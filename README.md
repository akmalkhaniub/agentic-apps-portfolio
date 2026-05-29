# 🚀 Agentic AI Applications Portfolio

Welcome to the **Agentic AI Applications Portfolio**—a state-of-the-art collection of specialized AI agent applications and microservices demonstrating advanced AI orchestration, Retrieval-Augmented Generation (RAG), voice automation, local-first inference, and production-grade software engineering.

This workspace houses a complete multi-agent ecosystem. Each folder represents a standalone service or application that is unified under a single React-based portfolio frontend.

---

## 🏗️ System Architecture & Port Mapping

The portfolio consists of a unified React/Vite frontend that communicates with a fleet of specialized agent backends running in Hono (Node.js), FastAPI (Python), Go (Gin/Kafka), and NestJS.

```mermaid
graph TD
    UI["💻 Portfolio UI (React/Vite)"] --> P8001["🔒 PII Sanitizer (Port 8001)"]
    UI --> P8081["💸 Fraud Mitigator (Port 8081)"]
    UI --> P8002["🏥 Medical Intake (Port 8002)"]
    UI --> P8082["💳 Revenue Auditor (Port 8082)"]
    UI --> P8501["🧪 Research Sandbox (Port 8501)"]
    UI --> P8003["✈️ Travel Concierge (Port 8003)"]
    UI --> P3000["🛠️ Feature Agent (Port 3000)"]
    UI --> P8004["🧠 Knowledge Swarm (Port 8004)"]
    UI --> P8005["⚖️ Agent Debate (Port 8005)"]
```

---

## 🛠️ Core Technology Stack

*   **Languages:** TypeScript (Strict), Python 3.12, Go 1.22.
*   **AI & Agent Frameworks:** Vercel AI SDK, LangGraph, CrewAI, PydanticAI, LiteLLM, Microsoft Presidio.
*   **Databases & Vector Search:** Supabase (PostgreSQL), Turso (SQLite), Milvus, Qdrant, Redis Stack.
*   **Orchestration & Infrastructure:** Temporal.io (durable execution), BullMQ (async queues), Docker, NATS, Kafka.
*   **Evaluation & Security:** Giskard, DeepEval, Ragas.

---

## 🗂️ Registry of Agentic Applications

Here is the complete registry of all applications, tools, and frontends in this portfolio:

### 🌐 User Interface & Portfolio Hub
| Directory | Tech Stack | Role & Purpose |
| :--- | :--- | :--- |
| **[agentic-portfolio-ui](./agentic-portfolio-ui)** | React, TypeScript, Vite, TailwindCSS | The interactive dashboard that connects to, controls, and visualizes the outputs of all background agents in real-time. |

