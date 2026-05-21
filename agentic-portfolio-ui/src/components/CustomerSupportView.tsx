import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Play, Layers, Code2, Copy, Check, Activity } from 'lucide-react';
import { API_ENDPOINTS } from '../config';
import { useInspector } from '../context/InspectorContext';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

function formatTime(d: Date) {
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button className="chat-copy-btn" onClick={handleCopy} title="Copy message">
      {copied ? <><Check size={11} /> Copied</> : <><Copy size={11} /> Copy</>}
    </button>
  );
}

export default function CustomerSupportView() {
  const { setIsOpen, addTrace } = useInspector();
  const [activeTab, setActiveTab] = useState<'demo' | 'architecture' | 'tech'>('demo');
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: 'Hi there! I am your AI Customer Support Specialist. How can I help you today?', timestamp: new Date() }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | undefined>(undefined);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    addTrace({ source: 'CustomerSupportView', type: 'log', content: 'Execution started...' });

    const userMessage: Message = { role: 'user', content: input, timestamp: new Date() };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch(`${API_ENDPOINTS.customerSupport}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMessage.content, sessionId })
      });

      const data = await response.json();
      if (data.error) throw new Error(JSON.stringify(data.error));

      if (data.sessionId && !sessionId) setSessionId(data.sessionId);

      setMessages(prev => [...prev, {
        role: 'assistant',
        content: data.response || 'I took an action.',
        timestamp: new Date()
      }]);
    } catch (err) {
      console.error(err);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Sorry, I encountered an error connecting to the server.',
        timestamp: new Date()
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
      <div className="view-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 className="view-title">
            <span style={{ fontSize: '2rem' }}>💬</span>
            Customer Support Agent
          </h1>
          <p className="view-subtitle">Interactive ReAct Agent Demo</p>
        </div>
        <button className="btn-ghost" onClick={() => setIsOpen(true)}>
          <Activity size={16} color="var(--accent-secondary)" />
          Inspect Agent Traces
        </button>
      </div>

      <div className="tabs-container">
        <button className={`tab-btn ${activeTab === 'demo' ? 'active' : ''}`} onClick={() => setActiveTab('demo')}>
          <Play size={15} /> Interactive Demo
        </button>
        <button className={`tab-btn ${activeTab === 'architecture' ? 'active' : ''}`} onClick={() => setActiveTab('architecture')}>
          <Layers size={15} /> Architecture &amp; Flow
        </button>
        <button className={`tab-btn ${activeTab === 'tech' ? 'active' : ''}`} onClick={() => setActiveTab('tech')}>
          <Code2 size={15} /> Tech Stack Specs
        </button>
      </div>

      <div className="glass-panel" style={{ minHeight: '600px' }}>
        {activeTab === 'demo' && (
          <div className="chat-container">
            <div className="chat-messages">
              {messages.map((msg, i) => (
                <div key={i} className={`chat-message ${msg.role}`}>
                  <div className="chat-message-meta">
                    {msg.role === 'assistant' ? <Bot size={12} /> : <User size={12} />}
                    <span>{msg.role === 'assistant' ? 'Support AI' : 'You'}</span>
                    <span style={{ opacity: 0.6 }}>· {formatTime(msg.timestamp)}</span>
                  </div>
                  {msg.content}
                  {msg.role === 'assistant' && (
                    <div className="chat-message-actions">
                      <CopyButton text={msg.content} />
                    </div>
                  )}
                </div>
              ))}
              {isLoading && (
                <div className="chat-message assistant">
                  <div className="chat-message-meta">
                    <Bot size={12} />
                    <span>Support AI</span>
                  </div>
                  <div className="typing-bubble">
                    <span /><span /><span />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            <form onSubmit={sendMessage} className="chat-input-area">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about order #12345 or refund policies..."
                disabled={isLoading}
                autoFocus
                id="support-chat-input"
              />
              <button type="submit" className="chat-send-btn" disabled={isLoading || !input.trim()} title="Send">
                <Send size={18} />
              </button>
            </form>
          </div>
        )}

        {activeTab === 'architecture' && (
          <div className="content-block">
            <h3>Tier-1 ReAct Agent Workflow</h3>
            <p>
              This agent uses a classic ReAct (Reasoning and Acting) loop to dynamically route user intents, execute queries, and synthesize final answers. Instead of a hardcoded decision tree, the LLM determines which tool to call based on the conversational context.
            </p>
            <div style={{ margin: '32px 0', padding: '24px', background: 'var(--code-bg)', borderRadius: '12px', border: '1px solid var(--border-subtle)' }}>
              <pre style={{ background: 'transparent', border: 'none', color: 'var(--text-main)', fontSize: '0.9rem', lineHeight: '1.8' }}>
{`User Input -> Intent Routing Prompt
    ├── If [Information Request] -> Use Knowledge Base Search Tool -> Synthesize Answer
    ├── If [Order Status] -> Use Drizzle SQL Query Tool (id=?) -> Synthesize Status
    └── If [Refund Request] -> 
             1. Query Order Database for Eligibility
             2. If eligible < 30 days -> Execute Refund Mutation Tool
             3. If not eligible -> Escalate to Human`}
              </pre>
            </div>
          </div>
        )}

        {activeTab === 'tech' && (
          <div className="content-block">
            <h3>Frameworks and Libraries</h3>
            <div style={{ margin: '24px 0', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              <span className="badge primary">Google Gemini 1.5 Flash</span>
              <span className="badge secondary">Vercel AI SDK</span>
              <span className="badge success">Hono Edge</span>
              <span className="badge warning">LibSQL / SQLite</span>
              <span className="badge tertiary">Drizzle ORM</span>
            </div>

            <h4>Why Hono + Vercel AI SDK?</h4>
            <p>
              Hono is an ultrafast web framework built for Edge runtimes (Cloudflare Workers, Deno, Bun). Combined with the Vercel AI SDK (<code>ai/core</code>), we achieve streaming LLM responses with built-in tool execution loops (<code>streamText(..., maxSteps: 5)</code>). This dramatically reduces the latency compared to traditional Python/FastAPI setups for simple stateless chatbots.
            </p>

            <h4>Database Setup (Drizzle + LibSQL)</h4>
            <p>
              We use LibSQL (a fork of SQLite by Turso) because of its incredibly low latency and ability to run embedded or at the edge. Drizzle ORM provides full type-safety for our database schema, preventing SQL injections when the ReAct agent executes a parameterized lookup tool.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
