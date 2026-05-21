# App 16: Compliance & PII Sanitizer

## Concept
A "Zero-Trust" AI gateway that enforces data privacy and regulatory compliance at the edge.

## Workflow
1.  **Ingestion:** Intercepts outgoing LLM requests.
2.  **Detection:** Uses NER (Named Entity Recognition) to find PII.
3.  **Transformation:** 
    *   **Masking:** `123-456-7890` -> `XXX-XXX-7890`.
    *   **Synthetic Swap:** Replaces real names with fake ones to maintain sentence structure.
4.  **Verification:** A secondary LLM (local) checks the sanitized text to ensure no residual PII exists.
5.  **Audit Log:** Records that a sanitization event occurred (without storing the PII).

## Tech Stack
- **Language:** Python
- **Privacy:** Microsoft Presidio
- **Local LLM:** Phi-3 / Llama 3 (via Ollama)
- **Framework:** LangChain (Privacy Filter)
