# Model Router & Budget Sentinel

A cost-aware proxy that classifies prompt complexity, checks a semantic cache, routes requests to the optimal LLM provider, and enforces monthly budget guardrails with automatic fallback to local models.

## Architecture

```
┌──────────────────────────────────────────────────────────────────────────┐
│                       INCOMING REQUEST                                   │
│                (Any application using the proxy)                         │
└─────────────────────────────────┬────────────────────────────────────────┘
                                  │  POST /v1/chat/completions
                                  ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                    HONO EDGE API (Vercel)                                 │
│                                                                          │
│  POST /v1/chat/completions  — unified LLM endpoint                       │
│  GET  /v1/budget            — current spend and limits                   │
│  GET  /v1/cache/stats       — cache hit rate metrics                     │
│                                                                          │
│  ┌───────────────────────────────────────────────────────────────┐      │
│  │  STEP 1: COMPLEXITY CLASSIFIER                                │      │
│  │                                                               │      │
│  │  Analyze prompt:                                              │      │
│  │    Token count estimate                                       │      │
│  │    Task difficulty (summarize vs. reason vs. code)            │      │
│  │    Context window needed                                      │      │
│  │                                                               │      │
│  │  Output: SIMPLE | MODERATE | COMPLEX                          │      │
│  └───────────────────────────────┬───────────────────────────────┘      │
│                                  │                                       │
│                                  ▼                                       │
│  ┌───────────────────────────────────────────────────────────────┐      │
│  │  STEP 2: SEMANTIC CACHE (Redis Vector Search)                 │      │
│  │                                                               │      │
│  │  Embed the prompt ──▶ cosine similarity search                │      │
│  │                                                               │      │
│  │  ┌──────────┐        ┌──────────┐                            │      │
│  │  │ HIT      │        │ MISS     │                            │      │
│  │  │ sim>0.95 │        │ sim<0.95 │                            │      │
│  │  │          │        │          │                            │      │
│  │  │ Return   │        │ Continue │                            │      │
│  │  │ cached   │        │ to       │                            │      │
│  │  │ (cost $0)│        │ routing  │                            │      │
│  │  └──────────┘        └────┬─────┘                            │      │
│  └───────────────────────────┼───────────────────────────────────┘      │
│                              │                                           │
│                              ▼                                           │
│  ┌───────────────────────────────────────────────────────────────┐      │
│  │  STEP 3: BUDGET CHECK                                         │      │
│  │                                                               │      │
│  │  Aggregate monthly spend across all providers                 │      │
│  │                                                               │      │
│  │  ┌────────────┐           ┌────────────┐                     │      │
│  │  │ UNDER      │           │ OVER       │                     │      │
│  │  │ BUDGET     │           │ BUDGET     │                     │      │
│  │  │            │           │            │                     │      │
│  │  │ Route      │           │ Fallback   │                     │      │
│  │  │ normally   │           │ to Ollama  │                     │      │
│  │  └─────┬──────┘           │ local or   │                     │      │
│  │        │                  │ "degraded" │                     │      │
│  │        │                  └────────────┘                     │      │
│  └────────┼──────────────────────────────────────────────────────┘      │
│           │                                                              │
│           ▼                                                              │
│  ┌───────────────────────────────────────────────────────────────┐      │
│  │  STEP 4: DYNAMIC ROUTING (LiteLLM)                            │      │
│  │                                                               │      │
│  │  SIMPLE ──────▶ Gemma 2B / Llama 3 8B (Groq / Fireworks)    │      │
│  │  MODERATE ────▶ Claude 3.5 Sonnet / GPT-4o-mini              │      │
│  │  COMPLEX ─────▶ Claude 3.5 Sonnet / GPT-4o                   │      │
│  └───────────────────────────┬───────────────────────────────────┘      │
│                              │                                           │
│                              ▼                                           │
│                    ┌───────────────────┐     ┌───────────────────┐      │
│                    │  Response         │     │  Helicone /       │      │
│                    │  + cache store    │     │  Portkey           │      │
│                    │  + budget update  │     │  (monitoring)      │      │
│                    └───────────────────┘     └───────────────────┘      │
└──────────────────────────────────────────────────────────────────────────┘
```

## Tech Stack

| Component | Technology | Purpose |
|-----------|-----------|---------|
| Language | Node.js / TypeScript | Edge-compatible runtime |
| HTTP Framework | Hono | Ultra-lightweight edge-first web framework |
| Routing | LiteLLM | Unified API across 100+ LLM providers |
| Caching | Redis (Vector Search) | Semantic similarity cache for repeated queries |
| Monitoring | Helicone / Portkey | Cost tracking and latency observability |
| Deployment | Vercel Edge Functions | Global low-latency distribution |
| Fallback | Ollama | Local model for budget-exceeded scenarios |

## Quick Start

```bash
cd model-router-sentinel
npm install
npm run dev
```

Configure provider keys and budget:

```bash
export OPENAI_API_KEY=...
export ANTHROPIC_API_KEY=...
export GROQ_API_KEY=...
export REDIS_URL=redis://localhost:6379
export MONTHLY_BUDGET_USD=500
```

## API Examples

### Send a request through the router
```bash
curl -X POST http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-proxy-key" \
  -d '{"messages": [{"role": "user", "content": "Summarize this article..."}]}'
```

### Check budget status
```bash
curl http://localhost:3000/v1/budget \
  -H "Authorization: Bearer your-proxy-key"
```

### View cache statistics
```bash
curl http://localhost:3000/v1/cache/stats
```

## Design Decisions

- **Hono on Vercel Edge**: Sub-millisecond cold starts and global distribution ensure the routing proxy adds negligible latency to LLM requests.
- **Semantic cache over exact match**: Users often rephrase the same question. Vector similarity at 0.95 threshold catches these near-duplicates and avoids redundant LLM calls.
- **LiteLLM abstraction**: A single `completion()` call works across OpenAI, Anthropic, Groq, and Fireworks, making it trivial to add or remove providers.
- **Graceful degradation**: When the budget is exceeded, traffic falls back to a local Ollama model rather than returning errors, maintaining service availability at reduced quality.