### 🤖 Standalone Agent Applications
| # | App Name & Folder | Primary Frameworks | Focus Area & Description |
| :---: | :--- | :--- | :--- |
| **1** | **[Feature Shippable Agent](./feature-shippable-agent)** | LangGraph.js, E2B Sandboxing | **Autonomous Coding Agent:** Analyzes code requirements, searches the codebase, edits code inside an isolated E2B sandbox, runs tests, self-corrects on failures, and submits Pull Requests. |
| **2** | **[Revenue Recovery Auditor](./revenue-recovery-auditor)** | Go, Temporal.io, Stripe API | **Fintech Automation:** Monitors payment failures via Stripe webhooks, evaluates customer value against PostgreSQL database, and triggers retention campaigns. |
| **3** | **[Scientific Research Sandbox](./scientific-research-sandbox)** | PydanticAI, Streamlit, Modal.com | **Serverless Data Science:** Automatically writes, executes, and refines scientific Python scripts in a serverless Modal environment using IBM Docling for PDF ingestion. |
| **4** | **[Cloud Security Sentinel](./cloud-security-sentinel)** | Rust, Python, AWS SDK | **Cloud Security Ops:** Monitors cloud configuration changes, triggers automated incident response for exposed credentials, and patches security group rules. |
| **5** | **[Agentic Customer Support](./agentic-customer-support)** | Vercel AI SDK, Hono, Zod | **High-Reliability Tool-Use:** Handles order status queries, customer verification, and refund requests with strict Zod-enforced schemas and self-correction loops. |
| **6** | **[Autonomous DevRel Agent](./autonomous-devrel-agent)** | Haystack, Milvus Vector DB | **Community RAG:** Scrapes GitHub discussions and discord chats, formats them, and uses hybrid vector/keyword search to answer complex product and developer questions. |
| **7** | **[Medical Intake Nurse](./medical-intake-nurse)** | Vapi, Deepgram, FastAPI | **Healthcare Voice Agent:** Synthesizes realistic phone screening intake, transcribes responses, and structures medical notes using SOAP standards. |
| **8** | **[Real Estate Coordinator](./real-estate-coordinator)** | Vapi, Twilio, Node.js | **Sales Voice Agent:** Automates inbound property lead calls, filters client criteria (budget, location), and books appointments directly to a calendar. |
| **9** | **[Fintech Fraud Mitigator](./fintech-fraud-mitigator)** | Go, Apache Kafka, pgvector | **Event-Driven AI:** Streams financial transaction events, runs low-latency vector similarity checks against fraud patterns, and flags suspicious activity. |
| **10** | **[Service Dispatch Coordinator](./service-dispatch-coordinator)** | CrewAI, BullMQ, NestJS | **Logistics & Negotiation:** Coordinates technician assignments, schedules job times, and negotiates vendor prices using nested CrewAI agent swarms. |
| **11** | **[Travel Concierge Agent](./travel-concierge-agent)** | Vapi, FastAPI, Python | **Voice Assistant:** Real-time conversational agent capable of coordinating trip bookings, hotel searches, and itinerary planning via voice commands. |
| **12** | **[Agentic Red-Teamer](./agentic-red-teamer)** | Giskard, DeepEval, Ragas | **Evaluation & Security:** Synthesizes adversarial inputs (injection, leaks, boundary cases) and runs automatic quality tests against other agents. |
| **13** | **[Model Router & Budget Sentinel](./model-router-sentinel)** | LiteLLM, Redis Stack, Bun | **Cost & Latency Gateway:** Routes queries to the cheapest model capable of solving them (Llama 3, GPT-4, Gemini) and utilizes Redis caching. |
| **14** | **[Autonomous Multi-modal QA](./multimodal-qa-agent)** | Playwright, GPT-4o Vision | **Visual Testing Robot:** Crawls web interfaces, captures screenshots, evaluates accessibility (contrast, buttons), and records verification videos. |
| **15** | **[Compliance & PII Sanitizer](./compliance-pii-sanitizer)** | Microsoft Presidio, Ollama, Phi-3 | **Privacy Gateway:** Intercepts outgoing LLM calls, masks or swaps PII (emails, names), and validates safety scores using a local Ollama instance. |
| **16** | **[Enterprise Knowledge Swarm](./enterprise-knowledge-swarm)** | FastAPI, Asyncio, RAG | **Hierarchical Swarm:** Uses a manager agent to split research queries and coordinate multiple parallel subagents to synthesize RAG reports. |
| **17** | **[Multi-Agent Debate](./multi-agent-debate)** | FastAPI, LLM-Debate | **Consensus Resolution:** Simulates a structured debate between a proponent agent and opponent agent on a given topic, moderated by a third agent. |

---

## ⚡ Quick Start & Run Instructions

To spin up the entire suite of agent backends, you can use the unified PowerShell script:

### Prerequisites
1. Ensure you have the required runtimes installed: **Node.js (v18+)**, **Python (v3.10+)**, and **Go**.
2. Set up your environment variables by copying `.env.example` to `.env` in the respective application folders:
   ```bash
   cp .env.example .env
   ```

### Start Backends
Run the following script from the root directory:
```powershell
powershell -ExecutionPolicy Bypass -File .\start_all_backends.ps1
```

### Start Frontend UI
Navigate to the frontend folder and run the dev server:
```bash
cd agentic-portfolio-ui
npm install
npm run dev
```

---

## 📚 Portfolios & Guides

For deep dives into interviews, system architectures, and recruitment guides, check the `docs` directory:
*   **[Portfolio Questionnaire Mapping](./docs/portfolio_mapping.md):** Architectural patterns, RAG setups, and edge-case handling.
*   **[Detailed Professional Experience](./docs/professional_experience_detailed.md):** Long-term background in scaling production SaaS backends, database migrations, and CI/CD automation.
