import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { registerTools } from './tools.js';

/**
 * MCP Tool Gateway — Milestone 1: stdio server.
 *
 * Exposes portfolio tools over the Model Context Protocol via the stdio
 * transport, which is what desktop MCP clients (Claude Desktop, Cursor) spawn
 * and speak to. A later milestone adds a Streamable HTTP transport on port 8006
 * so the React dashboard and the host agent can reach the same server over the
 * network.
 *
 * IMPORTANT (stdio): the protocol owns stdout. Never `console.log` here — it
 * corrupts the JSON-RPC stream. Diagnostics go to stderr via `console.error`.
 */
async function main(): Promise<void> {
  const server = new McpServer({
    name: 'mcp-tool-gateway',
    version: '0.1.0',
  });

  registerTools(server);

  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error('[mcp-tool-gateway] stdio server ready.');
}

main().catch((err) => {
  console.error('[mcp-tool-gateway] fatal:', err);
  process.exit(1);
});
