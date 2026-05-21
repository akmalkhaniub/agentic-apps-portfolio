"""
query_database MCP Tool — Natural language to SQL via Vanna AI.
Validates safety, enforces row limits, executes against RDS MySQL.
"""

from __future__ import annotations

from typing import Any

import structlog

from sql_agent.vanna_setup import get_vanna_instance
from sql_agent.validator import SQLValidator

logger = structlog.get_logger(__name__)

ROW_LIMITS = {"INTERNAL": 500, "PARTNER": 100, "PUBLIC": 25}


async def query_database_tool(
    question: str,
    tier: str = "PUBLIC",
    dry_run: bool = False,
) -> dict[str, Any]:
    """Generate and execute SQL from natural language via Vanna AI."""
    logger.info("tool.query_database", question=question, tier=tier, dry_run=dry_run)

    vn = get_vanna_instance()
    validator = SQLValidator()

    try:
        sql = vn.generate_sql(question=question)
    except Exception as exc:
        return {"sql": None, "results": [], "row_count": 0, "error": str(exc)}

    is_valid, err = validator.validate(sql)
    if not is_valid:
        return {"sql": sql, "results": [], "row_count": 0, "error": err}

    if dry_run:
        return {"sql": sql, "results": [], "row_count": 0, "error": None}

    import re
    from sqlalchemy import text

    limit = ROW_LIMITS.get(tier, 25)
    sql = sql.rstrip(";").strip()
    if re.search(r"\bLIMIT\b", sql, re.IGNORECASE):
        sql = re.sub(r"\bLIMIT\s+\d+\b", f"LIMIT {limit}", sql, flags=re.IGNORECASE)
    else:
        sql = f"{sql} LIMIT {limit}"
    sql += ";"

    try:
        engine = vn.get_engine()
        with engine.connect() as conn:
            result = conn.execute(text(sql))
            rows = [dict(row._mapping) for row in result.fetchall()]
        return {"sql": sql, "results": rows, "row_count": len(rows), "error": None}
    except Exception as exc:
        logger.error("tool.query_database.exec_error", error=str(exc))
        return {"sql": sql, "results": [], "row_count": 0, "error": str(exc)}
