"""
Pydantic schemas for the FastAPI service.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field


# ── Request schemas ───────────────────────────────────────────────────────────

class QueryRequest(BaseModel):
    query: str = Field(..., min_length=3, max_length=2000, description="Natural language procurement query")
    session_id: str | None = Field(None, description="Session ID for conversation continuity")
    stream: bool = Field(True, description="Stream the response via SSE")

    model_config = {"json_schema_extra": {
        "example": {
            "query": "Which vendors have overdue invoices above $50,000 this quarter?",
            "session_id": "sess_abc123",
            "stream": True,
        }
    }}


# ── Response schemas ──────────────────────────────────────────────────────────

class Citation(BaseModel):
    source: str
    excerpt: str
    relevance_score: float | None = None


class QueryResponse(BaseModel):
    answer: str
    citations: list[Citation] = []
    confidence_score: float = Field(ge=0.0, le=1.0)
    sql_query: str | None = None          # Included for INTERNAL tier only
    session_id: str
    trace_url: str | None = None          # LangSmith trace URL
    processing_time_ms: int
    tier: Literal["INTERNAL", "PARTNER", "PUBLIC"]


class StreamEvent(BaseModel):
    """SSE event payload for streaming responses."""
    event: Literal["thinking", "retrieving", "sql_query", "writing", "complete", "error"]
    data: dict[str, Any]


class HealthResponse(BaseModel):
    status: Literal["healthy", "degraded", "unhealthy"]
    timestamp: datetime
    version: str
    components: dict[str, str]           # component → "ok" | "error"


# ── Auth schemas ──────────────────────────────────────────────────────────────

class TokenRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int                      # Seconds
    tier: Literal["INTERNAL", "PARTNER", "PUBLIC"]


class TokenPayload(BaseModel):
    sub: str                             # user_id
    tier: Literal["INTERNAL", "PARTNER", "PUBLIC"]
    exp: int                             # Unix timestamp
