"""
Document Indexer — S3 → Parse → Chunk → Embed → Pinecone upsert pipeline.
Ingests procurement documents (PDFs, CSVs, DOCX) into the vector database.
"""

from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path
from typing import Any

import boto3
import structlog
from pinecone import Pinecone

from retrieval.embedder import get_embedder

logger = structlog.get_logger(__name__)


# ── Text Splitter ─────────────────────────────────────────────────────────────

class RecursiveChunker:
    """Split text into overlapping chunks for embedding."""

    def __init__(self, chunk_size: int = 1024, chunk_overlap: int = 128) -> None:
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap
        self._separators = ["\n\n", "\n", ". ", " "]

    def split(self, text: str) -> list[str]:
        """Recursively split text into chunks."""
        chunks: list[str] = []
        self._split_recursive(text, self._separators, chunks)
        return chunks

    def _split_recursive(self, text: str, separators: list[str], chunks: list[str]) -> None:
        if len(text) <= self.chunk_size:
            if text.strip():
                chunks.append(text.strip())
            return

        sep = separators[0] if separators else ""
        remaining_seps = separators[1:] if separators else []

        parts = text.split(sep) if sep else [text[i:i + self.chunk_size] for i in range(0, len(text), self.chunk_size)]

        current = ""
        for part in parts:
            candidate = f"{current}{sep}{part}" if current else part
            if len(candidate) <= self.chunk_size:
                current = candidate
            else:
                if current.strip():
                    chunks.append(current.strip())
                if len(part) > self.chunk_size and remaining_seps:
                    self._split_recursive(part, remaining_seps, chunks)
                else:
                    current = part[-self.chunk_overlap:] + part if self.chunk_overlap else part
                    current = part


# ── Document Parser ──────────────────────────────────────────────────────────

class DocumentParser:
    """Parse various document formats into plain text."""

    @staticmethod
    def parse(content: bytes, filename: str) -> str:
        """Parse bytes content into text based on file extension."""
        ext = Path(filename).suffix.lower()

        if ext == ".pdf":
            return DocumentParser._parse_pdf(content)
        elif ext in (".csv", ".tsv"):
            return content.decode("utf-8", errors="replace")
        elif ext == ".txt":
            return content.decode("utf-8", errors="replace")
        elif ext == ".json":
            data = json.loads(content)
            return json.dumps(data, indent=2)
        elif ext in (".docx",):
            return DocumentParser._parse_docx(content)
        else:
            return content.decode("utf-8", errors="replace")

    @staticmethod
    def _parse_pdf(content: bytes) -> str:
        """Parse PDF using pypdf."""
        try:
            from pypdf import PdfReader
            import io
            reader = PdfReader(io.BytesIO(content))
            return "\n\n".join(page.extract_text() or "" for page in reader.pages)
        except ImportError:
            logger.warning("parser.pypdf_not_installed")
            return content.decode("utf-8", errors="replace")

    @staticmethod
    def _parse_docx(content: bytes) -> str:
        """Parse DOCX using python-docx."""
        try:
            from docx import Document
            import io
            doc = Document(io.BytesIO(content))
            return "\n\n".join(p.text for p in doc.paragraphs if p.text.strip())
        except ImportError:
            logger.warning("parser.python_docx_not_installed")
            return content.decode("utf-8", errors="replace")


# ── S3 Document Indexer ──────────────────────────────────────────────────────

class S3DocumentIndexer:
    """
    Ingest documents from S3 into Pinecone.

    Flow: S3 → Download → Parse → Chunk → Embed → Upsert

    Usage:
        indexer = S3DocumentIndexer()
        stats = await indexer.ingest_bucket(
            bucket="procurement-intelligence-docs",
            prefix="contracts/",
            tier_access="partner",
            doc_type="contract",
        )
    """

    BATCH_SIZE = 50

    def __init__(self) -> None:
        self._s3 = boto3.client("s3", region_name=os.getenv("AWS_REGION", "us-east-1"))
        self._pc = Pinecone(api_key=os.environ["PINECONE_API_KEY"])
        self._index_name = os.environ["PINECONE_INDEX_NAME"]
        self._embedder = get_embedder()
        self._chunker = RecursiveChunker()
        self._parser = DocumentParser()

    async def ingest_bucket(
        self,
        bucket: str,
        prefix: str = "",
        tier_access: str = "public",
        doc_type: str = "general",
        vendor_id: str | None = None,
    ) -> dict[str, Any]:
        """
        Ingest all documents from an S3 prefix into Pinecone.

        Returns:
            Stats dict with counts of files processed, chunks created, etc.
        """
        stats = {"files_processed": 0, "chunks_created": 0, "errors": 0}
        index = self._pc.Index(self._index_name)

        # List objects in the prefix
        paginator = self._s3.get_paginator("list_objects_v2")
        all_keys: list[str] = []
        for page in paginator.paginate(Bucket=bucket, Prefix=prefix):
            for obj in page.get("Contents", []):
                all_keys.append(obj["Key"])

        logger.info("indexer.found_objects", bucket=bucket, prefix=prefix, count=len(all_keys))

        for key in all_keys:
            try:
                # Download
                response = self._s3.get_object(Bucket=bucket, Key=key)
                content = response["Body"].read()
                filename = Path(key).name

                # Parse
                text = self._parser.parse(content, filename)
                if not text.strip():
                    continue

                # Chunk
                chunks = self._chunker.split(text)

                # Embed + build vectors
                vectors = []
                for i, chunk in enumerate(chunks):
                    chunk_id = hashlib.sha256(f"{key}:{i}".encode()).hexdigest()[:16]
                    embedding = await self._embedder.embed(chunk)

                    vectors.append({
                        "id": chunk_id,
                        "values": embedding,
                        "metadata": {
                            "content": chunk[:2000],  # Pinecone metadata size limit
                            "source": filename,
                            "s3_key": key,
                            "chunk_index": i,
                            "total_chunks": len(chunks),
                            "doc_type": doc_type,
                            "tier_access": tier_access,
                            "vendor_id": vendor_id or "",
                        },
                    })

                # Batch upsert to Pinecone
                for batch_start in range(0, len(vectors), self.BATCH_SIZE):
                    batch = vectors[batch_start : batch_start + self.BATCH_SIZE]
                    index.upsert(vectors=batch)

                stats["files_processed"] += 1
                stats["chunks_created"] += len(chunks)
                logger.info("indexer.file_processed", key=key, chunks=len(chunks))

            except Exception as exc:
                stats["errors"] += 1
                logger.error("indexer.file_error", key=key, error=str(exc))

        logger.info("indexer.complete", stats=stats)
        return stats


# ── CLI entrypoint ────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import asyncio
    import argparse

    parser = argparse.ArgumentParser(description="Ingest S3 documents into Pinecone")
    parser.add_argument("--bucket", required=True, help="S3 bucket name")
    parser.add_argument("--prefix", default="", help="S3 key prefix")
    parser.add_argument("--tier", default="public", choices=["internal", "partner", "public"])
    parser.add_argument("--doc-type", default="general", choices=["contract", "rfp", "price_sheet", "policy", "general"])
    parser.add_argument("--vendor-id", default=None)

    args = parser.parse_args()

    indexer = S3DocumentIndexer()
    stats = asyncio.run(indexer.ingest_bucket(
        bucket=args.bucket,
        prefix=args.prefix,
        tier_access=args.tier,
        doc_type=args.doc_type,
        vendor_id=args.vendor_id,
    ))
    print(json.dumps(stats, indent=2))
