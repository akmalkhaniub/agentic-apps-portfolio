# 🏛️ Enterprise Procurement Intelligence Agent

A production-grade multi-agent system for autonomous procurement analysis, vendor intelligence, and spend optimization — built on the exact stack demanded by senior AI Engineer roles.

> **Stack:** LangGraph · MCP (Model Context Protocol) · Pinecone · Vanna AI · AWS Bedrock (Claude) · Bedrock Guardrails · LangSmith · FastAPI · Streamlit · AWS CDK

---

## 🗺️ System Architecture

```mermaid
flowchart TB
    subgraph CLIENT["Client Layer"]
        A[/"REST Client\n(curl / SDK)"/]
        B[/"Streamlit UI\n(Annotation + Eval)"/]
    end

    subgraph API["FastAPI Service (SSE Streaming)"]
        C["JWT Auth Middleware"]
        D["Tier Detection\nINTERNAL / PARTNER / PUBLIC"]
        RL["Rate Limiter\n(slowapi · tier-aware RPM)"]
        E["Guardrail Middleware\n(pre-processing)"]
        F["Guardrail Middleware\n(post-processing)"]
    end

    subgraph BEDROCK_GUARD["AWS Bedrock Guardrails"]
        G["PII Masking / Block"]
        H["Topic Denial"]
        I["Grounding Check"]
    end

    subgraph LANGGRAPH["LangGraph Supervisor Graph (Message History)"]
        J["SupervisorAgent\n(Claude 3.5 Sonnet via Bedrock)\n+ Prompt Caching"]
        K["ResearcherAgent\n(RAG + Web Search)"]
        L["SQLAnalystAgent\n(Vanna AI + RDS)"]
        M["WriterAgent\n(Synthesis + Citations)"]
    end

    subgraph MCP_LAYER["MCP Integration Layer"]
        MCP_CLIENT["MCP Client\n(langchain-mcp-adapters)"]
        subgraph MCP["MCP Tool Server (FastMCP v1.0)"]
            N["search_docs tool"]
            O["search_web tool\n(Perplexity API)"]
            P["query_database tool"]
        end
    end

    subgraph DATA["Data Layer"]
        Q[("Pinecone\nVector DB")]
        R[("AWS RDS\nMySQL")]
        S[("AWS S3\nRaw Documents")]
    end

    subgraph OBS["Observability"]
        T["LangSmith Traces"]
        U["LLM-as-Judge Eval"]
    end

    A --> C
    B --> C
    C --> D --> RL --> E
    E --> BEDROCK_GUARD --> J
    J -->|"dispatch"| K
    J -->|"dispatch"| L
    J -->|"dispatch"| M
    K --> MCP_CLIENT
    L --> MCP_CLIENT
    MCP_CLIENT -->|"MCP Protocol\n(streamable-http)"| MCP
    N --> Q
    O -->|"Perplexity API"| Internet
    P --> R
    M --> F --> BEDROCK_GUARD
    J --> T
    T --> U
    S -->|"ingestion pipeline\n(indexer.py)"| Q
    Internet["🌐 Internet"]
```

---

## 🤖 Agent Topology (LangGraph StateGraph)

```mermaid
stateDiagram-v2
    [*] --> Supervisor : User Query + Message History

    state Supervisor {
        [*] --> ParseIntent : Analyse query
        ParseIntent --> Route : JSON routing decision
    }

    state "Iteration Guard (max=5)" as Guard {
        Supervisor --> Dispatch : iterations < max
        Supervisor --> Writer : iterations >= max
    }

    state Dispatch {
        [*] --> Researcher : needs docs/web
        [*] --> SQLAnalyst : needs structured data
        Researcher --> [*] : context_docs + messages
        SQLAnalyst --> [*] : sql_results + messages
    }

    Dispatch --> Supervisor : Return for re-routing
    Dispatch --> Writer : Guardrail triggered → short-circuit

    state Writer {
        [*] --> Synthesise : Merge evidence
        Synthesise --> Cite : Add source citations
        Cite --> Score : Confidence 0.0–1.0
    }

    Writer --> [*] : final_answer + citations

    note right of Supervisor
        Claude 3.5 Sonnet
        via ChatBedrockConverse
        with prompt caching
        + append-only message history
    end note
```

---

## 🔌 MCP Protocol Integration

