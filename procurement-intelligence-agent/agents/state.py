"""
Shared LangGraph state schema for the Procurement Intelligence Agent.
All agents read from and write to this typed state dict.
"""

from __future__ import annotations

from typing import Annotated, Any, Literal
from typing_extensions import TypedDict

from langchain_core.messages import BaseMessage
from langgraph.graph.message import add_messages


# ── User Tier ────────────────────────────────────────────────────────────────

TierType = Literal["INTERNAL", "PARTNER", "PUBLIC"]


# ── Agent State ───────────────────────────────────────────────────────────────

class AgentState(TypedDict):
    """Central shared state for the multi-agent procurement graph."""

    # ── Message history (append-only via add_messages reducer) ──
    messages: Annotated[list[BaseMessage], add_messages]

    # ── User context ──
    user_id: str
    tier: TierType
    session_id: str

    # ── Query decomposition ──
    original_query: str
    sub_queries: list[str]           # Supervisor-generated query breakdown

    # ── Researcher outputs ──
    context_docs: list[dict[str, Any]]   # Retrieved chunks + metadata
    web_results: list[dict[str, Any]]    # Perplexity search results
    retrieval_scores: list[float]        # Reranker scores per chunk

    # ── SQL Analyst outputs ──
    sql_query: str                   # Generated SQL (for audit)
    sql_results: list[dict[str, Any]]  # Raw rows from RDS
    sql_error: str | None            # Validation/execution error if any

    # ── Writer outputs ──
    draft_answer: str
    citations: list[dict[str, str]]  # [{"source": "...", "excerpt": "..."}]

    # ── Supervisor control ──
    next_agent: str                  # Which agent to call next
    iterations: int                  # Loop counter (prevents infinite loops)
    max_iterations: int              # Configurable per tier

    # ── Guardrail flags ──
    guardrail_triggered: bool
    guardrail_reason: str | None

    # ── Final output ──
    final_answer: str
    confidence_score: float          # 0.0 – 1.0


# ── Default state factory ─────────────────────────────────────────────────────

def default_state(
    query: str,
    user_id: str,
    tier: TierType,
    session_id: str,
    max_iterations: int = 5,
) -> AgentState:
    """Create a fresh state for a new query."""
    return AgentState(
        messages=[],
        user_id=user_id,
        tier=tier,
        session_id=session_id,
        original_query=query,
        sub_queries=[],
        context_docs=[],
        web_results=[],
        retrieval_scores=[],
        sql_query="",
        sql_results=[],
        sql_error=None,
        draft_answer="",
        citations=[],
        next_agent="supervisor",
        iterations=0,
        max_iterations=max_iterations,
        guardrail_triggered=False,
        guardrail_reason=None,
        final_answer="",
        confidence_score=0.0,
    )
