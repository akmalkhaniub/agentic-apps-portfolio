# Detailed Professional AI Experience

This document contains detailed responses to the 11-question AI engineering questionnaire, focusing on real-world production systems, infrastructure, and troubleshooting.

---

## 1. Recent AI-Powered System
The most recent system I shipped was a multi-agent document processing and task orchestration platform for an ops-heavy client. 
*   **The Problem:** Their team was manually triaging and routing hundreds of incoming documents daily (contracts, support requests, internal forms) — slow, error-prone, and unscalable. 
*   **The Solution:** I built a **LangGraph-based** multi-agent system where one agent classifies and extracts structured data from each document, a second validates and enriches it against internal records, and a third routes the result to the correct downstream workflow with a human-in-the-loop checkpoint for edge cases. 
*   **Infrastructure:** It ran on **AWS Lambda** with **DynamoDB** for session state. 
*   **Impact:** At peak it handled 1,000+ concurrent sessions. The client's manual triage workload dropped by around 70% within the first month.

---

## 2. Production LLM Integration & Fallbacks
I'll describe the fallback chain I built for an enterprise RAG chatbot. 
*   **The Flow:** User query → retrieval (hybrid vector + BM25 against Pinecone) → prompt construction with retrieved context → GPT-4 API call → output parsing. 
*   **Error Handling:** I wrapped every LLM call in a retry layer with exponential backoff for rate limits and transient 5xx errors. 
*   **Fallbacks:** Timeouts had a hard 15-second ceiling — if hit, the request fell through to **GPT-3.5** (faster, cheaper) and if that also failed, served a cached response for the closest matching prior query. 
*   **Malformed Outputs:** I used structured outputs / JSON mode where available, but still ran a validation layer on every response — if the parsed output didn't match the expected schema, I retried once with an explicit correction prompt before logging it as a failure and returning a safe fallback message. Every call was logged with input, output, model version, latency, and token count.

---

## 3. Handling AI Unreliability (Prompt Drift)
The most instructive failure was a quiet prompt drift issue that took about two weeks to surface properly. 
*   **The Problem:** After OpenAI updated an underlying GPT-4 model version, our structured extraction agent started returning subtly different JSON shapes — field names with slightly different casing, and one optional field occasionally omitted entirely. 
*   **Detection:** What surfaced it was an anomaly in our scoring dashboard: the accuracy on a specific extraction task dropped from ~94% to ~81% over about a week. I caught it because I had automated regression tests running nightly against a fixed eval set of 200 known-good documents. 
*   **The Fix:** I bisected the timeline against our deployment and model-version logs, confirmed the output schema had drifted, then fixed it in two ways: tightened the output validation layer to fail loudly on schema mismatches rather than silently accepting partial results, and pinned the model version in the API call. 
*   **Prevention:** Added the nightly eval run to our CI pipeline so schema drift gets caught before it reaches users.

---

## 4. RAG Implementation & Tuning
Built a RAG system for an enterprise client with three document types: internal policy PDFs, DOCX procedure manuals, and scraped HTML from an internal wiki. 
*   **Normalisation:** OCR where needed, strip formatting artefacts, deduplicate near-identical paragraphs (cosine similarity threshold on embeddings), remove PII (names, emails, IDs) using a combination of regex and a small NER model. 
*   **Pipeline:** Chunking was sentence-aware with 512-token chunks and 10% overlap. Embedded with **OpenAI text-embedding-3-small**, stored in **Pinecone** with metadata (doc type, date, department). 
*   **Retrieval:** Used hybrid search (vector + BM25) with a cross-encoder re-ranker. 
*   **Learning:** Chunk size and overlap tuning mattered more than expected — too-small chunks lost context, too-large chunks diluted relevance scores. Pure vector search often retrieved plausible-sounding but wrong sections for short queries on long technical docs; the BM25 component rescued these cases by finding specific product codes or procedure numbers.

---

## 5. Multi-Agent Workflow Orchestration
The multi-agent automation platform is the clearest example. The workflow had four stages: 
1.  **Intake Agent:** Classified incoming documents and extracted a structured payload.
2.  **Validation Agent:** Checked extracted fields against a PostgreSQL database of known entities and flagged mismatches.
3.  **Decision Agent:** Based on document type and validation output, either routed the task automatically or escalated to a human checkpoint.
4.  **Notification Agent:** Fired downstream webhooks or emails. 
*   **Decision-Making:** Used a combination of rule-based routing (deterministic for well-understood types) and LLM judgement (for ambiguous cases). 
*   **Failure Handling:** Each agent step was wrapped in a try/except with structured error logging; if an agent failed twice it handed off to the human checkpoint. 
*   **Loop Prevention:** Tracking state in **DynamoDB** — if a document ID re-entered a completed stage, the orchestrator short-circuited.

