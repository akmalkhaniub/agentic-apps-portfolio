"""
Ingestion CLI — Re-exports the S3DocumentIndexer from retrieval.indexer
for backward compatibility and provides convenience functions.

Usage:
    python -m ingestion.cli --bucket procurement-docs --prefix contracts/ --tier internal
"""

from __future__ import annotations

from retrieval.indexer import S3DocumentIndexer, RecursiveChunker, DocumentParser

__all__ = ["S3DocumentIndexer", "RecursiveChunker", "DocumentParser"]
