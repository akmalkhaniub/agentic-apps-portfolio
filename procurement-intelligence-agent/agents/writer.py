"""
Writer Agent — Synthesises RAG context, SQL results, and web search
into a final grounded answer with citations. Uses Claude via Bedrock.
"""

from __future__ import annotations

import json

import structlog
from langchain_aws import ChatBedrockConverse
from langchain_core.messages import AIMessage, HumanMessage, SystemMessage
from langchain_core.runnables import RunnableConfig

from agents.json_utils import extract_json
from agents.state import AgentState

logger = structlog.get_logger(__name__)

WRITER_SYSTEM_PROMPT = """You are the Writer Agent for a Procurement Intelligence system.

Your job:
1. Synthesise all available evidence (documents, SQL results, web data)
2. Write a clear, accurate answer grounded ONLY in the evidence provided
3. Include inline citations using [Source: <doc_name>] notation
4. Include a confidence score (0.0–1.0) based on evidence quality
5. Flag any gaps or caveats in the evidence

Output JSON with this exact schema:
{{
  "answer": "Full answer text with inline citations",
  "citations": [
    {{"source": "vendor_contract_acme.pdf", "excerpt": "relevant passage"}}
  ],
  "confidence_score": 0.85,
  "caveats": ["any important caveats"]
}}

Tier: {tier}
- INTERNAL: Include specific financials, vendor names, exact figures
- PARTNER: Anonymize competitors, omit internal cost structures
- PUBLIC: Only aggregated statistics, no vendor names or internal pricing
"""


async def writer_node(state: AgentState, config: RunnableConfig) -> dict:
    """
    LangGraph node: Evidence synthesis → final grounded answer.
    Returns final_answer, citations, confidence_score, and appended messages.
    """
    cfg = config.get("configurable", {})
    model_id = cfg.get("model_id", "anthropic.claude-3-5-sonnet-20241022-v2:0")
    region = cfg.get("aws_region", "us-east-1")
    tier = state["tier"]

    logger.info(
        "writer.start",
        docs=len(state["context_docs"]),
        sql_rows=len(state["sql_results"]),
        web_results=len(state["web_results"]),
    )

    llm = ChatBedrockConverse(
        model=model_id,
        region_name=region,
        temperature=0.1,
        max_tokens=8192,
    )

    # Build evidence block
    evidence_parts = []

    if state["context_docs"]:
        evidence_parts.append("=== DOCUMENT EVIDENCE ===")
        for i, doc in enumerate(state["context_docs"][:5], 1):
            score = state["retrieval_scores"][i - 1] if i - 1 < len(state["retrieval_scores"]) else "N/A"
            evidence_parts.append(
                f"[Doc {i}] Source: {doc.get('source', 'unknown')}\n"
                f"Score: {score}\n"
                f"Content: {doc.get('content', '')[:800]}"
            )

    if state["sql_results"]:
        evidence_parts.append("=== STRUCTURED DATA (SQL) ===")
        evidence_parts.append(f"Query: {state['sql_query']}")
        evidence_parts.append(
            f"Results (first 10 rows):\n"
            f"{json.dumps(state['sql_results'][:10], indent=2, default=str)}"
        )

    if state["web_results"]:
        evidence_parts.append("=== WEB SEARCH RESULTS ===")
        for i, result in enumerate(state["web_results"][:3], 1):
            evidence_parts.append(
                f"[Web {i}] {result.get('title', '')}\n"
                f"URL: {result.get('url', '')}\n"
                f"Snippet: {result.get('snippet', '')[:500]}"
            )

    if not evidence_parts:
        evidence_parts.append("No evidence was retrieved. Acknowledge this limitation.")

    evidence_text = "\n\n".join(evidence_parts)

    human_content = f"""
User Question: {state["original_query"]}

Evidence:
{evidence_text}

Write the final answer now.
"""

    messages = [
        SystemMessage(
            content=WRITER_SYSTEM_PROMPT.format(tier=tier),
            additional_kwargs={"cache_control": {"type": "ephemeral"}},
        ),
        *state["messages"][-6:],  # Include recent message history
        HumanMessage(content=human_content),
    ]

    response = await llm.ainvoke(messages)

    # FIX #5: Use robust JSON extraction instead of greedy regex
    parsed = extract_json(response.content)
    if parsed is None:
        parsed = _fallback_response(response.content)

    logger.info(
        "writer.complete",
        confidence=parsed.get("confidence_score", 0.0),
        citation_count=len(parsed.get("citations", [])),
    )

    answer = parsed.get("answer", response.content)

    return {
        "draft_answer": answer,
        "final_answer": answer,
        "citations": parsed.get("citations", []),
        "confidence_score": float(parsed.get("confidence_score", 0.5)),
        "messages": [AIMessage(content=f"[Writer] {answer[:200]}...")],
    }


def _fallback_response(raw: str) -> dict:
    return {
        "answer": raw,
        "citations": [],
        "confidence_score": 0.3,
        "caveats": ["Response could not be structured — returning raw output."],
    }
