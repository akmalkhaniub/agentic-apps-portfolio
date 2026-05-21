import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

export const orders = sqliteTable('orders', {
  id: text('id').primaryKey(),
  customerEmail: text('customer_email').notNull(),
  customerName: text('customer_name').notNull(),
  product: text('product').notNull(),
  amount: real('amount').notNull(),
  status: text('status').notNull(), // pending | shipped | delivered | refunded | cancelled
  trackingNumber: text('tracking_number'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

export const tickets = sqliteTable('tickets', {
  id: text('id').primaryKey(),
  orderId: text('order_id').references(() => orders.id),
  customerEmail: text('customer_email').notNull(),
  subject: text('subject').notNull(),
  status: text('status').notNull(), // open | escalated | resolved | closed
  priority: text('priority').notNull(), // low | medium | high | urgent
  resolution: text('resolution'),
  assignedTo: text('assigned_to'), // 'agent' | 'human'
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  resolvedAt: integer('resolved_at', { mode: 'timestamp' }),
});

export const conversations = sqliteTable('conversations', {
  id: text('id').primaryKey(),
  ticketId: text('ticket_id').references(() => tickets.id),
  role: text('role').notNull(), // user | assistant | system
  content: text('content').notNull(),
  toolCalls: text('tool_calls'), // JSON stringified
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

export const knowledgeBase = sqliteTable('knowledge_base', {
  id: text('id').primaryKey(),
  category: text('category').notNull(), // faq | policy | troubleshooting
  title: text('title').notNull(),
  content: text('content').notNull(),
  embedding: text('embedding'), // JSON stringified float array
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});
