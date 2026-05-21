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

describe('Real Estate Coordinator API Gateway', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /health', () => {
    it('should return 200 and ok status', async () => {
      const res = await app.request('/health');
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toEqual({ status: 'ok' });
    });
  });

  describe('GET /properties', () => {
    it('should return search listings', async () => {
      const res = await app.request('/properties?city=Austin&minPrice=400000&maxPrice=600000');
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.length).toBeGreaterThan(0);
      expect(body[0].city).toBe('Austin');
      expect(body[0].price).toBeGreaterThanOrEqual(400000);
      expect(body[0].price).toBeLessThanOrEqual(600000);
    });

    it('should retrieve a single listing by ID or return 404', async () => {
      const resOk = await app.request('/properties/prop_001');
      expect(resOk.status).toBe(200);
      const bodyOk = await resOk.json();
      expect(bodyOk.id).toBe('prop_001');

      const resFail = await app.request('/properties/nonexistent');
      expect(resFail.status).toBe(404);
    });
  });

  describe('Lead Management & Qualification Pipeline', () => {
    let leadId = '';

    it('should successfully register a new lead via POST /leads', async () => {
      const res = await app.request('/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Jane Doe',
          phone: '+15125550199',
          email: 'jane@example.com',
          budget: 500000,
          preferredBeds: 3,
          preferredCity: 'Austin',
          notes: 'Looking for a craftsman house.',
        }),
      });

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.name).toBe('Jane Doe');
      expect(body.status).toBe('new');
      expect(body.id).toBeDefined();
      leadId = body.id;
    });

    it('should successfully score and qualify a lead via mock AI responses', async () => {
      vi.mocked(generateText).mockResolvedValueOnce({
        text: JSON.stringify({
          score: 85,
          reason: 'Matches multiple listings with active status.',
          recommended_action: 'schedule_showing',
        }),
        finishReason: 'stop',
        steps: [{}],
      } as any);

      const res = await app.request(`/leads/${leadId}/qualify`, { method: 'POST' });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.lead.status).toBe('qualified');
      expect(body.lead.qualificationScore).toBe(85);
      expect(body.recommendedAction).toBe('schedule_showing');
    });

    it('should trigger outbound call dialing when scheduling viewing sessions', async () => {
      const res = await app.request(`/leads/${leadId}/schedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          propertyId: 'prop_001',
          dateTime: '2026-06-01T14:00:00Z',
        }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.lead.status).toBe('viewing_scheduled');
      expect(body.lead.scheduledViewing.propertyId).toBe('prop_001');
      expect(body.property.id).toBe('prop_001');
      expect(body.confirmation.status).toBeDefined();
      expect(body.confirmation.transcript).toBeDefined();
    });

    it('should fallback to heuristic checks when AI API errors out during qualification', async () => {
      // Create new lead first
      const leadRes = await app.request('/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Bob Smith',
          phone: '+15125550200',
          budget: 200000,
          preferredCity: 'Round Rock',
        }),
      });
      const newLead = await leadRes.json();

      vi.mocked(generateText).mockRejectedValueOnce(new Error('API Timeout'));

      const res = await app.request(`/leads/${newLead.id}/qualify`, { method: 'POST' });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.fallback).toBe(true);
      expect(body.lead.qualificationScore).toBeDefined();
      expect(body.lead.qualificationReason).toContain('Heuristic score');
    });
  });
});
