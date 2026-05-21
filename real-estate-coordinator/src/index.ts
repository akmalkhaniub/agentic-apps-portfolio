import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { z } from 'zod';
import { generateText } from 'ai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { PropertyStore } from './properties.js';
import { LeadStore, CreateLeadSchema } from './leads.js';
import { simulateOutboundCall } from './dialer.js';
import { env } from './env.js';

const app = new Hono();
app.use('/*', cors());

app.onError((err, c) => {
  console.error('HONO Real Estate Coordinator Error:', err);
  return c.json({ error: err.message }, 500);
});

const properties = new PropertyStore();
const leads = new LeadStore();
const anthropic = createAnthropic({ apiKey: env.ANTHROPIC_API_KEY });

app.get('/health', (c) => c.json({ status: 'ok' }));

app.get('/properties', (c) => {
  const q = c.req.query();
  const results = properties.search({
    minPrice: q.minPrice ? Number(q.minPrice) : undefined,
    maxPrice: q.maxPrice ? Number(q.maxPrice) : undefined,
    minBeds: q.minBeds ? Number(q.minBeds) : undefined,
    city: q.city || undefined,
    type: q.type || undefined,
  });
  return c.json(results);
});

app.get('/properties/:id', (c) => {
  const prop = properties.get(c.req.param('id'));
  if (!prop) return c.json({ error: 'Property not found' }, 404);
  return c.json(prop);
});

app.post('/leads', async (c) => {
  const body = await c.req.json();
  const parsed = CreateLeadSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);
  const lead = leads.create(parsed.data);
  return c.json(lead, 201);
});

app.get('/leads', (c) => {
  const status = c.req.query('status') || undefined;
  return c.json(leads.list(status));
});

app.post('/leads/:id/qualify', async (c) => {
  const lead = leads.get(c.req.param('id'));
  if (!lead) return c.json({ error: 'Lead not found' }, 404);

  const matchingProperties = properties.search({
    maxPrice: lead.budget,
    minBeds: lead.preferredBeds,
    city: lead.preferredCity,
  });

  try {
    const result = await generateText({
      model: anthropic('claude-sonnet-4-20250514'),
      messages: [
        {
          role: 'user',
          content: `You are a real estate lead qualification agent. Score this lead 1-100 and explain why.

Lead: ${lead.name}
Budget: ${lead.budget ? '$' + lead.budget.toLocaleString() : 'Not specified'}
Preferred beds: ${lead.preferredBeds ?? 'Not specified'}
Preferred city: ${lead.preferredCity ?? 'Not specified'}
Source: ${lead.source}
Notes: ${lead.notes ?? 'None'}
Matching properties available: ${matchingProperties.length}

Respond in JSON: {"score": <number>, "reason": "<explanation>", "recommended_action": "<next step>"}`,
        },
      ],
      maxTokens: 256,
    });

    let score = 50;
    let reason = result.text;
    let action = 'follow_up';

    try {
      const parsed = JSON.parse(result.text);
      score = parsed.score ?? score;
      reason = parsed.reason ?? reason;
      action = parsed.recommended_action ?? action;
    } catch {
      // ignore JSON parse fail
    }

    const status = score >= 60 ? 'qualified' : 'unqualified';
    const updated = leads.update(lead.id, {
      status,
      qualificationScore: score,
      qualificationReason: reason,
    });

    return c.json({ lead: updated, matchingProperties: matchingProperties.length, recommendedAction: action });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Qualification failed';

    const heuristicScore = matchingProperties.length > 0 && lead.budget ? 65 : 35;
    const updated = leads.update(lead.id, {
      status: heuristicScore >= 60 ? 'qualified' : 'unqualified',
      qualificationScore: heuristicScore,
      qualificationReason: `Heuristic score (LLM unavailable: ${msg})`,
    });
    return c.json({ lead: updated, matchingProperties: matchingProperties.length, fallback: true });
  }
});

const ScheduleSchema = z.object({
  propertyId: z.string(),
  dateTime: z.string(),
});

app.post('/leads/:id/schedule', async (c) => {
  const lead = leads.get(c.req.param('id'));
  if (!lead) return c.json({ error: 'Lead not found' }, 404);

  const body = await c.req.json();
  const parsed = ScheduleSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  const prop = properties.get(parsed.data.propertyId);
  if (!prop) return c.json({ error: 'Property not found' }, 404);

  const updated = leads.update(lead.id, {
    status: 'viewing_scheduled',
    scheduledViewing: {
      propertyId: parsed.data.propertyId,
      dateTime: parsed.data.dateTime,
    },
  });

  const callResult = await simulateOutboundCall(lead);

  return c.json({
    lead: updated,
    property: prop,
    confirmation: callResult,
  });
});

export default app;