---

## 6. Open-Source Models & Fine-Tuning
On an AI learning management system, I used **Mistral 7B** as the Q&A backbone to manage costs (tens of thousands of daily queries). 
*   **Dataset Prep:** Pulled Q&A pairs from course transcripts, instructor-written assessments, and synthetic negatives generated by prompting GPT-4 to produce plausible-but-wrong answers. Total dataset: ~18,000 examples. 
*   **Fine-Tuning:** Fine-tuned with **QLoRA** (4-bit quantisation, rank 16 adapters) on a rented **A100**. 
*   **Results:** Eval showed 91% task accuracy on the held-out val set vs. 88% with prompt engineering alone. 
*   **Learning:** Fine-tuning paid off because the domain was narrow and consistent, and cost constraints were tight. However, for broader tasks, closed-source APIs are better due to free model updates and flexible prompting. The real cost is dataset curation, not GPU time.

---

## 7. AI Evaluation Approach
*   **Eval Set:** Maintain a fixed eval set of representative inputs with known-good outputs, built from real production cases. 
*   **Automation:** Every deployment runs this eval set automatically as part of **CI**. 
*   **Scoring:** A mix of exact-match/schema validation for structured tasks, and **rubric-based LLM-as-judge** scoring (using a separate cheaper model) for open-ended outputs. 
*   **Production Monitoring:** Layer on output monitoring — every response is logged and I run daily aggregations looking for distribution shifts in output length, schema validation failure rates, and low-confidence scores. User feedback gets sampled into the eval set when it surfaces novel failure patterns.

---

## 8. Cross-System Integration (Zendesk & PostgreSQL)
Built an integrated system for a support operations client. 
*   **Flow:** Tickets arrived via webhook from **Zendesk** -> Agent read the ticket, identified intent/urgency/product IDs -> Queried internal **PostgreSQL** for customer account history and order state -> Generated a draft response and routed it to the correct support queue. 
*   **Outbound:** Resolved tickets triggered updates back to Zendesk via API and logged a structured summary to an internal reporting database. 
*   **Impact:** 4-hour average first response time dropped to under 20 minutes for the auto-handled tier (about 60% of volume).

---

## 9. Engineering Foundation (Beyond AI)
*   **Experience:** 9 years as a primary backend engineer on 10+ SaaS products. 
*   **Stack:** Python (Django, FastAPI, Flask), TypeScript/Node.js (Express, NestJS). 
*   **DBs:** PostgreSQL (schema design, query optimisation), MongoDB, DynamoDB, Redis. 
*   **Infra:** AWS (Lambda, ECS, S3, RDS, CloudFront, API Gateway), Docker, Terraform, GitHub Actions. 
*   **Expertise:** Designed REST/GraphQL APIs, event-driven architectures (SNS/SQS), ETL pipelines, Stripe integrations, and multi-tenant isolation.

---

## 10. Current Technology Stack
*   **Languages:** Python (Primary), TypeScript/React.
*   **Frameworks:** FastAPI, Django, LangGraph, LangChain, LlamaIndex.
*   **Models:** OpenAI, Anthropic, Groq/Fireworks (Llama 3, Mistral, Qwen).
*   **Storage:** Pinecone, pgvector, PostgreSQL, DynamoDB, Redis.
*   **DevOps:** AWS (Lambda + ECS), GitHub Actions, Terraform.

---

## 11. Production Experience Checklist

- [x] Hosted LLM APIs (OpenAI, Anthropic, Gemini, or similar)
- [x] Open-source LLMs in production (Llama, Qwen, Mistral, DeepSeek, Gemma, etc.)
- [x] Self-hosting or OSS inference platforms (vLLM, Ollama, Groq, Fireworks, etc.)
- [x] Fine-tuning (LoRA, QLoRA, or full fine-tuning of small models)
- [x] Prompt design and iteration in production systems
- [x] Structured outputs / function calling / JSON-mode
- [x] RAG or retrieval-augmented systems
- [x] Vector databases (Pinecone, Qdrant, pgvector, Chroma, Weaviate, etc.)
- [x] Embeddings (generation, similarity search, clustering)
- [x] Multi-step AI agents or orchestrated workflows
- [x] Automation platforms (n8n, Zapier, Make) or custom orchestrators
- [x] Webhooks and event-driven backends
- [x] Structured data extraction from unstructured inputs
- [x] AI evaluation, test sets, or output scoring
- [x] Cost optimization for LLM workloads (caching, model routing, batching)
- [x] CRM, support, or marketing platform integrations
- [x] Background job systems, queues, or async processing (BullMQ, Temporal)
