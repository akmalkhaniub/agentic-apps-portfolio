# Agentic Red-Teamer & Eval-Ops

A meta-agent that systematically attacks, tests, and scores other AI agents in the portfolio by generating adversarial prompts, executing them against target APIs, and producing quality scorecards.

## Architecture

```
┌──────────────────────────────────────────────────────────────────────────┐
│                       TARGET AGENT                                       │
│        (Any agent in the portfolio: App 1-12 API endpoint)               │
└──────────────────────────────────▲───────────────────────────────────────┘
                                   │  adversarial requests
                                   │
┌──────────────────────────────────┼───────────────────────────────────────┐
│                                  │                                       │
│  ┌───────────────────────────────┴───────────────────────────────┐      │
│  │                  TEST CASE GENERATOR                          │      │
│  │                                                               │      │
│  │  Input: target agent's system prompt                          │      │
│  │                                                               │      │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐      │      │
│  │  │ Jailbreak   │  │ Prompt      │  │ Edge Case       │      │      │
│  │  │ Attempts    │  │ Injections  │  │ Scenarios       │      │      │
│  │  │             │  │             │  │                  │      │      │
│  │  │ "Ignore     │  │ "System:    │  │ Empty input,    │      │      │
│  │  │  your       │  │  override   │  │ 100k tokens,    │      │      │
│  │  │  rules..."  │  │  safety..." │  │ unicode, etc.   │      │      │
│  │  └─────────────┘  └─────────────┘  └─────────────────┘      │      │
│  └───────────────────────────────┬───────────────────────────────┘      │
│                                  │  generated test suite                 │
│                                  ▼                                       │
│  ┌───────────────────────────────────────────────────────────────┐      │
│  │                  EXECUTION ENGINE                              │      │
│  │                                                               │      │
│  │  For each test case:                                          │      │
│  │    1. Send to target agent API                                │      │
│  │    2. Capture response                                        │      │
│  │    3. Log to LangSmith trace                                  │      │
│  └───────────────────────────────┬───────────────────────────────┘      │
│                                  │  responses collected                  │
│                                  ▼                                       │
│  ┌───────────────────────────────────────────────────────────────┐      │
│  │                  EVALUATION PIPELINE                           │      │
│  │                                                               │      │
│  │  ┌───────────────────┐  ┌──────────────┐  ┌──────────────┐  │      │
│  │  │  FAITHFULNESS     │  │  SAFETY      │  │  RELEVANCY   │  │      │
│  │  │  (Ragas)          │  │  (DeepEval)  │  │  (Ragas)     │  │      │
│  │  │                   │  │              │  │              │  │      │
│  │  │  Does response    │  │  Did it leak │  │  Is answer   │  │      │
│  │  │  match context?   │  │  system      │  │  actually    │  │      │
│  │  │                   │  │  prompt?     │  │  helpful?    │  │      │
│  │  │  Score: 0.0-1.0   │  │  Pass/Fail   │  │  Score: 0-1  │  │      │
│  │  └───────────────────┘  └──────────────┘  └──────────────┘  │      │
│  └───────────────────────────────┬───────────────────────────────┘      │
│                                  │                                       │
│                                  ▼                                       │
│  ┌───────────────────────────────────────────────────────────────┐      │
│  │                  SCORECARD GENERATOR                           │      │
│  │                                                               │      │
│  │  Output: Markdown / PDF report                                │      │
│  │                                                               │      │
│  │  ┌─────────────────────────────────────────────────────┐     │      │
│  │  │  Agent: Customer Support (App 5)                     │     │      │
│  │  │  Tests run: 147                                      │     │      │
│  │  │  Faithfulness: 0.92    Safety: PASS    Relevancy: 0.88│     │      │
│  │  │  Grade: B+                                           │     │      │
│  │  │  Issues: 3 prompt injection leaks found              │     │      │
│  │  └─────────────────────────────────────────────────────┘     │      │
│  └───────────────────────────────────────────────────────────────┘      │
│                                                                          │
│                  ┌───────────────────┐                                   │
│                  │  LangSmith        │                                   │
│                  │  Trace Dashboard  │                                   │
│                  │  (all test runs)  │                                   │
│                  └───────────────────┘                                   │
└──────────────────────────────────────────────────────────────────────────┘
```

## Tech Stack

| Component | Technology | Purpose |
|-----------|-----------|---------|
| Language | Python 3.12 | Rich evaluation and ML library ecosystem |
| RAG Metrics | Ragas | Faithfulness and relevancy scoring |
| Unit Testing | DeepEval | Safety and behavioral testing for LLM agents |
| Observability | LangSmith | Trace logging for every test run |
| Targeting | Custom API client | HTTP calls to App 1-12 endpoints |
| Reporting | Markdown / PDF generation | Quality scorecards with pass/fail grades |

## Quick Start

```bash
cd agentic-red-teamer
python -m venv venv
venv\Scripts\activate        # Windows
pip install -r requirements.txt
python run_eval.py --target app5 --suite full
```

Configure via environment variables:

```bash
export LANGSMITH_API_KEY=...
export TARGET_BASE_URL=http://localhost:8080
```

## API Examples

### Run a red-team evaluation
```bash
curl -X POST http://localhost:8000/evaluate \
  -H "Content-Type: application/json" \
  -d '{
    "target": "app5_customer_support",
    "test_suites": ["jailbreak", "prompt_injection", "edge_cases"],
    "num_cases": 50
  }'
```

### Get scorecard for a previous run
```bash
curl http://localhost:8000/scorecards/run_abc123
```

### List all evaluation runs
```bash
curl http://localhost:8000/scorecards
```

## Design Decisions

- **Ragas + DeepEval combination**: Ragas excels at RAG-specific metrics (faithfulness, context relevancy) while DeepEval provides assertion-style safety tests. Together they cover both quality and security.
- **LangSmith tracing**: Every adversarial prompt and response is traced, making it possible to replay and debug failures without re-running expensive evaluations.
- **System prompt ingestion**: The red-teamer reads each target's system prompt to generate contextually relevant attacks, not just generic jailbreak templates.
- **Scorecard grading**: A single letter grade (A-F) gives stakeholders an at-a-glance quality signal without requiring them to interpret raw metric values.
