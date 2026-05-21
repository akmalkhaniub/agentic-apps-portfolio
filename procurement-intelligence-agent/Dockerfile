# ─────────────────────────────────────────────────────────────────────────────
# Stage 1: Base Python image
# ─────────────────────────────────────────────────────────────────────────────
FROM python:3.11-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# System deps (for pymysql, cryptography)
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    default-libmysqlclient-dev \
    pkg-config \
    && rm -rf /var/lib/apt/lists/*

# ─────────────────────────────────────────────────────────────────────────────
# Stage 2: Install uv and dependencies
# ─────────────────────────────────────────────────────────────────────────────
FROM base AS deps

# Install uv
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

# FIX #22: Copy both pyproject.toml, uv.lock, and README.md
COPY pyproject.toml uv.lock* README.md* ./
RUN uv sync --no-dev --no-install-project

# ─────────────────────────────────────────────────────────────────────────────
# Stage 3: Final image
# ─────────────────────────────────────────────────────────────────────────────
FROM base AS final

# Copy installed packages from deps stage
COPY --from=deps /app/.venv /app/.venv
ENV PATH="/app/.venv/bin:$PATH"

# Copy application code
COPY agents/ ./agents/
COPY api/ ./api/
COPY guardrails/ ./guardrails/
COPY mcp_server/ ./mcp_server/
COPY retrieval/ ./retrieval/
COPY sql_agent/ ./sql_agent/
COPY eval/ ./eval/
COPY ui/ ./ui/

# Non-root user for security
RUN adduser --disabled-password --gecos "" appuser
USER appuser

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
    CMD python -c "import httpx; httpx.get('http://localhost:8000/health')" || exit 1

EXPOSE 8000

CMD ["uvicorn", "api.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]
