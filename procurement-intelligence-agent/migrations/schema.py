"""
Alembic migrations for the Procurement Intelligence Agent database.
Schema matches the Vanna AI training DDLs in sql_agent/vanna_setup.py.

Usage:
    # Initialize (already done)
    alembic init migrations

    # Generate migration
    alembic revision --autogenerate -m "initial schema"

    # Apply
    alembic upgrade head
"""

from __future__ import annotations

import os
from logging.config import fileConfig

from sqlalchemy import (
    Boolean, Column, Date, DateTime, Enum, Integer, MetaData, Numeric,
    String, Table, create_engine, text,
)


# ── Schema Definition ─────────────────────────────────────────────────────────

metadata = MetaData()

vendors = Table(
    "vendors", metadata,
    Column("vendor_id", String(50), primary_key=True),
    Column("vendor_name", String(255), nullable=False),
    Column("category", String(100)),
    Column("country", String(100)),
    Column("risk_score", Numeric(3, 2)),
    Column("contract_value_usd", Numeric(15, 2)),
    Column("onboarded_at", Date),
    Column("is_active", Boolean, default=True),
)

purchase_orders = Table(
    "purchase_orders", metadata,
    Column("po_id", String(50), primary_key=True),
    Column("vendor_id", String(50)),
    Column("department", String(100)),
    Column("amount_usd", Numeric(12, 2)),
    Column("currency", String(10), default="USD"),
    Column("status", Enum("PENDING", "APPROVED", "FULFILLED", "CANCELLED")),
    Column("created_at", DateTime),
    Column("fulfilled_at", DateTime),
    Column("fiscal_year", Integer),
    Column("quarter", Integer),
)

invoices = Table(
    "invoices", metadata,
    Column("invoice_id", String(50), primary_key=True),
    Column("po_id", String(50)),
    Column("vendor_id", String(50)),
    Column("amount_usd", Numeric(12, 2)),
    Column("due_date", Date),
    Column("paid_date", Date),
    Column("payment_status", Enum("UNPAID", "PAID", "OVERDUE", "DISPUTED")),
    # days_outstanding is a VIRTUAL generated column — handled by raw SQL below
)

contracts = Table(
    "contracts", metadata,
    Column("contract_id", String(50), primary_key=True),
    Column("vendor_id", String(50)),
    Column("contract_type", Enum("MASTER", "SOW", "NDA", "AMENDMENT")),
    Column("start_date", Date),
    Column("end_date", Date),
    Column("total_value_usd", Numeric(15, 2)),
    Column("renewal_status", Enum("AUTO", "MANUAL", "EXPIRED")),
    Column("s3_document_key", String(500)),
)


# ── Migration Functions ───────────────────────────────────────────────────────

def upgrade(engine=None) -> None:
    """Create all tables and indexes."""
    if engine is None:
        engine = _get_engine()

    metadata.create_all(engine)

    # Add generated column (not supported by SQLAlchemy Table definition)
    with engine.connect() as conn:
        try:
            conn.execute(text(
                "ALTER TABLE invoices ADD COLUMN days_outstanding INT "
                "GENERATED ALWAYS AS (DATEDIFF(paid_date, due_date)) VIRTUAL"
            ))
        except Exception:
            pass  # Column may already exist

        # Create performance indexes
        indexes = [
            "CREATE INDEX IF NOT EXISTS idx_vendors_risk ON vendors(risk_score)",
            "CREATE INDEX IF NOT EXISTS idx_vendors_active ON vendors(is_active)",
            "CREATE INDEX IF NOT EXISTS idx_vendors_country ON vendors(country)",
            "CREATE INDEX IF NOT EXISTS idx_po_vendor ON purchase_orders(vendor_id)",
            "CREATE INDEX IF NOT EXISTS idx_po_status ON purchase_orders(status)",
            "CREATE INDEX IF NOT EXISTS idx_po_fiscal ON purchase_orders(fiscal_year, quarter)",
            "CREATE INDEX IF NOT EXISTS idx_po_department ON purchase_orders(department)",
            "CREATE INDEX IF NOT EXISTS idx_inv_vendor ON invoices(vendor_id)",
            "CREATE INDEX IF NOT EXISTS idx_inv_status ON invoices(payment_status)",
            "CREATE INDEX IF NOT EXISTS idx_inv_due ON invoices(due_date)",
            "CREATE INDEX IF NOT EXISTS idx_contracts_vendor ON contracts(vendor_id)",
            "CREATE INDEX IF NOT EXISTS idx_contracts_end ON contracts(end_date)",
            "CREATE INDEX IF NOT EXISTS idx_contracts_type ON contracts(contract_type)",
        ]
        for idx_sql in indexes:
            try:
                conn.execute(text(idx_sql))
            except Exception:
                pass

        conn.commit()


def downgrade(engine=None) -> None:
    """Drop all tables (DANGER: data loss)."""
    if engine is None:
        engine = _get_engine()
    metadata.drop_all(engine)


def _get_engine():
    url = (
        f"mysql+pymysql://{os.environ['DB_USER']}:{os.environ['DB_PASSWORD']}"
        f"@{os.environ['DB_HOST']}:{os.environ.get('DB_PORT', '3306')}"
        f"/{os.environ['DB_NAME']}"
    )
    return create_engine(url, pool_pre_ping=True)


# ── CLI ───────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Database migration tool")
    parser.add_argument("action", choices=["upgrade", "downgrade"], help="Migration action")
    args = parser.parse_args()

    engine = _get_engine()

    if args.action == "upgrade":
        print("🔄 Running upgrade...")
        upgrade(engine)
        print("✅ Schema created with 13 performance indexes")
    elif args.action == "downgrade":
        confirm = input("⚠️  This will DROP ALL TABLES. Type 'yes' to confirm: ")
        if confirm == "yes":
            downgrade(engine)
            print("✅ All tables dropped")
        else:
            print("Aborted.")
