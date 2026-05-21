import React, { useState } from 'react';
import { Send, Bot, Play, Layers, Code2, Server, Activity } from 'lucide-react';
import { API_ENDPOINTS } from '../config';
import { useInspector } from '../context/InspectorContext';

interface ResponseData {
  router_decision: {
    intent: string;
    complexity: string;
    selected_model: string;
    confidence: number;
    reasoning: string;
  };
  final_answer: string;
}

export default function ModelRouterView() {
  const { setIsOpen, addTrace } = useInspector();
  const [activeTab, setActiveTab] = useState<'demo' | 'architecture' | 'tech'>('demo');
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<ResponseData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    addTrace({ source: 'ModelRouterView', type: 'log', content: 'Execution started...' });

    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch(`${API_ENDPOINTS.modelRouter}/api/v1/route`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: input })
      });
      
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || 'Failed to route request');
      
      setResult(data);
    } catch (err: any) {
      console.error(err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
      <div className="view-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 className="view-title">Model Router Sentinel</h1>
          <p className="view-subtitle">Dynamic LLM Routing based on Intent & Complexity</p>
          <div className="pattern-badges-container">
            <span className="pattern-badge">Semantic Routing</span>
            <span className="pattern-badge">Fallback Chaining</span>
          </div>
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
          <Layers size={16} /> Routing Logic
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
                <label>Enter a query to see how the Sentinel routes it</label>
                <textarea
                  rows={4}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="e.g., 'What is 2+2?' vs 'Write a python script to train a neural network'"
                  disabled={isLoading}
                />
              </div>
              <button type="submit" className="btn" disabled={isLoading || !input.trim()} id="router-submit-btn">
                {isLoading ? 'Routing...' : <><Send size={18} /> Process Query</>}
              </button>
            </form>

            {error && (
              <div className="glass" style={{ padding: '16px', borderLeft: '4px solid var(--danger)', color: 'var(--danger)' }}>
                {error}
              </div>
            )}

            {result && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', animation: 'fadeIn 0.4s ease' }}>
                <div className="glass" style={{ padding: '24px', borderLeft: '4px solid var(--accent-primary)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                      <Server size={20} /> Router Decision
                    </h3>
                    <div className="badge primary" style={{ fontSize: '0.9rem', padding: '7px 14px' }}>
                      {result.router_decision.selected_model}
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '20px' }}>
                    <div style={{ background: 'var(--code-bg)', padding: '14px', borderRadius: '10px' }}>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 6, fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.5px' }}>Intent</div>
                      <div style={{ fontWeight: 600, fontSize: '1rem' }}>{result.router_decision.intent}</div>
                    </div>
                    <div style={{ background: 'var(--code-bg)', padding: '14px', borderRadius: '10px' }}>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 6, fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.5px' }}>Complexity</div>
                      <div style={{
                        fontWeight: 700,
                        fontSize: '1rem',
                        color: result.router_decision.complexity === 'High'
                          ? 'var(--danger)'
                          : result.router_decision.complexity === 'Medium'
                            ? 'var(--warning)'
                            : 'var(--success)'
                      }}>
                        {result.router_decision.complexity}
                      </div>
                    </div>
                    <div style={{ background: 'var(--code-bg)', padding: '14px', borderRadius: '10px' }}>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 6, fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.5px' }}>Confidence</div>
                      <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--success)' }}>
                        {(result.router_decision.confidence * 100).toFixed(1)}%
                      </div>
                    </div>
                  </div>

                  <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', fontStyle: 'italic', background: 'var(--code-bg)', padding: '14px 16px', borderRadius: '10px', lineHeight: 1.7 }}>
                    "{result.router_decision.reasoning}"
                  </div>
                </div>

                <div className="glass" style={{ padding: '24px' }}>
                  <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                    <Bot size={20} /> Final Answer
                  </h3>
                  <div style={{ lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>
                    {result.final_answer}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'architecture' && (
          <div className="content-block">
            <h3>Semantic Router Architecture</h3>
            <p>
              The Model Router acts as an intelligent API Gateway for LLMs. Instead of blindly sending every request to an expensive model like GPT-4 or Claude 3.5 Sonnet, it uses a highly optimized classifier to evaluate the complexity of the request.
            </p>
            <div style={{ margin: '32px 0', padding: '24px', background: 'var(--code-bg)', borderRadius: '12px', border: '1px solid var(--border-subtle)' }}>
              <pre style={{ background: 'transparent', border: 'none', color: 'var(--text-main)', fontSize: '0.9rem', lineHeight: '1.8' }}>
{`User Request
    ↓
[ FastAPI Gateway ]
    ↓
[ Classifier Model (gpt-4o-mini / gemini-1.5-flash) ]
    ├─ Extracts Intent (Code, Math, Chat, Data)
    ├─ Evaluates Complexity (Low, Medium, High)
    └─ Calculates Confidence Score
    ↓
[ Routing Logic ]
    ├─ If High Complexity / Code -> Route to Claude-3.5-Sonnet (Heavy Model)
    ├─ If Medium Complexity -> Route to Gemini-1.5-Pro
    └─ If Low Complexity (Chat) -> Route to Gemini-1.5-Flash (Fast/Cheap)
    ↓
[ Selected LLM Execution ]
    ↓
Final Answer + Routing Metadata`}
              </pre>
            </div>
            <p>
              This architecture dramatically reduces API costs (up to 80%) while maintaining high reasoning quality for tasks that actually require it.
            </p>
          </div>
        )}

        {activeTab === 'tech' && (
          <div className="content-block">
            <h3>Frameworks and Libraries</h3>
            <div style={{ margin: '24px 0', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              <span className="badge primary">FastAPI (Python)</span>
              <span className="badge secondary">Instructor (Structured Outputs)</span>
              <span className="badge success">Pydantic</span>
              <span className="badge warning">LiteLLM</span>
              <span className="badge tertiary">Terraform (IaC)</span>
            </div>
            
            <h4>Why Instructor + Pydantic?</h4>
            <p>
              Instructor allows us to enforce strict JSON schemas on the classifier LLM using Pydantic models. This guarantees that the routing node will always return a structured object containing `intent`, `complexity`, and `reasoning`, without the risk of parsing errors.
            </p>

            <h4>Why LiteLLM?</h4>
            <p>
              LiteLLM normalizes the API specifications across OpenAI, Anthropic, Google, and open-source models into a single format. This allows the Router Sentinel to seamlessly invoke `claude-3-5-sonnet`, `gemini-1.5-flash`, or `gpt-4o` using the exact same interface.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
