import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { buildServer } from './build.js';

/**
 * MCP Tool Gateway — stdio entry point.
 *
 * Exposes the gateway over the stdio transport, which is what desktop MCP
 * clients (Claude Desktop, Cursor) spawn and speak to. For the network-facing
 * Streamable HTTP transport, see `transport-http.ts`.
 *
 * IMPORTANT (stdio): the protocol owns stdout. Never `console.log` here — it
 * corrupts the JSON-RPC stream. Diagnostics go to stderr via `console.error`.
 */
async function main(): Promise<void> {
  const server = buildServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error('[mcp-tool-gateway] stdio server ready.');
}

main().catch((err) => {
  console.error('[mcp-tool-gateway] fatal:', err);
  process.exit(1);
});
