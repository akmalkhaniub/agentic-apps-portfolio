# Compliance & PII Sanitizer

A privacy-first firewall that sits between raw data and LLMs — detects PII, redacts sensitive tokens, and enforces compliance policies before any data reaches an AI model.

## Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                     INCOMING DATA SOURCES                            │
│        (User Prompts, Documents, Database Exports, API Payloads)     │
└───────────────────────────┬──────────────────────────────────────────┘
                            │  POST /sanitize
                            ▼
┌──────────────────────────────────────────────────────────────────────┐
│                     SANITIZER API (FastAPI)                           │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │                    STAGE 1: PII DETECTION                      │  │
│  │                                                                │  │
│  │   ┌──────────────────┐    ┌──────────────────────────────┐    │  │
│  │   │ Microsoft        │    │  Fallback Regex Engine        │    │  │
│  │   │ Presidio         │    │                               │    │  │
│  │   │                  │    │  • SSN: \d{3}-\d{2}-\d{4}    │    │  │
│  │   │  • NER (spaCy)   │    │  • Email: user@domain.com    │    │  │
│  │   │  • Pattern match │    │  • Credit card: 13-19 digits │    │  │
│  │   │  • Context-aware │    │  • Phone: (xxx) xxx-xxxx     │    │  │
│  │   │                  │    │  • IP: xxx.xxx.xxx.xxx       │    │  │
│  │   │  Entities:       │    │                               │    │  │
│  │   │  PERSON, SSN,    │    │  Used when Presidio is not   │    │  │
│  │   │  CREDIT_CARD,    │    │  installed (zero-dep mode)   │    │  │
│  │   │  EMAIL, PHONE,   │    │                               │    │  │
│  │   │  IBAN, IP, etc.  │    │                               │    │  │
│  │   └────────┬─────────┘    └──────────────┬───────────────┘    │  │
│  │            └──────────────┬──────────────┘                    │  │
│  │                           ▼                                    │  │
│  │              List of PIIEntity (type, span, score)             │  │
│  └───────────────────────────┬────────────────────────────────────┘  │
│                              ▼                                       │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │                 STAGE 2: COMPLIANCE CHECK                      │  │
│  │                                                                │  │
│  │   ┌─────────┐  ┌─────────┐  ┌──────────┐  ┌──────────┐      │  │
│  │   │  HIPAA  │  │ PCI-DSS │  │   GDPR   │  │  SOC2    │      │  │
│  │   │         │  │         │  │          │  │          │      │  │
│  │   │ No raw  │  │ No card │  │ No bulk  │  │ No creds │      │  │
│  │   │ PHI in  │  │ numbers │  │ PII      │  │ in logs  │      │  │
│  │   │ prompts │  │ in text │  │ export   │  │          │      │  │
│  │   └────┬────┘  └────┬────┘  └────┬─────┘  └────┬─────┘      │  │
│  │        └─────────────┴───────────┴──────────────┘             │  │
│  │                      │                                        │  │
│  │              violations[] (may BLOCK the request)             │  │
│  └──────────────────────┬─────────────────────────────────────────┘  │
│                         ▼                                            │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │                 STAGE 3: REDACTION                              │  │
│  │                                                                │  │
│  │   "John Smith's SSN is 123-45-6789"                           │  │
│  │                    ▼                                           │  │
│  │   "[PERSON_REDACTED]'s SSN is [SSN_REDACTED]"                │  │
│  │                                                                │  │
│  │   • Semantic placeholders preserve context for LLM reasoning  │  │
│  │   • Custom deny-list terms also redacted                      │  │
│  │   • Presidio operator configs per entity type                 │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                      │
└───────────────────────────┬──────────────────────────────────────────┘
                            │
                ┌───────────┴──────────┐
                ▼                      ▼
        ┌──────────────┐      ┌──────────────┐
        │   BLOCKED    │      │   SANITIZED  │
        │              │      │   OUTPUT     │
        │ compliance   │      │              │
        │ violation    │      │ safe to send │
        │ returned to  │      │ to any LLM   │
        │ caller       │      │              │
        └──────────────┘      └──────┬───────┘
                                     │
                                     ▼
                              ┌──────────────┐
                              │  LLM / AI    │
                              │  (Claude,    │
                              │   GPT, Local │
                              │   Ollama)    │
                              └──────────────┘
```

## Risk Scoring

```
  Entity Weights              Risk Score Formula
  ─────────────               ──────────────────
  US_SSN         1.0          score = max_weight × 0.7 + density × 0.3
  CREDIT_CARD    1.0
  MEDICAL_LICENSE 0.9          density = min(entity_count / 10, 1.0)
  IBAN_CODE      0.8
  EMAIL_ADDRESS  0.4          0.0 ──────────────────── 1.0
  PHONE_NUMBER   0.4           clean          moderate       critical
  PERSON         0.3
  IP_ADDRESS     0.3
  LOCATION       0.2
```

## Tech Stack

| Component | Technology | Purpose |
|-----------|-----------|---------|
| API | FastAPI | Async REST server with auto-generated OpenAPI docs |
| PII Detection | Microsoft Presidio + spaCy | NER-based entity recognition |
| Fallback | Regex engine | Zero-dependency PII detection mode |
| Redaction | Presidio Anonymizer | Configurable per-entity-type operators |
| Compliance | Rule engine | HIPAA, PCI-DSS, GDPR, SOC2 policy enforcement |

## Quick Start

```bash
# Install dependencies
pip install -r requirements.txt

# Download spaCy model (for Presidio NER)
python -m spacy download en_core_web_lg

# Run the server
python main.py
```

The server starts on `http://localhost:8000` with auto-generated docs at `/docs`.

## API Examples

### Sanitize text
```bash
curl -X POST http://localhost:8000/sanitize \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Patient John Smith (SSN: 123-45-6789) was prescribed Lisinopril. Contact: john@example.com",
    "deny_list": ["Lisinopril"]
  }'
```

Response:
```json
{
  "sanitized_text": "Patient [PERSON_REDACTED] (SSN: [SSN_REDACTED]) was prescribed [CUSTOM_DENY]. Contact: [EMAIL_REDACTED]",
  "entities_found": [...],
  "compliance_violations": ["HIPAA: HIPAA - No raw PHI in prompts"],
  "blocked": true,
  "redaction_count": 4
}
```

### Analyze only (no redaction)
```bash
curl -X POST http://localhost:8000/analyze \
  -H "Content-Type: application/json" \
  -d '{"text": "Call me at 555-123-4567"}'
```

### List compliance rules
```bash
curl http://localhost:8000/rules
```

## Design Decisions

- **Dual-mode detection**: Presidio for production accuracy, regex fallback for zero-dependency development and testing.
- **Semantic placeholders**: `[PERSON_REDACTED]` instead of `***` — the LLM still understands the entity role without knowing the value.
- **Block vs. redact**: Compliance violations block the entire request; PII is redacted but allowed through. The caller decides how to handle each.
- **Framework-agnostic**: This is middleware — it sits in front of any LLM (Claude, GPT, Ollama) and sanitizes before the data leaves your environment.
