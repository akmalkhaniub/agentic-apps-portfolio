import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { orders, knowledgeBase } from './schema';

const client = createClient({ url: 'file:local.db' });
const db = drizzle(client);

const KB_ARTICLES = [
  {
    id: 'kb_1',
    category: 'policy',
    title: 'Refund Policy',
    content: `Refunds are available within 30 days of purchase. Orders over $500 require manager approval.
Refunds are processed back to the original payment method within 5-7 business days.
Digital products are non-refundable once the download link has been accessed.`,
  },
  {
    id: 'kb_2',
    category: 'policy',
    title: 'Shipping Policy',
    content: `Standard shipping takes 5-7 business days. Express shipping takes 2-3 business days.
Free shipping on orders over $50. International shipping available to 40+ countries.
Tracking numbers are emailed within 24 hours of shipment.`,
  },
  {
    id: 'kb_3',
    category: 'faq',
    title: 'How to track my order',
    content: `You can track your order using the tracking number sent to your email.
Visit our tracking page or use the carrier's website directly.
If no tracking number was received, check your spam folder or contact support.`,
  },
  {
    id: 'kb_4',
    category: 'troubleshooting',
    title: 'Order stuck in processing',
    content: `If your order has been in "processing" for more than 48 hours, it may indicate a payment verification issue.
Common causes: billing address mismatch, bank hold, or inventory delay.
The agent can check the exact status and escalate to fulfillment if needed.`,
  },
  {
    id: 'kb_5',
    category: 'policy',
    title: 'Escalation Policy',
    content: `Escalate to a human agent when: refund amount exceeds $500, customer requests human agent,
the issue cannot be resolved within 3 tool calls, or the customer expresses frustration more than twice.
Escalated tickets are picked up within 15 minutes during business hours.`,
  },
];

const SAMPLE_ORDERS = [
  {
    id: 'ORD-1001',
    customerEmail: 'alice@example.com',
    customerName: 'Alice Chen',
    product: 'Agentic AI Hoodie',
    amount: 59.99,
    status: 'shipped',
    trackingNumber: 'TRK-998877',
    createdAt: new Date('2026-05-01'),
  },
  {
    id: 'ORD-1002',
    customerEmail: 'bob@example.com',
    customerName: 'Bob Martinez',
    product: 'LLM Ops Course Bundle',
    amount: 299.0,
    status: 'delivered',
    trackingNumber: 'TRK-112233',
    createdAt: new Date('2026-04-20'),
  },
  {
    id: 'ORD-1003',
    customerEmail: 'carol@example.com',
    customerName: 'Carol Nguyen',
    product: 'GPU Cluster Access (Monthly)',
    amount: 849.0,
    status: 'pending',
    trackingNumber: null,
    createdAt: new Date('2026-05-10'),
  },
  {
    id: 'ORD-1004',
    customerEmail: 'dave@example.com',
    customerName: 'Dave Patel',
    product: 'Vector DB Sticker Pack',
    amount: 12.5,
    status: 'shipped',
    trackingNumber: 'TRK-445566',
    createdAt: new Date('2026-05-08'),
  },
  {
    id: 'ORD-1005',
    customerEmail: 'eve@example.com',
    customerName: 'Eve Washington',
    product: 'AI Conference Ticket 2026',
    amount: 1200.0,
    status: 'pending',
    trackingNumber: null,
    createdAt: new Date('2026-05-11'),
  },
];

async function seed() {
  console.log('Seeding database...');

  for (const order of SAMPLE_ORDERS) {
    await db.insert(orders).values(order).onConflictDoNothing();
  }
  console.log(`Seeded ${SAMPLE_ORDERS.length} orders`);

  for (const article of KB_ARTICLES) {
    await db
      .insert(knowledgeBase)
      .values({
        ...article,
        createdAt: new Date(),
      })
      .onConflictDoNothing();
  }
  console.log(`Seeded ${KB_ARTICLES.length} knowledge base articles`);

  console.log('Done.');
  process.exit(0);
}

seed().catch(console.error);
