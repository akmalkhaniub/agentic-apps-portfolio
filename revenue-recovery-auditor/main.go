package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"math/rand"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"sync"
	"syscall"
	"time"
)

type InvoiceStatus string

const (
	InvoiceOpen     InvoiceStatus = "open"
	InvoicePaid     InvoiceStatus = "paid"
	InvoiceVoid     InvoiceStatus = "void"
	InvoiceUncollec InvoiceStatus = "uncollectible"
)

type WorkflowState string

const (
	StatePending     WorkflowState = "pending"
	StateRetrying    WorkflowState = "retrying"
	StateNotified    WorkflowState = "notified"
	StateGracePeriod WorkflowState = "grace_period"
	StateRecovered   WorkflowState = "recovered"
	StateWrittenOff  WorkflowState = "written_off"
)

type Invoice struct {
	ID            string        `json:"id"`
	CustomerID    string        `json:"customer_id"`
	AmountCents   int           `json:"amount_cents"`
	Currency      string        `json:"currency"`
	Status        InvoiceStatus `json:"status"`
	FailureReason string        `json:"failure_reason,omitempty"`
	CreatedAt     time.Time     `json:"created_at"`
	UpdatedAt     time.Time     `json:"updated_at"`
}

type PaymentAttempt struct {
	ID        string    `json:"id"`
	InvoiceID string    `json:"invoice_id"`
	Success   bool      `json:"success"`
	Error     string    `json:"error,omitempty"`
	AttemptAt time.Time `json:"attempt_at"`
}

type DunningStep struct {
	Action      string        `json:"action"`
	Description string        `json:"description"`
	Delay       time.Duration `json:"-"`
	DelayStr    string        `json:"delay"`
}

type RecoveryWorkflow struct {
	ID              string           `json:"id"`
	InvoiceID       string           `json:"invoice_id"`
	State           WorkflowState    `json:"state"`
	CurrentStep     int              `json:"current_step"`
	Attempts        []PaymentAttempt `json:"attempts"`
	CreatedAt       time.Time        `json:"created_at"`
	UpdatedAt       time.Time        `json:"updated_at"`
	NextActionAt    time.Time        `json:"next_action_at"`
	StepsCompleted  []string         `json:"steps_completed"`
}

var dunningSequence = []DunningStep{
	{Action: "retry_payment", Description: "Automatic payment retry", Delay: 0, DelayStr: "immediate"},
	{Action: "email_reminder", Description: "Send payment failure email", Delay: 5 * time.Second, DelayStr: "5s"},
	{Action: "retry_payment_2", Description: "Second payment retry", Delay: 10 * time.Second, DelayStr: "10s"},
	{Action: "grace_period", Description: "Enter grace period", Delay: 15 * time.Second, DelayStr: "15s"},
	{Action: "escalate", Description: "Escalate — write off or final attempt", Delay: 20 * time.Second, DelayStr: "20s"},
}

type Store struct {
	mu        sync.RWMutex
	invoices  map[string]*Invoice
	workflows map[string]*RecoveryWorkflow
}

func NewStore() *Store {
	return &Store{
		invoices:  make(map[string]*Invoice),
		workflows: make(map[string]*RecoveryWorkflow),
	}
}

func (s *Store) CreateInvoice(inv *Invoice) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.invoices[inv.ID] = inv
}

func (s *Store) GetInvoice(id string) (*Invoice, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	inv, ok := s.invoices[id]
	return inv, ok
}

func (s *Store) ListInvoices() []*Invoice {
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := make([]*Invoice, 0, len(s.invoices))
	for _, inv := range s.invoices {
		out = append(out, inv)
	}
	return out
}

func (s *Store) CreateWorkflow(wf *RecoveryWorkflow) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.workflows[wf.ID] = wf
}

func (s *Store) GetWorkflow(id string) (*RecoveryWorkflow, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	wf, ok := s.workflows[id]
	return wf, ok
}

func (s *Store) ListWorkflows() []*RecoveryWorkflow {
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := make([]*RecoveryWorkflow, 0, len(s.workflows))
	for _, wf := range s.workflows {
		out = append(out, wf)
	}
	return out
}

func (s *Store) ActiveWorkflows() []*RecoveryWorkflow {
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := make([]*RecoveryWorkflow, 0)
	for _, wf := range s.workflows {
		if wf.State != StateRecovered && wf.State != StateWrittenOff {
			out = append(out, wf)
		}
	}
	return out
}

func genID(prefix string) string {
	return fmt.Sprintf("%s_%d", prefix, rand.Int63n(1e12))
}

type Server struct {
	store *Store
	mux   *http.ServeMux
}

