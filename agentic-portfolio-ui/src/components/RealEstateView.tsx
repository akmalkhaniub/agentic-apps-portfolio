import React, { useState } from 'react';
import { MapPin, Building, Search, Play, Layers, Code2, Home, Activity } from 'lucide-react';
import { API_ENDPOINTS } from '../config';
import { useInspector } from '../context/InspectorContext';

interface Listing {
  id: string;
  address: string;
  price: number;
  bedrooms: number;
  bathrooms: number;
  sqft: number;
  description: string;
  relevance_score?: number;
}

interface QueryResponse {
  answer: string;
  listings: Listing[];
}

export default function RealEstateView() {
  const { setIsOpen, addTrace } = useInspector();
  const [activeTab, setActiveTab] = useState<'demo' | 'architecture' | 'tech'>('demo');
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<QueryResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim() || isLoading) return;
    addTrace({ source: 'RealEstateView', type: 'log', content: 'Execution started...' });

    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch(`${API_ENDPOINTS.realEstate}/api/v1/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query })
      });
      
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || 'Failed to process query');
      
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
          <h1 className="view-title">Real Estate Agent</h1>
          <p className="view-subtitle">Semantic Search over Property Listings using Pinecone</p>
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
          <Layers size={16} /> Retrieval Pipeline
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
                <label>Semantic Property Search</label>
                <div style={{ display: 'flex', gap: '16px' }}>
                  <input 
                    type="text" 
                    style={{ flex: 1 }}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="e.g., 'Looking for a family home with a big backyard near a park under $800k'"
                    disabled={isLoading}
                  />
                  <button type="submit" className="btn" disabled={isLoading || !query.trim()} id="realestate-submit-btn">
                    {isLoading ? 'Searching...' : <><Search size={18} /> Find Matches</>}
                  </button>
                </div>
              </div>
            </form>

            {error && (
              <div className="glass" style={{ padding: '16px', borderLeft: '4px solid var(--danger)', color: 'var(--danger)' }}>
                {error}
              </div>
            )}

            {result && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
                <div className="glass" style={{ padding: '24px' }}>
                  <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', color: 'var(--accent-primary)' }}>
                    <Home size={20} /> AI Agent Summary
                  </h3>
                  <div style={{ lineHeight: '1.6', fontSize: '1.05rem', whiteSpace: 'pre-wrap' }}>
                    {result.answer}
                  </div>
                </div>

                <div>
                  <h3 style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Building size={20} /> Matching Properties
                  </h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
                    {result.listings.map((listing) => (
                      <div key={listing.id} className="glass" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <h4 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text-main)', display: 'flex', gap: '6px', alignItems: 'center' }}>
                            <MapPin size={16} color="var(--accent-tertiary)" /> {listing.address}
                          </h4>
                          {listing.relevance_score && (
                            <span className="badge success">
                              {(listing.relevance_score * 100).toFixed(0)}% Match
                            </span>
                          )}
                        </div>
                        
                        <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--success)' }}>
                          ${listing.price.toLocaleString()}
                        </div>
                        
                        <div style={{ display: 'flex', gap: '16px', color: 'var(--text-muted)', fontSize: '0.9rem', borderTop: '1px solid var(--border-subtle)', borderBottom: '1px solid var(--border-subtle)', padding: '12px 0' }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><strong>{listing.bedrooms}</strong> beds</span>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><strong>{listing.bathrooms}</strong> baths</span>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><strong>{listing.sqft.toLocaleString()}</strong> sqft</span>
                        </div>
                        
                        <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', lineHeight: '1.5', marginTop: '4px' }}>
                          {listing.description.length > 120 ? listing.description.substring(0, 120) + '...' : listing.description}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'architecture' && (
          <div className="content-block">
            <h3>RAG (Retrieval-Augmented Generation) Pipeline</h3>
            <p>
              Traditional database searches (SQL) struggle with vague queries like "a quiet place for a large family." This semantic search pipeline uses embeddings to find properties based on concept and meaning rather than keyword matching.
            </p>
            <div style={{ margin: '32px 0', padding: '24px', background: 'var(--code-bg)', borderRadius: '12px', border: '1px solid var(--border-subtle)' }}>
              <pre style={{ background: 'transparent', border: 'none', color: 'var(--text-main)', fontSize: '0.9rem', lineHeight: '1.8' }}>
{`User Natural Language Query
    ↓
[ Embedding Model: text-embedding-3-small ]
    ↓ (Converts text into a 1536-dimensional float array)
    ↓
[ Pinecone Vector Database ]
    ├─ Performs Cosine Similarity Search
    ├─ Finds Top-K matching property descriptions
    └─ Returns Metadata (Price, Beds, Baths, Address)
    ↓
[ LLM Context Assembly ]
    ├─ System Prompt + Query
    └─ Injected Property Metadata
    ↓
[ Claude 3.5 Sonnet / GPT-4o ]
    ↓ (Synthesizes the final conversational answer)
    ↓
Final Summary + Listing Results`}
              </pre>
            </div>
            <p>
              The agent provides a conversational wrapper around the raw vector search, acting as an AI real estate agent that can justify why it recommended specific properties based on the user's specific constraints.
            </p>
          </div>
        )}

        {activeTab === 'tech' && (
          <div className="content-block">
            <h3>Frameworks and Libraries</h3>
            <div style={{ margin: '24px 0', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              <span className="badge primary">FastAPI (Python)</span>
              <span className="badge secondary">Pinecone (Serverless)</span>
              <span className="badge success">OpenAI Embeddings</span>
              <span className="badge warning">Anthropic Claude</span>
              <span className="badge tertiary">LangChain Core</span>
            </div>
            
            <h4>Why Pinecone?</h4>
            <p>
              Pinecone provides a managed, serverless vector database capable of querying millions of dense vectors in under 50ms. By offloading the nearest-neighbor calculation to Pinecone, we eliminate the need to run expensive Postgres+pgvector instances for lightweight agentic apps.
            </p>

            <h4>Why text-embedding-3-small?</h4>
            <p>
              OpenAI's latest embedding models provide superior multilingual retrieval performance while significantly reducing cost per token compared to older Ada-002 models. They generate highly contextual 1536-dimensional embeddings perfect for real estate descriptions.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
