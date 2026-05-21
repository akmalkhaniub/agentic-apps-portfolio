import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { generateText, type CoreMessage } from 'ai';
import { google } from '@ai-sdk/google';
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { env } from './env.js';
import { createTools } from './tools.js';
import { conversations, tickets } from './db/schema.js';

const client = createClient({ url: env.DATABASE_URL });
const db = drizzle(client);
const tools = createTools(db);

const SYSTEM_PROMPT = `You are an agentic customer support specialist for an AI products company.

You RESOLVE problems, not just answer questions. Your workflow:
1. Understand the customer's issue
2. Search the knowledge base for relevant policies BEFORE answering policy questions
3. Look up order details when an order is referenced
4. Take action (refund, create ticket, escalate) when appropriate
5. Confirm resolution with the customer

Rules:
- Always verify order details before taking action
- Refunds over $500 require escalation — explain this to the customer
- If the customer asks for a human or expresses frustration twice, escalate immediately
- Create a ticket for any issue that requires follow-up
- Be concise, empathetic, and action-oriented
- Never make up order information — always use tools to look it up`;

const app = new Hono();
app.use('/*', cors());

app.onError((err, c) => {
  console.error('HONO ERROR:', err);
  return c.json({ error: err.message }, 500);
});

app.get('/', (c) => c.text('Agentic Customer Support API v2'));

app.get('/health', (c) => c.json({ status: 'ok', timestamp: new Date().toISOString() }));

const chatSchema = z.object({
  message: z.string().min(1),
  sessionId: z.string().optional(),
});

app.post('/chat', async (c) => {
  const body = await c.req.json();
  const parsed = chatSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  const { message, sessionId } = parsed.data;
  const sid = sessionId ?? 'ses_' + Math.random().toString(36).substring(2, 9);

  // Ensure target ticket exists to satisfy foreign key constraints
  const [existingTicket] = await db.select().from(tickets).where(eq(tickets.id, sid));
  if (!existingTicket) {
    await db.insert(tickets).values({
      id: sid,
      customerEmail: 'customer@example.com',
      subject: 'Chat Session: ' + sid,
      status: 'open',
      priority: 'medium',
      assignedTo: 'agent',
      createdAt: new Date(),
    });
  }

  const history = await db
    .select()
    .from(conversations)
    .where(eq(conversations.ticketId, sid))
    .orderBy(conversations.createdAt);

  const messages: CoreMessage[] = history.map((m) => ({
    role: m.role as 'user' | 'assistant',
    content: m.content,
  }));
  messages.push({ role: 'user', content: message });

  await db.insert(conversations).values({
    id: 'msg_' + Math.random().toString(36).substring(2, 9),
    ticketId: sid,
    role: 'user',
    content: message,
    createdAt: new Date(),
  });

  const result = await generateText({
    // @ts-expect-error - nested provider type definitions mismatch
    model: google('gemini-2.0-flash'),
    system: SYSTEM_PROMPT,
    messages,
    tools,
    maxSteps: 8,
  });

  await db.insert(conversations).values({
    id: 'msg_' + Math.random().toString(36).substring(2, 9),
    ticketId: sid,
    role: 'assistant',
    content: result.text,
    toolCalls: result.toolCalls.length > 0 ? JSON.stringify(result.toolCalls) : null,
    createdAt: new Date(),
  });

  return c.json({
    sessionId: sid,
    response: result.text,
    toolCalls: result.toolCalls,
    steps: result.steps.length,
  });
});

app.get('/sessions/:id', async (c) => {
  const sid = c.req.param('id');
  const history = await db
    .select()
    .from(conversations)
    .where(eq(conversations.ticketId, sid))
    .orderBy(conversations.createdAt);
  return c.json({ sessionId: sid, messages: history });
});

export default app;
