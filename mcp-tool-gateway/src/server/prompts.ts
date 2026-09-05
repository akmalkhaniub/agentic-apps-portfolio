import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

/**
 * Registers reusable prompt templates.
 *
 * A *prompt* is a parameterized message a client can surface to the user (e.g.
 * a slash command). `debate_topic` front-ends the Multi-Agent Debate app (#17):
 * given a topic, it produces a ready-to-run instruction for that service.
 */
export function registerPrompts(server: McpServer): void {
  server.registerPrompt(
    'debate_topic',
    {
      title: 'Frame a multi-agent debate',
      description: 'Builds a structured instruction to run the Multi-Agent Debate app on a topic.',
      argsSchema: {
        topic: z.string().describe('The proposition to debate, e.g. "Nuclear energy is the safest path to net zero."'),
        rounds: z.string().optional().describe('Number of debate rounds (defaults to 3).'),
      },
    },
    ({ topic, rounds }) => ({
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text:
              `Run a structured debate on the proposition: "${topic}".\n` +
              `Use ${rounds ?? '3'} rounds. Have a proponent argue for it and an opponent argue ` +
              `against, then let the moderator agent declare a reasoned verdict.`,
          },
        },
      ],
    })
  );
}
