"""
Ingestion CLI — Command-line interface for batch document ingestion.

Usage:
    python -m ingestion.cli --bucket procurement-intelligence-docs --prefix contracts/ --tier internal --doc-type contract
"""

from __future__ import annotations

import asyncio
import argparse
import json
import sys

from retrieval.indexer import S3DocumentIndexer


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Ingest procurement documents from S3 into Pinecone",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python -m ingestion.cli --bucket procurement-docs --prefix contracts/ --tier internal --doc-type contract
  python -m ingestion.cli --bucket procurement-docs --prefix rfps/ --tier partner --doc-type rfp
  python -m ingestion.cli --bucket procurement-docs --tier public --doc-type policy
        """,
    )
    parser.add_argument("--bucket", required=True, help="S3 bucket name")
    parser.add_argument("--prefix", default="", help="S3 key prefix to filter objects")
    parser.add_argument(
        "--tier",
        default="public",
        choices=["internal", "partner", "public"],
        help="Access tier for ingested documents (default: public)",
    )
    parser.add_argument(
        "--doc-type",
        default="general",
        choices=["contract", "rfp", "price_sheet", "policy", "general"],
        help="Document type for metadata tagging (default: general)",
    )
    parser.add_argument("--vendor-id", default=None, help="Vendor ID for vendor-specific documents")

    args = parser.parse_args()

    print(f"🔄 Starting ingestion: bucket={args.bucket}, prefix={args.prefix}")
    print(f"   tier={args.tier}, doc_type={args.doc_type}, vendor_id={args.vendor_id}")

    indexer = S3DocumentIndexer()
    stats = asyncio.run(indexer.ingest_bucket(
        bucket=args.bucket,
        prefix=args.prefix,
        tier_access=args.tier,
        doc_type=args.doc_type,
        vendor_id=args.vendor_id,
    ))

    print(f"\n✅ Ingestion complete:")
    print(json.dumps(stats, indent=2))

    if stats.get("errors", 0) > 0:
        sys.exit(1)


if __name__ == "__main__":
    main()
