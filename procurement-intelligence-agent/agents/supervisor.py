"""
Supervisor Agent — Routes queries to the appropriate sub-agents using
LangGraph's tool-calling pattern. Runs on Claude 3.5 Sonnet via AWS Bedrock.
"""

from __future__ import annotations

import structlog
from langchain_aws import ChatBedrockConverse
from langchain_core.messages import AIMessage, HumanMessage, SystemMessage
from langchain_core.runnables import RunnableConfig

from agents.json_utils import extract_json
from agents.state import AgentState

logger = structlog.get_logger(__name__)

SUPERVISOR_SYSTEM_PROMPT = """You are the Supervisor Agent for an Enterprise Procurement Intelligence system.

Your role:
1. Analyse the user's procurement query
2. Decompose it into sub-queries if needed
3. Decide which specialist agents to call:
   - **researcher**: for questions needing document retrieval (vendor contracts, RFPs, policy docs) or live web search
   - **sql_analyst**: for questions needing structured data (spend totals, vendor counts, PO history)
   - **writer**: after receiving results from other agents, synthesise into a final answer
   - **FINISH**: when the answer is ready and validated

User Tier: {tier}
- INTERNAL: full data access, detailed financials allowed
- PARTNER: filtered vendor data, no internal financials
- PUBLIC: aggregated data only, no PII or internal references

Always respond in JSON with this exact schema:
{{
  "next_agent": "researcher" | "sql_analyst" | "writer" | "FINISH",
  "sub_queries": ["query1", "query2"],
  "reasoning": "why you chose this routing"
}}

Do NOT answer the user directly — route to the right agent.
"""


def build_supervisor(model_id: str, region: str) -> ChatBedrockConverse:
    """Initialise Claude via ChatBedrockConverse with prompt caching enabled."""
    return ChatBedrockConverse(
        model=model_id,
        region_name=region,
        temperature=0,
        max_tokens=4096,
        # Prompt caching — cache the system prompt across calls
        additional_model_request_fields={
            "anthropic_beta": ["prompt-caching-2024-07-31"],
        },
    )


async def supervisor_node(state: AgentState, config: RunnableConfig) -> dict:
    """
    LangGraph node: Supervisor routing decision.
    Returns partial state update with next_agent, sub_queries, and messages.
    """
    cfg = config.get("configurable", {})
    model_id = cfg.get("model_id", "anthropic.claude-3-5-sonnet-20241022-v2:0")
    region = cfg.get("aws_region", "us-east-1")

    logger.info(
        "supervisor.routing",
        query=state["original_query"],
        tier=state["tier"],
        iteration=state["iterations"],
    )

    # Guard: max iterations exceeded
    if state["iterations"] >= state["max_iterations"]:
        logger.warning("supervisor.max_iterations_exceeded", iterations=state["iterations"])
        return {"next_agent": "writer", "iterations": state["iterations"] + 1}

    llm = build_supervisor(model_id, region)

    human_content = f"""
User Query: {state["original_query"]}

Context gathered so far:
- Documents retrieved: {len(state["context_docs"])}
- SQL results: {len(state["sql_results"])}
- Draft answer ready: {bool(state["draft_answer"])}

Previous routing: {state.get("next_agent", "none")}

Decide the next step.
"""

    # FIX #8: Include message history for multi-turn context
    messages = [
        SystemMessage(
            content=SUPERVISOR_SYSTEM_PROMPT.format(tier=state["tier"]),
            additional_kwargs={"cache_control": {"type": "ephemeral"}},
        ),
        *state["messages"][-10:],  # Last 10 messages for context window management
        HumanMessage(content=human_content),
    ]

    response = await llm.ainvoke(messages)

    # FIX #5: Use robust JSON extraction instead of greedy regex
    parsed = extract_json(response.content)
    if parsed is None:
        parsed = {"next_agent": "writer", "sub_queries": [], "reasoning": "parse error"}

    logger.info(
        "supervisor.decision",
        next_agent=parsed.get("next_agent"),
        reasoning=parsed.get("reasoning"),
    )

    # FIX #8: Append messages to state for conversation history
    return {
        "next_agent": parsed.get("next_agent", "writer"),
        "sub_queries": parsed.get("sub_queries", [state["original_query"]]),
        "iterations": state["iterations"] + 1,
        "messages": [
            HumanMessage(content=human_content),
            AIMessage(content=response.content),
        ],
    }
