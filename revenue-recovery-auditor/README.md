# Revenue Recovery Auditor

A multi-agent system built in Go that monitors Stripe webhooks for failed payments, investigates user activity, and autonomously executes recovery workflows ranging from soft nudges to win-back offers.

## Architecture

```
┌──────────────────────────────────────────────────────────────────────────┐
│                         EXTERNAL EVENTS                                  │
│            (Stripe Webhooks, CRM Updates, User Actions)                  │
└─────────────────────────────────┬────────────────────────────────────────┘
                                  │  invoice.payment_failed
                                  ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                      WEBHOOK HANDLER (Gin Gonic)                         │
│                                                                          │
│  POST /webhooks/stripe    — receive Stripe events                        │
│  GET  /dashboard          — recovery metrics                             │
│  GET  /users/:id/status   — user investigation summary                   │
└─────────────────────────────────┬────────────────────────────────────────┘
                                  │  publish to NATS "payment.failed"
                                  ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                       EVENT BUS (NATS Streaming)                         │
│                                                                          │
│  "payment.failed" ──▶ Redis dedup check ──▶ Temporal Workflow            │
│                                                    │                     │
│                              ┌─────────────────────┤                     │
│                              ▼                     ▼                     │
│                     ┌──────────────┐      ┌──────────────┐              │
│                     │  PostgreSQL  │      │  USER INVEST  │              │
│                     │  User Query  │      │  AGENT        │              │
│                     │              │      │               │              │
│                     │  last_login  │      │  login recency│              │
│                     │  features    │      │  feature usage │              │
│                     │  plan tier   │      │  payment hist  │              │
│                     └──────┬───────┘      └──────┬───────┘              │
│                            └──────────┬──────────┘                      │
│                                       │                                  │
│                            ┌──────────┼──────────┐                      │
│                            ▼                     ▼                      │
│                     User is ACTIVE          User is INACTIVE            │
│                     ┌─────────────┐         ┌──────────────┐            │
│                     │ SOFT NUDGE  │         │  WIN-BACK    │            │
│                     │ Slack + Email│         │  OFFER       │            │
│                     │ update link  │         │  or feedback │            │
│                     └──────┬──────┘         └──────┬───────┘            │
│                            └──────────┬────────────┘                    │
│                                       ▼                                  │
│                              ┌──────────────┐                           │
│                              │ AWAIT REPLY  │                           │
│                              │ (Temporal)   │                           │
│                              └──────┬───────┘                           │
│                                     │                                    │
│                          ┌──────────┼──────────┐                        │
│                          ▼          ▼          ▼                        │
│                     "Updated"  "Cancel"   No Response                   │
│                     ┌────────┐ ┌────────┐ ┌──────────┐                 │
│                     │ CLOSE  │ │ STRIPE │ │ ESCALATE │                 │
│                     │ CASE   │ │ CANCEL │ │ TO HUMAN │                 │
│                     └────────┘ │ + CRM  │ └──────────┘                 │
│                                └────────┘                               │
└──────────────────────────────────────────────────────────────────────────┘
```

## Tech Stack

| Component | Technology | Purpose |
|-----------|-----------|---------|
| Language | Go (Golang) | High-performance concurrent processing |
| HTTP Framework | Gin Gonic | Low-latency REST API and webhook handling |
| Database | PostgreSQL | User activity, subscription, and CRM data |
| Cache | Redis | Event deduplication and session state |
| Orchestration | Temporal.io | Reliable long-running recovery workflows |
| Messaging | NATS | Event-driven pub/sub communication |
| Payments | Stripe SDK | Subscription management and cancellation |
| Notifications | Slack Web API | User outreach and team alerts |

## Quick Start

```bash
go run main.go
```

The server starts on `:8080` by default. Configure Stripe webhook signing secret and NATS connection via environment variables.

## API Examples

### Receive a Stripe webhook
```bash
curl -X POST http://localhost:8080/webhooks/stripe \
  -H "Content-Type: application/json" \
  -H "Stripe-Signature: t=...,v1=..." \
  -d '{"type": "invoice.payment_failed", "data": {"object": {"customer": "cus_abc123"}}}'
```

### Check user recovery status
```bash
curl http://localhost:8080/users/cus_abc123/status
```

### View recovery dashboard metrics
```bash
curl http://localhost:8080/dashboard
```

## Design Decisions

- **Temporal for durability**: Recovery workflows can span days (waiting for user replies). Temporal ensures workflows survive process restarts and retries without duplicating outreach.
- **NATS over Kafka**: For the expected throughput of payment failure events, NATS provides simpler operations with sufficient durability via JetStream.
- **Redis deduplication**: Stripe can deliver the same webhook multiple times. Redis TTL keys prevent duplicate workflow starts for the same invoice.
- **Active/inactive branching**: The investigation agent checks real usage data before choosing a recovery strategy, avoiding tone-deaf win-back emails to daily active users who just have an expired card.
