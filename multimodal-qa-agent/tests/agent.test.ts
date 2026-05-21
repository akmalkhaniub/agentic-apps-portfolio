import { describe, it, expect, vi, beforeEach } from 'vitest';

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

describe('Multimodal QA Agent API Gateway', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  describe('GET /health', () => {
    it('should return 200 and ok status', async () => {
      const res = await app.request('/health');
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toEqual({ status: 'ok' });
    });
  });

  describe('POST /crawl', () => {
    it('should return 400 for invalid crawler parameters', async () => {
      const res = await app.request('/crawl', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: 'not-a-valid-url' }),
      });
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body).toHaveProperty('error');
    });

    it('should fetch and extract HTML details using Cheerio in-memory', async () => {
      // Mock global fetch
      const mockFetch = vi.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        text: async () => `
          <html>
            <head><title>Mock Domain</title></head>
            <body>
              <h1>Welcome to the Mock Site</h1>
              <p>This is a page about brand guidelines.</p>
              <img src="/assets/logo.png" />
              <a href="/about">About Us</a>
              <a href="https://google.com">Google</a>
            </body>
          </html>
        `,
      } as any);

      const res = await app.request('/crawl', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: 'https://mock-site.com' }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.url).toBe('https://mock-site.com');
      expect(body.title).toBe('Mock Domain');
      expect(body.text).toContain('Welcome to the Mock Site');
      expect(body.imageUrls).toContain('https://mock-site.com/assets/logo.png');
      expect(body.links).toContain('https://mock-site.com/about');

      mockFetch.mockRestore();
    });
  });

  describe('POST /audit', () => {
    it('should perform text and image compliance checks with mocked AI vision/text outputs', async () => {
      // Mock global fetch for auto-crawling if needed
      const mockFetch = vi.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        text: async () => `
          <html>
            <head><title>Audit Domain</title></head>
            <body>
              <p>Audit site text</p>
              <img src="https://mock-site.com/logo.png" />
            </body>
          </html>
        `,
      } as any);

      // Mock AI text auditor and image vision auditor responses
      vi.mocked(generateText)
        .mockResolvedValueOnce({
          text: '[CRITICAL] Brand logo colors are off\n[WARNING] Typography is non-standard',
          finishReason: 'stop',
          steps: [{}],
        } as any) // Text auditor generateText
        .mockResolvedValueOnce({
          text: '- Visual contrast issue\n* Element overflow',
          finishReason: 'stop',
          steps: [{}],
        } as any); // Vision auditor generateText

      const res = await app.request('/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: 'https://audit-site.com',
          guidelines: 'Logo must be blue.',
        }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.url).toBe('https://audit-site.com');
      expect(body.findings.length).toBe(4); // 2 text findings + 2 visual findings

      // Check text findings
      expect(body.findings[0]).toEqual({
        type: 'text',
        severity: 'critical',
        description: 'Brand logo colors are off',
        source: 'https://audit-site.com',
      });

      // Check visual findings
      expect(body.findings[2]).toEqual({
        type: 'visual',
        severity: 'warning',
        description: 'Visual contrast issue',
        source: 'https://mock-site.com/logo.png',
      });

      expect(generateText).toHaveBeenCalledTimes(2);
      mockFetch.mockRestore();
    });
  });

  describe('POST /qa', () => {
    it('should successfully answer user questions about crawled context', async () => {
      const mockFetch = vi.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        text: async () => `<html><body>Simple text</body></html>`,
      } as any);

      vi.mocked(generateText).mockResolvedValue({
        text: 'Yes, the page only contains simple text.',
        finishReason: 'stop',
        steps: [{}],
      } as any);

      const res = await app.request('/qa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: 'https://qa-site.com',
          question: 'Does the page contain simple text?',
        }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.answer).toBe('Yes, the page only contains simple text.');

      expect(generateText).toHaveBeenCalledTimes(1);
      mockFetch.mockRestore();
    });
  });
});
