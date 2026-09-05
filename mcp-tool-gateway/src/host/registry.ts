import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';

/** A discovered tool, flattened into the shape the Anthropic API expects. */
export interface DiscoveredTool {
  /** Namespaced name, `<serverLabel>__<toolName>`, unique across servers. */
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

interface Connection {
  label: string;
  client: Client;
  /** Bare tool names this server owns (un-namespaced). */
  toolNames: Set<string>;
}

export interface ServerSpec {
  label: string;
  transport: () => Transport;
}

const SEP = '__';

/**
 * Connects to one or more MCP servers, merges their tool catalogs into a single
 * namespaced list for the model, and routes tool calls back to the owning
 * server. This is the heart of the host being *protocol-native*: it does not
 * know or care that one server is our gateway and another is a third party.
 */
export class McpRegistry {
  private connections: Connection[] = [];

  /** Convenience factory for our gateway over Streamable HTTP. */
  static httpSpec(label: string, url: string): ServerSpec {
    return { label, transport: () => new StreamableHTTPClientTransport(new URL(url)) };
  }

  /** Convenience factory for a stdio server spawned as a child process. */
  static stdioSpec(label: string, command: string, args: string[]): ServerSpec {
    return { label, transport: () => new StdioClientTransport({ command, args }) };
  }

  /**
   * Connects to a server. Failures are non-fatal: a third-party server that
   * won't spawn (offline npx, etc.) or takes too long is logged and skipped so
   * the host still runs with whatever connected. `timeoutMs` bounds the wait so
   * a hanging child process can't block host startup.
   */
  async connect(spec: ServerSpec, timeoutMs = 20_000): Promise<boolean> {
    const client = new Client({ name: 'mcp-tool-gateway-host', version: '0.3.0' });
    try {
      const withTimeout = <T>(p: Promise<T>): Promise<T> =>
        Promise.race([
          p,
          new Promise<T>((_, reject) =>
            setTimeout(() => reject(new Error(`timed out after ${timeoutMs}ms`)), timeoutMs)
          ),
        ]);

      await withTimeout(client.connect(spec.transport()));
      const { tools } = await withTimeout(client.listTools());
      this.connections.push({
        label: spec.label,
        client,
        toolNames: new Set(tools.map((t) => t.name)),
      });
      console.error(
        `[host] connected to "${spec.label}" — ${tools.length} tool(s): ${tools
          .map((t) => t.name)
          .join(', ')}`
      );
      return true;
    } catch (err) {
      console.error(`[host] skipping "${spec.label}": ${(err as Error).message}`);
      return false;
    }
  }

  /** The merged, namespaced tool catalog to hand the model. */
  async listTools(): Promise<DiscoveredTool[]> {
    const out: DiscoveredTool[] = [];
    for (const conn of this.connections) {
      const { tools } = await conn.client.listTools();
      for (const t of tools) {
        out.push({
          name: `${conn.label}${SEP}${t.name}`,
          description: t.description ?? '',
          input_schema: (t.inputSchema as Record<string, unknown>) ?? {
            type: 'object',
            properties: {},
          },
        });
      }
    }
    return out;
  }

  /** Routes a namespaced tool call to the server that owns it. */
  async callTool(namespaced: string, args: Record<string, unknown>): Promise<string> {
    const idx = namespaced.indexOf(SEP);
    const label = namespaced.slice(0, idx);
    const toolName = namespaced.slice(idx + SEP.length);

    const conn = this.connections.find((c) => c.label === label);
    if (!conn || !conn.toolNames.has(toolName)) {
      return `Error: no connected server owns tool "${namespaced}".`;
    }

    const res = await conn.client.callTool({ name: toolName, arguments: args });
    const parts = (res.content as Array<{ type: string; text?: string }>) ?? [];
    const text = parts
      .filter((p) => p.type === 'text' && p.text)
      .map((p) => p.text)
      .join('\n');
    return text || JSON.stringify(res.structuredContent ?? res.content ?? {});
  }

  get serverLabels(): string[] {
    return this.connections.map((c) => c.label);
  }

  async close(): Promise<void> {
    await Promise.all(this.connections.map((c) => c.client.close().catch(() => {})));
    this.connections = [];
  }
}
