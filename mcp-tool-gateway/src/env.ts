import 'dotenv/config';

/** Central place for configurable ports/secrets. */
export const env = {
  /** Streamable HTTP server (the gateway itself). */
  httpPort: Number(process.env.MCP_HTTP_PORT ?? 8006),

  /** Host agent HTTP port. */
  hostPort: Number(process.env.MCP_HOST_PORT ?? 3002),

  /** Where the host reaches this gateway over Streamable HTTP. */
  gatewayUrl: process.env.GATEWAY_HTTP_URL ?? 'http://localhost:8006/mcp',

  /** Anthropic model + key for the host agent loop. */
  anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? '',
  model: process.env.HOST_MODEL ?? 'claude-opus-4-8',

  /**
   * Optional second, third-party MCP server the host also connects to — proof
   * that the host is protocol-native, not coupled to our gateway. Defaults to
   * the official reference "everything" server (spawned via npx). Set
   * ENABLE_THIRD_PARTY_MCP=false to skip it.
   */
  enableThirdParty: (process.env.ENABLE_THIRD_PARTY_MCP ?? 'true') !== 'false',
  thirdPartyCommand: process.env.THIRD_PARTY_MCP_COMMAND ?? 'npx',
  thirdPartyArgs: (process.env.THIRD_PARTY_MCP_ARGS ?? '-y,@modelcontextprotocol/server-everything').split(','),
};
