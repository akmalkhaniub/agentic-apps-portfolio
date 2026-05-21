import { tool } from 'ai';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import type { LibSQLDatabase } from 'drizzle-orm/libsql';
import { orders, tickets, knowledgeBase } from './db/schema';

export function createTools(db: LibSQLDatabase) {
  const get_order_status = tool({
    description:
      'Look up an order by ID or customer email. Returns order details including status, product, amount, and tracking info.',
    parameters: z.object({
      orderId: z.string().optional().describe('The order ID (e.g., ORD-1001)'),
      customerEmail: z.string().optional().describe('Customer email to look up all their orders'),
    }),
    execute: async ({ orderId, customerEmail }) => {
      if (orderId) {
        const [order] = await db.select().from(orders).where(eq(orders.id, orderId));
        if (!order) return { error: `Order ${orderId} not found` };
        return order;
      }
      if (customerEmail) {
        const results = await db
          .select()
          .from(orders)
          .where(eq(orders.customerEmail, customerEmail));
        if (results.length === 0) return { error: `No orders found for ${customerEmail}` };
        return results;
      }
      return { error: 'Provide either orderId or customerEmail' };
    },
  });

  const search_knowledge_base = tool({
    description:
      'Search the support knowledge base for policies, FAQs, and troubleshooting guides. Use this before answering policy questions.',
    parameters: z.object({
      query: z
        .string()
        .describe('Search query — e.g., "refund policy", "shipping times", "escalation"'),
    }),
    execute: async ({ query }) => {
      const all = await db.select().from(knowledgeBase);
      const q = query.toLowerCase();
      const matches = all.filter(
        (a) =>
          a.title.toLowerCase().includes(q) ||
          a.content.toLowerCase().includes(q) ||
          a.category.toLowerCase().includes(q)
      );
      if (matches.length === 0) {
        return {
          results: all.map((a) => ({ title: a.title, category: a.category, content: a.content })),
        };
      }
      return {
        results: matches.map((a) => ({ title: a.title, category: a.category, content: a.content })),
      };
    },
  });

  const trigger_refund = tool({
    description:
      'Initiate a refund for an order. Orders over $500 are auto-escalated to a human agent for approval.',
    parameters: z.object({
      orderId: z.string().describe('The order ID to refund'),
      reason: z.string().describe('Reason for the refund'),
    }),
    execute: async ({ orderId, reason }) => {
      console.log(`Refund requested for order ${orderId}. Reason: ${reason}`);
      const [order] = await db.select().from(orders).where(eq(orders.id, orderId));
      if (!order) return { error: `Order ${orderId} not found` };
      if (order.status === 'refunded') return { error: 'Order already refunded' };

      if (order.amount > 500) {
        await db.update(orders).set({ status: 'pending' }).where(eq(orders.id, orderId));
        return {
          escalated: true,
          message: `Refund of $${order.amount} requires manager approval. Ticket has been escalated.`,
          orderId,
          amount: order.amount,
        };
      }

      await db.update(orders).set({ status: 'refunded' }).where(eq(orders.id, orderId));
      return {
        success: true,
        refundId: 'ref_' + Math.random().toString(36).substring(2, 9),
        orderId,
        amount: order.amount,
        message: `Refund of $${order.amount} processed. Will appear in 5-7 business days.`,
      };
    },
  });

  const create_ticket = tool({
    description:
      'Create a support ticket to track the current issue. Use for non-trivial issues that need follow-up.',
    parameters: z.object({
      customerEmail: z.string(),
      subject: z.string(),
      priority: z.enum(['low', 'medium', 'high', 'urgent']),
      orderId: z.string().optional(),
    }),
    execute: async ({ customerEmail, subject, priority, orderId }) => {
      const ticketId = 'TKT-' + Math.random().toString(36).substring(2, 8).toUpperCase();
      await db.insert(tickets).values({
        id: ticketId,
        orderId: orderId ?? null,
        customerEmail,
        subject,
        status: 'open',
        priority,
        assignedTo: 'agent',
        createdAt: new Date(),
      });
      return { ticketId, status: 'open', assignedTo: 'agent' };
    },
  });

  const escalate_to_human = tool({
    description:
      'Escalate the current conversation to a human support agent. Use when: refund >$500, customer requests it, issue is unresolvable, or customer is frustrated.',
    parameters: z.object({
      ticketId: z.string().describe('The ticket ID to escalate'),
      reason: z.string().describe('Why this needs human attention'),
    }),
    execute: async ({ ticketId, reason }) => {
      await db
        .update(tickets)
        .set({
          status: 'escalated',
          assignedTo: 'human',
        })
        .where(eq(tickets.id, ticketId));
      return {
        escalated: true,
        ticketId,
        reason,
        eta: '15 minutes during business hours',
        message: 'A human agent will take over shortly. The customer will be notified.',
      };
    },
  });

  return {
    get_order_status,
    search_knowledge_base,
    trigger_refund,
    create_ticket,
    escalate_to_human,
  };
}
