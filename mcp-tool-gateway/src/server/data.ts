/**
 * A lightweight, dependency-free registry of the apps in this portfolio.
 * Shared by tools (lookup_portfolio_app) and resources (portfolio://apps/{name}).
 *
 * A later milestone swaps this for the real libsql/Drizzle-backed data source.
 */
export interface PortfolioApp {
  port: number | null;
  stack: string;
  focus: string;
}

export const PORTFOLIO: Record<string, PortfolioApp> = {
  'agentic-customer-support': {
    port: null,
    stack: 'Vercel AI SDK, Hono, Zod',
    focus: 'High-reliability tool-use for order verification, shipment status, and refunds.',
  },
  'compliance-pii-sanitizer': {
    port: 8001,
    stack: 'Microsoft Presidio, Ollama, Phi-3',
    focus: 'Masks or swaps PII on outgoing LLM calls and validates safety scores locally.',
  },
  'multi-agent-debate': {
    port: 8005,
    stack: 'FastAPI, LLM-Debate',
    focus: 'Structured proponent/opponent debate moderated by a third agent.',
  },
  'enterprise-knowledge-swarm': {
    port: 8004,
    stack: 'FastAPI, Asyncio, RAG',
    focus: 'Manager agent splits queries across parallel subagents to synthesize RAG reports.',
  },
};

export const APP_NAMES = Object.keys(PORTFOLIO);
