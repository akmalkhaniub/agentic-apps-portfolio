import { useState } from 'react';
import { Users, Send, CheckCircle2, Activity, Play, RefreshCw, MessageSquare } from 'lucide-react';
import { API_ENDPOINTS } from '../config';
import { useInspector } from '../context/InspectorContext';

export default function MultiAgentDebateView() {
  const { setIsOpen, addTrace } = useInspector();
  const [topic, setTopic] = useState("Serverless computing is superior to Kubernetes for enterprise microservices");
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const handleRunDebate = async () => {
    setIsLoading(true);
    setResult(null);
    addTrace({ source: 'MultiAgentDebateView', type: 'log', content: 'Execution started. Forwarding topic to Moderator...' });

    try {
      const response = await fetch(`${API_ENDPOINTS.multiAgentDebate}/debate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic })
      });
      
      if (!response.ok) throw new Error("Backend offline");
      
      const data = await response.json();
      setResult(data);
      
      // Stream traces into the inspector
      data.traces.forEach((trace: any) => {
        addTrace(trace);
      });
      
      setIsLoading(false);
    } catch (err) {
      console.warn("Backend offline. Fallback to mock simulation.");
      
      const mockData = {
        status: "completed",
        summary: `**Debate Conclusion on: ${topic}**\n\n**Proponent (Alpha):** Argued for scalability and reduced overhead.\n**Opponent (Beta):** Rebutted with concerns over security risks and long-term vendor lock-in.\n**Synthesis:** Both agents raise valid points. A hybrid approach is recommended: leverage the scalability of serverless for stateless workloads, but maintain on-premise controls for secure, stateful data.`,
        traces: [
          { source: 'User', type: 'log', target: 'Moderator', content: `Proposed debate topic: '${topic}'` },
          { source: 'Moderator', type: 'log', target: 'AgentAlpha', content: "Initializing debate. Delegating to Proponent (Alpha)." },
          { source: 'Moderator', type: 'log', target: 'AgentBeta', content: "Delegating to Opponent (Beta)." },
          { source: 'AgentAlpha', type: 'argument', target: 'AgentBeta', content: `I strongly support the premise that ${topic}. The primary benefits include scalability, rapid iteration, and reduced overhead costs.` },
          { source: 'AgentBeta', type: 'critique', target: 'Moderator', content: `While Alpha highlights scalability, they ignore the glaring security risks and vendor lock-in associated with ${topic}.` },
          { source: 'Moderator', type: 'log', target: '', content: "Receiving arguments and critiques. Generating synthesis..." },
          { source: 'Moderator', type: 'synthesis', target: 'User', content: "Synthesis generated. Hybrid approach recommended." }
        ]
      };
      
      // Simulate real-time streaming
      for (let i = 0; i < mockData.traces.length; i++) {
        setTimeout(() => {
          addTrace(mockData.traces[i]);
        }, i * 1000);
      }
      
      setTimeout(() => {
        setResult(mockData);
        setIsLoading(false);
      }, mockData.traces.length * 1000);
    }
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
      <div className="dev-mode-banner">
        <span className="dev-mode-banner-badge">Pending</span>
        <span>Running in Local Development Mode — Listening on port 8005</span>
      </div>

      <div className="view-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 className="view-title">
            <Users size={32} color="var(--accent-tertiary)" />
            Multi-Agent Debate Environment
          </h1>
          <p className="view-subtitle">Evaluator-Optimizer pattern where adversarial agents critique proposals to reach robust conclusions</p>
          <div className="pattern-badges-container">
            <span className="pattern-badge">Adversarial Critique</span>
            <span className="pattern-badge">Evaluator-Optimizer</span>
          </div>
        </div>
        <button className="btn-ghost" onClick={() => setIsOpen(true)}>
          <Activity size={16} color="var(--accent-secondary)" />
          Inspect Agent Traces
        </button>
      </div>

      <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: 24 }}>
        <div className="glass content-block">
          <h3>
            <MessageSquare size={18} />
            Debate Topic
          </h3>
          <div className="input-group">
            <label htmlFor="topic">Provide a contentious topic for the agents to debate</label>
            <textarea
              id="topic"
              rows={4}
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g. Serverless computing is superior to Kubernetes..."
            />
          </div>

          <button className="btn" onClick={handleRunDebate} disabled={isLoading} style={{ width: '100%', marginTop: 12 }}>
            {isLoading ? <RefreshCw className="spin" size={16} /> : <Play size={16} />}
            {isLoading ? 'Agents Debating...' : 'Commence Debate'}
          </button>
        </div>

        <div className="glass content-block" style={{ display: 'flex', flexDirection: 'column' }}>
          <h3>Debate Conclusion</h3>
          {!result && !isLoading ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 250, color: 'var(--text-muted)' }}>
              <Users size={48} style={{ opacity: 0.2, marginBottom: 12 }} />
              <p>Launch the debate to see adversarial synthesis</p>
            </div>
          ) : isLoading && !result ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 250, color: 'var(--text-muted)' }}>
              <RefreshCw className="spin" size={32} style={{ marginBottom: 16, color: 'var(--accent-tertiary)' }} />
              <p style={{ fontWeight: 600 }}>Agents are formulating arguments...</p>
              <p style={{ fontSize: '0.85rem' }}>Open Agent Inspector to view real-time traces</p>
            </div>
          ) : (
            <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ padding: 16, borderRadius: 12, background: 'var(--bg-main)', border: '1px solid var(--border-subtle)' }}>
                <h4 style={{ margin: '0 0 12px 0', fontSize: '0.9rem', color: 'var(--text-main)' }}>Moderator Synthesis</h4>
                <div style={{ lineHeight: 1.6, fontSize: '0.95rem', whiteSpace: 'pre-wrap' }}>
                  {result?.summary}
                </div>
              </div>
              <div style={{ padding: 12, borderRadius: 12, background: 'var(--success-glow)', border: '1px solid rgba(16,185,129,0.3)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <CheckCircle2 size={16} color="var(--success)" />
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--success)' }}>
                  Debate concluded successfully
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
