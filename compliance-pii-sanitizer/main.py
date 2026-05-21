"""Compliance & PII Sanitizer — a privacy firewall between raw data and LLMs."""

from __future__ import annotations

import re
import uuid
from enum import Enum
from typing import Optional

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

# ---------------------------------------------------------------------------
# Presidio is optional at import time so the app can still start for demo
# purposes even if the heavy NLP deps aren't installed yet.
# ---------------------------------------------------------------------------
try:
    from presidio_analyzer import AnalyzerEngine, RecognizerResult
    from presidio_anonymizer import AnonymizerEngine
    from presidio_anonymizer.entities import OperatorConfig

    analyzer = AnalyzerEngine()
    anonymizer = AnonymizerEngine()
    PRESIDIO_AVAILABLE = True
except ImportError:
    PRESIDIO_AVAILABLE = False
    analyzer = None
    anonymizer = None

app = FastAPI(title="Compliance & PII Sanitizer", version="1.0.0")

# ---------------------------------------------------------------------------
# Domain models
# ---------------------------------------------------------------------------

class PIIType(str, Enum):
    PERSON = "PERSON"
    EMAIL_ADDRESS = "EMAIL_ADDRESS"
    PHONE_NUMBER = "PHONE_NUMBER"
    CREDIT_CARD = "CREDIT_CARD"
    US_SSN = "US_SSN"
    IBAN_CODE = "IBAN_CODE"
    IP_ADDRESS = "IP_ADDRESS"
    LOCATION = "LOCATION"
    DATE_TIME = "DATE_TIME"
    NRP = "NRP"  # nationality, religious, political group
    MEDICAL_LICENSE = "MEDICAL_LICENSE"
    US_DRIVER_LICENSE = "US_DRIVER_LICENSE"


class ComplianceRule(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4())[:8])
    name: str
    framework: str  # GDPR, HIPAA, PCI-DSS, SOC2
    description: str
    blocked_patterns: list[str] = []  # regex patterns that violate this rule


class SanitizeRequest(BaseModel):
    text: str
    language: str = "en"
    deny_list: list[str] = []  # extra terms to always redact
    enforce_compliance: bool = True


class PIIEntity(BaseModel):
    entity_type: str
    start: int
    end: int
    score: float
    original: str


class SanitizeResponse(BaseModel):
    original_length: int
    sanitized_text: str
    entities_found: list[PIIEntity]
    compliance_violations: list[str]
    blocked: bool
    redaction_count: int


class AnalyzeRequest(BaseModel):
    text: str
    language: str = "en"


class AnalyzeResponse(BaseModel):
    entities: list[PIIEntity]
    risk_score: float  # 0.0 = clean, 1.0 = highly sensitive


# ---------------------------------------------------------------------------
# Compliance rules (in production: loaded from PostgreSQL)
# ---------------------------------------------------------------------------

COMPLIANCE_RULES: list[ComplianceRule] = [
    ComplianceRule(
        name="HIPAA - No raw PHI in prompts",
        framework="HIPAA",
        description="Blocks prompts containing unredacted protected health information",
        blocked_patterns=[
            r"\b(patient|diagnosis|prescription|medical record)\b.*\b\d{3}-?\d{2}-?\d{4}\b",
        ],
    ),
    ComplianceRule(
        name="PCI-DSS - No card numbers",
        framework="PCI-DSS",
        description="Blocks prompts containing credit card numbers",
        blocked_patterns=[
            r"\b(?:\d[ -]*?){13,19}\b",
        ],
    ),
    ComplianceRule(
        name="GDPR - No bulk PII extraction",
        framework="GDPR",
        description="Blocks prompts that ask to extract or list personal data",
        blocked_patterns=[
            r"(?i)(list|extract|export|dump)\s+(all\s+)?(names|emails|addresses|phone numbers|personal data)",
        ],
    ),
    ComplianceRule(
        name="SOC2 - No credential logging",
        framework="SOC2",
        description="Blocks prompts containing API keys or passwords",
        blocked_patterns=[
            r"(?i)(api[_-]?key|secret[_-]?key|password|token)\s*[=:]\s*\S+",
        ],
    ),
]

# ---------------------------------------------------------------------------
# Fallback PII detection (regex-based, used when Presidio is unavailable)
# ---------------------------------------------------------------------------

FALLBACK_PATTERNS = {
    "US_SSN": r"\b\d{3}-\d{2}-\d{4}\b",
    "EMAIL_ADDRESS": r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b",
    "PHONE_NUMBER": r"\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b",
    "CREDIT_CARD": r"\b(?:\d[ -]*?){13,19}\b",
    "IP_ADDRESS": r"\b(?:\d{1,3}\.){3}\d{1,3}\b",
}


