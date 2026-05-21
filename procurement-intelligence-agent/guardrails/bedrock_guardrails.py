"""
AWS Bedrock Guardrails Client — Wraps the ApplyGuardrail API for
pre- and post-processing of LLM inputs and outputs.
Uses asyncio.to_thread to avoid blocking the event loop.
"""

from __future__ import annotations

import asyncio
import json
import os

import boto3
import structlog

from guardrails.tiers import TierConfig

logger = structlog.get_logger(__name__)


class BedrockGuardrailsClient:
    """
    Wraps AWS Bedrock ApplyGuardrail API for input/output validation.

    Usage:
        client = BedrockGuardrailsClient()
        result = await client.apply(text=user_input, source="INPUT", tier=tier_config)
        if result["blocked"]:
            return error_response(result["reason"])
    """

    def __init__(self) -> None:
        self._client = boto3.client(
            "bedrock-runtime",
            region_name=os.getenv("AWS_REGION", "us-east-1"),
        )
        self._guardrail_id = os.environ.get("BEDROCK_GUARDRAIL_ID", "")
        self._guardrail_version = os.environ.get("BEDROCK_GUARDRAIL_VERSION", "DRAFT")

    def _apply_sync(self, text: str, source: str) -> dict:
        """Synchronous boto3 call — run via asyncio.to_thread."""
        return self._client.apply_guardrail(
            guardrailIdentifier=self._guardrail_id,
            guardrailVersion=self._guardrail_version,
            source=source,
            content=[{"text": {"text": text}}],
        )

    async def apply(
        self,
        text: str,
        source: str,  # "INPUT" or "OUTPUT"
        tier: TierConfig,
    ) -> dict:
        """
        Apply Bedrock Guardrail to text content (non-blocking).

        Returns:
            {
                "blocked": bool,
                "reason": str | None,
                "action": str,        # "NONE", "GUARDRAIL_INTERVENED"
                "assessments": list,
            }
        """
        if not self._guardrail_id or not tier.apply_guardrail_api:
            return {"blocked": False, "reason": None, "action": "NONE", "assessments": []}

        try:
            # FIX #11: Run synchronous boto3 call in a thread to avoid blocking
            response = await asyncio.to_thread(self._apply_sync, text, source)

            action = response.get("action", "NONE")
            blocked = action == "GUARDRAIL_INTERVENED"

            reason = None
            if blocked:
                # Extract reason from assessments
                assessments = response.get("assessments", [])
                reasons = []
                for assessment in assessments:
                    for key, val in assessment.items():
                        if isinstance(val, dict) and val.get("topics"):
                            for topic in val["topics"]:
                                if topic.get("action") == "BLOCKED":
                                    reasons.append(f"Topic blocked: {topic.get('name')}")
                reason = "; ".join(reasons) if reasons else "Content blocked by guardrail"

            logger.info(
                "bedrock_guardrail.applied",
                source=source,
                action=action,
                blocked=blocked,
                tier=tier.name,
                reason=reason,
            )

            return {
                "blocked": blocked,
                "reason": reason,
                "action": action,
                "assessments": response.get("assessments", []),
            }

        except Exception as exc:
            # Fail open for known unavailability; fail closed in strict tiers
            if tier.name == "PUBLIC":
                logger.error("bedrock_guardrail.error_fail_closed", error=str(exc))
                return {
                    "blocked": True,
                    "reason": f"Guardrail service unavailable: {exc}",
                    "action": "ERROR",
                    "assessments": [],
                }
            else:
                logger.warning("bedrock_guardrail.error_fail_open", error=str(exc))
                return {"blocked": False, "reason": None, "action": "ERROR", "assessments": []}


_client: BedrockGuardrailsClient | None = None


def get_guardrail_client() -> BedrockGuardrailsClient:
    global _client
    if _client is None:
        _client = BedrockGuardrailsClient()
    return _client
