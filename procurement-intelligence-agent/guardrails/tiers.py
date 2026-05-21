"""
Guardrail Tier Definitions — INTERNAL / PARTNER / PUBLIC access configuration.
Defines token budgets, topic restrictions, and Bedrock Guardrail settings per tier.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Literal

TierType = Literal["INTERNAL", "PARTNER", "PUBLIC"]


@dataclass(frozen=True)
class TierConfig:
    """Configuration for a single access tier."""
    name: TierType
    max_tokens: int
    max_rows: int                        # SQL result row cap
    bedrock_guardrail_strength: str      # "NONE", "LOW", "MEDIUM", "HIGH"
    apply_guardrail_api: bool            # Use Bedrock ApplyGuardrail API
    denied_topics: list[str]             # Topics blocked for this tier
    pii_action: str                      # "NONE", "ANONYMIZE", "BLOCK"
    grounding_required: bool             # Reject ungrounded answers
    langsmith_trace_level: str           # "FULL", "SUMMARY", "MINIMAL"
    rate_limit_rpm: int                  # Requests per minute
    description: str = ""


TIER_CONFIGS: dict[TierType, TierConfig] = {
    "INTERNAL": TierConfig(
        name="INTERNAL",
        max_tokens=50_000,
        max_rows=500,
        bedrock_guardrail_strength="LOW",
        apply_guardrail_api=True,
        denied_topics=[],                # No topic restrictions
        pii_action="NONE",              # PII visible to internal users
        grounding_required=False,
        langsmith_trace_level="FULL",
        rate_limit_rpm=120,
        description="Full access for internal analysts. No topic restrictions.",
    ),
    "PARTNER": TierConfig(
        name="PARTNER",
        max_tokens=20_000,
        max_rows=100,
        bedrock_guardrail_strength="MEDIUM",
        apply_guardrail_api=True,
        denied_topics=[
            "internal_cost_structure",
            "employee_data",
            "strategic_plans",
            "competitor_intelligence",
        ],
        pii_action="ANONYMIZE",         # Anonymise PII in responses
        grounding_required=True,
        langsmith_trace_level="SUMMARY",
        rate_limit_rpm=30,
        description="Partner-facing: filtered vendor data, no internal financials.",
    ),
    "PUBLIC": TierConfig(
        name="PUBLIC",
        max_tokens=8_000,
        max_rows=25,
        bedrock_guardrail_strength="HIGH",
        apply_guardrail_api=True,
        denied_topics=[
            "internal_cost_structure",
            "employee_data",
            "strategic_plans",
            "competitor_intelligence",
            "vendor_pricing",
            "contract_terms",
            "internal_processes",
        ],
        pii_action="BLOCK",             # Block any PII entirely
        grounding_required=True,
        langsmith_trace_level="MINIMAL",
        rate_limit_rpm=10,
        description="Public: aggregated statistics only, strict safety guardrails.",
    ),
}


def get_tier_config(tier: TierType) -> TierConfig:
    """Get configuration for a given tier."""
    if tier not in TIER_CONFIGS:
        raise ValueError(f"Unknown tier: {tier}. Must be one of {list(TIER_CONFIGS.keys())}")
    return TIER_CONFIGS[tier]


def tier_from_jwt_claim(claim: str | None) -> TierType:
    """Parse tier from a JWT claim string, defaulting to PUBLIC."""
    if claim is None:
        return "PUBLIC"
    upper = claim.strip().upper()
    if upper in ("INTERNAL", "PARTNER", "PUBLIC"):
        return upper  # type: ignore[return-value]
    return "PUBLIC"
