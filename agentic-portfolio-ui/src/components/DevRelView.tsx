import React, { useState } from 'react';
import { FileText, Send, Database, Terminal, CheckCircle, Play, Layers, Code2, Activity } from 'lucide-react';
import { API_ENDPOINTS } from '../config';
import { useInspector } from '../context/InspectorContext';

interface Source {
  title: string;
  url: string;
}

interface QueryResponse {
  answer: string;
  sources: Source[];
  draft_ticket?: string | null;
}

export default function DevRelView() {
  const { setIsOpen, addTrace } = useInspector();
  const [activeTab, setActiveTab] = useState<'demo' | 'architecture' | 'tech'>('demo');
  const [activeSubTab, setActiveSubTab] = useState<'qa' | 'ingest'>('qa');
  
  // QA States
  const [query, setQuery] = useState('');
  const [generateDraft, setGenerateDraft] = useState(false);
  const [isLoadingQA, setIsLoadingQA] = useState(false);
  const [result, setResult] = useState<QueryResponse | null>(null);
  
  // Ingest States
  const [ingestText, setIngestText] = useState('');
  const [ingestUrl, setIngestUrl] = useState('');
  const [ingestTitle, setIngestTitle] = useState('');
  const [isLoadingIngest, setIsLoadingIngest] = useState(false);
  const [ingestSuccess, setIngestSuccess] = useState(false);

  const handleRunQA = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim() || isLoadingQA) return;

    setIsLoadingQA(true);
    setResult(null);
    addTrace({ source: 'DevRelView', type: 'log', content: 'Execution started for DevRel QA query...' });

    try {
      const response = await fetch(`${API_ENDPOINTS.devrel}/api/v1/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: query,
          generate_draft_ticket: generateDraft
        })
      });

      const data = await response.json();
      setResult(data);
    } catch (err) {
      console.error(err);
      alert('Failed to execute DevRel query.');
    } finally {
      setIsLoadingQA(false);
    }
  };

  const handleIngest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ingestText.trim() || isLoadingIngest) return;

    setIsLoadingIngest(true);
    setIngestSuccess(false);
    addTrace({ source: 'DevRelView', type: 'log', content: 'Execution started for DevRel document ingest...' });

    try {
      await fetch(`${API_ENDPOINTS.devrel}/api/v1/ingest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: ingestText,
          metadata: {
            title: ingestTitle || 'Untitled Documentation',
            url: ingestUrl || 'https://docs.local'
          }
        })
      });

      setIngestSuccess(true);
      setIngestText('');
      setIngestTitle('');
      setIngestUrl('');
    } catch (err) {
      console.error(err);
      alert('Failed to ingest documentation.');
    } finally {
      setIsLoadingIngest(false);
    }
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
      <div className="view-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 className="view-title">Autonomous DevRel Agent</h1>
          <p className="view-subtitle">Developer documentation Q&A & Support Ticket automation</p>
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
          <Layers size={16} /> Haystack Pipeline
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
            <div style={{ display: 'flex', gap: '16px', marginBottom: '32px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '8px' }}>
              <button 
                type="button" 
                onClick={() => setActiveSubTab('qa')}
                className="nav-link"
                style={{ 
                  background: 'none', 
                  border: 'none', 
                  color: activeSubTab === 'qa' ? 'var(--accent-primary)' : 'var(--text-muted)',
                  borderBottom: activeSubTab === 'qa' ? '2px solid var(--accent-primary)' : 'none',
                  padding: '8px 16px',
                  cursor: 'pointer',
                  fontWeight: activeSubTab === 'qa' ? 600 : 400,
                  borderRadius: 0,
                  margin: 0
                }}
              >
                Developer Q&A
              </button>
              <button 
                type="button" 
                onClick={() => setActiveSubTab('ingest')}
                className="nav-link"
                style={{ 
                  background: 'none', 
                  border: 'none', 
                  color: activeSubTab === 'ingest' ? 'var(--accent-primary)' : 'var(--text-muted)',
                  borderBottom: activeSubTab === 'ingest' ? '2px solid var(--accent-primary)' : 'none',
                  padding: '8px 16px',
                  cursor: 'pointer',
                  fontWeight: activeSubTab === 'ingest' ? 600 : 400,
                  borderRadius: 0,
                  margin: 0
                }}
              >
                Ingest Docs
              </button>
            </div>

            {activeSubTab === 'qa' && (
              <div>
                <form onSubmit={handleRunQA} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  <div className="input-group">
                    <label>Ask a technical question about the documentation</label>
                    <textarea 
                      rows={3}
                      value={query} 
                      onChange={(e) => setQuery(e.target.value)} 
                      placeholder="e.g. How do I configure the authentication middleware?" 
                    />
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '16px', background: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border-subtle)' }}>
                    <input 
                      type="checkbox" 
                      id="draftToggle"
                      checked={generateDraft}
                      onChange={(e) => setGenerateDraft(e.target.checked)}
                      style={{ width: '20px', height: '20px', accentColor: 'var(--accent-primary)' }}
                    />
                    <label htmlFor="draftToggle" style={{ cursor: 'pointer', fontWeight: 600, color: 'var(--text-main)' }}>
                      Also Generate GitHub/Jira Issue Draft
                    </label>
                  </div>

                  <button type="submit" className="btn" disabled={isLoadingQA || !query.trim()} id="devrel-qa-btn">
                    {isLoadingQA ? 'Searching Docs...' : <><Send size={18} /> Ask DevRel Agent</>}
                  </button>
                </form>

                {result && (
                  <div style={{ marginTop: '40px', display: 'flex', flexDirection: 'column', gap: '24px', animation: 'fadeIn 0.5s ease' }}>
                    <div className="glass" style={{ padding: '32px' }}>
                      <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', color: 'var(--text-main)' }}>
                        <Terminal size={20} color="var(--accent-primary)" /> Answer
                      </h3>
                      <div style={{ lineHeight: '1.7', whiteSpace: 'pre-wrap', fontSize: '1.05rem' }}>{result.answer}</div>
                    </div>

                    {result.sources && result.sources.length > 0 && (
                      <div className="glass" style={{ padding: '32px' }}>
                        <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', color: 'var(--text-main)' }}>
                          <FileText size={20} color="var(--accent-tertiary)" /> Reference Sources
                        </h3>
                        <ul style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: 0, listStyle: 'none' }}>
                          {result.sources.map((src, idx) => (
                            <li key={idx} style={{ padding: '16px', background: 'var(--bg-card-hover)', borderRadius: '8px', borderLeft: '3px solid var(--accent-tertiary)' }}>
                              <strong style={{ display: 'block', color: 'var(--text-main)', marginBottom: '4px' }}>{src.title}</strong>
                              <a href={src.url} target="_blank" rel="noreferrer" style={{ color: 'var(--accent-primary)', fontSize: '0.9rem', textDecoration: 'none' }}>{src.url}</a>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {result.draft_ticket && (
                      <div className="glass" style={{ padding: '32px' }}>
                        <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', color: 'var(--text-main)' }}>
                          <CheckCircle size={20} color="var(--success)" /> Generated Issue Draft
                        </h3>
                        <pre style={{ background: 'var(--code-bg)', border: '1px solid var(--border-subtle)' }}>
                          <code>{result.draft_ticket}</code>
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {activeSubTab === 'ingest' && (
              <form onSubmit={handleIngest} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div style={{ display: 'flex', gap: '20px' }}>
                  <div className="input-group" style={{ flex: 1 }}>
                    <label>Document Title</label>
                    <input 
                      type="text" 
                      value={ingestTitle} 
                      onChange={(e) => setIngestTitle(e.target.value)} 
                      placeholder="e.g. Auth v2 Guide" 
                    />
                  </div>
                  <div className="input-group" style={{ flex: 1 }}>
                    <label>Canonical URL</label>
                    <input 
                      type="text" 
                      value={ingestUrl} 
                      onChange={(e) => setIngestUrl(e.target.value)} 
                      placeholder="https://docs.example.com/auth" 
                    />
                  </div>
                </div>

                <div className="input-group">
                  <label>Markdown Content</label>
                  <textarea 
                    rows={8}
                    value={ingestText} 
                    onChange={(e) => setIngestText(e.target.value)} 
                    placeholder="# Authentication Setup\n\nTo configure authentication..." 
                  />
                </div>

                <button type="submit" className="btn" disabled={isLoadingIngest || !ingestText.trim()} id="devrel-ingest-btn">
                  {isLoadingIngest ? 'Ingesting...' : <><Database size={18} /> Add to Knowledge Base</>}
                </button>

                {ingestSuccess && (
                  <div className="glass" style={{ padding: '16px', background: 'var(--success-glow)', borderLeft: '4px solid var(--success)', color: 'var(--success)', marginTop: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <CheckCircle size={20} /> Document successfully indexed into InMemoryDocumentStore.
                  </div>
                )}
              </form>
            )}
          </div>
        )}

        {activeTab === 'architecture' && (
          <div className="content-block">
            <h3>Haystack Retrieval Architecture</h3>
            <p>
              The DevRel agent uses Deepset's Haystack 2.0 framework to construct robust retrieval pipelines. Unlike LangChain which can be heavily abstracted, Haystack provides explicit components (Document Stores, Retrievers, Prompt Builders, Generators) that are wired together cleanly.
            </p>
            <div style={{ margin: '32px 0', padding: '24px', background: 'var(--code-bg)', borderRadius: '12px', border: '1px solid var(--border-subtle)' }}>
              <pre style={{ background: 'transparent', border: 'none', color: 'var(--text-main)', fontSize: '0.9rem', lineHeight: '1.8' }}>
{`[ Ingestion Pipeline ]
Markdown Text -> Document Cleaner -> Document Splitter -> Embedding Generator -> [ InMemoryDocumentStore ]

[ Query Pipeline ]
User Query
    ↓
[ Embedding Retriever ] -> Fetches top K chunks from DocumentStore
    ↓
[ Prompt Builder ] -> Injects chunks into Context Template
    ↓
[ OpenAIGenerator ] -> Synthesizes technical answer
    ↓
(Optional Draft Step)
    ↓
[ Draft Prompt Builder ] -> Uses answer to write GitHub/Jira Issue
    ↓
[ OpenAIGenerator (2) ] -> Returns Draft Ticket string`}
              </pre>
            </div>
            <p>
              By decoupling the pipelines into explicit components, we can easily swap the `InMemoryDocumentStore` for Elasticsearch, Weaviate, or Qdrant when deploying to a higher scale production environment.
            </p>
          </div>
        )}

        {activeTab === 'tech' && (
          <div className="content-block">
            <h3>Frameworks and Libraries</h3>
            <div style={{ margin: '24px 0', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              <span className="badge primary">FastAPI (Python)</span>
              <span className="badge secondary">Haystack 2.0</span>
              <span className="badge success">InMemoryDocumentStore</span>
              <span className="badge warning">OpenAI GPT-4o</span>
            </div>
            
            <h4>Why Haystack 2.0?</h4>
            <p>
              Haystack 2.0's explicit pipeline design makes it incredibly easy to visualize and debug RAG flows. Every component strictly defines its inputs and outputs, eliminating "magic" behavior. It is heavily optimized for search-intensive applications.
            </p>

            <h4>Dual-LLM Invocation</h4>
            <p>
              The system demonstrates sequential LLM generation without complicated multi-agent looping. It first performs standard RAG to answer the question, then optionally routes that exact answer into a *second* specialized prompt to generate markdown-formatted Jira/GitHub bug reports, offloading tedious documentation tasks for DevRel engineers.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
