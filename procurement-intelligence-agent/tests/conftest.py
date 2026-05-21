"""
Pytest fixtures shared across all test modules.
Provides mocked Bedrock, Pinecone, and Cohere clients.
"""

from __future__ import annotations

import os
from unittest.mock import AsyncMock, MagicMock, patch

import pytest


# ── Environment defaults for testing ──────────────────────────────────────────

@pytest.fixture(autouse=True)
def mock_env(monkeypatch):
    """Inject test environment variables."""
    env_vars = {
        "AWS_REGION": "us-east-1",
        "PINECONE_API_KEY": "test-pinecone-key",
        "PINECONE_INDEX_NAME": "test-index",
        "COHERE_API_KEY": "test-cohere-key",
        "PERPLEXITY_API_KEY": "test-perplexity-key",
        "BEDROCK_GUARDRAIL_ID": "test-guardrail-id",
        "BEDROCK_GUARDRAIL_VERSION": "1",
        "DB_USER": "admin",
        "DB_PASSWORD": "testpassword",
        "DB_HOST": "localhost",
        "DB_PORT": "3306",
        "DB_NAME": "procurement",
        "JWT_SECRET_KEY": "test-jwt-secret-key-for-unit-tests-only",
        "JWT_ALGORITHM": "HS256",
        "LANGCHAIN_API_KEY": "test-langchain-key",
        "LANGCHAIN_PROJECT": "test-project",
        "USE_BEDROCK_EMBEDDINGS": "false",
    }
    for key, value in env_vars.items():
        monkeypatch.setenv(key, value)


@pytest.fixture
def mock_bedrock_client():
    """Mock boto3 bedrock-runtime client."""
    client = MagicMock()
    client.invoke_model.return_value = {
        "body": MagicMock(
            read=MagicMock(return_value=b'{"content": [{"text": "test response"}]}')
        ),
    }
    client.apply_guardrail.return_value = {
        "action": "NONE",
        "assessments": [],
    }
    return client


@pytest.fixture
def mock_pinecone_index():
    """Mock Pinecone Index."""
    index = MagicMock()
    index.query.return_value = MagicMock(
        matches=[
            MagicMock(
                id="chunk_1",
                score=0.92,
                metadata={"content": "Test document content", "source": "test.pdf", "doc_type": "contract"},
            ),
            MagicMock(
                id="chunk_2",
                score=0.85,
                metadata={"content": "Another document", "source": "rfp.pdf", "doc_type": "rfp"},
            ),
        ]
    )
    index.upsert.return_value = {}
    return index


@pytest.fixture
def mock_cohere_client():
    """Mock Cohere async client."""
    client = AsyncMock()
    client.rerank.return_value = MagicMock(
        results=[
            MagicMock(index=0, relevance_score=0.95),
            MagicMock(index=1, relevance_score=0.82),
        ]
    )
    client.embed.return_value = MagicMock(
        embeddings=[[0.1] * 1024]
    )
    return client


@pytest.fixture
def sample_agent_state():
    """Create a minimal AgentState for testing."""
    from agents.state import default_state
    return default_state(
        query="What is our total spend by vendor?",
        user_id="test_user",
        tier="INTERNAL",
        session_id="test_session",
        max_iterations=5,
    )
