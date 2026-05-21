import type { Lead } from './leads.js';

export interface CallResult {
  callId: string;
  leadId: string;
  status: 'completed' | 'no_answer' | 'voicemail' | 'busy';
  duration: number;
  transcript: string;
  sentiment: 'positive' | 'neutral' | 'negative';
}

export async function simulateOutboundCall(lead: Lead): Promise<CallResult> {
  await new Promise((r) => setTimeout(r, 500));

  const outcomes: CallResult['status'][] = ['completed', 'no_answer', 'voicemail', 'busy'];
  const status = outcomes[Math.floor(Math.random() * outcomes.length)]!;

  const transcripts: Record<string, string> = {
    completed: `Agent: Hi ${lead.name}, I'm calling about properties in ${lead.preferredCity ?? 'Austin'}. We have some great listings matching your criteria. Lead: Yes, I'm interested in seeing some homes. Agent: Wonderful, let me tell you about a few options.`,
    no_answer: 'No answer after 30 seconds. Left callback number.',
    voicemail: `Hi ${lead.name}, this is your real estate coordinator. We have exciting properties matching your search. Please call us back at your convenience.`,
    busy: 'Line busy. Will retry in 2 hours.',
  };

  return {
    callId: `call_${Date.now()}`,
    leadId: lead.id,
    status,
    duration: status === 'completed' ? 120 + Math.floor(Math.random() * 300) : 0,
    transcript: transcripts[status],
    sentiment: status === 'completed' ? 'positive' : 'neutral',
  };
}