```mermaid
flowchart LR
    subgraph AGENTS["Agent Layer (LangGraph)"]
        SUP["Supervisor"]
        RES["Researcher"]
        SQL["SQL Analyst"]
    end

    subgraph MCP_CLIENT_LAYER["MCP Client (langchain-mcp-adapters)"]
        CLIENT["MCPToolClient\n(singleton)"]
        TOOLS["LangChain StructuredTools\n(search_docs, search_web,\nquery_database)"]
    end

    subgraph MCP_SERVER["MCP Server (FastMCP)"]
        direction TB
        SDOCS["search_docs\n(Pinecone hybrid + rerank)"]
        SWEB["search_web\n(Perplexity API)"]
        QDB["query_database\n(Vanna AI text-to-SQL)"]
    end

    subgraph DATA_MCP["Data Sources"]
        PIN[("Pinecone")]
        PERP["Perplexity API"]
        RDS[("RDS MySQL")]
    end

    RES --> CLIENT
    SQL --> CLIENT
    CLIENT -->|"streamable-http\nMCP Protocol"| MCP_SERVER
    SDOCS --> PIN
    SWEB --> PERP
    QDB --> RDS

    style MCP_CLIENT_LAYER fill:#1a1a2e,stroke:#6366f1,color:#fff
    style MCP_SERVER fill:#0f3460,stroke:#10b981,color:#fff
```

---

## 🛡️ Guardrail & Safety Architecture

```mermaid
flowchart LR
    subgraph T1["🔴 INTERNAL Tier"]
        direction TB
        I1["Full data access"]
        I2["No topic restrictions"]
        I3["50k token budget"]
        I4["500 row limit"]
        I5["120 RPM rate limit"]
        I6["LangSmith full trace"]
    end

    subgraph T2["🟡 PARTNER Tier"]
        direction TB
        P1["Filtered vendor data"]
        P2["Topic deny: 4 categories"]
        P3["20k token budget"]
        P4["100 row limit"]
        P5["30 RPM rate limit"]
        P6["PII: ANONYMIZE"]
    end

    subgraph T3["🟢 PUBLIC Tier"]
        direction TB
        PU1["Aggregated data only"]
        PU2["Topic deny: 7 categories"]
        PU3["8k token budget"]
        PU4["25 row limit"]
        PU5["10 RPM rate limit"]
        PU6["PII: BLOCK"]
    end

    JWT["JWT Token\n(tier claim)"] --> T1
    JWT --> T2
    JWT --> T3

    subgraph SAFETY["SQL Safety Controls"]
        FP["Forbidden Pattern\nDetection (11 patterns)"]
        TV["Table Whitelist\nValidator"]
        RL["Tier Row Limit\nInjection"]
    end
```

---

## ☁️ AWS Infrastructure (CDK)

```mermaid
flowchart TB
    subgraph VPC["AWS VPC (2 AZs)"]
        subgraph PUBLIC_SUBNET["Public Subnet"]
            ALB["Application\nLoad Balancer"]
        end

        subgraph PRIVATE_SUBNET["Private Subnet (NAT)"]
            ECS_API["ECS Fargate\n(FastAPI · 2 tasks · 1 vCPU)"]
            ECS_MCP["ECS Fargate\n(MCP Server · 1 task · 0.5 vCPU)"]
        end

        subgraph ISOLATED_SUBNET["Isolated Subnet"]
            RDS["RDS MySQL 8.0\n(Multi-AZ · Encrypted\nPerformance Insights)"]
        end
    end

    subgraph BEDROCK_REGION["AWS Bedrock (us-east-1)"]
        BC["ChatBedrockConverse\nClaude 3.5 Sonnet"]
        BG["Bedrock Guardrails\n(Topics + PII)"]
    end

    subgraph STORAGE["Storage & Secrets"]
        S3["S3 Bucket\n(procurement-intelligence-docs)"]
        ECR_API["ECR: procurement-api"]
        ECR_MCP["ECR: procurement-mcp-server"]
        SM["Secrets Manager\n(DB creds · API keys · JWT)"]
    end

    subgraph OBS2["Observability"]
        CW["CloudWatch Logs\n(Container Insights)"]
        LS["LangSmith\n(Trace + Eval)"]
    end

    Internet["🌐 Internet"] --> ALB
    ALB --> ECS_API
    ECS_API -->|"MCP Protocol\n(streamable-http)"| ECS_MCP
    ECS_API --> BC
    ECS_API --> BG
    ECS_API <--> SM
    ECS_MCP --> RDS
    ECS_MCP <--> SM
    ECS_API --> S3
    ECS_API --> CW
    ECS_API --> LS
    ECR_API -->|"pull image"| ECS_API
    ECR_MCP -->|"pull image"| ECS_MCP
```

