import { useState } from 'react';
import { Network, Database, RefreshCw, Send, CheckCircle2, Activity } from 'lucide-react';
import { API_ENDPOINTS } from '../config';
import { useInspector } from '../context/InspectorContext';

export default function EnterpriseSwarmView() {
  const { setIsOpen, addTrace } = useInspector();
  const [query, setQuery] = useState("Analyze Q3 market trends for AI hardware and compare against Q2 internal docs");
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const handleResearch = async () => {
    setIsLoading(true);
    setResult(null);
    addTrace({ source: 'EnterpriseSwarmView', type: 'log', content: 'Execution started. Forwarding to Manager Agent...' });

    try {
      const response = await fetch(`${API_ENDPOINTS.enterpriseSwarm}/research`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, deep_dive: true })
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
        summary: "Based on internal RAG docs (Q2 sales up 14%) and real-time subagent research (High volatility in supply chain), the Q3 market trend suggests strong growth with potential supply bottlenecks.",
        traces: [
          { source: 'ManagerAgent', type: 'log', content: `Received query: '${query}'. Synthesizing dynamic execution plan...` },
          { source: 'ManagerAgent', type: 'plan', content: [
            { step: 1, action: "Query internal knowledge base for past Q2/Q3 trends." },
            { step: 2, action: "Spawn web scraper subagent to gather real-time competitor data." },
            { step: 3, action: "Synthesize RAG context with web context." }
          ]},
          { source: 'RAG_Node', type: 'log', content: "Connecting to Pinecone Vector DB... Searching embeddings." },
          { source: 'RAG_Node', type: 'rag', content: [
            { doc_id: "Q2_Earnings_Report.pdf", score: 0.92, snippet: "Internal sales grew 14% in Q2 due to AI hardware demand." },
            { doc_id: "Market_Analysis_2026.docx", score: 0.88, snippet: "Competitor X is planning to release a new TPU cluster in late Q3." }
          ]},
          { source: 'ManagerAgent', type: 'log', content: "Delegating step 2 to Scraper Subagents..." },
          { source: 'ScraperSubagent_1', type: 'subagent', content: { target: "techcrunch.com", status: "Scraping headlines", findings: "Found 3 articles on AI hardware supply chain." } },
          { source: 'ScraperSubagent_2', type: 'subagent', content: { target: "bloomberg.com", status: "Extracting market data", findings: "Nvidia stock shows high volatility ahead of Q3 earnings." } },
          { source: 'ManagerAgent', type: 'log', content: "Subagents reported back. Aggregating data..." },
          { source: 'ManagerAgent', type: 'log', content: "Synthesis complete." }
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
        <span>Running in Local Development Mode — Listening on port 8004</span>
      </div>

      <div className="view-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 className="view-title">
            <Network size={32} color="var(--accent-primary)" />
            Enterprise Knowledge Swarm
          </h1>
          <p className="view-subtitle">Hierarchical multi-agent research swarm combining RAG Vector search with real-time web scrapers</p>
          <div className="pattern-badges-container">
            <span className="pattern-badge">Hierarchical Subagents</span>
            <span className="pattern-badge">Plan-and-Solve</span>
            <span className="pattern-badge">RAG</span>
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
            <Database size={18} />
            Research Query
          </h3>
          <div className="input-group">
            <label htmlFor="query">Manager Agent Directive</label>
            <textarea
              id="query"
              rows={4}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="e.g. Compare Q2 internal sales with Q3 market forecasts..."
            />
          </div>

          <button className="btn" onClick={handleResearch} disabled={isLoading} style={{ width: '100%', marginTop: 12 }}>
            {isLoading ? <RefreshCw className="spin" size={16} /> : <Send size={16} />}
            {isLoading ? 'Swarm in Progress...' : 'Launch Research Swarm'}
          </button>
        </div>

        <div className="glass content-block" style={{ display: 'flex', flexDirection: 'column' }}>
          <h3>Executive Synthesis</h3>
          {!result && !isLoading ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 250, color: 'var(--text-muted)' }}>
              <Network size={48} style={{ opacity: 0.2, marginBottom: 12 }} />
              <p>Launch the swarm to see dynamic planning and parallel research</p>
            </div>
          ) : isLoading && !result ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 250, color: 'var(--text-muted)' }}>
              <RefreshCw className="spin" size={32} style={{ marginBottom: 16, color: 'var(--accent-primary)' }} />
              <p style={{ fontWeight: 600 }}>Delegating tasks to subagents...</p>
              <p style={{ fontSize: '0.85rem' }}>Open Agent Inspector to view real-time traces</p>
            </div>
          ) : (
            <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ padding: 16, borderRadius: 12, background: 'var(--bg-main)', border: '1px solid var(--border-subtle)' }}>
                <h4 style={{ margin: '0 0 12px 0', fontSize: '0.9rem', color: 'var(--text-main)' }}>Final Report</h4>
                <p style={{ lineHeight: 1.6, fontSize: '0.95rem' }}>
                  {result?.summary}
                </p>
              </div>
              <div style={{ padding: 12, borderRadius: 12, background: 'var(--success-glow)', border: '1px solid rgba(16,185,129,0.3)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <CheckCircle2 size={16} color="var(--success)" />
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--success)' }}>
                  Research job completed successfully
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
