"""
SQL Validator — Pre-execution safety checks for Vanna-generated SQL.
Checks for forbidden operations, injection patterns, and schema validity.
"""

from __future__ import annotations

import re

import structlog

logger = structlog.get_logger(__name__)

# ── Blocked patterns ──────────────────────────────────────────────────────────

WRITE_OPERATIONS = [
    r"\bINSERT\b", r"\bUPDATE\b", r"\bDELETE\b",
    r"\bDROP\b", r"\bTRUNCATE\b", r"\bALTER\b",
    r"\bCREATE\b", r"\bGRANT\b", r"\bREVOKE\b",
    r"\bEXEC\b", r"\bEXECUTE\b", r"\bCALL\b",
    r"\bLOAD\b", r"\bOUTFILE\b", r"\bINFILE\b",
]

INJECTION_PATTERNS = [
    r"--\s",                    # SQL comment
    r"/\*.*\*/",                # Block comment
    r";\s*\w",                  # Multiple statements
    r"\bUNION\s+ALL\b",         # UNION injection
    r"\bSLEEP\s*\(",            # Time-based injection
    r"\bBENCHMARK\s*\(",        # Benchmark injection
    r"\bINFORMATION_SCHEMA\b",  # Schema enumeration
    r"\bsys\b",                 # MySQL sys schema
]

ALLOWED_TABLES = {
    "vendors", "purchase_orders", "invoices",
    "contracts", "vendor_categories",
}


class SQLValidator:
    """Validates Vanna-generated SQL before execution."""

    def validate(self, sql: str) -> tuple[bool, str | None]:
        """
        Run all validation checks.

        Returns:
            (is_valid, error_message) — error_message is None if valid.
        """
        if not sql or not sql.strip():
            return False, "Empty SQL query"

        # Check for write operations
        for pattern in WRITE_OPERATIONS:
            if re.search(pattern, sql, re.IGNORECASE):
                clean_pattern = re.sub(r'\\b', '', pattern)
                msg = f"Blocked: write operation detected ({clean_pattern})"
                logger.warning("validator.blocked_write", sql=sql[:100], pattern=pattern)
                return False, msg

        # Check for injection patterns
        for pattern in INJECTION_PATTERNS:
            if re.search(pattern, sql, re.IGNORECASE):
                msg = f"Blocked: potential injection pattern detected"
                logger.warning("validator.injection_detected", sql=sql[:100])
                return False, msg

        # Must start with SELECT
        stripped = sql.strip().upper()
        if not stripped.startswith("SELECT") and not stripped.startswith("WITH"):
            msg = "Only SELECT and WITH (CTE) queries are allowed"
            logger.warning("validator.non_select", sql=sql[:100])
            return False, msg

        # Extract and validate table names
        table_pattern = r"\bFROM\s+(\w+)|\bJOIN\s+(\w+)"
        tables_found = set()
        for match in re.finditer(table_pattern, sql, re.IGNORECASE):
            table = match.group(1) or match.group(2)
            if table:
                tables_found.add(table.lower())

        unknown = tables_found - ALLOWED_TABLES
        if unknown:
            msg = f"Query references unknown tables: {unknown}"
            logger.warning("validator.unknown_tables", tables=unknown)
            return False, msg

        logger.info("validator.passed", tables=tables_found)
        return True, None
