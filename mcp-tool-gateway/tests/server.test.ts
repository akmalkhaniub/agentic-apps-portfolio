import { describe, it, expect } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { buildServer } from '../src/server/build.js';

/**
 * Smoke tests using the SDK's in-memory transport: a real client talks to a
 * real server over a linked pair, so discovery and invocation of tools,
 * resources, and prompts are exercised end-to-end without spawning a process.
 */
async function connectedClient() {
  const server = buildServer();
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'test-client', version: '0.0.0' });

  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return client;
}

describe('tools', () => {
  it('advertises lookup_portfolio_app during discovery', async () => {
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

describe('resources', () => {
  it('lists the templated app URIs', async () => {
    const client = await connectedClient();
    const { resources } = await client.listResources();
    const uris = resources.map((r) => r.uri);
    expect(uris).toContain('portfolio://apps/multi-agent-debate');
  });

  it('reads a single app resource as JSON', async () => {
    const client = await connectedClient();
    const res = await client.readResource({ uri: 'portfolio://apps/compliance-pii-sanitizer' });
    const parsed = JSON.parse(res.contents[0].text as string);
    expect(parsed.port).toBe(8001);
  });
});

describe('prompts', () => {
  it('renders the debate_topic prompt with arguments', async () => {
    const client = await connectedClient();
    const { prompts } = await client.listPrompts();
    expect(prompts.map((p) => p.name)).toContain('debate_topic');

    const res = await client.getPrompt({
      name: 'debate_topic',
      arguments: { topic: 'Remote work boosts productivity', rounds: '2' },
    });
    const text = (res.messages[0].content as { type: string; text: string }).text;
    expect(text).toContain('Remote work boosts productivity');
    expect(text).toContain('2 rounds');
  });
});
