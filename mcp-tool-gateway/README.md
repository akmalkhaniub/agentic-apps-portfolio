# 🔌 MCP Tool Gateway

An **MCP (Model Context Protocol) server + host** demo for the Agentic Apps Portfolio.

Every other app in this portfolio *is* an agent. This one shows the **interop layer
underneath** agents: it exposes portfolio tools, resources, and prompts over the
standard protocol, so **any** MCP client — Claude Desktop, Cursor, or the portfolio's
own host agent — can discover and call them at runtime, with no hardcoding.

> **Status:** Milestone 1 — a working **stdio** MCP server exposing one Zod-typed tool.
> See the roadmap below for the HTTP transport, resources/prompts, and the host agent.

---

## What ships in Milestone 1

- **`McpServer`** over the **stdio** transport (what desktop MCP clients spawn and speak to).
- One fully-working tool, **`lookup_portfolio_app`**, with a Zod input schema the SDK
  advertises to clients during discovery and a structured content response.
- A copy-paste **Claude Desktop** config for the live "aha" demo.
- End-to-end **smoke tests** using the SDK's in-memory transport.

## Layout

```
mcp-tool-gateway/
├── src/server/
│   ├── index.ts   # McpServer + stdio transport bootstrap
│   └── tools.ts   # Zod-validated tool registry
├── tests/server.test.ts
├── claude_desktop_config.json
└── package.json
```

## Run it

```bash
npm install
npm run dev:server   # starts the stdio server (speaks JSON-RPC on stdin/stdout)
npm test             # in-memory client <-> server smoke tests
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
| 2 | Streamable HTTP transport (**port 8006**) + resources (`portfolio://apps/{name}`) + prompts |
| 3 | Host agent (**port 3002**): runtime tool discovery + a second, third-party MCP server |
| 4 | Wire into `start_all_backends.ps1`, the root README registry, and the dashboard UI |
