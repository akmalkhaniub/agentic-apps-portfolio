import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { buildServer } from './build.js';
import { env } from '../env.js';

/**
 * MCP Tool Gateway — Streamable HTTP entry point (port 8006 by default).
 *
 * This is the network-facing transport the React dashboard and the host agent
 * (milestone 3) will use, and the current MCP HTTP standard (SSE is deprecated).
 *
 * Runs in **stateless** mode: each POST /mcp spins up a fresh server+transport,
 * handles the one request, and tears them down on close. That keeps the demo
 * simple (no session store) and safe under concurrent requests. GET/DELETE,
 * which only matter for the stateful streaming session model, return 405.
 */
const MCP_PATH = '/mcp';

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw.length ? JSON.parse(raw) : undefined;
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

async function handleMcpPost(req: IncomingMessage, res: ServerResponse): Promise<void> {
  // Stateless: a new server + transport per request, disposed when it closes.
  const server = buildServer();
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });

  res.on('close', () => {
    void transport.close();
    void server.close();
  });

  await server.connect(transport);

  let body: unknown;
  try {
    body = await readJsonBody(req);
  } catch {
    sendJson(res, 400, {
      jsonrpc: '2.0',
      error: { code: -32700, message: 'Parse error: request body is not valid JSON.' },
      id: null,
    });
    return;
  }

  await transport.handleRequest(req, res, body);
}

function requestListener(req: IncomingMessage, res: ServerResponse): void {
  const url = new URL(req.url ?? '/', `http://localhost:${env.httpPort}`);

  if (url.pathname === '/health') {
    sendJson(res, 200, { status: 'ok', transport: 'streamable-http', path: MCP_PATH });
    return;
  }

  if (url.pathname !== MCP_PATH) {
    sendJson(res, 404, { error: `Not found. MCP endpoint is POST ${MCP_PATH}.` });
    return;
  }

  if (req.method === 'POST') {
    handleMcpPost(req, res).catch((err) => {
      console.error('[mcp-tool-gateway:http] request error:', err);
      if (!res.headersSent) {
        sendJson(res, 500, {
          jsonrpc: '2.0',
          error: { code: -32603, message: 'Internal server error.' },
          id: null,
        });
      }
    });
    return;
  }

  // Stateless mode doesn't support the GET/DELETE session lifecycle.
  sendJson(res, 405, {
    jsonrpc: '2.0',
    error: { code: -32000, message: 'Method not allowed. This stateless server accepts POST only.' },
    id: null,
  });
}

createServer(requestListener).listen(env.httpPort, () => {
  console.error(
    `[mcp-tool-gateway] Streamable HTTP server ready on http://localhost:${env.httpPort}${MCP_PATH}`
  );
});
