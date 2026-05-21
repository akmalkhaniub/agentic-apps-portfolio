"""
search_web MCP Tool — Live web search via Perplexity API.
Perplexity exposes an OpenAI-compatible API, so we use the openai SDK.
"""

from __future__ import annotations

import os
from typing import Any

import structlog
from openai import AsyncOpenAI
from tenacity import retry, stop_after_attempt, wait_exponential

logger = structlog.get_logger(__name__)


def _get_perplexity_client() -> AsyncOpenAI:
    return AsyncOpenAI(
        api_key=os.environ["PERPLEXITY_API_KEY"],
        base_url=os.getenv("PERPLEXITY_BASE_URL", "https://api.perplexity.ai"),
    )


@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=10))
async def perplexity_search(
    query: str,
    max_results: int = 5,
    model: str = "llama-3.1-sonar-large-128k-online",
) -> list[dict[str, Any]]:
    """
    Raw Perplexity search returning list of result dicts.
    Used directly by the ResearcherAgent and via MCP tool wrapper.
    """
    client = _get_perplexity_client()

    response = await client.chat.completions.create(
        model=model,
        messages=[
            {
                "role": "system",
                "content": (
                    "You are a procurement market intelligence assistant. "
                    "Provide factual, sourced information. "
                    "Return results as a JSON array with fields: title, url, snippet, published_date."
                ),
            },
            {"role": "user", "content": query},
        ],
        max_tokens=2048,
        temperature=0.1,
    )

    import json, re
    raw = response.choices[0].message.content or ""
    json_match = re.search(r"\[.*\]", raw, re.DOTALL)

    if json_match:
        try:
            results = json.loads(json_match.group())
            return results[:max_results]
        except json.JSONDecodeError:
            pass

    # Fallback: wrap raw text as single result
    return [{"title": "Perplexity Result", "url": "", "snippet": raw[:1000], "published_date": ""}]


async def search_web_tool(
    query: str,
    max_results: int = 5,
    focus: str = "procurement",
) -> dict[str, Any]:
    """MCP-exposed wrapper for Perplexity search."""
    logger.info("tool.search_web", query=query, focus=focus)

    focused_query = f"{query} site:procurement OR supply chain OR vendor {focus}"
    try:
        results = await perplexity_search(query=focused_query, max_results=max_results)
        return {
            "results": results,
            "metadata": {"query": query, "focus": focus, "count": len(results)},
        }
    except Exception as exc:
        logger.error("tool.search_web.error", error=str(exc))
        return {"results": [], "metadata": {"error": str(exc)}}
