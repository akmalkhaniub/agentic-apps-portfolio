import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { z } from 'zod';
import { generateText } from 'ai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { crawlPage, type CrawlResult } from './crawler.js';
import { auditPage } from './auditor.js';
import { env } from './env.js';

const app = new Hono();
app.use('/*', cors());

app.onError((err, c) => {
  console.error('HONO Multimodal QA Agent Error:', err);
  return c.json({ error: err.message }, 500);
});

const anthropic = createAnthropic({ apiKey: env.ANTHROPIC_API_KEY });

const crawlStore = new Map<string, CrawlResult>();

const CrawlRequest = z.object({ url: z.string().url() });

const AuditRequest = z.object({
  url: z.string().url(),
  guidelines: z.string().min(1),
});

const QARequest = z.object({
  url: z.string().url(),
  question: z.string().min(1),
});

app.get('/health', (c) => c.json({ status: 'ok' }));

app.post('/crawl', async (c) => {
  const body = await c.req.json();
  const parsed = CrawlRequest.safeParse(body);
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  try {
    const result = await crawlPage(parsed.data.url);
    crawlStore.set(parsed.data.url, result);
    return c.json(result);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Crawl failed';
    return c.json({ error: msg }, 502);
  }
});

app.post('/audit', async (c) => {
  const body = await c.req.json();
  const parsed = AuditRequest.safeParse(body);
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  let crawl = crawlStore.get(parsed.data.url);
  if (!crawl) {
    try {
      crawl = await crawlPage(parsed.data.url);
      crawlStore.set(parsed.data.url, crawl);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Crawl failed';
      return c.json({ error: msg }, 502);
    }
  }

  try {
    const result = await auditPage(crawl, parsed.data.guidelines);
    return c.json(result);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Audit failed';
    return c.json({ error: msg }, 502);
  }
});

app.post('/qa', async (c) => {
  const body = await c.req.json();
  const parsed = QARequest.safeParse(body);
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  let crawl = crawlStore.get(parsed.data.url);
  if (!crawl) {
    try {
      crawl = await crawlPage(parsed.data.url);
      crawlStore.set(parsed.data.url, crawl);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Crawl failed';
      return c.json({ error: msg }, 502);
    }
  }

  try {
    const result = await generateText({
      model: anthropic('claude-sonnet-4-20250514'),
      messages: [
        {
          role: 'user',
          content: `Based on this crawled page content, answer the question.

Page URL: ${crawl.url}
Page Title: ${crawl.title}
Page Content (first 8000 chars): ${crawl.text.slice(0, 8000)}
Images found: ${crawl.imageUrls.length}

Question: ${parsed.data.question}`,
        },
      ],
      maxTokens: 1024,
    });

    return c.json({ url: crawl.url, question: parsed.data.question, answer: result.text });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'QA failed';
    return c.json({ error: msg }, 502);
  }
});

export default app;
