import Anthropic from '@anthropic-ai/sdk';
import type { MessageParam, Tool, ToolUseBlock } from '@anthropic-ai/sdk/resources/messages';
import { env } from '../env.js';
import type { McpRegistry } from './registry.js';

const SYSTEM_PROMPT =
  'You are the MCP Tool Gateway host agent. You answer questions by discovering ' +
  'and calling tools exposed over the Model Context Protocol. The tools were ' +
  'discovered at runtime from one or more MCP servers — prefer calling a tool ' +
  'over guessing. Be concise.';

const MAX_TURNS = 8;

export interface AgentResult {
  answer: string;
  toolCalls: Array<{ tool: string; args: Record<string, unknown> }>;
}

/**
 * Runs an Anthropic tool-use loop where the tool catalog is populated entirely
 * by MCP discovery. The model never sees which server a tool came from — it
 * just calls namespaced tools, and the registry routes each call.
 */
export async function runAgent(registry: McpRegistry, userMessage: string): Promise<AgentResult> {
  if (!env.anthropicApiKey) {
    throw new Error('ANTHROPIC_API_KEY is not set — the host agent needs it to run the model loop.');
  }

  const client = new Anthropic({ apiKey: env.anthropicApiKey });
  const discovered = await registry.listTools();
  const tools: Tool[] = discovered.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.input_schema as Tool['input_schema'],
  }));

  const messages: MessageParam[] = [{ role: 'user', content: userMessage }];
  const toolCalls: AgentResult['toolCalls'] = [];

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    const res = await client.messages.create({
      model: env.model,
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      tools,
      messages,
    });

    messages.push({ role: 'assistant', content: res.content });

    if (res.stop_reason !== 'tool_use') {
      const answer = res.content
        .filter((b): b is Extract<typeof b, { type: 'text' }> => b.type === 'text')
        .map((b) => b.text)
        .join('\n');
      return { answer, toolCalls };
    }

    const toolUses = res.content.filter((b): b is ToolUseBlock => b.type === 'tool_use');
    const results = await Promise.all(
      toolUses.map(async (tu) => {
        const args = (tu.input ?? {}) as Record<string, unknown>;
        toolCalls.push({ tool: tu.name, args });
        const output = await registry.callTool(tu.name, args);
        return { type: 'tool_result' as const, tool_use_id: tu.id, content: output };
      })
    );

    messages.push({ role: 'user', content: results });
  }

  return { answer: '(stopped: reached the maximum number of tool-use turns)', toolCalls };
}
