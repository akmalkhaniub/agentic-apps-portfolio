"""
Vanna AI Setup — Configures and trains Vanna on the procurement MySQL schema.
Uses ChromaDB for vector storage of question-SQL pairs.

Training steps:
1. DDL statements (table schemas)
2. Documentation (business glossary)
3. Question-SQL pairs (golden examples)
"""

from __future__ import annotations

import os
import threading

import structlog
from sqlalchemy import create_engine, Engine

logger = structlog.get_logger(__name__)


# ── Vanna subclass with Bedrock LLM ───────────────────────────────────────────

class ProcurementVanna:
    """
    Vanna AI wrapper configured for the procurement database.
    We use a simple SQLAlchemy connection to RDS MySQL.
    """

    def __init__(self) -> None:
        from vanna.chromadb import ChromaDB_VectorStore
        from vanna.base import VannaBase

        # Use Vanna with ChromaDB for local vector storage + Bedrock for LLM
        # In production, swap ChromaDB for Pinecone-backed Vanna
        class MyVanna(ChromaDB_VectorStore, VannaBase):
            def __init__(self, config=None):
                ChromaDB_VectorStore.__init__(self, config=config)
                VannaBase.__init__(self, config=config)

        self._vn = MyVanna(config={"chromadb_path": "./.vanna_db"})
        self._engine: Engine | None = None

    def get_engine(self) -> Engine:
        if self._engine is None:
            db_url = (
                f"mysql+pymysql://{os.environ['DB_USER']}:{os.environ['DB_PASSWORD']}"
                f"@{os.environ['DB_HOST']}:{os.environ.get('DB_PORT', '3306')}"
                f"/{os.environ['DB_NAME']}"
            )
            self._engine = create_engine(db_url, pool_pre_ping=True)
        return self._engine

    def generate_sql(self, question: str) -> str:
        return self._vn.generate_sql(question=question)

    def train_on_schema(self) -> None:
        """Train Vanna on procurement DDL schemas."""
        ddls = [
            """
            CREATE TABLE vendors (
                vendor_id VARCHAR(50) PRIMARY KEY,
                vendor_name VARCHAR(255) NOT NULL,
                category VARCHAR(100),
                country VARCHAR(100),
                risk_score DECIMAL(3,2),
                contract_value_usd DECIMAL(15,2),
                onboarded_at DATE,
                is_active BOOLEAN DEFAULT TRUE
            );
            """,
            """
            CREATE TABLE purchase_orders (
                po_id VARCHAR(50) PRIMARY KEY,
                vendor_id VARCHAR(50) REFERENCES vendors(vendor_id),
                department VARCHAR(100),
                amount_usd DECIMAL(12,2),
                currency VARCHAR(10) DEFAULT 'USD',
                status ENUM('PENDING','APPROVED','FULFILLED','CANCELLED'),
                created_at DATETIME,
                fulfilled_at DATETIME,
                fiscal_year INT,
                quarter INT
            );
            """,
            """
            CREATE TABLE invoices (
                invoice_id VARCHAR(50) PRIMARY KEY,
                po_id VARCHAR(50) REFERENCES purchase_orders(po_id),
                vendor_id VARCHAR(50),
                amount_usd DECIMAL(12,2),
                due_date DATE,
                paid_date DATE,
                payment_status ENUM('UNPAID','PAID','OVERDUE','DISPUTED'),
                days_outstanding INT GENERATED ALWAYS AS (DATEDIFF(paid_date, due_date)) VIRTUAL
            );
            """,
            """
            CREATE TABLE contracts (
                contract_id VARCHAR(50) PRIMARY KEY,
                vendor_id VARCHAR(50) REFERENCES vendors(vendor_id),
                contract_type ENUM('MASTER','SOW','NDA','AMENDMENT'),
                start_date DATE,
                end_date DATE,
                total_value_usd DECIMAL(15,2),
                renewal_status ENUM('AUTO','MANUAL','EXPIRED'),
                s3_document_key VARCHAR(500)
            );
            """,
        ]

        documentation = [
            "Vendor risk_score ranges from 0.0 (lowest risk) to 1.0 (highest risk).",
            "Fiscal year runs from July 1 to June 30. Q1=Jul-Sep, Q2=Oct-Dec, Q3=Jan-Mar, Q4=Apr-Jun.",
            "Purchase orders above $50,000 require VP approval.",
            "Days outstanding > 30 means the invoice is overdue.",
            "Active vendors have is_active=TRUE and at least one APPROVED purchase order in the last 12 months.",
        ]

        question_sql_pairs = [
            ("What is the total spend by vendor this fiscal year?",
             "SELECT v.vendor_name, SUM(po.amount_usd) AS total_spend FROM purchase_orders po JOIN vendors v ON po.vendor_id = v.vendor_id WHERE po.fiscal_year = YEAR(CURDATE()) AND po.status = 'FULFILLED' GROUP BY v.vendor_id, v.vendor_name ORDER BY total_spend DESC LIMIT 20;"),
            ("Which vendors have overdue invoices?",
             "SELECT v.vendor_name, COUNT(i.invoice_id) AS overdue_count, SUM(i.amount_usd) AS overdue_amount FROM invoices i JOIN vendors v ON i.vendor_id = v.vendor_id WHERE i.payment_status = 'OVERDUE' GROUP BY v.vendor_id, v.vendor_name ORDER BY overdue_amount DESC;"),
            ("Show me contracts expiring in the next 90 days",
             "SELECT c.contract_id, v.vendor_name, c.end_date, c.total_value_usd, c.renewal_status FROM contracts c JOIN vendors v ON c.vendor_id = v.vendor_id WHERE c.end_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 90 DAY) ORDER BY c.end_date ASC;"),
            ("What is the average payment cycle by department?",
             "SELECT po.department, AVG(DATEDIFF(i.paid_date, i.due_date)) AS avg_days_outstanding FROM invoices i JOIN purchase_orders po ON i.po_id = po.po_id WHERE i.payment_status = 'PAID' GROUP BY po.department ORDER BY avg_days_outstanding DESC;"),
            ("How many high-risk vendors do we have active contracts with?",
             "SELECT COUNT(DISTINCT v.vendor_id) AS high_risk_active_vendors FROM vendors v JOIN contracts c ON v.vendor_id = c.vendor_id WHERE v.risk_score > 0.7 AND v.is_active = TRUE AND c.end_date >= CURDATE();"),
        ]

        logger.info("vanna.training.start")

        for ddl in ddls:
            self._vn.train(ddl=ddl.strip())

        for doc in documentation:
            self._vn.train(documentation=doc)

        for question, sql in question_sql_pairs:
            self._vn.train(question=question, sql=sql)

        logger.info("vanna.training.complete",
                    ddls=len(ddls),
                    docs=len(documentation),
                    examples=len(question_sql_pairs))


# FIX #4: Clean singleton using threading.Lock instead of conflicting lru_cache+global
_instance: ProcurementVanna | None = None
_instance_lock = threading.Lock()


def get_vanna_instance() -> ProcurementVanna:
    """Return thread-safe singleton ProcurementVanna instance."""
    global _instance
    if _instance is None:
        with _instance_lock:
            if _instance is None:
                _instance = ProcurementVanna()
                logger.info("vanna.initialized")
    return _instance
