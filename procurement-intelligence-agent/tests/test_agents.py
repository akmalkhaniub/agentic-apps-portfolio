"""
Tests for agent routing logic, state transitions, and JSON parsing.
"""

from __future__ import annotations

import json

import pytest

from agents.json_utils import extract_json
from agents.graph import route_supervisor, route_after_agents
from agents.state import default_state, AgentState


# ── JSON Extraction Tests (FIX #5) ───────────────────────────────────────────

class TestExtractJson:
    def test_pure_json(self):
        raw = '{"next_agent": "researcher", "reasoning": "needs docs"}'
        result = extract_json(raw)
        assert result is not None
        assert result["next_agent"] == "researcher"

    def test_markdown_fenced_json(self):
        raw = '```json\n{"next_agent": "writer"}\n```'
        result = extract_json(raw)
        assert result is not None
        assert result["next_agent"] == "writer"

    def test_json_with_surrounding_text(self):
        raw = 'I think the best route is:\n{"next_agent": "sql_analyst"}\nLet me know.'
        result = extract_json(raw)
        assert result is not None
        assert result["next_agent"] == "sql_analyst"

    def test_nested_json_extracts_outermost(self):
        raw = '{"outer": {"inner": "value"}, "key": "test"}'
        result = extract_json(raw)
        assert result is not None
        assert "outer" in result
        assert result["outer"]["inner"] == "value"

    def test_invalid_json_returns_none(self):
        raw = "This is not JSON at all"
        assert extract_json(raw) is None

    def test_empty_string_returns_none(self):
        assert extract_json("") is None

    def test_json_with_escaped_braces_in_explanation(self):
        raw = 'The routing decision {{ uses patterns }} is:\n{"next_agent": "researcher"}'
        result = extract_json(raw)
        assert result is not None
        assert result["next_agent"] == "researcher"


# ── Routing Tests ─────────────────────────────────────────────────────────────

class TestRouteSupervisor:
    def test_routes_to_researcher(self):
        state = _make_state(next_agent="researcher")
        assert route_supervisor(state) == "researcher"

    def test_routes_to_sql_analyst(self):
        state = _make_state(next_agent="sql_analyst")
        assert route_supervisor(state) == "sql_analyst"

    def test_routes_to_writer(self):
        state = _make_state(next_agent="writer")
        assert route_supervisor(state) == "writer"

    def test_finish_routes_to_end(self):
        from langgraph.graph import END
        state = _make_state(next_agent="FINISH")
        assert route_supervisor(state) == END

    def test_unknown_defaults_to_writer(self):
        state = _make_state(next_agent="unknown_agent")
        assert route_supervisor(state) == "writer"

    def test_missing_next_agent_defaults_to_writer(self):
        state: dict = {}
        assert route_supervisor(state) == "writer"


class TestRouteAfterAgents:
    def test_normal_returns_to_supervisor(self):
        state = _make_state(guardrail_triggered=False)
        assert route_after_agents(state) == "supervisor"

    def test_guardrail_triggered_goes_to_writer(self):
        state = _make_state(guardrail_triggered=True)
        assert route_after_agents(state) == "writer"

    def test_no_guardrail_flag_returns_supervisor(self):
        state: dict = {}
        assert route_after_agents(state) == "supervisor"


# ── State Factory Tests ──────────────────────────────────────────────────────

class TestDefaultState:
    def test_creates_valid_state(self):
        state = default_state("Test query", "user1", "INTERNAL", "sess1")
        assert state["original_query"] == "Test query"
        assert state["user_id"] == "user1"
        assert state["tier"] == "INTERNAL"
        assert state["iterations"] == 0
        assert state["guardrail_triggered"] is False

    def test_default_max_iterations(self):
        state = default_state("q", "u", "PUBLIC", "s")
        assert state["max_iterations"] == 5

    def test_custom_max_iterations(self):
        state = default_state("q", "u", "PARTNER", "s", max_iterations=10)
        assert state["max_iterations"] == 10

    def test_empty_collections(self):
        state = default_state("q", "u", "PUBLIC", "s")
        assert state["context_docs"] == []
        assert state["sql_results"] == []
        assert state["web_results"] == []
        assert state["messages"] == []


# ── Helpers ───────────────────────────────────────────────────────────────────

def _make_state(**overrides) -> dict:
    """Create a minimal state dict with overrides."""
    base = {
        "original_query": "test query",
        "tier": "INTERNAL",
        "iterations": 0,
        "max_iterations": 5,
        "next_agent": "supervisor",
        "context_docs": [],
        "sql_results": [],
        "web_results": [],
        "draft_answer": "",
        "guardrail_triggered": False,
    }
    base.update(overrides)
    return base
