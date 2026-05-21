import { useState } from 'react';
import { useInspector } from '../context/InspectorContext';
import { Terminal, Database, PlaySquare, X, Activity, Zap, List, GitCommit } from 'lucide-react';
import DAGVisualizer from './DAGVisualizer';

export default function AgentInspector() {
  const { isOpen, setIsOpen, traces, clearTraces } = useInspector();
  const [viewMode, setViewMode] = useState<'list' | 'graph'>('list');

  if (!isOpen) return null;

  return (
    <div className="inspector-drawer">
      <div className="inspector-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Activity size={18} color="var(--accent-primary)" />
          <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Agent Inspector</h3>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <div style={{ display: 'flex', background: 'var(--bg-main)', borderRadius: 20, padding: 2 }}>
            <button 
              onClick={() => setViewMode('list')}
              style={{ padding: '4px 8px', borderRadius: 18, background: viewMode === 'list' ? 'var(--bg-hover)' : 'transparent', color: viewMode === 'list' ? 'var(--text-main)' : 'var(--text-muted)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
            >
              <List size={14} /> <span style={{ fontSize: '0.75rem' }}>Logs</span>
            </button>
            <button 
              onClick={() => setViewMode('graph')}
              style={{ padding: '4px 8px', borderRadius: 18, background: viewMode === 'graph' ? 'var(--bg-hover)' : 'transparent', color: viewMode === 'graph' ? 'var(--text-main)' : 'var(--text-muted)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
            >
              <GitCommit size={14} /> <span style={{ fontSize: '0.75rem' }}>Graph</span>
            </button>
          </div>
          <button className="btn-ghost" onClick={clearTraces} style={{ fontSize: '0.8rem', padding: '4px 8px' }}>
            Clear
          </button>
          <button className="btn-ghost" onClick={() => setIsOpen(false)} style={{ padding: '4px' }}>
            <X size={18} />
          </button>
        </div>
      </div>

      <div className="inspector-content" style={viewMode === 'graph' ? { padding: 0 } : {}}>
        {traces.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', padding: 20 }}>
            <Terminal size={32} style={{ opacity: 0.3, marginBottom: 12 }} />
            <p style={{ fontSize: '0.9rem' }}>No active traces.</p>
            <p style={{ fontSize: '0.8rem', opacity: 0.7 }}>Run an agent to populate execution logs.</p>
          </div>
        ) : viewMode === 'graph' ? (
          <DAGVisualizer />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {traces.map((trace) => (
              <div key={trace.id} className="inspector-trace-item">
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                  {trace.type === 'log' && <Terminal size={14} color="#a1a1aa" />}
                  {trace.type === 'tool' && <PlaySquare size={14} color="#3b82f6" />}
                  {trace.type === 'llm' && <Zap size={14} color="#f59e0b" />}
                  {trace.type === 'graph_state' && <Database size={14} color="#10b981" />}
                  <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--text-muted)' }}>
                    [{trace.source.toUpperCase()}]
                  </span>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>
                    {new Date(trace.timestamp).toLocaleTimeString()}
                  </span>
                </div>
                <div style={{ background: 'rgba(0,0,0,0.2)', padding: 8, borderRadius: 6, fontSize: '0.85rem', fontFamily: 'monospace', wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>
                  {typeof trace.content === 'string' ? trace.content : JSON.stringify(trace.content, null, 2)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
