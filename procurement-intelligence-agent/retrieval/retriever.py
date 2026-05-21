"""
Hybrid Retriever — Pinecone dense + BM25 sparse search with RRF fusion
and Cohere reranking. Implements multi-query expansion.
"""

from __future__ import annotations

import asyncio
import os
from typing import Any

import cohere
import structlog
from pinecone import Pinecone, ServerlessSpec

from retrieval.embedder import get_embedder

logger = structlog.get_logger(__name__)

# ── Reciprocal Rank Fusion ─────────────────────────────────────────────────────

def reciprocal_rank_fusion(
    dense_results: list[tuple[dict, float]],
    sparse_results: list[tuple[dict, float]],
    k: int = 60,
) -> list[tuple[dict, float]]:
    """Combine dense + sparse rankings using RRF."""
    scores: dict[str, float] = {}
    docs_by_id: dict[str, dict] = {}

    for rank, (doc, _) in enumerate(dense_results):
        doc_id = doc.get("chunk_id", str(rank))
        scores[doc_id] = scores.get(doc_id, 0.0) + 1.0 / (k + rank + 1)
        docs_by_id[doc_id] = doc

    for rank, (doc, _) in enumerate(sparse_results):
        doc_id = doc.get("chunk_id", str(rank))
        scores[doc_id] = scores.get(doc_id, 0.0) + 1.0 / (k + rank + 1)
        docs_by_id[doc_id] = doc

    sorted_ids = sorted(scores, key=lambda x: scores[x], reverse=True)
    return [(docs_by_id[doc_id], scores[doc_id]) for doc_id in sorted_ids]


# ── Hybrid Retriever ──────────────────────────────────────────────────────────

class HybridRetriever:
    """
    Performs hybrid retrieval:
    1. Multi-query expansion (3 query variants)
    2. Dense vector search (Pinecone)
    3. BM25 sparse search (Pinecone sparse index)
    4. RRF fusion
    5. Cohere reranking
    """

    def __init__(self) -> None:
        self._pc = Pinecone(api_key=os.environ["PINECONE_API_KEY"])
        self._index_name = os.environ["PINECONE_INDEX_NAME"]
        self._cohere = cohere.AsyncClient(api_key=os.environ["COHERE_API_KEY"])
        self._embedder = get_embedder()

    def _get_index(self):
        return self._pc.Index(self._index_name)

    async def _expand_queries(self, query: str) -> list[str]:
        """Generate 3 query variants for multi-query retrieval."""
        # Simple rule-based expansion; in production use LLM
        return [
            query,
            f"procurement {query}",
            f"vendor contract {query}",
        ]

    async def _dense_search(
        self,
        query: str,
        top_k: int,
        metadata_filter: dict | None,
    ) -> list[tuple[dict, float]]:
        """Dense vector search via Pinecone."""
        embedding = await self._embedder.embed(query)
        index = self._get_index()

        response = index.query(
            vector=embedding,
            top_k=top_k * 2,  # Over-fetch before reranking
            filter=metadata_filter,
            include_metadata=True,
        )

        return [
            (
                {
                    "chunk_id": match.id,
                    "content": match.metadata.get("content", ""),
                    "source": match.metadata.get("source", ""),
                    "doc_type": match.metadata.get("doc_type", ""),
                    "vendor_id": match.metadata.get("vendor_id", ""),
                },
                match.score,
            )
            for match in response.matches
        ]

    async def retrieve(
        self,
        query: str,
        top_k: int = 5,
        tier_filter: str | None = None,
        metadata_filter: dict | None = None,
    ) -> tuple[list[dict], list[float]]:
        """
        Full hybrid retrieval pipeline with multi-query + RRF + rerank.

        Returns:
            Tuple of (docs, scores) sorted by reranker score descending.
        """
        # Build metadata filter
        if metadata_filter is None:
            metadata_filter = {}

        if tier_filter:
            tier_access_map = {
                "INTERNAL": ["internal", "partner", "public"],
                "PARTNER": ["partner", "public"],
                "PUBLIC": ["public"],
            }
            metadata_filter["tier_access"] = {
                "$in": tier_access_map.get(tier_filter, ["public"])
            }

        # Step 1: Multi-query expansion
        queries = await self._expand_queries(query)

        # Step 2: Dense search across all query variants (parallel)
        dense_tasks = [
            self._dense_search(q, top_k, metadata_filter) for q in queries
        ]
        dense_results_all = await asyncio.gather(*dense_tasks)
        all_dense: list[tuple[dict, float]] = []
        for results in dense_results_all:
            all_dense.extend(results)

        # Step 3: RRF fusion (dense only for now; sparse requires Pinecone hybrid index)
        fused = reciprocal_rank_fusion(all_dense, [], k=60)
        fused = fused[: top_k * 3]  # Keep top candidates for reranking

        if not fused:
            return [], []

        # Step 4: Cohere reranking
        docs = [item[0] for item in fused]
        doc_texts = [d.get("content", "") for d in docs]

        try:
            rerank_response = await self._cohere.rerank(
                query=query,
                documents=doc_texts,
                top_n=top_k,
                model="rerank-english-v3.0",
            )
            reranked_indices = [r.index for r in rerank_response.results]
            reranked_scores = [r.relevance_score for r in rerank_response.results]
            final_docs = [docs[i] for i in reranked_indices]
            final_scores = reranked_scores

        except Exception as exc:
            logger.warning("retriever.rerank_failed", error=str(exc))
            # Fallback: use RRF scores directly
            final_docs = [d for d, _ in fused[:top_k]]
            final_scores = [s for _, s in fused[:top_k]]

        logger.info(
            "retriever.complete",
            query=query,
            doc_count=len(final_docs),
            top_score=round(final_scores[0], 4) if final_scores else 0,
        )

        return final_docs, final_scores
