"""
Tests for the hybrid retrieval pipeline — RRF fusion, deduplication,
reranker fallback, and multi-query expansion.
"""

from __future__ import annotations

import pytest

from retrieval.retriever import reciprocal_rank_fusion


# ── RRF Fusion Tests ──────────────────────────────────────────────────────────

class TestReciprocalRankFusion:
    def test_single_source_preserves_order(self):
        dense = [
            ({"chunk_id": "a", "content": "doc a"}, 0.9),
            ({"chunk_id": "b", "content": "doc b"}, 0.8),
            ({"chunk_id": "c", "content": "doc c"}, 0.7),
        ]
        result = reciprocal_rank_fusion(dense, [], k=60)
        assert len(result) == 3
        assert result[0][0]["chunk_id"] == "a"
        assert result[1][0]["chunk_id"] == "b"

    def test_dual_source_boosts_overlap(self):
        dense = [
            ({"chunk_id": "a"}, 0.9),
            ({"chunk_id": "b"}, 0.8),
        ]
        sparse = [
            ({"chunk_id": "b"}, 5.0),
            ({"chunk_id": "c"}, 3.0),
        ]
        result = reciprocal_rank_fusion(dense, sparse, k=60)
        # "b" appears in both, should be ranked higher than "a" or "c"
        chunk_ids = [r[0]["chunk_id"] for r in result]
        assert chunk_ids[0] == "b", f"Expected 'b' first (dual-source boost), got {chunk_ids}"

    def test_empty_inputs(self):
        result = reciprocal_rank_fusion([], [], k=60)
        assert result == []

    def test_unique_docs_across_sources(self):
        dense = [({"chunk_id": "a"}, 0.9)]
        sparse = [({"chunk_id": "b"}, 5.0)]
        result = reciprocal_rank_fusion(dense, sparse, k=60)
        assert len(result) == 2

    def test_k_parameter_affects_scoring(self):
        dense = [({"chunk_id": "a"}, 0.9), ({"chunk_id": "b"}, 0.8)]
        # With k=1, rank differences are more pronounced
        result_k1 = reciprocal_rank_fusion(dense, [], k=1)
        result_k100 = reciprocal_rank_fusion(dense, [], k=100)

        # Score gap should be larger with smaller k
        gap_k1 = result_k1[0][1] - result_k1[1][1]
        gap_k100 = result_k100[0][1] - result_k100[1][1]
        assert gap_k1 > gap_k100


# ── Deduplication Tests ───────────────────────────────────────────────────────

class TestDeduplication:
    def test_deduplicate_by_chunk_id(self):
        """Simulate the deduplication logic from researcher_node."""
        docs = [
            {"chunk_id": "a", "content": "first"},
            {"chunk_id": "b", "content": "second"},
            {"chunk_id": "a", "content": "first duplicate"},
        ]
        scores = [0.9, 0.85, 0.7]

        seen_ids: set[str] = set()
        unique_docs = []
        unique_scores = []
        for doc, score in zip(docs, scores):
            chunk_id = doc.get("chunk_id", "")
            if chunk_id not in seen_ids:
                seen_ids.add(chunk_id)
                unique_docs.append(doc)
                unique_scores.append(score)

        assert len(unique_docs) == 2
        assert unique_docs[0]["content"] == "first"  # Keeps first occurrence
        assert unique_scores == [0.9, 0.85]

    def test_no_duplicates_preserves_all(self):
        docs = [{"chunk_id": f"doc_{i}"} for i in range(5)]
        scores = [0.9, 0.8, 0.7, 0.6, 0.5]

        seen_ids: set[str] = set()
        unique_docs = []
        for doc in docs:
            cid = doc.get("chunk_id", "")
            if cid not in seen_ids:
                seen_ids.add(cid)
                unique_docs.append(doc)

        assert len(unique_docs) == 5


# ── Indexer Tests ─────────────────────────────────────────────────────────────

class TestRecursiveChunker:
    def test_short_text_not_split(self):
        from retrieval.indexer import RecursiveChunker
        chunker = RecursiveChunker(chunk_size=1024)
        chunks = chunker.split("Short text.")
        assert len(chunks) == 1
        assert chunks[0] == "Short text."

    def test_long_text_is_split(self):
        from retrieval.indexer import RecursiveChunker
        chunker = RecursiveChunker(chunk_size=100, chunk_overlap=20)
        text = "This is a sentence. " * 50  # ~1000 chars
        chunks = chunker.split(text)
        assert len(chunks) > 1

    def test_empty_text_returns_empty(self):
        from retrieval.indexer import RecursiveChunker
        chunker = RecursiveChunker()
        chunks = chunker.split("")
        assert chunks == []
