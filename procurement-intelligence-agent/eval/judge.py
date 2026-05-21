"""
LLM-as-Judge — Evaluates procurement agent responses on faithfulness,
relevance, citation quality, and SQL accuracy using Claude via Bedrock.
Uses asyncio.to_thread for non-blocking boto3 calls.
"""

from __future__ import annotations

import asyncio
import json
import os
import re
from typing import Any

import boto3
import structlog

logger = structlog.get_logger(__name__)

JUDGE_PROMPT = """You are a rigorous evaluator of AI-generated procurement intelligence answers.

Evaluate the answer against these criteria, scoring each from 0.0 to 1.0:

1. **faithfulness** (0-1): Is every claim in the answer grounded in the provided citations or SQL data? 
   Penalise hallucinations heavily.
2. **relevance** (0-1): Does the answer directly address the question? Penalise tangential responses.
3. **citation_quality** (0-1): Are citations specific, accurate, and properly formatted?
4. **sql_accuracy** (0-1): If SQL was generated, does it appear correct for the question? 
   Score 0.5 if no SQL was generated (N/A).

Return ONLY valid JSON with this exact schema:
{{
  "faithfulness": 0.0,
  "relevance": 0.0,
  "citation_quality": 0.0,
  "sql_accuracy": 0.0,
  "reasoning": "brief explanation of scores"
}}

Question: {query}

Answer: {answer}

Citations: {citations}

SQL Query (if any): {sql_query}
"""


class ProcurementJudge:
    """Claude-based LLM judge for procurement agent evaluation."""

    MODEL_ID = "anthropic.claude-3-5-sonnet-20241022-v2:0"

    def __init__(self) -> None:
        self._client = boto3.client(
            "bedrock-runtime",
            region_name=os.getenv("AWS_REGION", "us-east-1"),
        )

    def _invoke_sync(self, prompt: str) -> str:
        """Synchronous Bedrock call — run via asyncio.to_thread."""
        response = self._client.invoke_model(
            modelId=self.MODEL_ID,
            contentType="application/json",
            accept="application/json",
            body=json.dumps({
                "anthropic_version": "bedrock-2023-05-31",
                "max_tokens": 512,
                "temperature": 0,
                "messages": [{"role": "user", "content": prompt}],
            }),
        )
        raw = json.loads(response["body"].read())
        return raw["content"][0]["text"]

    async def evaluate_async(
        self,
        query: str,
        answer: str,
        citations: list[dict[str, Any]],
        sql_query: str | None = None,
    ) -> dict[str, float]:
        """Async version — runs boto3 in a thread pool."""
        prompt = JUDGE_PROMPT.format(
            query=query,
            answer=answer[:2000],
            citations=json.dumps(citations[:5], indent=2),
            sql_query=sql_query or "N/A",
        )
        try:
            content = await asyncio.to_thread(self._invoke_sync, prompt)
            return self._parse_scores(content)
        except Exception as exc:
            logger.error("judge.evaluation_failed", error=str(exc))
            return self._default_scores()

    def evaluate(
        self,
        query: str,
        answer: str,
        citations: list[dict[str, Any]],
        sql_query: str | None = None,
    ) -> dict[str, float]:
        """
        Synchronous version for use outside async context (e.g., eval scripts).
        """
        prompt = JUDGE_PROMPT.format(
            query=query,
            answer=answer[:2000],
            citations=json.dumps(citations[:5], indent=2),
            sql_query=sql_query or "N/A",
        )

        try:
            content = self._invoke_sync(prompt)
            return self._parse_scores(content)
        except Exception as exc:
            logger.error("judge.evaluation_failed", error=str(exc))
            return self._default_scores()

    def _parse_scores(self, content: str) -> dict[str, float]:
        """Extract scores from LLM response using robust JSON parsing."""
        from agents.json_utils import extract_json
        parsed = extract_json(content)
        if parsed:
            return {
                "faithfulness": float(parsed.get("faithfulness", 0.5)),
                "relevance": float(parsed.get("relevance", 0.5)),
                "citation_quality": float(parsed.get("citation_quality", 0.5)),
                "sql_accuracy": float(parsed.get("sql_accuracy", 0.5)),
                "reasoning": parsed.get("reasoning", ""),
            }
        return self._default_scores()

    def _default_scores(self) -> dict[str, float]:
        return {
            "faithfulness": 0.5,
            "relevance": 0.5,
            "citation_quality": 0.5,
            "sql_accuracy": 0.5,
            "reasoning": "Evaluation failed",
        }
