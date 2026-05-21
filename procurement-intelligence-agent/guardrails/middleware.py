"""
Guardrail Middleware — FastAPI middleware that applies tier-based guardrails
pre- and post-agent execution. Integrates with Bedrock ApplyGuardrail API.
"""

from __future__ import annotations

import json

import structlog
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse, Response as StarletteResponse

from guardrails.bedrock_guardrails import get_guardrail_client
from guardrails.tiers import TierType, get_tier_config

logger = structlog.get_logger(__name__)


class GuardrailMiddleware(BaseHTTPMiddleware):
    """
    FastAPI middleware that:
    1. Extracts tier from request state (set by JWT auth)
    2. Applies Bedrock Guardrail to incoming query (INPUT)
    3. Passes request to handler
    4. Applies Bedrock Guardrail to response body (OUTPUT)
    5. Blocks or passes based on guardrail action
    """

    # Only guard these paths
    GUARDED_PATHS = {"/query", "/api/v1/query"}

    async def dispatch(self, request: Request, call_next) -> Response:
        # Skip non-guarded endpoints
        if request.url.path not in self.GUARDED_PATHS:
            return await call_next(request)

        # Get tier from request state (set by JWTAuthMiddleware)
        tier_str: str = getattr(request.state, "tier", "PUBLIC")
        tier: TierType = tier_str if tier_str in ("INTERNAL", "PARTNER", "PUBLIC") else "PUBLIC"
        tier_config = get_tier_config(tier)

        guardrail = get_guardrail_client()

        # ── Pre-processing: guard the INPUT ───────────────────────────────────
        try:
            body_bytes = await request.body()
            body = json.loads(body_bytes) if body_bytes else {}
            query_text = body.get("query", "")
        except Exception:
            body_bytes = b""
            query_text = ""

        if query_text:
            input_result = await guardrail.apply(
                text=query_text,
                source="INPUT",
                tier=tier_config,
            )
            if input_result["blocked"]:
                logger.warning(
                    "guardrail.input_blocked",
                    tier=tier,
                    reason=input_result["reason"],
                )
                return JSONResponse(
                    status_code=400,
                    content={
                        "error": "query_blocked",
                        "message": "Your query violates content policies for your access tier.",
                        "reason": input_result["reason"],
                    },
                )

        # ── Pass to route handler ──────────────────────────────────────────────
        # Reconstruct request with original body
        async def receive():
            return {"type": "http.request", "body": body_bytes, "more_body": False}

        request._receive = receive
        response = await call_next(request)

        # ── Post-processing: guard the OUTPUT ─────────────────────────────────
        # For streaming responses we skip post-guardrail (handled in route)
        content_type = response.headers.get("content-type", "")
        if "text/event-stream" in content_type:
            return response

        # Buffer response body for non-streaming
        response_body = b""
        async for chunk in response.body_iterator:
            response_body += chunk

        try:
            response_json = json.loads(response_body)
            answer_text = response_json.get("answer", "")
        except Exception:
            answer_text = response_body.decode("utf-8", errors="replace")

        if answer_text:
            output_result = await guardrail.apply(
                text=answer_text,
                source="OUTPUT",
                tier=tier_config,
            )
            if output_result["blocked"]:
                logger.warning(
                    "guardrail.output_blocked",
                    tier=tier,
                    reason=output_result["reason"],
                )
                blocked_body = json.dumps({
                    "error": "response_blocked",
                    "message": "The generated response was blocked by content policies.",
                }).encode()
                return StarletteResponse(
                    content=blocked_body,
                    status_code=200,
                    media_type="application/json",
                )

        return StarletteResponse(
            content=response_body,
            status_code=response.status_code,
            headers=dict(response.headers),
            media_type=response.media_type,
        )
