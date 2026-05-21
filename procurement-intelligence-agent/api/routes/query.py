"""
Query Route — SSE-streaming endpoint wrapping the LangGraph multi-agent graph.
Emits real-time events as agents execute, ends with the final answer.
"""

from __future__ import annotations

import json
import time
import uuid
from typing import AsyncGenerator

import structlog
from fastapi import APIRouter, Depends, HTTPException, Request
from sse_starlette.sse import EventSourceResponse

from agents.graph import get_graph
from agents.state import default_state
from api.auth import get_current_user
from api.schemas import Citation, QueryRequest, QueryResponse, StreamEvent, TokenPayload
from guardrails.tiers import get_tier_config

logger = structlog.get_logger(__name__)
router = APIRouter()


# ── SSE event generator ───────────────────────────────────────────────────────

async def stream_agent_response(
    query: str,
    session_id: str,
    user: TokenPayload,
    request: Request,
) -> AsyncGenerator[str, None]:
    """Stream agent execution events as Server-Sent Events."""
    tier = user.tier
    tier_config = get_tier_config(tier)

    graph = get_graph()
    state = default_state(
        query=query,
        user_id=user.sub,
        tier=tier,
        session_id=session_id,
        max_iterations=5,
    )

    config = {
        "configurable": {
            "model_id": "anthropic.claude-3-5-sonnet-20241022-v2:0",
            "aws_region": "us-east-1",
            "retrieval_top_k": 5 if tier == "INTERNAL" else 3,
        },
        "run_name": f"procurement-query-{session_id}",
        "tags": ["procurement", tier.lower()],
    }

    start_time = time.time()
    final_state = None

    try:
        # Emit start event
        yield _sse(StreamEvent(
            event="thinking",
            data={"message": "Supervisor analysing your query...", "tier": tier},
        ))

        # FIX #1: Use astream() to both stream events AND capture final state
        # in a single graph execution — no double invocation.
        async for event in graph.astream_events(state, config=config, version="v2"):
            kind = event.get("event", "")
            name = event.get("name", "")

            # Node-level events → emit to client
            if kind == "on_chain_start":
                if name in ("researcher", "sql_analyst", "writer", "supervisor"):
                    evt_map = {
                        "researcher": ("retrieving", "Searching procurement documents..."),
                        "sql_analyst": ("sql_query", "Querying procurement database..."),
                        "writer": ("writing", "Synthesising answer with citations..."),
                        "supervisor": ("thinking", "Supervisor routing decision..."),
                    }
                    event_type, message = evt_map.get(name, ("thinking", "Processing..."))
                    yield _sse(StreamEvent(event=event_type, data={"message": message, "agent": name}))

            elif kind == "on_chain_end" and name == "sql_analyst":
                # Emit SQL query to INTERNAL users for transparency
                output = event.get("data", {}).get("output", {})
                if tier == "INTERNAL" and output.get("sql_query"):
                    yield _sse(StreamEvent(
                        event="sql_query",
                        data={"sql": output["sql_query"], "rows": len(output.get("sql_results", []))},
                    ))

            # Capture final state from the root graph completion event
            elif kind == "on_chain_end":
                output = event.get("data", {}).get("output", {})
                if isinstance(output, dict) and "final_answer" in output:
                    final_state = output

        elapsed_ms = int((time.time() - start_time) * 1000)

        # Build final response from captured state (no second invocation)
        if final_state is None:
            final_state = {}

        # Coerce raw citation dicts into Citation schema
        raw_citations = final_state.get("citations", [])
        citations = [
            Citation(
                source=c.get("source", ""),
                excerpt=c.get("excerpt", ""),
                relevance_score=c.get("relevance_score"),
            )
            for c in raw_citations
            if isinstance(c, dict)
        ]

        response = QueryResponse(
            answer=final_state.get("final_answer", "No answer generated."),
            citations=citations,
            confidence_score=final_state.get("confidence_score", 0.0),
            sql_query=final_state.get("sql_query") if tier == "INTERNAL" else None,
            session_id=session_id,
            processing_time_ms=elapsed_ms,
            tier=tier,
        )

        yield _sse(StreamEvent(
            event="complete",
            data=response.model_dump(),
        ))

    except Exception as exc:
        logger.error("stream.error", session_id=session_id, error=str(exc))
        yield _sse(StreamEvent(
            event="error",
            data={"message": "An error occurred processing your query.", "detail": str(exc)},
        ))


def _sse(event: StreamEvent) -> str:
    return f"event: {event.event}\ndata: {json.dumps(event.data)}\n\n"


# ── Routes ────────────────────────────────────────────────────────────────────

@router.post("/query")
async def query(
    body: QueryRequest,
    request: Request,
    user: TokenPayload = Depends(get_current_user),
):
    """
    Execute a procurement intelligence query through the multi-agent graph.
    Returns SSE stream of events (thinking → retrieving → writing → complete).
    """
    session_id = body.session_id or str(uuid.uuid4())

    logger.info(
        "query.received",
        user_id=user.sub,
        tier=user.tier,
        session_id=session_id,
        query_length=len(body.query),
    )

    if body.stream:
        return EventSourceResponse(
            stream_agent_response(body.query, session_id, user, request),
            media_type="text/event-stream",
        )

    # Non-streaming: run graph to completion (single invocation)
    graph = get_graph()
    state = default_state(body.query, user.sub, user.tier, session_id)
    config = {
        "configurable": {"model_id": "anthropic.claude-3-5-sonnet-20241022-v2:0"},
        "run_name": f"procurement-query-{session_id}",
    }

    start = time.time()
    final_state = await graph.ainvoke(state, config=config)
    elapsed = int((time.time() - start) * 1000)

    raw_citations = final_state.get("citations", [])
    citations = [
        Citation(
            source=c.get("source", ""),
            excerpt=c.get("excerpt", ""),
            relevance_score=c.get("relevance_score"),
        )
        for c in raw_citations
        if isinstance(c, dict)
    ]

    return QueryResponse(
        answer=final_state.get("final_answer", ""),
        citations=citations,
        confidence_score=final_state.get("confidence_score", 0.0),
        sql_query=final_state.get("sql_query") if user.tier == "INTERNAL" else None,
        session_id=session_id,
        processing_time_ms=elapsed,
        tier=user.tier,
    )