---

## 📊 Retrieval & Ingestion Pipeline

```mermaid
flowchart LR
    subgraph INGEST["Ingestion Pipeline (retrieval/indexer.py)"]
        S3_IN["S3: PDFs, CSVs, DOCX\nVendor Contracts\nRFPs, Price Sheets"]
        PARSE["Document Parser\n(pypdf · python-docx\nJSON · CSV)"]
        CHUNK["Recursive Chunker\n(1024 tokens\n128 overlap)"]
        EMBED["Embedder\n(Amazon Titan v2\nor Cohere Embed v3)"]
        META["Metadata Tagger\n(vendor_id, doc_type\ntier_access, s3_key)"]
        PIN_IN["Pinecone Batch\nUpsert (50/batch)"]
    end

    subgraph QUERY["Query Time (Online)"]
        Q_IN["User Query"]
        MULTI["Multi-Query Expansion\n(3 query variants)"]
        DENSE["Dense Retrieval\n(Pinecone · top-k=20)"]
        SPARSE["BM25 Sparse\n(top-k=20)"]
        RRF["Reciprocal Rank\nFusion (k=60)"]
        RERANK["Cohere Reranker v3\n(top-k=5)"]
        OUT["Retrieved Chunks\n+ Source Citations"]
    end

    S3_IN --> PARSE --> CHUNK --> EMBED --> META --> PIN_IN
    Q_IN --> MULTI --> DENSE --> RRF
    MULTI --> SPARSE --> RRF
    RRF --> RERANK --> OUT
```

---

## 🔄 LangSmith Eval Loop

```mermaid
flowchart TB
    PROD["Production Traces\n(LangSmith)"] --> SAMPLE["Stratified Sampling\n(by tier · 100 traces/week)"]
    SAMPLE --> HUMAN["Human Raters\n(Streamlit annotation UI\nScore 1-5: relevance,\naccuracy, safety)"]
    SAMPLE --> LLM_J["LLM-as-Judge\n(Claude scores same traces\n4 dimensions)"]
    HUMAN --> CALIB["Calibration\n(Pearson correlation\nhuman vs LLM judge)"]
    LLM_J --> CALIB
    CALIB --> DATASET["Eval Dataset\n(22 golden queries\n+ guardrail tests)"]
    DATASET --> PROMPT_OPT["Prompt Optimization\n(DSPy / manual tuning)"]
    PROMPT_OPT --> PROD
```

---

## 🚀 Quick Start

```bash
# Install dependencies (using uv)
uv sync

# Copy and fill environment variables
cp .env.example .env

# Option A: Docker Compose (recommended for local dev)
docker compose up -d

# Option B: Run services individually
uv run python -m mcp_server.server --transport http --port 8080
uv run uvicorn api.main:app --reload --port 8000
uv run streamlit run ui/app.py

# Ingest documents from S3
uv run python -m ingestion.cli --bucket procurement-intelligence-docs --prefix contracts/ --tier internal --doc-type contract

# Run database migrations
uv run python -m migrations.schema upgrade

# Run tests
uv run pytest tests/ -v

# Run eval harness
uv run python -m eval.harness

# Deploy to AWS
cd infra && cdk deploy --all
```

---

## 📁 Project Structure

