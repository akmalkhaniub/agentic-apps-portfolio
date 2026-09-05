import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerTools } from './tools.js';
import { registerResources } from './resources.js';
import { registerPrompts } from './prompts.js';

/**
 * Builds a fully-configured MCP server with every tool, resource, and prompt
 * registered. Transport-agnostic: the stdio entry point and the Streamable HTTP
 * entry point both call this, so the two transports expose an identical surface.
 */
export function buildServer(): McpServer {
  const server = new McpServer({
    name: 'mcp-tool-gateway',
    version: '0.2.0',
  });

  registerTools(server);
  registerResources(server);
  registerPrompts(server);

  return server;
}
