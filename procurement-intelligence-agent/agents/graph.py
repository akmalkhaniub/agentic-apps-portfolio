"""
LangGraph StateGraph — Wires all agents together into the Procurement
Intelligence supervisor-researcher topology with MCP tool integration.
"""

from __future__ import annotations

import threading

from langgraph.graph import END, StateGraph

from agents.state import AgentState
from agents.supervisor import supervisor_node
from agents.researcher import researcher_node
from agents.sql_analyst import sql_analyst_node
from agents.writer import writer_node


# ── Routing logic ─────────────────────────────────────────────────────────────

def route_supervisor(state: AgentState) -> str:
    """
    Conditional edge: Supervisor decides which node to visit next.
    Maps state["next_agent"] to actual graph node names.
    """
    next_agent = state.get("next_agent", "writer")
    routing_map = {
        "researcher": "researcher",
        "sql_analyst": "sql_analyst",
        "writer": "writer",
        "FINISH": END,
    }
    return routing_map.get(next_agent, "writer")


def route_after_agents(state: AgentState) -> str:
    """
    After researcher or sql_analyst completes, always return to supervisor
    for next routing decision, unless guardrail was triggered.
    """
    if state.get("guardrail_triggered"):
        return "writer"  # Short-circuit to writer to surface the error
    return "supervisor"


# ── Graph construction ────────────────────────────────────────────────────────

def build_graph() -> StateGraph:
    """
    Build and compile the LangGraph StateGraph.

    Topology:
        supervisor ──► researcher ──► supervisor
                  ──► sql_analyst ──► supervisor
                  ──► writer ──► END
    """
    builder = StateGraph(AgentState)

    # ── Add nodes ──
    builder.add_node("supervisor", supervisor_node)
    builder.add_node("researcher", researcher_node)
    builder.add_node("sql_analyst", sql_analyst_node)
    builder.add_node("writer", writer_node)

    # ── Entry point ──
    builder.set_entry_point("supervisor")

    # ── Supervisor conditional routing ──
    builder.add_conditional_edges(
        "supervisor",
        route_supervisor,
        {
            "researcher": "researcher",
            "sql_analyst": "sql_analyst",
            "writer": "writer",
            END: END,
        },
    )

    # ── Sub-agent return loops ──
    builder.add_conditional_edges(
        "researcher",
        route_after_agents,
        {
            "supervisor": "supervisor",
            "writer": "writer",
        },
    )

    builder.add_conditional_edges(
        "sql_analyst",
        route_after_agents,
        {
            "supervisor": "supervisor",
            "writer": "writer",
        },
    )

    # ── Writer always ends ──
    builder.add_edge("writer", END)

    return builder.compile()


# ── Thread-safe singleton compiled graph (FIX #2) ────────────────────────────

_graph = None
_graph_lock = threading.Lock()


def get_graph() -> StateGraph:
    """Return cached compiled graph (thread-safe via lock)."""
    global _graph
    if _graph is None:
        with _graph_lock:
            # Double-checked locking
            if _graph is None:
                _graph = build_graph()
    return _graph
