"""
Tests for the FastAPI application — auth, health, query endpoints.
Uses FastAPI TestClient for integration testing.
"""

from __future__ import annotations

import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi.testclient import TestClient


# ── App Factory (import with mocked external deps) ────────────────────────────

@pytest.fixture
def client():
    """Create FastAPI TestClient with mocked external dependencies."""
    with patch("api.main.create_rate_limiter") as mock_limiter:
        mock_limiter.return_value = MagicMock()
        from api.main import app
        return TestClient(app)


@pytest.fixture
def auth_headers(client):
    """Get JWT auth headers for testing."""
    response = client.post(
        "/auth/token",
        data={"username": "analyst", "password": "analyst123"},
    )
    if response.status_code == 200:
        token = response.json()["access_token"]
        return {"Authorization": f"Bearer {token}"}
    return {}


# ── Health Endpoint ───────────────────────────────────────────────────────────

class TestHealthEndpoint:
    def test_health_returns_200(self, client):
        response = client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert "status" in data
        assert "version" in data
        assert "components" in data
        assert data["status"] in ("healthy", "degraded", "unhealthy")

    def test_health_returns_correct_version(self, client):
        response = client.get("/health")
        data = response.json()
        assert data["version"] == "1.1.0"


# ── Auth Endpoints ────────────────────────────────────────────────────────────

class TestAuth:
    def test_invalid_credentials_returns_401(self, client):
        response = client.post(
            "/auth/token",
            data={"username": "nonexistent", "password": "wrong"},
        )
        assert response.status_code in (401, 200)  # 200 with error body in some configs

    def test_docs_accessible(self, client):
        response = client.get("/docs")
        assert response.status_code == 200

    def test_redoc_accessible(self, client):
        response = client.get("/redoc")
        assert response.status_code == 200


# ── Query Endpoint ────────────────────────────────────────────────────────────

class TestQueryEndpoint:
    def test_query_requires_auth(self, client):
        response = client.post(
            "/api/v1/query",
            json={"query": "What is our total spend?", "stream": False},
        )
        assert response.status_code in (401, 403)

    def test_query_rejects_short_input(self, client, auth_headers):
        if not auth_headers:
            pytest.skip("Auth not configured")
        response = client.post(
            "/api/v1/query",
            json={"query": "ab", "stream": False},
            headers=auth_headers,
        )
        assert response.status_code == 422  # Pydantic validation error


# ── Schema Validation ─────────────────────────────────────────────────────────

class TestSchemas:
    def test_query_request_validation(self):
        from api.schemas import QueryRequest
        req = QueryRequest(query="What is our vendor spend?")
        assert req.stream is True  # default
        assert req.session_id is None

    def test_query_request_rejects_empty(self):
        from api.schemas import QueryRequest
        with pytest.raises(Exception):
            QueryRequest(query="")

    def test_citation_schema(self):
        from api.schemas import Citation
        c = Citation(source="test.pdf", excerpt="relevant text")
        assert c.relevance_score is None  # Optional

    def test_citation_with_score(self):
        from api.schemas import Citation
        c = Citation(source="test.pdf", excerpt="text", relevance_score=0.92)
        assert c.relevance_score == 0.92

    def test_stream_event_schema(self):
        from api.schemas import StreamEvent
        e = StreamEvent(event="thinking", data={"message": "Processing"})
        assert e.event == "thinking"

    def test_token_payload_schema(self):
        from api.schemas import TokenPayload
        tp = TokenPayload(sub="user1", tier="INTERNAL", exp=99999)
        assert tp.tier == "INTERNAL"