def fallback_detect(text: str) -> list[PIIEntity]:
    entities = []
    for entity_type, pattern in FALLBACK_PATTERNS.items():
        for match in re.finditer(pattern, text):
            entities.append(PIIEntity(
                entity_type=entity_type,
                start=match.start(),
                end=match.end(),
                score=0.85,
                original=match.group(),
            ))
    return entities


def fallback_redact(text: str, entities: list[PIIEntity]) -> str:
    result = text
    for entity in sorted(entities, key=lambda e: e.start, reverse=True):
        placeholder = f"[{entity.entity_type}]"
        result = result[:entity.start] + placeholder + result[entity.end:]
    return result


# ---------------------------------------------------------------------------
# Core logic
# ---------------------------------------------------------------------------

def check_compliance(text: str) -> list[str]:
    violations = []
    for rule in COMPLIANCE_RULES:
        for pattern in rule.blocked_patterns:
            if re.search(pattern, text):
                violations.append(f"{rule.framework}: {rule.name}")
                break
    return violations


def detect_pii(text: str, language: str = "en") -> list[PIIEntity]:
    if PRESIDIO_AVAILABLE:
        results = analyzer.analyze(text=text, language=language, entities=None)
        return [
            PIIEntity(
                entity_type=r.entity_type,
                start=r.start,
                end=r.end,
                score=round(r.score, 3),
                original=text[r.start:r.end],
            )
            for r in results
        ]
    return fallback_detect(text)


def redact_text(text: str, entities: list[PIIEntity], language: str = "en") -> str:
    if PRESIDIO_AVAILABLE:
        results = [
            RecognizerResult(
                entity_type=e.entity_type,
                start=e.start,
                end=e.end,
                score=e.score,
            )
            for e in entities
        ]
        operators = {
            "DEFAULT": OperatorConfig("replace", {"new_value": None}),
            "US_SSN": OperatorConfig("replace", {"new_value": "[SSN_REDACTED]"}),
            "CREDIT_CARD": OperatorConfig("replace", {"new_value": "[CARD_REDACTED]"}),
            "EMAIL_ADDRESS": OperatorConfig("replace", {"new_value": "[EMAIL_REDACTED]"}),
            "PHONE_NUMBER": OperatorConfig("replace", {"new_value": "[PHONE_REDACTED]"}),
            "PERSON": OperatorConfig("replace", {"new_value": "[PERSON_REDACTED]"}),
        }
        result = anonymizer.anonymize(
            text=text, analyzer_results=results, operators=operators
        )
        return result.text
    return fallback_redact(text, entities)


def compute_risk_score(entities: list[PIIEntity]) -> float:
    if not entities:
        return 0.0
    weights = {
        "US_SSN": 1.0,
        "CREDIT_CARD": 1.0,
        "MEDICAL_LICENSE": 0.9,
        "IBAN_CODE": 0.8,
        "PERSON": 0.3,
        "EMAIL_ADDRESS": 0.4,
        "PHONE_NUMBER": 0.4,
        "IP_ADDRESS": 0.3,
        "LOCATION": 0.2,
        "DATE_TIME": 0.1,
    }
    max_weight = max(weights.get(e.entity_type, 0.5) * e.score for e in entities)
    density = min(len(entities) / 10.0, 1.0)
    return round(min(max_weight * 0.7 + density * 0.3, 1.0), 3)


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.get("/health")
def health():
    return {
        "status": "ok",
        "presidio_available": PRESIDIO_AVAILABLE,
        "compliance_rules_loaded": len(COMPLIANCE_RULES),
    }


@app.post("/analyze", response_model=AnalyzeResponse)
def analyze(req: AnalyzeRequest):
    entities = detect_pii(req.text, req.language)
    return AnalyzeResponse(
        entities=entities,
        risk_score=compute_risk_score(entities),
    )


@app.post("/sanitize", response_model=SanitizeResponse)
def sanitize(req: SanitizeRequest):
    violations = check_compliance(req.text) if req.enforce_compliance else []

    entities = detect_pii(req.text, req.language)

    if req.deny_list:
        for term in req.deny_list:
            for match in re.finditer(re.escape(term), req.text, re.IGNORECASE):
                entities.append(PIIEntity(
                    entity_type="CUSTOM_DENY",
                    start=match.start(),
                    end=match.end(),
                    score=1.0,
                    original=match.group(),
                ))

    sanitized = redact_text(req.text, entities, req.language)

    return SanitizeResponse(
        original_length=len(req.text),
        sanitized_text=sanitized,
        entities_found=entities,
        compliance_violations=violations,
        blocked=len(violations) > 0,
        redaction_count=len(entities),
    )


@app.get("/rules")
def list_rules():
    return {"rules": COMPLIANCE_RULES}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
