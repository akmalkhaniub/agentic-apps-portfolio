# App 14: Model Router & Budget Sentinel

## Concept
An "Intelligent LLM Gateway" that optimizes for cost, latency, and reliability by routing traffic across a fleet of models.

## Workflow
1.  **Request Intake:** Receives a prompt from a client application.
2.  **Semantic Lookup:** Checks a vector-enabled Redis cache for a similar query answered within the last 24 hours.
3.  **Model Selection:** 
    *   If task == "Summary": Use Llama 3 70B (Fast, cheaper).
    *   If task == "Code Generation": Use GPT-4o (Accurate).
    *   If task == "Extraction": Use Gemini 1.5 Flash (Long context).
4.  **Fallback Logic:** If a provider (e.g., OpenAI) returns a 5xx, immediately retry with Anthropic.
5.  **Telemetry:** Logs cost-per-request and latency to a central dashboard.

## Tech Stack
- **Language:** TypeScript
- **Runtime:** Bun (for ultra-low latency)
- **Gateway:** LiteLLM / Portkey
- **Cache:** Redis Stack (Vector)
- **Monitoring:** Helicone
