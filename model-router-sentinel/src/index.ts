import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { z } from 'zod';
import { generateText } from 'ai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { SemanticCache } from './cache.js';
import { BudgetTracker } from './budget.js';
import { classifyComplexity, getModel, estimateCost } from './router.js';
import { env } from './env.js';

const app = new Hono();
app.use('/*', cors());

app.onError((err, c) => {
  console.error('HONO Sentinel Error:', err);
  return c.json({ error: err.message }, 500);
});

const cache = new SemanticCache();
const budget = new BudgetTracker(env.DEFAULT_BUDGET_USD);

const anthropic = createAnthropic({ apiKey: env.ANTHROPIC_API_KEY });

const routingStats: Record<string, number> = { simple: 0, moderate: 0, complex: 0 };

const MessageSchema = z.object({
  role: z.enum(['system', 'user', 'assistant']),
  content: z.string(),
});

const CompletionRequest = z.object({
  messages: z.array(MessageSchema).min(1),
  temperature: z.number().optional(),
  max_tokens: z.number().optional(),
});

function extractApiKey(header: string | undefined): string {
  if (!header) return 'anonymous';
  return header.replace('Bearer ', '').trim() || 'anonymous';
}

app.get('/health', (c) => c.json({ status: 'ok' }));

app.get('/stats', async (c) => {
  const cacheStats = await cache.stats();
  const spendStats = await budget.spendByKey();
  return c.json({
    cache: cacheStats,
    routing: routingStats,
    spend: spendStats,
  });
});

app.post('/v1/chat/completions', async (c) => {
  const body = await c.req.json();
  const parsed = CompletionRequest.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  const { messages, temperature, max_tokens } = parsed.data;
  const apiKey = extractApiKey(c.req.header('Authorization'));

  const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user')?.content ?? '';
  const cached = await cache.get(lastUserMsg);
  if (cached) {
    return c.json({ ...(cached as object), _cached: true });
  }

  const isOver = await budget.isOverBudget(apiKey);
  if (isOver) {
    return c.json({ error: 'Budget exceeded for this API key' }, 429);
  }

  const complexity = classifyComplexity(messages);
  const modelId = getModel(complexity);
  routingStats[complexity]++;

  try {
    const result = await generateText({
      model: anthropic(modelId),
      messages: messages.map((m) => ({ role: m.role as 'user' | 'assistant' | 'system', content: m.content })),
      temperature: temperature ?? 0.7,
      maxTokens: max_tokens ?? 1024,
    });

    const inputTokens = result.usage?.promptTokens ?? 0;
    const outputTokens = result.usage?.completionTokens ?? 0;
    const cost = estimateCost(modelId, inputTokens, outputTokens);
    await budget.record(apiKey, cost, modelId);

    const response = {
      id: `chatcmpl-${Date.now()}`,
      object: 'chat.completion',
      model: modelId,
      complexity,
      choices: [
        {
          index: 0,
          message: { role: 'assistant', content: result.text },
          finish_reason: 'stop',
        },
      ],
      usage: { prompt_tokens: inputTokens, completion_tokens: outputTokens, total_tokens: inputTokens + outputTokens },
      cost_usd: cost,
    };

    await cache.set(lastUserMsg, response);
    return c.json(response);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return c.json({ error: message, model: modelId, complexity }, 502);
  }
});

export default app;
