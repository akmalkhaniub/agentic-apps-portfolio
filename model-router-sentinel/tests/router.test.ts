import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the Redis client
vi.mock('ioredis', () => {
  return {
    default: vi.fn().mockImplementation(() => {
      const store = new Map<string, string>();
      return {
        get: vi.fn(async (key) => store.get(key) || null),
        set: vi.fn(async (key, val) => {
          store.set(key, val);
          return 'OK';
        }),
        hget: vi.fn(async (key, field) => {
          const raw = store.get(`${key}:${field}`);
          return raw || null;
        }),
        hset: vi.fn(async (key, field, val) => {
          store.set(`${key}:${field}`, val);
          return 1;
        }),
        hincrbyfloat: vi.fn(async (key, field, amount) => {
          const current = Number(store.get(`${key}:${field}`) || 0);
          const next = current + amount;
          store.set(`${key}:${field}`, next.toString());
          return next;
        }),
        hgetall: vi.fn(async (key) => {
          const result: Record<string, string> = {};
          for (const [k, v] of store.entries()) {
            if (k.startsWith(`${key}:`)) {
              const field = k.replace(`${key}:`, '');
              result[field] = v;
            }
          }
          return result;
        }),
        incr: vi.fn(async (key) => {
          const val = Number(store.get(key) || 0) + 1;
          store.set(key, val.toString());
          return val;
        }),
        lpush: vi.fn(async (key, val) => {
          const list = JSON.parse(store.get(key) || '[]');
          list.unshift(val);
          store.set(key, JSON.stringify(list));
          return list.length;
        }),
        ltrim: vi.fn(async () => 'OK'),
      };
    }),
  };
});

// Mock the AI SDK's generateText
vi.mock('ai', async (importOriginal) => {
  const actual = await importOriginal<typeof import('ai')>();
  return {
    ...actual,
    generateText: vi.fn(),
  };
});

import { generateText } from 'ai';
import app from '../src/index.js';

describe('Model Router Sentinel Gateway', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /health', () => {
    it('should return 200 and ok', async () => {
      const res = await app.request('/health');
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toEqual({ status: 'ok' });
    });
  });

  describe('GET /stats', () => {
    it('should return 200 and base statistics', async () => {
      const res = await app.request('/stats');
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toHaveProperty('cache');
      expect(body).toHaveProperty('routing');
      expect(body).toHaveProperty('spend');
    });
  });

  describe('POST /v1/chat/completions', () => {
    it('should return 400 for empty or invalid messages', async () => {
      const res = await app.request('/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [] }),
      });
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body).toHaveProperty('error');
    });

    it('should route user queries based on complexity and cost estimation', async () => {
      // Mock generateText return
      vi.mocked(generateText).mockResolvedValue({
        text: 'This is a simple matched answer',
        usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
        finishReason: 'stop',
        steps: [{}],
      } as any);

      // 1. Simple complexity route: "hello" should map to simple model claude-3-5-haiku-latest
      const res = await app.request('/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-user-api-key',
        },
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'hello' }],
        }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.model).toBe('claude-3-5-haiku-latest');
      expect(body.complexity).toBe('simple');
      expect(body.choices[0].message.content).toBe('This is a simple matched answer');
      expect(body).toHaveProperty('cost_usd');

      // Verify generateText was called
      expect(generateText).toHaveBeenCalledTimes(1);
    });

    it('should return cached response on subsequent identical calls', async () => {
      vi.mocked(generateText).mockResolvedValue({
        text: 'Cached test text',
        usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
        finishReason: 'stop',
        steps: [{}],
      } as any);

      const requestBody = {
        messages: [{ role: 'user', content: 'unique-prompt-for-caching' }],
      };

      // First call (cache miss)
      const res1 = await app.request('/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });
      expect(res1.status).toBe(200);
      const body1 = await res1.json();
      expect(body1).not.toHaveProperty('_cached');

      // Second call (cache hit)
      const res2 = await app.request('/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });
      expect(res2.status).toBe(200);
      const body2 = await res2.json();
      expect(body2._cached).toBe(true);
      expect(body2.choices[0].message.content).toBe('Cached test text');
    });
  });
});
