# Agentic Customer Support

An AI support agent that doesn't just chat — it **resolves** customer problems by querying databases, searching knowledge bases, processing refunds, and escalating to humans when needed.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        CLIENT (REST API)                            │
│                    POST /chat { message, sessionId }                │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         HONO SERVER                                 │
│                                                                     │
│  ┌─────────────┐    ┌──────────────────┐    ┌───────────────────┐  │
│  │   Request    │───▶│  Conversation    │───▶│   Vercel AI SDK   │  │
│  │  Validation  │    │  History Loader  │    │   generateText()  │  │
│  │   (Zod)     │    │   (SQLite)       │    │                   │  │
│  └─────────────┘    └──────────────────┘    └────────┬──────────┘  │
│                                                       │             │
│                              ┌────────────────────────┘             │
│                              │  Tool-Use Loop (max 8 steps)        │
│                              ▼                                      │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                     TOOL REGISTRY                             │  │
│  │                                                               │  │
│  │  ┌──────────────┐  ┌─────────────────┐  ┌────────────────┐  │  │
│  │  │ get_order    │  │ search_knowledge │  │ trigger_refund │  │  │
│  │  │ _status      │  │ _base            │  │                │  │  │
│  │  │              │  │                  │  │  >$500 ──▶ ESC │  │  │
│  │  │ by ID or     │  │ policies, FAQs,  │  │  <$500 ──▶ OK  │  │  │
│  │  │ email lookup │  │ troubleshooting  │  │                │  │  │
│  │  └──────┬───────┘  └────────┬─────────┘  └───────┬────────┘  │  │
│  │         │                   │                     │           │  │
│  │  ┌──────────────┐  ┌─────────────────┐                       │  │
│  │  │ create_ticket│  │ escalate_to     │                       │  │
│  │  │              │  │ _human          │                       │  │
│  │  │ track issues │  │                 │                       │  │
│  │  │ w/ priority  │  │ frustrated user │                       │  │
│  │  └──────┬───────┘  │ high-value txn  │                       │  │
│  │         │          │ unresolvable    │                       │  │
│  │         │          └────────┬────────┘                       │  │
│  └─────────┼───────────────────┼────────────────────────────────┘  │
│            │                   │                                    │
└────────────┼───────────────────┼────────────────────────────────────┘
             │                   │
             ▼                   ▼
┌────────────────────┐  ┌────────────────────┐
│   SQLite (Turso)   │  │   Human Agent      │
│                    │  │   Queue             │
│  • orders          │  │                    │
│  • tickets         │  │  ETA: 15 min       │
│  • conversations   │  │  during biz hours  │
│  • knowledge_base  │  │                    │
└────────────────────┘  └────────────────────┘
```

## Agent Decision Flow

```
Customer Message
       │
       ▼
┌──────────────┐     ┌──────────────────┐
│ Is it about  │────▶│ search_knowledge │
│ a policy?    │ yes │ _base            │
└──────┬───────┘     └──────────────────┘
       │ no
       ▼
┌──────────────┐     ┌──────────────────┐
│ References   │────▶│ get_order_status │
│ an order?    │ yes │                  │
└──────┬───────┘     └────────┬─────────┘
       │                      │
       │               ┌──────▼──────┐     ┌────────────────┐
       │               │ Wants       │────▶│ trigger_refund │
       │               │ refund?     │ yes │                │
       │               └──────┬──────┘     └────────┬───────┘
       │                      │                     │
       │                      │              ┌──────▼──────┐
       │                      │              │ Amount      │──▶ escalate
       │                      │              │ > $500?     │    _to_human
       │                      │              └─────────────┘
       │                      │
       ▼                      ▼
┌──────────────┐     ┌──────────────────┐
│ Frustrated   │────▶│ escalate_to      │
│ or wants     │ yes │ _human           │
│ human?       │     └──────────────────┘
└──────┬───────┘
       │ no
       ▼
  Respond directly
```

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Runtime | Hono | Edge-ready HTTP server |
| AI | Vercel AI SDK + Claude Sonnet | Tool-use orchestration |
| Database | Drizzle ORM + libSQL/Turso | Orders, tickets, conversations |
| Validation | Zod | Request/tool parameter schemas |
| Knowledge | SQLite full-text search | Policy & FAQ retrieval |

## Project Structure

```
src/
├── index.ts          # Hono server, /chat endpoint, conversation loop
├── tools.ts          # 5 tool definitions with DB-backed execution
└── db/
    ├── schema.ts     # Drizzle schema: orders, tickets, conversations, knowledge_base
    └── seed.ts       # Sample data: 5 orders, 5 KB articles
```

## Quick Start

```bash
# Install dependencies
npm install

# Seed the database with sample data
npx tsx src/db/seed.ts

# Start the dev server
npm run dev
```

## API

### `POST /chat`

```json
{
  "message": "Where is my order ORD-1001?",
  "sessionId": "optional-session-id"
}
```

Response:
```json
{
  "sessionId": "ses_abc123",
  "response": "Your order ORD-1001 (Agentic AI Hoodie) has been shipped! Tracking number: TRK-998877.",
  "toolCalls": [...],
  "steps": 2
}
```

### `GET /sessions/:id`

Returns the full conversation history for a session.

### `GET /health`

Health check endpoint.

## Key Design Decisions

- **Multi-turn memory**: Conversations are persisted to SQLite and reloaded per session, giving the agent full context across messages.
- **Guardrailed refunds**: Refunds over $500 are auto-escalated — the agent cannot approve them alone.
- **Knowledge-first**: The system prompt instructs the agent to search the KB *before* answering policy questions, reducing hallucination.
- **Tool-use loop**: `maxSteps: 8` allows the agent to chain multiple tool calls (e.g., look up order → check policy → process refund) in a single turn.
- **Human escalation**: Explicit tool for handoff — not just a message, but a DB state change that a real ticketing system could consume.
