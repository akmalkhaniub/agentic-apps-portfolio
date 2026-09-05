# 🔌 MCP Tool Gateway

An **MCP (Model Context Protocol) server + host** demo for the Agentic Apps Portfolio.

Every other app in this portfolio *is* an agent. This one shows the **interop layer
underneath** agents: it exposes portfolio tools, resources, and prompts over the
standard protocol, so **any** MCP client — Claude Desktop, Cursor, or the portfolio's
own host agent — can discover and call them at runtime, with no hardcoding.

> **Status:** Milestone 3 — a **host agent** on port **3002** now discovers tools
> at runtime from this gateway (over HTTP) *and* a second, third-party MCP server,
> merges the catalogs, and drives an Opus tool-use loop. The gateway exposes all
> three MCP primitives (**tools**, **resources**, **prompts**) over **two
> transports** (stdio + Streamable HTTP on **8006**).

---

## What the gateway exposes

- **Tool** — `lookup_portfolio_app`: Zod-typed input the SDK advertises during
  discovery, returning a structured content response.
- **Resources** — `portfolio://apps` (index) and `portfolio://apps/{name}`
  (templated, per-app details), showing readable context vs. callable actions.
- **Prompt** — `debate_topic`: a parameterized template that front-ends the
  Multi-Agent Debate app (#17).

...over two transports, both exposing an identical surface via `buildServer()`:

- **stdio** — what Claude Desktop / Cursor spawn (`src/server/index.ts`).
- **Streamable HTTP** — the current MCP HTTP standard, stateless, on port 8006
  (`src/server/transport-http.ts`). SSE is deprecated and not used.

## Layout

```
mcp-tool-gateway/
├── src/
│   ├── env.ts                    # port/model/server config
│   ├── server/
│   │   ├── build.ts              # buildServer(): registers everything (shared)
│   │   ├── index.ts              # stdio transport entry
│   │   ├── transport-http.ts     # Streamable HTTP entry (port 8006)
│   │   ├── data.ts               # shared portfolio registry
│   │   └── tools.ts / resources.ts / prompts.ts
│   └── host/
│       ├── registry.ts           # connects to N MCP servers, merges + routes tools
│       ├── agent.ts              # Anthropic tool-use loop over discovered tools
│       └── server.ts             # host HTTP entry (port 3002): POST /chat
├── tests/server.test.ts / host.test.ts
├── claude_desktop_config.json
└── package.json
```

## The host agent (port 3002)

The host is **protocol-native**: its entire tool catalog is discovered at runtime.
It connects to this gateway over Streamable HTTP and, in the background, to a
second third-party MCP server over stdio (the reference `server-everything`,
spawned via npx). Tools are namespaced `<server>__<tool>` and the registry routes
each call back to the owning server — the model never knows which server a tool
came from.

```bash
# 1. start the gateway's HTTP transport
npm run dev:http
# 2. start the host (needs ANTHROPIC_API_KEY in .env)
npm run dev:host

# inspect the merged, runtime-discovered catalog:
curl -s http://localhost:3002/health

# ask the agent (it picks and calls MCP tools to answer):
curl -s -X POST http://localhost:3002/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"What stack does the multi-agent-debate app use, and what is 21 + 21?"}'
```

That single question exercises **both** servers: `gateway__lookup_portfolio_app`
and `everything__get-sum`.

## Run it

```bash
npm install
npm run dev:server   # stdio server (JSON-RPC on stdin/stdout)
npm run dev:http     # Streamable HTTP server on http://localhost:8006/mcp
npm test             # in-memory client <-> server smoke tests
```

Quick HTTP check once `dev:http` is running:

```bash
curl -s http://localhost:8006/health
```

> **stdio note:** the protocol owns `stdout`. This server logs diagnostics to
> `stderr` only — `console.log` would corrupt the JSON-RPC stream.

## Try it in Claude Desktop (the demo)

1. Open Claude Desktop → **Settings → Developer → Edit Config**.
2. Merge the contents of [`claude_desktop_config.json`](./claude_desktop_config.json)
   into that file (adjust the absolute path if your checkout differs).
3. Restart Claude Desktop. The **portfolio-gateway** server appears with a
   `lookup_portfolio_app` tool.
4. Ask: *"Use the portfolio gateway to look up multi-agent-debate."*

The same server the host agent will use is a config paste away from any MCP client —
that's the point.

## Roadmap

| Milestone | Adds |
| :---: | :--- |
| **1** ✅ | stdio server + one Zod tool + Claude Desktop config + tests |
| **2** ✅ | Streamable HTTP transport (**port 8006**) + resources (`portfolio://apps/{name}`) + prompts |
| **3** ✅ | Host agent (**port 3002**): runtime tool discovery + a second, third-party MCP server |
| 4 | Wire into `start_all_backends.ps1`, the root README registry, and the dashboard UI |
