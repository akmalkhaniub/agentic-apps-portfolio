"""
Rate Limiter — Tier-aware rate limiting using slowapi.
Enforces per-user RPM limits based on JWT tier claim.
"""

from __future__ import annotations

import os

from fastapi import FastAPI, Request
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from guardrails.tiers import TIER_CONFIGS


def _key_func(request: Request) -> str:
    """Rate limit key: user_id from JWT or IP address."""
    user_id = getattr(request.state, "user_id", None)
    if user_id:
        return f"user:{user_id}"
    return get_remote_address(request)


def _get_tier_limit(request: Request) -> str:
    """Dynamic rate limit based on tier claim in request state."""
    tier = getattr(request.state, "tier", "PUBLIC")
    config = TIER_CONFIGS.get(tier, TIER_CONFIGS["PUBLIC"])
    return f"{config.rate_limit_rpm}/minute"


# Module-level limiter instance
limiter = Limiter(
    key_func=_key_func,
    default_limits=["10/minute"],  # Default for unauthenticated
    storage_uri=os.getenv("RATE_LIMIT_STORAGE", "memory://"),
)


def create_rate_limiter(app: FastAPI) -> Limiter:
    """Attach rate limiter to FastAPI app and register error handler."""
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
    return limiter
