import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

/**
 * A lightweight, dependency-free registry of the apps in this portfolio.
 * Milestone 1 keeps data inline; a later milestone swaps this for the real
 * libsql/Drizzle-backed `query_portfolio_db` tool.
 */
const PORTFOLIO: Record<string, { port: number | null; stack: string; focus: string }> = {
  'agentic-customer-support': {
    port: null,
    stack: 'Vercel AI SDK, Hono, Zod',
    focus: 'High-reliability tool-use for order verification, shipment status, and refunds.',
  },
  'compliance-pii-sanitizer': {
    port: 8001,
    stack: 'Microsoft Presidio, Ollama, Phi-3',
    focus: 'Masks or swaps PII on outgoing LLM calls and validates safety scores locally.',
  },
  'multi-agent-debate': {
    port: 8005,
    stack: 'FastAPI, LLM-Debate',
    focus: 'Structured proponent/opponent debate moderated by a third agent.',
  },
  'enterprise-knowledge-swarm': {
    port: 8004,
    stack: 'FastAPI, Asyncio, RAG',
    focus: 'Manager agent splits queries across parallel subagents to synthesize RAG reports.',
  },
};

/**
 * Registers all tools this MCP server exposes.
 *
 * Milestone 1 ships a single, fully-working tool that demonstrates the core
 * MCP contract: a Zod-typed input schema (which the SDK advertises to clients
 * during discovery) and a structured content response.
 */
export function registerTools(server: McpServer): void {
  server.registerTool(
    'lookup_portfolio_app',
    {
      title: 'Look up a portfolio app',
      description:
        'Returns the tech stack, local port, and focus area for one of the agentic apps ' +
        'in this portfolio. Use it to discover how a given service is built and where it runs.',
      inputSchema: {
        name: z
          .string()
          .describe('The app folder name, e.g. "multi-agent-debate" or "compliance-pii-sanitizer".'),
      },
    },
    async ({ name }) => {
      const app = PORTFOLIO[name];

      if (!app) {
        const known = Object.keys(PORTFOLIO).join(', ');
        return {
          isError: true,
          content: [
            {
              type: 'text',
              text: `No app named "${name}". Known apps in this demo registry: ${known}.`,
            },
          ],
        };
      }

      const portLine = app.port ? `runs locally on port ${app.port}` : 'has no dedicated port';

      return {
        content: [
          {
            type: 'text',
            text: `${name} — ${app.stack}. ${portLine}. ${app.focus}`,
          },
        ],
        structuredContent: { name, ...app },
      };
    }
  );
}
