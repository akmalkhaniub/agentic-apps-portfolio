import { describe, it, expect } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { registerTools } from '../src/server/tools.js';

/**
 * Smoke tests using the SDK's in-memory transport: a real client talks to a
 * real server over a linked pair, so discovery and tool invocation are
 * exercised end-to-end without spawning a process.
 */
async function connectedClient() {
  const server = new McpServer({ name: 'mcp-tool-gateway', version: '0.1.0' });
  registerTools(server);

  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'test-client', version: '0.0.0' });

  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return client;
}

describe('mcp-tool-gateway server', () => {
  it('advertises the lookup_portfolio_app tool during discovery', async () => {
    const client = await connectedClient();
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name)).toContain('lookup_portfolio_app');
  });

  it('returns details for a known app', async () => {
    const client = await connectedClient();
    const res = await client.callTool({
      name: 'lookup_portfolio_app',
      arguments: { name: 'multi-agent-debate' },
    });
    const text = (res.content as Array<{ type: string; text: string }>)[0].text;
    expect(text).toContain('port 8005');
    expect(res.isError).toBeFalsy();
  });

  it('flags an unknown app as an error result', async () => {
    const client = await connectedClient();
    const res = await client.callTool({
      name: 'lookup_portfolio_app',
      arguments: { name: 'does-not-exist' },
    });
    expect(res.isError).toBe(true);
  });
});
