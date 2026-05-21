"""
SQL Analyst Agent — Uses Vanna AI to translate natural language queries
into validated, safe SQL and execute them against AWS RDS MySQL.
"""

from __future__ import annotations

import re
from typing import Any

import structlog
from langchain_core.messages import AIMessage
from langchain_core.runnables import RunnableConfig
from sqlalchemy import text

from agents.state import AgentState
from sql_agent.vanna_setup import get_vanna_instance
from sql_agent.validator import SQLValidator

logger = structlog.get_logger(__name__)

# SQL keywords that are never allowed (safety controls)
_FORBIDDEN_PATTERNS = [
    r"\bDROP\b", r"\bDELETE\b", r"\bTRUNCATE\b",
    r"\bALTER\b", r"\bCREATE\b", r"\bINSERT\b",
    r"\bUPDATE\b", r"\bGRANT\b", r"\bREVOKE\b",
    r"\bEXEC\b", r"\bEXECUTE\b",
]

MAX_ROWS = {
    "INTERNAL": 500,
    "PARTNER": 100,
    "PUBLIC": 25,
}


async def sql_analyst_node(state: AgentState, config: RunnableConfig) -> dict:
    """
    LangGraph node: Text-to-SQL via Vanna AI, with validation + execution.
    Returns partial state update with sql_query, sql_results, sql_error, and messages.
    """
    cfg = config.get("configurable", {})
    tier = state["tier"]
    queries = state["sub_queries"] or [state["original_query"]]
    primary_query = queries[0]

    logger.info("sql_analyst.start", query=primary_query, tier=tier)

    vn = get_vanna_instance()
    validator = SQLValidator()

    # ── Step 1: Generate SQL ───────────────────────────────────────────────────
    try:
        raw_sql: str = vn.generate_sql(question=primary_query)
        logger.info("sql_analyst.generated", sql=raw_sql)
    except Exception as exc:
        logger.error("sql_analyst.generation_failed", error=str(exc))
        return {
            "sql_error": f"SQL generation failed: {exc}",
            "sql_results": [],
            "messages": [AIMessage(content=f"[SQLAnalyst] Generation failed: {exc}")],
        }

    # ── Step 2: Safety validation ──────────────────────────────────────────────
    for pattern in _FORBIDDEN_PATTERNS:
        if re.search(pattern, raw_sql, re.IGNORECASE):
            reason = f"Forbidden SQL pattern detected: {pattern}"
            logger.warning("sql_analyst.blocked", reason=reason, sql=raw_sql)
            return {
                "sql_query": raw_sql,
                "sql_error": reason,
                "sql_results": [],
                "guardrail_triggered": True,
                "guardrail_reason": reason,
                "messages": [AIMessage(content=f"[SQLAnalyst] BLOCKED: {reason}")],
            }

    # ── Step 3: Schema validation via Vanna ────────────────────────────────────
    is_valid, validation_error = validator.validate(raw_sql)
    if not is_valid:
        logger.warning("sql_analyst.invalid_sql", error=validation_error)
        return {
            "sql_query": raw_sql,
            "sql_error": validation_error,
            "sql_results": [],
            "messages": [AIMessage(content=f"[SQLAnalyst] Invalid SQL: {validation_error}")],
        }

    # ── Step 4: Inject row limit based on tier ─────────────────────────────────
    limit = MAX_ROWS.get(tier, 25)
    safe_sql = _inject_limit(raw_sql, limit)
    logger.info("sql_analyst.safe_sql", sql=safe_sql, row_limit=limit)

    # ── Step 5: Execute ────────────────────────────────────────────────────────
    try:
        engine = vn.get_engine()
        with engine.connect() as conn:
            result = conn.execute(text(safe_sql))
            rows = [dict(row._mapping) for row in result.fetchall()]

        logger.info("sql_analyst.executed", row_count=len(rows))
        return {
            "sql_query": safe_sql,
            "sql_results": rows,
            "sql_error": None,
            "messages": [AIMessage(content=f"[SQLAnalyst] Executed: {safe_sql} → {len(rows)} rows")],
        }

    except Exception as exc:
        logger.error("sql_analyst.execution_failed", error=str(exc), sql=safe_sql)
        return {
            "sql_query": safe_sql,
            "sql_error": f"Execution failed: {exc}",
            "sql_results": [],
            "messages": [AIMessage(content=f"[SQLAnalyst] Execution failed: {exc}")],
        }


def _inject_limit(sql: str, limit: int) -> str:
    """Append or replace LIMIT clause to enforce row caps."""
    sql = sql.rstrip(";").strip()
    if re.search(r"\bLIMIT\b", sql, re.IGNORECASE):
        # Replace existing LIMIT with our tier-safe limit
        sql = re.sub(r"\bLIMIT\s+\d+\b", f"LIMIT {limit}", sql, flags=re.IGNORECASE)
    else:
        sql = f"{sql} LIMIT {limit}"
    return sql + ";"
