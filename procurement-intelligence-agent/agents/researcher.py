"""
Researcher Agent — Handles RAG (Pinecone hybrid search + rerank) and
live web search via Perplexity API through the MCP tool server.
Calls tools via MCPToolClient (MCP protocol in prod, direct fallback in dev).
"""

from __future__ import annotations

import structlog
from langchain_core.messages import AIMessage
from langchain_core.runnables import RunnableConfig

from agents.mcp_client import get_mcp_client
from agents.state import AgentState

logger = structlog.get_logger(__name__)


async def researcher_node(state: AgentState, config: RunnableConfig) -> dict:
    """
    LangGraph node: RAG retrieval + optional web search.
    Uses MCP protocol to call search_docs and search_web tools.
    Returns partial state update with context_docs, web_results, retrieval_scores,
    and appended messages for conversation history.
    """
    cfg = config.get("configurable", {})
    top_k = cfg.get("retrieval_top_k", 5)

    queries = state["sub_queries"] or [state["original_query"]]
    tier = state["tier"]

    logger.info("researcher.start", queries=queries, tier=tier)

    mcp = get_mcp_client()

    # ── Step 1: Document retrieval via MCP search_docs tool ───────────────────
    all_docs: list[dict] = []
    all_scores: list[float] = []

    for query in queries:
        try:
            result = await mcp.invoke_tool(
                "search_docs",
                query=query,
                top_k=top_k,
                tier=tier,
            )
            chunks = result.get("chunks", []) if isinstance(result, dict) else []
            for chunk in chunks:
                all_docs.append({
                    "chunk_id": chunk.get("chunk_id", chunk.get("id", "")),
                    "content": chunk.get("content", ""),
                    "source": chunk.get("source", ""),
                    "doc_type": chunk.get("doc_type", ""),
                    "vendor_id": chunk.get("vendor_id", ""),
                })
                all_scores.append(float(chunk.get("score", 0.0)))
        except Exception as exc:
            logger.warning("researcher.search_docs_failed", query=query, error=str(exc))

    # Deduplicate by chunk_id
    seen_ids: set[str] = set()
    unique_docs: list[dict] = []
    unique_scores: list[float] = []
    for doc, score in zip(all_docs, all_scores):
        chunk_id = doc.get("chunk_id", doc.get("id", ""))
        if chunk_id not in seen_ids:
            seen_ids.add(chunk_id)
            unique_docs.append(doc)
            unique_scores.append(score)

    logger.info("researcher.retrieved", doc_count=len(unique_docs))

    # ── Step 2: Web search via MCP search_web tool if coverage is low ─────────
    web_results: list[dict] = []
    avg_score = sum(unique_scores) / len(unique_scores) if unique_scores else 0.0

    if avg_score < 0.65 or len(unique_docs) < 3:
        logger.info("researcher.web_search_triggered", avg_score=avg_score)
        primary_query = queries[0] if queries else state["original_query"]
        try:
            result = await mcp.invoke_tool(
                "search_web",
                query=primary_query,
                max_results=5,
            )
            web_results = result.get("results", []) if isinstance(result, dict) else []
        except Exception as exc:
            logger.warning("researcher.web_search_failed", error=str(exc))

    logger.info(
        "researcher.complete",
        docs=len(unique_docs),
        web_results=len(web_results),
        avg_retrieval_score=round(avg_score, 3),
    )

    # Build summary message for conversation history
    summary = (
        f"Retrieved {len(unique_docs)} documents (avg score: {avg_score:.3f})"
        f" and {len(web_results)} web results for queries: {queries}"
    )

    return {
        "context_docs": unique_docs,
        "web_results": web_results,
        "retrieval_scores": unique_scores,
        "messages": [AIMessage(content=f"[Researcher] {summary}")],
    }
