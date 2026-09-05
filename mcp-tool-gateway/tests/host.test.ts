import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { Server } from 'node:http';
import { createHttpServer } from '../src/server/transport-http.js';
import { McpRegistry } from '../src/host/registry.js';

/**
 * Integration test: the host registry connects to the real gateway over
 * Streamable HTTP and discovers its tools — the exact runtime-discovery path
 * the agent uses, minus the Anthropic model call (no API key needed).
 */
const PORT = 8117;
let server: Server;
let registry: McpRegistry;

beforeAll(async () => {
  server = createHttpServer();
  await new Promise<void>((resolve) => server.listen(PORT, resolve));
  registry = new McpRegistry();
  await registry.connect(McpRegistry.httpSpec('gateway', `http://localhost:${PORT}/mcp`));
});

afterAll(async () => {
  await registry.close();
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

describe('host registry over HTTP', () => {
  it('discovers and namespaces the gateway tools', async () => {
    const tools = await registry.listTools();
    expect(tools.map((t) => t.name)).toContain('gateway__lookup_portfolio_app');
  });

  it('routes a namespaced tool call to the owning server', async () => {
    const out = await registry.callTool('gateway__lookup_portfolio_app', {
      name: 'multi-agent-debate',
    });
    expect(out).toContain('port 8005');
  });

  it('errors clearly for a tool no server owns', async () => {
    const out = await registry.callTool('gateway__nope', {});
    expect(out).toMatch(/no connected server owns/i);
  });
});
