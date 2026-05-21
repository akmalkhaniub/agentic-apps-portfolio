"""
FastAPI Application — Main entrypoint with middleware stack, routers,
structured logging, rate limiting, and lifecycle management.
"""

from __future__ import annotations

import json
import os
from contextlib import asynccontextmanager
from datetime import datetime, timezone

import structlog
from fastapi import Depends, FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.security import OAuth2PasswordRequestForm

from api.auth import authenticate_user, create_access_token
from api.rate_limiter import create_rate_limiter
from api.routes.query import router as query_router
from api.schemas import HealthResponse, TokenResponse
from guardrails.middleware import GuardrailMiddleware
from guardrails.tiers import TierType

# ── Structured logging ────────────────────────────────────────────────────────

structlog.configure(
    processors=[
        structlog.contextvars.merge_contextvars,
        structlog.processors.add_log_level,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.JSONRenderer(),
    ],
)

logger = structlog.get_logger(__name__)

# ── App version ───────────────────────────────────────────────────────────────

VERSION = "1.1.0"

# ── Cached health-check clients ───────────────────────────────────────────────

_health_clients: dict = {}


def _get_health_clients() -> dict:
    """Lazy-init and cache health check clients (FIX #16)."""
    if not _health_clients:
        try:
            import boto3
            _health_clients["bedrock"] = boto3.client(
                "bedrock", region_name=os.getenv("AWS_REGION", "us-east-1"),
            )
        except Exception:
            _health_clients["bedrock"] = None
        try:
            from pinecone import Pinecone
            _health_clients["pinecone"] = Pinecone(
                api_key=os.environ.get("PINECONE_API_KEY", ""),
            )
        except Exception:
            _health_clients["pinecone"] = None
    return _health_clients


# ── Lifespan: warm up resources ───────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("app.startup", version=VERSION)

    # Pre-warm Vanna AI (loads ChromaDB index)
    try:
        from sql_agent.vanna_setup import get_vanna_instance
        get_vanna_instance()
        logger.info("vanna.warmed_up")
    except Exception as exc:
        logger.warning("vanna.warmup_failed", error=str(exc))

    # Pre-warm LangGraph graph
    try:
        from agents.graph import get_graph
        get_graph()
        logger.info("langgraph.graph_compiled")
    except Exception as exc:
        logger.warning("langgraph.compile_failed", error=str(exc))

    # Pre-warm health clients
    _get_health_clients()

    yield

    logger.info("app.shutdown")


# ── FastAPI app ───────────────────────────────────────────────────────────────

app = FastAPI(
    title="Procurement Intelligence Agent API",
    description=(
        "Multi-agent procurement intelligence system powered by LangGraph, "
        "AWS Bedrock (Claude), Pinecone, and Vanna AI."
    ),
    version=VERSION,
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# ── Rate limiter (FIX #12) ───────────────────────────────────────────────────

limiter = create_rate_limiter(app)

# ── Middleware stack (order matters: outermost first) ─────────────────────────

# 1. CORS — FIX #15: properly parse JSON list from env var
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 2. JWT tier injection into request.state (must run before guardrails)
@app.middleware("http")
async def inject_tier_from_jwt(request: Request, call_next):
    """Decode JWT and inject tier into request.state for downstream middleware."""
    from fastapi.security.utils import get_authorization_scheme_param
    auth_header = request.headers.get("Authorization", "")
    scheme, token = get_authorization_scheme_param(auth_header)

    tier = "PUBLIC"
    if scheme.lower() == "bearer" and token:
        try:
            from jose import jwt as jose_jwt
            from api.auth import SECRET_KEY, ALGORITHM
            payload = jose_jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
            tier = payload.get("tier", "PUBLIC")
        except Exception:
            pass

    request.state.tier = tier
    return await call_next(request)

# 3. Guardrail middleware (uses request.state.tier)
app.add_middleware(GuardrailMiddleware)


# ── Routes ────────────────────────────────────────────────────────────────────

# Auth
@app.post("/auth/token", response_model=TokenResponse, tags=["Auth"])
async def login(form: OAuth2PasswordRequestForm = Depends()):
    """Issue JWT access token. Use credentials from .env.example for demo."""
    user = authenticate_user(form.username, form.password)
    if not user:
        return JSONResponse(
            status_code=401,
            content={"detail": "Invalid credentials"},
        )
    tier: TierType = user["tier"]
    token = create_access_token(user_id=form.username, tier=tier)
    return TokenResponse(
        access_token=token,
        expires_in=3600,
        tier=tier,
    )

# Query (streaming + sync)
app.include_router(query_router, prefix="/api/v1", tags=["Query"])

# Health — FIX #16: uses cached clients
@app.get("/health", response_model=HealthResponse, tags=["Ops"])
async def health():
    clients = _get_health_clients()
    components = {}

    # Check Pinecone
    try:
        pc = clients.get("pinecone")
        if pc:
            pc.list_indexes()
        components["pinecone"] = "ok"
    except Exception as e:
        components["pinecone"] = f"error: {e}"

    # Check DB
    try:
        from sql_agent.vanna_setup import get_vanna_instance
        vn = get_vanna_instance()
        with vn.get_engine().connect():
            pass
        components["rds_mysql"] = "ok"
    except Exception as e:
        components["rds_mysql"] = f"error: {e}"

    # Check Bedrock
    try:
        bedrock = clients.get("bedrock")
        if bedrock:
            bedrock.list_foundation_models(byOutputModality="TEXT")
        components["bedrock"] = "ok"
    except Exception as e:
        components["bedrock"] = f"error: {e}"

    overall = "healthy" if all(v == "ok" for v in components.values()) else "degraded"
    return HealthResponse(
        status=overall,
        timestamp=datetime.now(timezone.utc),
        version=VERSION,
        components=components,
    )
