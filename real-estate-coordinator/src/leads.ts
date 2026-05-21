import { z } from 'zod';

export const LeadStatus = z.enum(['new', 'contacted', 'qualified', 'unqualified', 'viewing_scheduled', 'converted']);

export const CreateLeadSchema = z.object({
  name: z.string().min(1),
  phone: z.string().min(1),
  email: z.string().email().optional(),
  source: z.enum(['inbound_call', 'web_form', 'referral']).default('web_form'),
  budget: z.number().optional(),
  preferredBeds: z.number().optional(),
  preferredCity: z.string().optional(),
  notes: z.string().optional(),
});

export type Lead = {
  id: string;
  name: string;
  phone: string;
  email?: string;
  source: string;
  status: z.infer<typeof LeadStatus>;
  budget?: number;
  preferredBeds?: number;
  preferredCity?: string;
  notes?: string;
  qualificationScore?: number;
  qualificationReason?: string;
  scheduledViewing?: {
    propertyId: string;
    dateTime: string;
  };
  createdAt: string;
  updatedAt: string;
};

let counter = 0;

export class LeadStore {
  private leads: Map<string, Lead> = new Map();

  create(data: z.infer<typeof CreateLeadSchema>): Lead {
    const id = `lead_${++counter}_${Date.now()}`;
    const now = new Date().toISOString();
    const lead: Lead = {
      id,
      ...data,
      status: 'new',
      createdAt: now,
      updatedAt: now,
    };
    this.leads.set(id, lead);
    return lead;
  }

  get(id: string): Lead | undefined {
    return this.leads.get(id);
  }

  list(statusFilter?: string): Lead[] {
    const all = [...this.leads.values()];
    if (!statusFilter) return all;
    return all.filter((l) => l.status === statusFilter);
  }

  update(id: string, patch: Partial<Lead>): Lead | undefined {
    const lead = this.leads.get(id);
    if (!lead) return undefined;
    Object.assign(lead, patch, { updatedAt: new Date().toISOString() });
    return lead;
  }
}
