# Agentic Apps Portfolio: Interview & Application Guide

This document contains the exact questions from the recruitment process paired with multiple, detailed responses derived from your **Agentic Apps** portfolio and related projects.

---

## 1. Briefly describe the most recent AI-powered system or feature you built and shipped to production. What problem did it solve, who used it (internal team / customers / specific workflow), and roughly what kind of usage volume did it handle?

### Response A: MedEdge (Hybrid Clinical Assistant)
*   **Problem:** Healthcare workers in remote or resource-constrained areas often lack stable internet, preventing them from using cloud AI for clinical support.
*   **Solution:** Built a hybrid-mode system that runs local inference (Gemma 4 via Ollama) when offline and switches to Gemini 2.0 Flash when online.
*   **Users:** Rural clinic staff and nurses for patient triage, SOAP note generation, and drug interaction checks.
*   **Volume:** Optimized for high-frequency daily consultation cycles with low-latency local processing.

### Response B: Socrates (Socratic Tutor)
*   **Problem:** Students in low-connectivity regions lack access to personalized tutoring.
*   **Solution:** A multimodal "Mistake Lens" that analyzes student work and guides them through errors using questions rather than just giving answers.
*   **Users:** Students and educators in developing regions.
*   **Volume:** Designed for high-concurrency mobile usage with offline-first data synchronization.

---

## 2. Describe one production integration with an LLM that you built, either a hosted API (OpenAI, Anthropic, Gemini, etc.) or an open-source model (self-hosted via vLLM/Ollama, or via providers like Together, Groq, Replicate, Hugging Face, Fireworks). Walk us through the flow at a high level. How did you handle errors, timeouts, malformed outputs, and cases where the model gave a bad or unexpected response?

### Response A: Vercel AI SDK with Google Gemini (App 5: Customer Support)
*   **Flow:** Hono (Node.js) -> Vercel AI SDK -> Gemini Pro. The agent uses `generateText` with `tools` to query order status and trigger refunds.
*   **Error Handling:** Used **Zod** for strict parameter validation. If a tool execution fails, the error is caught and returned to the LLM to explain the situation to the user.
*   **Bad Responses:** Implemented `maxSteps: 5` to allow the agent to self-correct if a tool call was incomplete or malformed.

### Response B: Local OSS Inference via Ollama (MedEdge)
*   **Flow:** FastAPI Backend -> Ollama (Gemma 2/4). Audio is transcribed locally using **Whisper.cpp** before being processed by the LLM.
*   **Error Handling:** Implemented circuit breakers for local inference to detect when the hardware is under too much load, automatically degrading to a smaller model (Gemma 2B) if necessary.

---

## 3. Tell us about a time an AI system you built behaved unreliably in production. Examples could include: hallucinations, wrong outputs, schema mismatches, prompt drift, cost spikes, rate-limit failures, or context-window issues. How did you detect the problem, and how did you fix it?

### Response A: Hallucinations in Code Generation (App 1: Feature Agent)
*   **Problem:** The agent frequently hallucinated library imports or used deprecated API methods.
*   **Detection:** Automated unit tests in an **E2B Sandbox** would fail during the verification step.
*   **Fix:** Implemented a **Self-Correction Loop**. When a test fails, the stderr/traceback is piped back into the LLM with a "Reflection" system message, prompting it to analyze its own mistake and rewrite the code.

### Response B: Schema Mismatches in Tool Calls (App 5: Support Agent)
*   **Problem:** The model would occasionally pass incorrect types to the database query tool.
*   **Detection:** **Zod** schema validation would trigger an error before the DB call.
*   **Fix:** Improved the tool description with explicit examples of valid inputs and added a "few-shot" prompting technique to demonstrate correct tool usage.

---

## 4. Have you built or worked on a RAG or retrieval-based system? Briefly describe what you built: the raw data source, what you had to do to clean or normalize it before ingestion (deduplication, PII removal, formatting fixes, etc.), how you chunked and embedded it, how retrieval worked, and what you learned about where it broke down or had to be tuned.

### Response A: Autonomous DevRel Agent (App 6)
*   **Data Source:** GitHub Discussions, Slack/Discord transcripts, and Markdown documentation.
*   **Cleaning:** Used **Haystack's** preprocessing components to strip HTML tags and normalize formatting.
*   **Pipeline:** Chunked by paragraph with overlap; embedded using **OpenAI Text Embedding 3 Large**; stored in **Milvus**.
*   **Learning:** Retrieval often failed for "cross-cutting" questions. Tuned it by implementing **Hybrid Search** (combining BM25 keyword matching with vector similarity).

### Response B: Scientific Research Sandbox (App 3)
*   **Data Source:** Messy PDF reports and CSV files.
*   **Cleaning:** Used **IBM Docling** to extract structured data from complex PDF tables, which standard loaders often mangled.
*   **Retrieval:** Used **Qdrant** with metadata filtering (e.g., filter by "year" or "researcher") to reduce the search space and improve precision.

---

## 5. Describe an AI agent or multi-step AI workflow you've built. What were the steps, how did the system make decisions or pick tools, and how did you handle failures, loops, or unexpected inputs?

### Response A: Feature Shippable Agent (App 1)
*   **Orchestration:** **LangGraph.js** (Cyclic Graph).
*   **Steps:** 1. Analyze Requirement -> 2. Search Codebase -> 3. Execute Code -> 4. Run Tests -> 5. Self-Correction -> 6. Submit PR.
*   **Decisions:** The LLM acts as a router at each node, deciding whether to continue to the next step or loop back to "Fix Code" based on the test results.

