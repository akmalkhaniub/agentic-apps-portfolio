import { describe, it, expect, vi, beforeEach } from 'vitest';
import app from '../src/index';

// Mock the AI SDK's generateText function
vi.mock('ai', async (importOriginal) => {
  const actual = await importOriginal<typeof import('ai')>();
  return {
    ...actual,
    generateText: vi.fn(),
  };
});

import { generateText } from 'ai';

describe('Agentic Customer Support API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /health', () => {
    it('should return 200 and status ok', async () => {
      const res = await app.request('/health');
      expect(res.status).toBe(200);
      
      const body = await res.json();
      expect(body).toHaveProperty('status', 'ok');
      expect(body).toHaveProperty('timestamp');
    });
  });

  describe('POST /chat', () => {
    it('should return 400 when message is missing', async () => {
      const res = await app.request('/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      expect(res.status).toBe(400);
      
      const body = await res.json();
      expect(body).toHaveProperty('error');
    });

    it('should return 400 when message is empty', async () => {
      const res = await app.request('/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: '' }),
      });
      expect(res.status).toBe(400);
      
      const body = await res.json();
      expect(body).toHaveProperty('error');
    });

    it('should run chat query successfully with mocked LLM response', async () => {
      const mockSessionId = 'ses_test123';
      const mockText = 'Hello! I am checking your order status right now.';
      
      // Mock generateText return value
      vi.mocked(generateText).mockResolvedValue({
        text: mockText,
        toolCalls: [],
        steps: [{}],
        finishReason: 'stop',
        usage: { promptTokens: 20, completionTokens: 10, totalTokens: 30 },
      } as any);

      const res = await app.request('/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: 'Hello, what is the status of my order?',
          sessionId: mockSessionId,
        }),
      });

      const body = await res.json();
      if (res.status !== 200) {
        console.error('ERROR RESPONSE FROM CHAT:', body);
      }
      expect(res.status).toBe(200);
      expect(body).toEqual({
        sessionId: mockSessionId,
        response: mockText,
        toolCalls: [],
        steps: 1,
      });

      // Verify generateText was called with expected arguments
      expect(generateText).toHaveBeenCalledTimes(1);
    });
  });

  describe('GET /sessions/:id', () => {
    it('should return session history', async () => {
      const mockSessionId = 'ses_test123';
      const res = await app.request(`/sessions/${mockSessionId}`);
      const body = await res.json();
      if (res.status !== 200) {
        console.error('ERROR RESPONSE FROM SESSIONS:', body);
      }
      expect(res.status).toBe(200);
      expect(body).toHaveProperty('sessionId', mockSessionId);
      expect(body).toHaveProperty('messages');
      expect(Array.isArray(body.messages)).toBe(true);
    });
  });
});
