"""
FastMCP Server — Exposes procurement tools via the Model Context Protocol.
Tools: search_docs, search_web, query_database

Run with: uv run python -m mcp_server.server
Or as HTTP: uv run python -m mcp_server.server --transport http --port 8080
"""

from __future__ import annotations

import os

import structlog
from fastmcp import FastMCP

from mcp_server.tools.search_docs import search_docs_tool
from mcp_server.tools.search_web import search_web_tool
from mcp_server.tools.query_database import query_database_tool

logger = structlog.get_logger(__name__)

# ── MCP server instance ───────────────────────────────────────────────────────

mcp = FastMCP(
    name="procurement-intelligence-tools",
    version="1.0.0",
    description="MCP tool server for the Enterprise Procurement Intelligence Agent. "
                "Provides document search (Pinecone), web search (Perplexity), "
                "and structured data queries (RDS MySQL via Vanna AI).",
)


# ── Register tools ────────────────────────────────────────────────────────────

@mcp.tool()
async def search_docs(
    query: str,
    top_k: int = 5,
    doc_type: str | None = None,
    vendor_id: str | None = None,
    tier: str = "PUBLIC",
) -> dict:
    """
    Search procurement documents using hybrid vector search (Pinecone).
    Supports filtering by document type and vendor ID.

    Args:
        query: Natural language search query
        top_k: Number of results to return (max 20)
        doc_type: Filter by type: 'contract', 'rfp', 'price_sheet', 'policy'
        vendor_id: Filter by specific vendor identifier
        tier: Access tier for metadata filtering (INTERNAL/PARTNER/PUBLIC)

    Returns:
        dict with 'chunks' (list of document chunks with scores) and 'metadata'
    """
    return await search_docs_tool(
        query=query,
        top_k=min(top_k, 20),
        doc_type=doc_type,
        vendor_id=vendor_id,
        tier=tier,
    )


@mcp.tool()
async def search_web(
    query: str,
    max_results: int = 5,
    focus: str = "procurement",
) -> dict:
    """
    Search the live web using Perplexity API for up-to-date procurement intelligence.

    Args:
        query: Search query
        max_results: Number of results (max 10)
        focus: Domain focus hint for Perplexity: 'procurement', 'market', 'regulatory'

    Returns:
        dict with 'results' list, each having title, url, snippet, published_date
    """
    return await search_web_tool(
        query=query,
        max_results=min(max_results, 10),
        focus=focus,
    )


@mcp.tool()
async def query_database(
    question: str,
    tier: str = "PUBLIC",
    dry_run: bool = False,
) -> dict:
    """
    Execute natural language queries against the procurement MySQL database via Vanna AI.
    Generates, validates, and executes SQL safely.

    Args:
        question: Natural language question about procurement data
        tier: Access tier controls row limits (INTERNAL=500, PARTNER=100, PUBLIC=25)
        dry_run: If True, returns the generated SQL without executing it

    Returns:
        dict with 'sql' (generated query), 'results' (rows), 'row_count', and 'error' if any
    """
    return await query_database_tool(
        question=question,
        tier=tier,
        dry_run=dry_run,
    )


# ── Server entrypoint ─────────────────────────────────────────────────────────

if __name__ == "__main__":
    import sys

    transport = "stdio"
    if "--transport" in sys.argv:
        idx = sys.argv.index("--transport")
        transport = sys.argv[idx + 1]

    port = 8080
    if "--port" in sys.argv:
        idx = sys.argv.index("--port")
        port = int(sys.argv[idx + 1])

    logger.info("mcp_server.starting", transport=transport, port=port)

    if transport == "http":
        mcp.run(transport="streamable-http", host="0.0.0.0", port=port)
    else:
        mcp.run(transport="stdio")
