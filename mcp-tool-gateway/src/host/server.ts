import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { z } from 'zod';
import { env } from '../env.js';
import { McpRegistry } from './registry.js';
import { runAgent } from './agent.js';

/**
 * MCP Tool Gateway — host agent (port 3002).
 *
 * A network-facing agent whose entire tool catalog is discovered at runtime
 * from MCP servers: our own gateway over Streamable HTTP, plus (optionally) a
 * third-party server over stdio. The React dashboard calls POST /chat.
 */
const registry = new McpRegistry();

const app = new Hono();

app.get('/health', async (c) => {
  const tools = await registry.listTools();
  return c.json({
    status: 'ok',
    servers: registry.serverLabels,
    toolCount: tools.length,
    tools: tools.map((t) => t.name),
  });
});

const chatSchema = z.object({ message: z.string().min(1) });

app.post('/chat', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const parsed = chatSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Body must be { "message": "..." }.' }, 400);
  }

  try {
    const result = await runAgent(registry, parsed.data.message);
    return c.json(result);
  } catch (err) {
    return c.json({ error: (err as Error).message }, 500);
  }
});

async function main(): Promise<void> {
  // The gateway is the primary dependency — connect it before serving.
  await registry.connect(McpRegistry.httpSpec('gateway', env.gatewayUrl));

  serve({ fetch: app.fetch, port: env.hostPort }, (info) => {
    console.error(
      `[host] agent ready on http://localhost:${info.port} — servers: ${
        registry.serverLabels.join(', ') || '(none connected)'
      }`
    );
  });

  // The third-party server is a portability demo — connect it in the background
  // so a slow/offline npx spawn never blocks host startup.
  if (env.enableThirdParty) {
    void registry
      .connect(McpRegistry.stdioSpec('everything', env.thirdPartyCommand, env.thirdPartyArgs))
      .then((ok) => {
        if (ok) console.error('[host] third-party "everything" server added to the catalog.');
      });
  }
}

main().catch((err) => {
  console.error('[host] fatal:', err);
  process.exit(1);
});
