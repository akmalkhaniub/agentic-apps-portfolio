"""
search_docs MCP Tool — Pinecone hybrid search with reranking.
"""

from __future__ import annotations

from typing import Any

import structlog
from retrieval.retriever import HybridRetriever

logger = structlog.get_logger(__name__)

_retriever: HybridRetriever | None = None


def _get_retriever() -> HybridRetriever:
    global _retriever
    if _retriever is None:
        _retriever = HybridRetriever()
    return _retriever


async def search_docs_tool(
    query: str,
    top_k: int = 5,
    doc_type: str | None = None,
    vendor_id: str | None = None,
    tier: str = "PUBLIC",
) -> dict[str, Any]:
    """Pinecone hybrid search with metadata filtering + Cohere rerank."""
    logger.info("tool.search_docs", query=query, top_k=top_k, tier=tier)

    retriever = _get_retriever()

    # Build Pinecone metadata filter
    filters: dict[str, Any] = {}
    if doc_type:
        filters["doc_type"] = {"$eq": doc_type}
    if vendor_id:
        filters["vendor_id"] = {"$eq": vendor_id}

    # Tier-based access filter
    tier_access_map = {
        "INTERNAL": ["internal", "partner", "public"],
        "PARTNER": ["partner", "public"],
        "PUBLIC": ["public"],
    }
    filters["tier_access"] = {"$in": tier_access_map.get(tier, ["public"])}

    try:
        docs, scores = await retriever.retrieve(
            query=query,
            top_k=top_k,
            metadata_filter=filters,
        )
        return {
            "chunks": [
                {
                    "content": doc.get("content", ""),
                    "source": doc.get("source", ""),
                    "doc_type": doc.get("doc_type", ""),
                    "vendor_id": doc.get("vendor_id", ""),
                    "chunk_id": doc.get("chunk_id", ""),
                    "relevance_score": round(score, 4),
                }
                for doc, score in zip(docs, scores)
            ],
            "metadata": {"query": query, "retrieved": len(docs), "tier": tier},
        }
    except Exception as exc:
        logger.error("tool.search_docs.error", error=str(exc))
        return {"chunks": [], "metadata": {"error": str(exc)}}