```
procurement-intelligence-agent/
├── agents/                   # LangGraph supervisor + sub-agents
│   ├── state.py              # Shared TypedDict state schema
│   ├── supervisor.py         # Supervisor routing agent (Claude)
│   ├── researcher.py         # RAG + web research agent
│   ├── sql_analyst.py        # Vanna AI SQL agent
│   ├── writer.py             # Synthesis + citation agent
│   ├── graph.py              # LangGraph StateGraph wiring (thread-safe)
│   ├── mcp_client.py         # MCP protocol client integration
│   └── json_utils.py         # Robust JSON extraction utility
├── mcp_server/               # FastMCP tool server (MCP protocol)
│   ├── server.py             # MCP server entrypoint (stdio + HTTP)
│   └── tools/                # Tool implementations
│       ├── search_docs.py    # Pinecone hybrid search tool
│       ├── search_web.py     # Perplexity API tool
│       └── query_database.py # Vanna AI SQL tool
├── retrieval/                # Pinecone retrieval pipeline
│   ├── embedder.py           # Titan/Cohere embedding (async)
│   ├── indexer.py            # S3 → parse → chunk → embed → upsert
│   └── retriever.py          # Hybrid search + RRF + Cohere rerank
├── ingestion/                # Document ingestion CLI
│   ├── __init__.py           # Re-exports indexer classes
│   └── cli.py                # CLI entrypoint (argparse)
├── migrations/               # Database schema management
│   └── schema.py             # SQLAlchemy schema + 13 indexes + upgrade/downgrade
├── sql_agent/                # Vanna AI text-to-SQL
│   ├── vanna_setup.py        # Schema training (4 DDLs, 5 golden pairs)
│   └── validator.py          # Query safety validation (22 patterns)
├── guardrails/               # Tier-based access control
│   ├── tiers.py              # 3-tier config with rate limits
│   ├── bedrock_guardrails.py # Bedrock ApplyGuardrail (async via to_thread)
│   └── middleware.py         # FastAPI pre/post guardrail middleware
├── api/                      # FastAPI service
│   ├── main.py               # App entrypoint + middleware stack
│   ├── auth.py               # JWT authentication
│   ├── rate_limiter.py       # Tier-aware rate limiting (slowapi)
│   ├── schemas.py            # Pydantic models (Citation, QueryResponse)
│   └── routes/
│       └── query.py          # SSE streaming endpoint (single invocation)
├── eval/                     # Evaluation + observability
│   ├── harness.py            # LangSmith trace extraction + metrics
│   ├── judge.py              # LLM-as-judge (async + sync)
│   └── datasets/
│       └── sample_queries.json  # 22-item eval dataset
├── infra/                    # AWS CDK stacks
│   ├── app.py                # CDK app entrypoint
│   └── stacks/
│       ├── database_stack.py # VPC + RDS MySQL (Multi-AZ, encrypted)
│       ├── bedrock_stack.py  # Bedrock Guardrail (topics + PII)
│       └── api_stack.py      # ECR + ECS Fargate (API + MCP services)
├── ui/                       # Streamlit annotation + eval dashboard
│   ├── app.py                # Main Streamlit app
│   └── pages/
│       ├── query_review.py   # Live query tester with SSE
│       └── eval_dashboard.py # Plotly eval metrics dashboard
├── tests/                    # pytest test suite (63+ tests)
│   ├── conftest.py           # Shared fixtures + mocked clients
│   ├── test_agents.py        # Routing, JSON extraction, state tests
│   ├── test_retrieval.py     # RRF, deduplication, chunker tests
│   ├── test_guardrails.py    # Tier config + SQL validator tests
│   └── test_api.py           # FastAPI integration tests
├── Dockerfile                # Multi-stage build (API)
├── Dockerfile.mcp            # MCP server build
├── docker-compose.yml        # Local dev: MySQL + API + MCP + Streamlit
├── pyproject.toml            # Dependencies (uv)
└── .env.example              # Environment template
```

---

## 🧪 Test Coverage

| Test File | Tests | Coverage Area |
|-----------|-------|---------------|
| `test_agents.py` | 20 | JSON extraction (7), routing logic (9), state factory (4) |
| `test_retrieval.py` | 10 | RRF fusion (5), deduplication (2), chunker (3) |
| `test_guardrails.py` | 21 | Tier config (10), SQL validator (10), tier parsing (1) |
| `test_api.py` | 12 | Health (2), auth (3), query (2), schemas (6) |
| **Total** | **63** | |

---

## 📈 Eval Metrics

| Metric | Target | Method |
|--------|--------|--------|
| Retrieval Precision@5 | > 0.80 | LLM-judge vs human |
| SQL Accuracy | > 0.90 | Execute + compare |
| Answer Faithfulness | > 0.85 | Groundedness check |
| Citation Quality | > 0.78 | Source verification |
| Latency P95 (INTERNAL) | < 8s | CloudWatch |
| Latency P95 (PUBLIC) | < 4s | CloudWatch |
| Guardrail False Positive Rate | < 2% | Human review |
| LLM-Judge ↔ Human Correlation | > 0.80 | Pearson r |
