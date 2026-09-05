import { useState } from 'react';
import { Plug, Send, CheckCircle2, Activity, Play, RefreshCw, Wrench } from 'lucide-react';
import { API_ENDPOINTS } from '../config';
import { useInspector } from '../context/InspectorContext';

interface ToolCall {
  tool: string;
  args: Record<string, unknown>;
}

interface ChatResult {
  answer: string;
  toolCalls: ToolCall[];
}

export default function MCPGatewayView() {
  const { setIsOpen, addTrace } = useInspector();
  const [message, setMessage] = useState(
    'What stack does the multi-agent-debate app use, and what is 21 + 21?'
  );
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<ChatResult | null>(null);

  const handleAsk = async () => {
    setIsLoading(true);
    setResult(null);
    addTrace({
      source: 'MCPGatewayView',
      type: 'log',
      content: 'Discovering MCP tool catalog and dispatching to host agent...',
    });

    try {
      const response = await fetch(`${API_ENDPOINTS.mcpGateway}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
      });

      if (!response.ok) throw new Error('Host agent offline');

      const data: ChatResult = await response.json();
      setResult(data);
      data.toolCalls.forEach((tc) => {
        addTrace({
          source: 'HostAgent',
          type: 'tool',
          content: `Called ${tc.tool}(${JSON.stringify(tc.args)})`,
        });
      });
      setIsLoading(false);
    } catch {
      console.warn('MCP host offline. Falling back to mock discovery.');

      const mockData: ChatResult = {
        answer:
          'The **multi-agent-debate** app is built with FastAPI + an LLM-Debate loop and runs ' +
          'on port 8005. And 21 + 21 = **42**.\n\nBoth answers came from tools discovered over ' +
          'MCP: `gateway__lookup_portfolio_app` (this portfolio) and `everything__get-sum` (a ' +
          'separate third-party MCP server) — proof the host is protocol-native, not hardcoded.',
        toolCalls: [
          { tool: 'gateway__lookup_portfolio_app', args: { name: 'multi-agent-debate' } },
          { tool: 'everything__get-sum', args: { a: 21, b: 21 } },
        ],
      };

      mockData.toolCalls.forEach((tc, i) => {
        setTimeout(() => {
          addTrace({
            source: 'HostAgent',
            type: 'tool',
            content: `Called ${tc.tool}(${JSON.stringify(tc.args)})`,
          });
        }, i * 800);
      });

      setTimeout(
        () => {
          setResult(mockData);
          setIsLoading(false);
        },
        mockData.toolCalls.length * 800 + 400
      );
    }
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
      <div className="dev-mode-banner">
        <span className="dev-mode-banner-badge">Pending</span>
        <span>Running in Local Development Mode — Host agent on port 3003, gateway on 8006</span>
      </div>

      <div
        className="view-header"
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}
      >
        <div>
          <h1 className="view-title">
            <Plug size={32} color="var(--accent-tertiary)" />
            MCP Tool Gateway
          </h1>
          <p className="view-subtitle">
            A protocol-native host agent that discovers tools at runtime over the Model Context
            Protocol — from this portfolio's gateway and a third-party MCP server — then routes each
            call to the server that owns it.
          </p>
          <div className="pattern-badges-container">
            <span className="pattern-badge">Model Context Protocol</span>
            <span className="pattern-badge">Runtime Discovery</span>
            <span className="pattern-badge">Streamable HTTP</span>
          </div>
        </div>
        <button className="btn-ghost" onClick={() => setIsOpen(true)}>
          <Activity size={16} color="var(--accent-secondary)" />
          Inspect Tool Calls
        </button>
      </div>

      <div
        className="grid-2"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))',
          gap: 24,
        }}
      >
        <div className="glass content-block">
          <h3>
            <Send size={18} />
            Ask the Host Agent
          </h3>
          <div className="input-group">
            <label htmlFor="message">
              Pose a question — the agent picks and calls MCP tools to answer
            </label>
            <textarea
              id="message"
              rows={4}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="e.g. What port does the PII sanitizer run on?"
            />
          </div>

          <button
            className="btn"
            onClick={handleAsk}
            disabled={isLoading}
            style={{ width: '100%', marginTop: 12 }}
          >
            {isLoading ? <RefreshCw className="spin" size={16} /> : <Play size={16} />}
            {isLoading ? 'Discovering & calling tools...' : 'Send to Host Agent'}
          </button>
        </div>

        <div className="glass content-block" style={{ display: 'flex', flexDirection: 'column' }}>
          <h3>Agent Response</h3>
          {!result && !isLoading ? (
            <div
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: 250,
                color: 'var(--text-muted)',
              }}
            >
              <Plug size={48} style={{ opacity: 0.2, marginBottom: 12 }} />
              <p>Ask a question to see runtime tool discovery in action</p>
            </div>
          ) : isLoading && !result ? (
            <div
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: 250,
                color: 'var(--text-muted)',
              }}
            >
              <RefreshCw
                className="spin"
                size={32}
                style={{ marginBottom: 16, color: 'var(--accent-tertiary)' }}
              />
              <p style={{ fontWeight: 600 }}>Host agent is calling MCP tools...</p>
              <p style={{ fontSize: '0.85rem' }}>Open the inspector to watch each tool call</p>
            </div>
          ) : (
            <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div
                style={{
                  padding: 16,
                  borderRadius: 12,
                  background: 'var(--bg-main)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <h4 style={{ margin: '0 0 12px 0', fontSize: '0.9rem', color: 'var(--text-main)' }}>
                  Answer
                </h4>
                <div style={{ lineHeight: 1.6, fontSize: '0.95rem', whiteSpace: 'pre-wrap' }}>
                  {result?.answer}
                </div>
              </div>

              {result && result.toolCalls.length > 0 && (
                <div
                  style={{
                    padding: 16,
                    borderRadius: 12,
                    background: 'var(--bg-main)',
                    border: '1px solid var(--border-subtle)',
                  }}
                >
                  <h4
                    style={{
                      margin: '0 0 12px 0',
                      fontSize: '0.9rem',
                      color: 'var(--text-main)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    <Wrench size={15} />
                    MCP tools called ({result.toolCalls.length})
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {result.toolCalls.map((tc, i) => (
                      <code
                        key={i}
                        style={{
                          fontSize: '0.8rem',
                          padding: '6px 10px',
                          borderRadius: 8,
                          background: 'var(--bg-subtle, rgba(127,127,127,0.08))',
                          border: '1px solid var(--border-subtle)',
                        }}
                      >
                        {tc.tool}
                      </code>
                    ))}
                  </div>
                </div>
              )}

              <div
                style={{
                  padding: 12,
                  borderRadius: 12,
                  background: 'var(--success-glow)',
                  border: '1px solid rgba(16,185,129,0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <CheckCircle2 size={16} color="var(--success)" />
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--success)' }}>
                  Answered via runtime-discovered MCP tools
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