### Response B: Revenue Recovery Auditor (App 2)
*   **Orchestration:** **Temporal.io** for durable execution.
*   **Steps:** Listen to Stripe Webhook -> Fetch User Activity (PostgreSQL) -> Branching Logic (Active vs. Inactive user) -> Slack/Email Outreach -> Final Action (Cancel/Re-activate).
*   **Failures:** Temporal handles state persistence; if a step fails due to an external API outage, it automatically retries with exponential backoff without losing the agent's progress.

---

## 6. Tell us about your experience with open-source models and / or fine-tuning. Have you used models like Llama, Qwen, Mistral, DeepSeek, Gemma, etc. in production, either self-hosted or via inference providers? Have you fine-tuned a model (LoRA, QLoRA, or full fine-tuning of a small model) for a specific task?

### Response: Open-Source Deployment (MedEdge/Socrates)
*   **OSS Models:** Heavily used **Gemma 2 9B**, **Llama 3**, and **Mistral 7B** via **Ollama** and **LiteRT** for offline-first edge applications.
*   **Fine-tuning (Roadmap):** Currently developing a pipeline for **Socrates** to fine-tune Gemma 4 using **LoRA** to support regional dialects (e.g., Swahili, Urdu) for educational tutoring where standard models underperform.
*   **Decision:** Chose OSS over API for **MedEdge** due to the hard requirement for offline resilience in clinics with zero internet connectivity.

---

## 7. How do you evaluate whether an AI feature you built is actually working? Walk us through your real approach: test sets, manual review, scoring rubrics, regression checks, user feedback loops, or whatever you actually do.

### Response: Multi-Layered Evaluation
*   **Automated Scoping:** Used **Giskard** (App 6) to run vulnerability and hallucination checks against specific test sets.
*   **Functional Benchmarking:** For the **Scientific Sandbox (App 3)**, I verify success by checking if the generated Python script actually runs and produces a statistically significant output within the **Modal.com** environment.
*   **Scoring Rubrics:** Implemented LLM-as-a-judge patterns to grade agent responses on "Helpfulness" and "Safety" using a 1-5 scale before shipping updates.

---

## 8. Describe a meaningful integration you built that connected AI to other systems (CRMs, support tools, internal databases, marketing platforms, ops tools, etc.). What systems were involved, what did the data flow look like, and what business problem did it solve?

### Response: Revenue Recovery Bridge (App 2)
*   **Systems:** **Stripe** (Payments), **PostgreSQL** (User Data), **Slack** (Notification), **NATS** (Event Stream).
*   **Flow:** A payment failure in Stripe triggers a NATS event. The agent fetches user usage data from PostgreSQL to determine "value," then sends a tailored retention offer via Slack.
*   **Business Problem:** Reduces churn by automating the recovery process for high-value users who might have just had an expired card.

---

## 9. What kind of backend work have you done in production beyond AI features? Languages, frameworks, databases, APIs, data pipelines, services.

### Response: Full-Stack Engineering Foundation
*   **Languages:** Expert in **TypeScript** (NestJS), **Python** (FastAPI), and **Go** (Gin Gonic).
*   **Data Pipelines:** Built event-driven architectures using **Apache Kafka** (App 9) for low-latency fraud detection.
*   **Infrastructure:** Used **Temporal.io** for stateful orchestration and **BullMQ** (App 10) for background job processing.
*   **DBs:** Proficient with **PostgreSQL (PostGIS)** for spatial queries, **MongoDB Atlas**, and **Redis** for session caching.

---

## 10. What is your current or most recent main technology stack?

### Response: Modern Agentic Stack
*   **Core:** TypeScript (Strict), Node.js (Hono), Python 3.12 (FastAPI).
*   **AI Tools:** Vercel AI SDK, LangGraph, CrewAI, PydanticAI.
*   **Databases:** Supabase (PostgreSQL), Turso (Edge SQLite), Milvus/Qdrant (Vector).
*   **Platform:** Vercel, Modal.com (Serverless GPU), E2B (Sandboxing).

---

## 11. Which of the following have you worked with in real production? (Select all that apply)

- [x] Hosted LLM APIs (OpenAI, Anthropic, Gemini, or similar)
- [x] Open-source LLMs in production (Llama, Qwen, Mistral, DeepSeek, Gemma, etc.)
- [x] Self-hosting or OSS inference platforms (vLLM, Ollama)
- [x] Prompt design and iteration in production systems
- [x] Structured outputs / function calling / JSON-mode
- [x] RAG or retrieval-augmented systems
- [x] Vector databases (Pinecone, Milvus, Qdrant, Chroma)
- [x] Embeddings (generation, similarity search)
- [x] Multi-step AI agents or orchestrated workflows
- [x] Voice agents, transcription, or speech APIs (Twilio, Vapi, Deepgram)
- [x] Webhooks and event-driven backends (NATS, Kafka)
- [x] Structured data extraction from unstructured inputs
- [x] AI evaluation, test sets, or output scoring (App 13: Agentic Red-Teamer)
- [x] Cost optimization for LLM workloads (App 14: Model Router)
- [x] Multi-modal / Vision analysis (App 15: Multi-modal QA)
- [x] Data privacy & PII sanitization (App 16: Compliance Sanitizer)
- [x] Background job systems, queues, or async processing (BullMQ, Temporal)
