import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { PORTFOLIO, APP_NAMES } from './data.js';

/**
 * Registers all tools this MCP server exposes.
 *
 * `lookup_portfolio_app` demonstrates the core MCP tool contract: a Zod-typed
 * input schema (which the SDK advertises to clients during discovery) and a
 * structured content response.
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
        return {
          isError: true,
          content: [
            {
              type: 'text',
              text: `No app named "${name}". Known apps in this demo registry: ${APP_NAMES.join(', ')}.`,
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
