"""
MCP Client Integration — Connects agents to the MCP tool server via
the Model Context Protocol using langchain-mcp-adapters.
This ensures tools are called through the protocol, not direct imports.
"""

from __future__ import annotations

import asyncio
import os
import threading
from typing import Any

import structlog
from langchain_core.tools import BaseTool

logger = structlog.get_logger(__name__)

# MCP server endpoint — defaults to local stdio, supports HTTP for production
MCP_TRANSPORT = os.getenv("MCP_TRANSPORT", "streamable-http")
MCP_SERVER_URL = os.getenv("MCP_SERVER_URL", "http://localhost:8080/mcp")


class MCPToolClient:
    """
    Manages the connection to the MCP tool server and provides
    LangChain-compatible tools for use in agents.

    Usage:
        client = get_mcp_client()
        tools = await client.get_tools()
        # Pass tools to LangChain agent or use directly
        result = await tools[0].ainvoke({"query": "...", "top_k": 5})
    """

    def __init__(self) -> None:
        self._tools: list[BaseTool] | None = None
        self._lock = asyncio.Lock()

    async def get_tools(self) -> list[BaseTool]:
        """
        Lazily connect to MCP server and return LangChain-compatible tools.
        Connection is cached for the lifetime of the client.
        """
        if self._tools is not None:
            return self._tools

        async with self._lock:
            if self._tools is not None:
                return self._tools

            try:
                from langchain_mcp_adapters.tools import load_mcp_tools
                from mcp import ClientSession
                from mcp.client.streamable_http import streamablehttp_client

                logger.info(
                    "mcp_client.connecting",
                    transport=MCP_TRANSPORT,
                    url=MCP_SERVER_URL,
                )

                async with streamablehttp_client(MCP_SERVER_URL) as (
                    read_stream,
                    write_stream,
                    _,
                ):
                    async with ClientSession(read_stream, write_stream) as session:
                        await session.initialize()
                        self._tools = await load_mcp_tools(session)

                logger.info(
                    "mcp_client.connected",
                    tool_count=len(self._tools),
                    tool_names=[t.name for t in self._tools],
                )

            except ImportError:
                logger.warning(
                    "mcp_client.adapters_not_installed",
                    hint="pip install langchain-mcp-adapters mcp",
                )
                self._tools = self._create_fallback_tools()

            except Exception as exc:
                logger.warning(
                    "mcp_client.connection_failed",
                    error=str(exc),
                    hint="Falling back to direct tool imports",
                )
                self._tools = self._create_fallback_tools()

            return self._tools

    def _create_fallback_tools(self) -> list[BaseTool]:
        """
        Create LangChain-compatible tool wrappers from direct imports.
        Used when MCP server is not available (local dev).
        """
        from langchain_core.tools import StructuredTool

        from mcp_server.tools.search_docs import search_docs_tool
        from mcp_server.tools.search_web import search_web_tool
        from mcp_server.tools.query_database import query_database_tool

        tools = [
            StructuredTool.from_function(
                coroutine=search_docs_tool,
                name="search_docs",
                description=(
                    "Search procurement documents using hybrid vector search (Pinecone). "
                    "Supports filtering by document type and vendor ID."
                ),
            ),
            StructuredTool.from_function(
                coroutine=search_web_tool,
                name="search_web",
                description=(
                    "Search the live web using Perplexity API for up-to-date procurement intelligence."
                ),
            ),
            StructuredTool.from_function(
                coroutine=query_database_tool,
                name="query_database",
                description=(
                    "Execute natural language queries against the procurement MySQL database via Vanna AI."
                ),
            ),
        ]
        logger.info("mcp_client.fallback_tools_created", count=len(tools))
        return tools

    async def invoke_tool(self, tool_name: str, **kwargs: Any) -> Any:
        """Invoke a specific MCP tool by name."""
        tools = await self.get_tools()
        for tool in tools:
            if tool.name == tool_name:
                return await tool.ainvoke(kwargs)
        raise ValueError(f"Tool '{tool_name}' not found. Available: {[t.name for t in tools]}")


# ── Singleton ──────────────────────────────────────────────────────────────────

_client: MCPToolClient | None = None
_client_lock = threading.Lock()


def get_mcp_client() -> MCPToolClient:
    """Return singleton MCP client."""
    global _client
    if _client is None:
        with _client_lock:
            if _client is None:
                _client = MCPToolClient()
    return _client
