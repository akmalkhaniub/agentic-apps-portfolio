import 'dotenv/config';

/** Central place for configurable ports/secrets. Milestone 2 uses only the port. */
export const env = {
  httpPort: Number(process.env.MCP_HTTP_PORT ?? 8006),
};
