import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { PORTFOLIO, APP_NAMES } from './data.js';

/**
 * Registers resources this MCP server exposes.
 *
 * Where a *tool* is an action the model chooses to invoke, a *resource* is
 * readable context a client can attach — addressed by URI. This demonstrates
 * the distinction:
 *
 *   portfolio://apps            → an index of every app (static resource)
 *   portfolio://apps/{name}     → one app's details (templated resource)
 *
 * The template also supplies a `list` callback so clients can enumerate the
 * concrete URIs during resource discovery.
 */
export function registerResources(server: McpServer): void {
  server.registerResource(
    'portfolio-index',
    'portfolio://apps',
    {
      title: 'Portfolio app index',
      description: 'The list of agentic apps exposed through this gateway.',
      mimeType: 'application/json',
    },
    async (uri) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: 'application/json',
          text: JSON.stringify(APP_NAMES, null, 2),
        },
      ],
    })
  );

  server.registerResource(
    'portfolio-app',
    new ResourceTemplate('portfolio://apps/{name}', {
      list: async () => ({
        resources: APP_NAMES.map((name) => ({
          uri: `portfolio://apps/${name}`,
          name,
          mimeType: 'application/json',
        })),
      }),
    }),
    {
      title: 'Portfolio app details',
      description: 'Tech stack, port, and focus area for a single app, addressed by name.',
      mimeType: 'application/json',
    },
    async (uri, { name }) => {
      const key = Array.isArray(name) ? name[0] : name;
      const app = PORTFOLIO[key];

      if (!app) {
        throw new Error(`Unknown app "${key}". Known: ${APP_NAMES.join(', ')}.`);
      }

      return {
        contents: [
          {
            uri: uri.href,
            mimeType: 'application/json',
            text: JSON.stringify({ name: key, ...app }, null, 2),
          },
        ],
      };
    }
  );
}
