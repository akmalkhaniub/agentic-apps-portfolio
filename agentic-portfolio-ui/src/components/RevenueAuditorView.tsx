import { useState } from 'react';
import { DollarSign, Clock, RefreshCw, AlertCircle, Play, Activity } from 'lucide-react';
import { API_ENDPOINTS } from '../config';
import { useInspector } from '../context/InspectorContext';

interface AuditInvoice {
  id: string;
  customerEmail: string;
  amount: number;
  currency: string;
  status: 'pending' | 'retrying' | 'notified' | 'grace_period' | 'recovered' | 'written_off';
  failureReason: string;
  retryCount: number;
  nextAttempt: string;
  history: string[];
}

export default function RevenueAuditorView() {
  const { setIsOpen, addTrace } = useInspector();
  const [customerEmail, setCustomerEmail] = useState("billing@startup.io");
  const [amount, setAmount] = useState(499);
  const [currency, setCurrency] = useState("USD");
  const [failureReason, setFailureReason] = useState("card_declined_insufficient_funds");
  const [isLoading, setIsLoading] = useState(false);
  const [invoices, setInvoices] = useState<AuditInvoice[]>([
    {
      id: "inv_rev_9012",
      customerEmail: "finance@enterprise.co",
      amount: 2450,
      currency: "USD",
      status: "grace_period",
      failureReason: "card_expired",
      retryCount: 2,
      nextAttempt: "In 4 hours",
      history: [
        "2026-05-20 08:00 - Failed Stripe charge: card_expired",
        "2026-05-20 08:01 - Retried payment, failed.",
        "2026-05-20 09:00 - Dispatched Email Notification #1 to customer"
      ]
    },
    {
      id: "inv_rev_8811",
      customerEmail: "owner@retailstore.com",
      amount: 120,
      currency: "USD",
      status: "recovered",
      failureReason: "card_declined_temporary",
      retryCount: 1,
      nextAttempt: "Completed",
      history: [
        "2026-05-20 04:00 - Failed Stripe charge: card_declined_temporary",
        "2026-05-20 12:00 - Auto-retry successful. Funds recovered."
      ]
    }
  ]);

  const fetchWorkflows = async () => {
    try {
      const response = await fetch(`${API_ENDPOINTS.revenueAuditor}/workflows`);
      if (!response.ok) return;
      const data = await response.json();
      
      const mappedInvoices: AuditInvoice[] = data.map((wf: any) => ({
        id: wf.invoice_id,
        customerEmail: "customer@example.com", // Go backend stores customer_id
        amount: 0, // In full implementation, we'd GET /invoices to map these
        currency: "USD",
        status: wf.state === 'pending' ? 'pending' :
                wf.state === 'retrying' ? 'retrying' :
                wf.state === 'notified' ? 'notified' :
                wf.state === 'grace_period' ? 'grace_period' :
                wf.state === 'recovered' ? 'recovered' : 'written_off',
        failureReason: "backend_failure",
        retryCount: wf.attempts ? wf.attempts.length : 0,
        nextAttempt: wf.state === 'recovered' || wf.state === 'written_off' ? "Completed" : new Date(wf.next_action_at).toLocaleTimeString(),
        history: wf.steps_completed || []
      }));
      setInvoices(mappedInvoices);
    } catch (err) {
      console.warn("Offline");
    }
  };

  const handleCreateWorkflow = async () => {
    addTrace({ source: 'RevenueAuditorView', type: 'log', content: 'Execution started...' });
    setIsLoading(true);
    try {
      // 1. Create Invoice
      const invRes = await fetch(`${API_ENDPOINTS.revenueAuditor}/invoices`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customer_id: customerEmail, amount_cents: amount * 100, currency, failure_reason: failureReason })
      });
      if (!invRes.ok) throw new Error("Offline");
      const invData = await invRes.json();

      // 2. Start Recovery
      await fetch(`${API_ENDPOINTS.revenueAuditor}/invoices/${invData.id}/recover`, {
        method: 'POST'
      });

      await fetchWorkflows();
    } catch (err) {
      console.warn("Backend offline. Simulating recovery state machine workflow.");
      // Fallback
      const invoiceId = `inv_rev_${Math.floor(1000 + Math.random() * 9000)}`;
      const newInvoice: AuditInvoice = {
        id: invoiceId,
        customerEmail,
        amount,
        currency,
        status: 'pending',
        failureReason,
        retryCount: 0,
        nextAttempt: "Immediate Retry",
        history: [`${new Date().toISOString().replace('T', ' ').substring(0, 16)} - Ingested failed invoice (${failureReason})`]
      };
      setInvoices(prev => [newInvoice, ...prev]);
    }
    setIsLoading(false);
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'recovered': return 'success';
      case 'written_off': return 'danger';
      case 'pending': return 'primary';
      case 'retrying': return 'warning';
      case 'notified': return 'secondary';
      case 'grace_period': return 'tertiary';
      default: return 'muted';
    }
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
      {/* Dev Mode Banner */}
      <div className="dev-mode-banner">
        <span className="dev-mode-banner-badge">Pending</span>
        <span>Running in Local Development Mode — Listening on port 8082</span>
      </div>

      <div className="view-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 className="view-title">
            <DollarSign size={32} color="var(--success)" />
            Revenue Recovery Auditor
          </h1>
          <p className="view-subtitle">Automated dunning engine for resolving payment failure and optimizing accounts receivable</p>
          <div className="pattern-badges-container">
            <span className="pattern-badge">Long-running Workflows</span>
          </div>
        </div>
        <button className="btn-ghost" onClick={() => setIsOpen(true)}>
          <Activity size={16} color="var(--accent-secondary)" />
          Inspect Agent Traces
        </button>
      </div>

      {/* Control Actions bar */}
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'flex-end' }}>
        <button className="btn-ghost" onClick={fetchWorkflows} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <RefreshCw size={14} color="var(--accent-secondary)" /> Refresh Recovery Board
        </button>
      </div>

      <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: 24 }}>
        {/* Invoice Simulator Form */}
        <div className="glass content-block">
          <h3>
            <AlertCircle size={18} color="var(--accent-secondary)" />
            Trigger Failed Invoice Webhook
          </h3>
          <div className="input-group">
            <label htmlFor="cust-email">Customer Email</label>
            <input id="cust-email" type="email" value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div className="input-group">
              <label htmlFor="inv-amount">Invoice Amount</label>
              <input id="inv-amount" type="number" value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
            </div>
            <div className="input-group">
              <label htmlFor="inv-currency">Currency</label>
              <input id="inv-currency" type="text" value={currency} onChange={(e) => setCurrency(e.target.value)} />
            </div>
          </div>
          <div className="input-group">
            <label htmlFor="fail-reason">Failure Code / Reason</label>
            <select id="fail-reason" value={failureReason} onChange={(e) => setFailureReason(e.target.value)}>
              <option value="card_declined_insufficient_funds">Insufficient Funds (card_declined)</option>
              <option value="card_expired">Card Expired (card_expired)</option>
              <option value="payment_method_restricted">Restricted Card (restricted)</option>
              <option value="incorrect_cvc">Incorrect CVC (incorrect_cvc)</option>
            </select>
          </div>

          <button className="btn" onClick={handleCreateWorkflow} disabled={isLoading} style={{ width: '100%', marginTop: 12 }}>
            {isLoading ? <RefreshCw className="spin" size={16} /> : <DollarSign size={16} />}
            {isLoading ? 'Ingesting Webhook...' : 'Simulate Payment Failure'}
          </button>
        </div>

        {/* Workflow State Machine View */}
        <div className="glass content-block" style={{ display: 'flex', flexDirection: 'column' }}>
          <h3>Recovery Board Processes</h3>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 16, overflowY: 'auto', maxHeight: 420 }}>
            {invoices.length === 0 ? (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 200, color: 'var(--text-muted)' }}>
                <Clock size={48} style={{ opacity: 0.2, marginBottom: 12 }} />
                <p>No active dunning recovery workflows running.</p>
              </div>
            ) : (
              invoices.map((inv) => (
                <div key={inv.id} className="glass" style={{ padding: 16, borderLeft: `4px solid var(--border-highlight)` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <span style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>{inv.id.toUpperCase()}</span>
                    <span className={`badge ${getStatusBadgeClass(inv.status)}`}>
                      {inv.status.toUpperCase()}
                    </span>
                  </div>

                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginBottom: 10 }}>
                    <div><strong>Customer:</strong> {inv.customerEmail}</div>
                    <div><strong>Due Amount:</strong> ${inv.amount} {inv.currency}</div>
                    <div><strong>Attempts:</strong> {inv.retryCount}</div>
                    <div><strong>Next Action:</strong> {inv.nextAttempt}</div>
                  </div>

                  {/* History Logs */}
                  <div style={{ background: 'var(--code-bg)', padding: 10, borderRadius: 8, fontSize: '0.75rem', border: '1px solid var(--border-subtle)' }}>
                    <div style={{ fontWeight: 'bold', marginBottom: 4, color: 'var(--text-muted)' }}>Workflow Execution Log:</div>
                    <ul style={{ paddingLeft: 14, margin: 0, listStyleType: 'circle', display: 'flex', flexDirection: 'column', gap: 3 }}>
                      {inv.history.map((h, i) => (
                        <li key={i}>{h}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