func NewServer(store *Store) *Server {
	s := &Server{store: store, mux: http.NewServeMux()}
	s.mux.HandleFunc("GET /health", s.handleHealth)
	s.mux.HandleFunc("POST /invoices", s.handleCreateInvoice)
	s.mux.HandleFunc("GET /invoices", s.handleListInvoices)
	s.mux.HandleFunc("POST /invoices/{id}/recover", s.handleStartRecovery)
	s.mux.HandleFunc("GET /workflows", s.handleListWorkflows)
	s.mux.HandleFunc("GET /workflows/{id}", s.handleGetWorkflow)
	s.mux.HandleFunc("POST /webhooks/stripe", s.handleStripeWebhook)
	return s
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v)
}

func (s *Server) handleHealth(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func (s *Server) handleCreateInvoice(w http.ResponseWriter, r *http.Request) {
	var req struct {
		CustomerID    string `json:"customer_id"`
		AmountCents   int    `json:"amount_cents"`
		Currency      string `json:"currency"`
		FailureReason string `json:"failure_reason"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid json"})
		return
	}
	if req.CustomerID == "" || req.AmountCents <= 0 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "customer_id and amount_cents > 0 required"})
		return
	}
	if req.Currency == "" {
		req.Currency = "usd"
	}
	now := time.Now()
	inv := &Invoice{
		ID:            genID("inv"),
		CustomerID:    req.CustomerID,
		AmountCents:   req.AmountCents,
		Currency:      req.Currency,
		Status:        InvoiceOpen,
		FailureReason: req.FailureReason,
		CreatedAt:     now,
		UpdatedAt:     now,
	}
	s.store.CreateInvoice(inv)
	writeJSON(w, http.StatusCreated, inv)
}

func (s *Server) handleListInvoices(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, s.store.ListInvoices())
}

func (s *Server) handleStartRecovery(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	inv, ok := s.store.GetInvoice(id)
	if !ok {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "invoice not found"})
		return
	}
	if inv.Status == InvoicePaid {
		writeJSON(w, http.StatusConflict, map[string]string{"error": "invoice already paid"})
		return
	}

	for _, wf := range s.store.ActiveWorkflows() {
		if wf.InvoiceID == id {
			writeJSON(w, http.StatusConflict, map[string]string{"error": "recovery already active", "workflow_id": wf.ID})
			return
		}
	}

	now := time.Now()
	wf := &RecoveryWorkflow{
		ID:             genID("wf"),
		InvoiceID:      id,
		State:          StatePending,
		CurrentStep:    0,
		Attempts:       []PaymentAttempt{},
		CreatedAt:      now,
		UpdatedAt:      now,
		NextActionAt:   now,
		StepsCompleted: []string{},
	}
	s.store.CreateWorkflow(wf)
	writeJSON(w, http.StatusCreated, wf)
}

func (s *Server) handleListWorkflows(w http.ResponseWriter, r *http.Request) {
	active := r.URL.Query().Get("active")
	if active == "true" {
		writeJSON(w, http.StatusOK, s.store.ActiveWorkflows())
		return
	}
	writeJSON(w, http.StatusOK, s.store.ListWorkflows())
}

func (s *Server) handleGetWorkflow(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	wf, ok := s.store.GetWorkflow(id)
	if !ok {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "workflow not found"})
		return
	}
	writeJSON(w, http.StatusOK, wf)
}

func (s *Server) handleStripeWebhook(w http.ResponseWriter, r *http.Request) {
	var payload struct {
		Type string `json:"type"`
		Data struct {
			Object struct {
				ID         string `json:"id"`
				Customer   string `json:"customer"`
				AmountDue  int    `json:"amount_due"`
				Currency   string `json:"currency"`
			} `json:"object"`
		} `json:"data"`
	}
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid json"})
		return
	}
	if payload.Type != "invoice.payment_failed" {
		writeJSON(w, http.StatusOK, map[string]string{"status": "ignored", "type": payload.Type})
		return
	}

	now := time.Now()
	invID := payload.Data.Object.ID
	if invID == "" {
		invID = genID("inv")
	}
	inv := &Invoice{
		ID:            invID,
		CustomerID:    payload.Data.Object.Customer,
		AmountCents:   payload.Data.Object.AmountDue,
		Currency:      payload.Data.Object.Currency,
		Status:        InvoiceOpen,
		FailureReason: "payment_failed via webhook",
		CreatedAt:     now,
		UpdatedAt:     now,
	}
	if inv.Currency == "" {
		inv.Currency = "usd"
	}
	s.store.CreateInvoice(inv)

	wf := &RecoveryWorkflow{
		ID:             genID("wf"),
		InvoiceID:      inv.ID,
		State:          StatePending,
		CurrentStep:    0,
		Attempts:       []PaymentAttempt{},
		CreatedAt:      now,
		UpdatedAt:      now,
		NextActionAt:   now,
		StepsCompleted: []string{},
	}
	s.store.CreateWorkflow(wf)

	writeJSON(w, http.StatusCreated, map[string]any{
		"status":      "recovery_started",
		"invoice_id":  inv.ID,
		"workflow_id": wf.ID,
	})
}

func simulatePaymentRetry(inv *Invoice) PaymentAttempt {
	success := rand.Float64() < 0.3
	attempt := PaymentAttempt{
		ID:        genID("pa"),
		InvoiceID: inv.ID,
		Success:   success,
		AttemptAt: time.Now(),
	}
	if !success {
		attempt.Error = "card_declined"
	}
	return attempt
}

func runDunningLoop(ctx context.Context, store *Store) {
	ticker := time.NewTicker(2 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			log.Println("Dunning loop shutting down")
			return
		case <-ticker.C:
			processWorkflows(store)
		}
	}
}

func processWorkflows(store *Store) {
	store.mu.Lock()
	defer store.mu.Unlock()

	now := time.Now()
	for _, wf := range store.workflows {
		if wf.State == StateRecovered || wf.State == StateWrittenOff {
			continue
		}
		if now.Before(wf.NextActionAt) {
			continue
		}
		if wf.CurrentStep >= len(dunningSequence) {
			wf.State = StateWrittenOff
			wf.UpdatedAt = now
			if inv, ok := store.invoices[wf.InvoiceID]; ok {
				inv.Status = InvoiceUncollec
				inv.UpdatedAt = now
			}
			log.Printf("[workflow %s] written off", wf.ID)
			continue
		}

		step := dunningSequence[wf.CurrentStep]
		inv := store.invoices[wf.InvoiceID]
		if inv == nil {
			continue
		}

		log.Printf("[workflow %s] executing step %d: %s", wf.ID, wf.CurrentStep, step.Action)

		switch {
		case strings.HasPrefix(step.Action, "retry_payment"):
			wf.State = StateRetrying
			attempt := simulatePaymentRetry(inv)
			wf.Attempts = append(wf.Attempts, attempt)
			if attempt.Success {
				wf.State = StateRecovered
				inv.Status = InvoicePaid
				inv.UpdatedAt = now
				wf.UpdatedAt = now
				wf.StepsCompleted = append(wf.StepsCompleted, step.Action+" (success)")
				log.Printf("[workflow %s] payment recovered!", wf.ID)
				continue
			}
			wf.StepsCompleted = append(wf.StepsCompleted, step.Action+" (failed)")

		case step.Action == "email_reminder":
			wf.State = StateNotified
			wf.StepsCompleted = append(wf.StepsCompleted, "email_reminder sent")
			log.Printf("[workflow %s] email reminder sent to customer %s", wf.ID, inv.CustomerID)

		case step.Action == "grace_period":
			wf.State = StateGracePeriod
			wf.StepsCompleted = append(wf.StepsCompleted, "grace_period started")
			log.Printf("[workflow %s] grace period started", wf.ID)

		case step.Action == "escalate":
			finalAttempt := simulatePaymentRetry(inv)
			wf.Attempts = append(wf.Attempts, finalAttempt)
			if finalAttempt.Success {
				wf.State = StateRecovered
				inv.Status = InvoicePaid
				inv.UpdatedAt = now
				wf.StepsCompleted = append(wf.StepsCompleted, "escalate (recovered)")
				log.Printf("[workflow %s] recovered on final attempt!", wf.ID)
			} else {
				wf.State = StateWrittenOff
				inv.Status = InvoiceUncollec
				inv.UpdatedAt = now
				wf.StepsCompleted = append(wf.StepsCompleted, "escalate (written_off)")
				log.Printf("[workflow %s] written off after escalation", wf.ID)
			}
			wf.UpdatedAt = now
			continue
		}

		wf.CurrentStep++
		if wf.CurrentStep < len(dunningSequence) {
			wf.NextActionAt = now.Add(dunningSequence[wf.CurrentStep].Delay)
		}
		wf.UpdatedAt = now
	}
}

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	store := NewStore()
	srv := NewServer(store)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	go runDunningLoop(ctx, store)

	httpServer := &http.Server{
		Addr:    ":" + port,
		Handler: srv.mux,
	}

	go func() {
		sigCh := make(chan os.Signal, 1)
		signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)
		<-sigCh
		log.Println("Shutting down...")
		cancel()
		shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer shutdownCancel()
		httpServer.Shutdown(shutdownCtx)
	}()

	log.Printf("Revenue Recovery Auditor starting on :%s", port)
	if err := httpServer.ListenAndServe(); err != http.ErrServerClosed {
		log.Fatalf("Server error: %v", err)
	}
	log.Println("Server stopped")
}
