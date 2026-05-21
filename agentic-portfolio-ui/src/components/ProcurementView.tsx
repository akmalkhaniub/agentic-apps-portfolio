import React, { useState, useEffect } from 'react';
import { Send, FileText, Database, ShieldAlert, Award, Play, Layers, Code2, Activity } from 'lucide-react';
import { API_ENDPOINTS } from '../config';
import { useInspector } from '../context/InspectorContext';

interface Citation {
  source: string;
  excerpt: string;
  relevance_score?: number;
}

interface QueryResponse {
  answer: string;
  citations: Citation[];
  confidence_score: number;
  sql_query?: string | null;
  processing_time_ms: number;
}

export default function ProcurementView() {
  const { setIsOpen, addTrace } = useInspector();
  const [activeTab, setActiveTab] = useState<'demo' | 'architecture' | 'tech'>('demo');
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [result, setResult] = useState<QueryResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Auto-login as internal analyst to see SQL queries and full docs
  useEffect(() => {
    const authenticate = async () => {
      try {
        const formData = new URLSearchParams();
        formData.append('username', 'analyst');
        formData.append('password', 'analyst123');

        const response = await fetch(`${API_ENDPOINTS.procurement}/auth/token`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: formData.toString()
        });

        const data = await response.json();
        if (data.access_token) {
          setToken(data.access_token);
        }
      } catch (err) {
        console.error('Procurement auth error:', err);
      }
    };
    authenticate();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim() || isLoading) return;

    setIsLoading(true);
    setError(null);
    setResult(null);
    
    addTrace({ source: 'ProcurementAgent', type: 'log', content: 'Execution started...' });

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };

      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(`${API_ENDPOINTS.procurement}/api/v1/query`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          query: query,
          stream: false
        })
      });

      if (!response.ok) {
        throw new Error(`Server returned status ${response.status}`);
      }

      const data = await response.json();
      setResult(data);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to communicate with Procurement Agent.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
      <div className="view-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 className="view-title">Procurement Intelligence</h1>
          <p className="view-subtitle">Multi-Agent Supply Chain Analysis</p>
        </div>
        <button className="btn-ghost" onClick={() => setIsOpen(true)}>
          <Activity size={16} color="var(--accent-secondary)" />
          Inspect Agent Traces
        </button>
      </div>

      <div className="tabs-container">
        <button 
          className={`tab-btn ${activeTab === 'demo' ? 'active' : ''}`}
          onClick={() => setActiveTab('demo')}
        >
          <Play size={16} /> Interactive Demo
        </button>
        <button 
          className={`tab-btn ${activeTab === 'architecture' ? 'active' : ''}`}
          onClick={() => setActiveTab('architecture')}
        >
          <Layers size={16} /> Multi-Agent Graph
        </button>
        <button 
          className={`tab-btn ${activeTab === 'tech' ? 'active' : ''}`}
          onClick={() => setActiveTab('tech')}
        >
          <Code2 size={16} /> Tech Stack Specs
        </button>
      </div>

      <div className="glass-panel" style={{ minHeight: '600px' }}>
        {activeTab === 'demo' && (
          <div>
            <form onSubmit={handleSubmit} style={{ marginBottom: '32px' }}>
              <div className="input-group">
                <label>Supply Chain or Vendor Intelligence Query</label>
                <textarea
                  rows={4}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Ask about vendors, purchase orders, contracts, or potential risks... (e.g. 'Show total amount of unpaid invoices by vendor name')"
                  disabled={isLoading}
                />
              </div>
              <button type="submit" className="btn" disabled={isLoading || !query.trim()} id="procurement-submit-btn">
                {isLoading ? 'Analyzing...' : <><Send size={18} /> Run Multi-Agent Analysis</>}
              </button>
            </form>

            {error && (
              <div className="glass" style={{ padding: '16px', borderLeft: '4px solid var(--danger)', color: 'var(--danger)' }}>
                {error}
              </div>
            )}

            {result && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                <div style={{ display: 'flex', gap: '16px' }}>
                  <div className="glass" style={{ padding: '16px', flex: 1, textAlign: 'center' }}>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Confidence Score</div>
                    <div style={{ fontWeight: 700, fontSize: '1.5rem', color: 'var(--accent-primary)', marginTop: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                      <Award size={20} /> {(result.confidence_score * 100).toFixed(0)}%
                    </div>
                  </div>
                  <div className="glass" style={{ padding: '16px', flex: 1, textAlign: 'center' }}>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Execution Time</div>
                    <div style={{ fontWeight: 700, fontSize: '1.5rem', color: 'var(--success)', marginTop: '8px' }}>
                      {result.processing_time_ms} ms
                    </div>
                  </div>
                </div>

                <div className="glass" style={{ padding: '24px' }}>
                  <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', color: 'var(--text-main)' }}>
                    <FileText size={20} color="var(--accent-primary)" /> Supervisor Final Synthesis
                  </h3>
                  <div style={{ lineHeight: 1.6, whiteSpace: 'pre-wrap', fontSize: '1.05rem' }}>
                    {result.answer}
                  </div>
                </div>

                {result.sql_query && (
                  <div className="glass" style={{ padding: '24px' }}>
                    <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', color: 'var(--text-main)' }}>
                      <Database size={20} color="var(--accent-secondary)" /> Structured Database Query (SQL Analyst Node)
                    </h3>
                    <pre style={{ margin: 0 }}>
                      <code>{result.sql_query}</code>
                    </pre>
                  </div>
                )}

                {result.citations && result.citations.length > 0 && (
                  <div className="glass" style={{ padding: '24px' }}>
                    <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', color: 'var(--text-main)' }}>
                      <ShieldAlert size={20} color="var(--accent-tertiary)" /> Unstructured Citations & Context Sources
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      {result.citations.map((citation, idx) => (
                        <div key={idx} style={{ padding: '16px', borderLeft: '3px solid var(--accent-tertiary)', background: 'var(--bg-card-hover)', borderRadius: '0 12px 12px 0' }}>
                          <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--accent-tertiary)', marginBottom: '8px' }}>
                            Source: {citation.source} {citation.relevance_score ? `(Relevance: ${(citation.relevance_score * 100).toFixed(0)}%)` : ''}
                          </div>
                          <div style={{ fontSize: '0.95rem', color: 'var(--text-muted)', fontStyle: 'italic', lineHeight: 1.5 }}>
                            "{citation.excerpt}"
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'architecture' && (
          <div className="content-block">
            <h3>LangGraph Multi-Agent Architecture</h3>
            <p>
              This application uses <strong>LangGraph</strong> to define a stateful, cyclical graph of AI specialists. Unlike standard linear chains or simple ReAct loops, LangGraph allows distinct agents (nodes) to collaborate, verify each other's work, and loop back if errors occur.
            </p>
            <div style={{ margin: '32px 0', padding: '24px', background: 'var(--code-bg)', borderRadius: '12px', border: '1px solid var(--border-subtle)' }}>
              <pre style={{ background: 'transparent', border: 'none', color: 'var(--text-main)', fontSize: '0.9rem', lineHeight: '1.8' }}>
{`                           [ Human User ]
                                 ↓
[ Security/Auth Middleware ] -> [ Graph Entry Point ]
                                 ↓
                     +-----------------------+
                     |  Supervisor Agent     |
                     |  (Intent & Routing)   |
                     +-----------------------+
                           /           \\
             (Needs Structured Data)   (Needs Unstructured Data)
                        /                 \\
       +--------------------+       +--------------------+
       | SQL Analyst Node   |       | Researcher Node    |
       | (Generates queries)|       | (Vector Search)    |
       +--------------------+       +--------------------+
             |            \\           /            |
             |             \\         /             |
       (Validates Query)    +-------+     (Ranks Documents)
             ↓                  ↓                  ↓
       [ DB Execution ]    [ Writer Agent Node ] <---+
                                ↓
                        [ Final Output Node ] -> Return JSON`}
              </pre>
            </div>
            <p>
              <strong>State Management:</strong> The graph passes a central "State" dictionary between nodes. The state tracks the original query, intermediate SQL queries, retrieved document chunks, and the final synthesized answer.
            </p>
          </div>
        )}

        {activeTab === 'tech' && (
          <div className="content-block">
            <h3>Frameworks and Libraries</h3>
            <div style={{ margin: '24px 0', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              <span className="badge primary">LangGraph</span>
              <span className="badge secondary">AWS Bedrock (Claude 3.5)</span>
              <span className="badge success">Pinecone (Vector DB)</span>
              <span className="badge warning">Vanna AI (Text-to-SQL)</span>
              <span className="badge tertiary">FastAPI</span>
            </div>
            
            <h4>LangGraph vs LangChain</h4>
            <p>
              While LangChain is great for chains, <strong>LangGraph</strong> excels at creating loops and multi-agent topologies. It is heavily inspired by Pregel and NetworkX, treating LLM orchestration as a compiled graph execution.
            </p>

            <h4>Structured + Unstructured RAG</h4>
            <p>
              This app fuses two distinct forms of Retrieval Augmented Generation:
              <br/><br/>
              1. <strong>Structured RAG (Vanna AI):</strong> Fine-tuned model to translate natural language into accurate SQL queries against relational databases (Vendors, POs).<br/>
              2. <strong>Unstructured RAG (Pinecone):</strong> Vector similarity search to retrieve paragraphs from PDF contracts, compliance laws, and email trails.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
