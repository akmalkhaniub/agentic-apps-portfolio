"""
Embedder — Wraps Amazon Titan Embeddings v2 via boto3 for consistency.
Falls back to Cohere Embed v3 if Bedrock is unavailable locally.
Uses asyncio.to_thread for non-blocking boto3 calls.
"""

from __future__ import annotations

import asyncio
import json
import os
from typing import Protocol

import boto3
import structlog

logger = structlog.get_logger(__name__)


class EmbedderProtocol(Protocol):
    async def embed(self, text: str) -> list[float]: ...
    async def embed_batch(self, texts: list[str]) -> list[list[float]]: ...


class TitanEmbedder:
    """Amazon Titan Text Embeddings v2 via Bedrock (non-blocking)."""

    MODEL_ID = "amazon.titan-embed-text-v2:0"
    DIMENSIONS = 1024

    def __init__(self) -> None:
        self._client = boto3.client(
            "bedrock-runtime",
            region_name=os.getenv("AWS_REGION", "us-east-1"),
        )

    def _embed_sync(self, text: str) -> list[float]:
        """Synchronous embed — run via asyncio.to_thread."""
        body = json.dumps({"inputText": text, "dimensions": self.DIMENSIONS})
        response = self._client.invoke_model(
            modelId=self.MODEL_ID,
            contentType="application/json",
            accept="application/json",
            body=body,
        )
        result = json.loads(response["body"].read())
        return result["embedding"]

    async def embed(self, text: str) -> list[float]:
        # FIX #11: Non-blocking via thread pool
        return await asyncio.to_thread(self._embed_sync, text)

    async def embed_batch(self, texts: list[str]) -> list[list[float]]:
        return await asyncio.gather(*[self.embed(t) for t in texts])


class CohereEmbedder:
    """Cohere Embed v3 — local development fallback."""

    MODEL = "embed-english-v3.0"

    def __init__(self) -> None:
        import cohere
        self._client = cohere.AsyncClient(api_key=os.environ["COHERE_API_KEY"])

    async def embed(self, text: str) -> list[float]:
        response = await self._client.embed(
            texts=[text],
            model=self.MODEL,
            input_type="search_query",
        )
        return response.embeddings[0]

    async def embed_batch(self, texts: list[str]) -> list[list[float]]:
        response = await self._client.embed(
            texts=texts,
            model=self.MODEL,
            input_type="search_document",
        )
        return response.embeddings


_embedder: EmbedderProtocol | None = None


def get_embedder() -> EmbedderProtocol:
    """Return singleton embedder (Titan in prod, Cohere locally)."""
    global _embedder
    if _embedder is None:
        use_bedrock = os.getenv("USE_BEDROCK_EMBEDDINGS", "true").lower() == "true"
        _embedder = TitanEmbedder() if use_bedrock else CohereEmbedder()
        logger.info("embedder.initialized", type=type(_embedder).__name__)
    return _embedder
