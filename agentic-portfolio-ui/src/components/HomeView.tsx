import React, { useState, useMemo } from 'react';
import {
  ShieldAlert, Code2, ShieldCheck, FileKey,
  Banknote, Stethoscope, SearchCode, DollarSign, FlaskConical,
  Truck, PlaneTakeoff, MessageSquare, Database, Server, Search, Home,
  Activity, Clock, Cloud, ArrowRight
} from 'lucide-react';

interface AppCardProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  iconBg: string;
  tags: string[];
  status: 'active' | 'pending';
  path?: string;
  onClick?: () => void;
  animationDelay?: number;
}

function AppCard({ title, description, icon, iconBg, tags, status, onClick, animationDelay = 0 }: AppCardProps) {
  const handleMouseMove = (e: React.MouseEvent<HTMLElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty('--mouse-x', `${e.clientX - rect.left}px`);
    e.currentTarget.style.setProperty('--mouse-y', `${e.clientY - rect.top}px`);
  };

  const content = (
    <>
      <div className="app-card-icon" style={{ background: iconBg }}>
        {icon}
      </div>
      <h3 className="app-card-title">{title}</h3>
      <p className="app-card-desc">{description}</p>
      <div className="app-card-footer">
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {tags.map(tag => (
            <span key={tag} className="badge muted">{tag}</span>
          ))}
        </div>
        <span className={`badge ${status === 'active' ? 'success' : 'pending-badge'}`}>
          {status === 'active' ? '● Live' : '◌ Pending'}
        </span>
      </div>
    </>
  );

  const style: React.CSSProperties = {
    animationDelay: `${animationDelay}ms`,
  };

  if (onClick) {
    return (
      <a
        role="button"
        tabIndex={0}
        onClick={(e) => { e.preventDefault(); onClick(); }}
        onKeyDown={(e) => e.key === 'Enter' && onClick()}
        className={`glass app-card ${status === 'pending' ? 'pending' : ''}`}
        style={style}
        onMouseMove={handleMouseMove}
      >
        {content}
        <div style={{ position: 'absolute', top: 20, right: 20, opacity: 0.3, transition: 'opacity 0.2s' }} className="arrow-icon">
          <ArrowRight size={16} />
        </div>
      </a>
    );
  }

  return (
    <div className="glass app-card disabled" style={style} onMouseMove={handleMouseMove}>
      {content}
    </div>
  );
}

const ALL_APPS: Omit<AppCardProps, 'animationDelay'>[] = [
  {
    title: 'Agentic Customer Support',
    description: 'Tier-1 ReAct Agent that autonomously resolves customer tickets, queries databases, and handles refunds.',
    icon: <MessageSquare size={22} color="#fff" />,
    iconBg: 'linear-gradient(135deg, #2563eb, #3b82f6)',
    tags: ['ReAct', 'Hono Edge', 'LibSQL'],
    status: 'active',
    path: '/support',
  },
  {
    title: 'Model Router Sentinel',
    description: 'Dynamic API Gateway that evaluates query complexity to optimize LLM cost and performance routing.',
    icon: <Server size={22} color="#fff" />,
    iconBg: 'linear-gradient(135deg, #7c3aed, #8b5cf6)',
    tags: ['FastAPI', 'Instructor', 'LiteLLM'],
    status: 'active',
    path: '/router',
  },
  {
    title: 'Multimodal QA Agent',
    description: 'Vision-language pipeline capable of extracting structured data from unstructured images and documents.',
    icon: <Search size={22} color="#fff" />,
    iconBg: 'linear-gradient(135deg, #db2777, #ec4899)',
    tags: ['LangChain', 'Claude 3.5'],
    status: 'active',
    path: '/multimodal',
  },
  {
    title: 'Real Estate Coordinator',
    description: 'Vector search retrieval system mapping natural language queries to hyper-specific property listings.',
    icon: <Home size={22} color="#fff" />,
    iconBg: 'linear-gradient(135deg, #059669, #10b981)',
    tags: ['Pinecone', 'Embeddings'],
    status: 'active',
    path: '/real-estate',
  },
  {
    title: 'Procurement Intelligence',
    description: 'Multi-agent graph for supply chain risk analysis fusing structured SQL generation with unstructured RAG.',
    icon: <Database size={22} color="#fff" />,
    iconBg: 'linear-gradient(135deg, #d97706, #f59e0b)',
    tags: ['LangGraph', 'Vanna AI'],
    status: 'active',
    path: '/procurement',
  },
  {
    title: 'Agentic Red Teamer',
    description: 'Automated fuzzing and evaluation framework to audit LLM endpoints against jailbreaks and PII leakage.',
    icon: <ShieldAlert size={22} color="#fff" />,
    iconBg: 'linear-gradient(135deg, #dc2626, #ef4444)',
    tags: ['Eval-Ops', 'Async I/O'],
    status: 'active',
    path: '/red-teamer',
  },
  {
    title: 'Autonomous DevRel',
    description: 'Haystack-powered documentation assistant capable of drafting Jira issues from technical Q&A.',
    icon: <Code2 size={22} color="#fff" />,
    iconBg: 'linear-gradient(135deg, #0891b2, #06b6d4)',
    tags: ['Haystack 2.0', 'GPT-4o'],
    status: 'active',
    path: '/devrel',
  },
  {
    title: 'Cloud Security Sentinel',
    description: 'Rust-based static analyzer paired with an LLM exploit simulator to remediate Terraform vulnerabilities.',
    icon: <ShieldCheck size={22} color="#fff" />,
    iconBg: 'linear-gradient(135deg, #0f766e, #14b8a6)',
    tags: ['Rust Axum', 'Terraform'],
    status: 'active',
    path: '/cloud-security',
  },
  {
    title: 'Compliance PII Sanitizer',
    description: 'Streaming middleware interceptor that redacts sensitive personal data before it reaches the LLM layer.',
    icon: <FileKey size={22} color="#fff" />,
    iconBg: 'linear-gradient(135deg, #6366f1, #818cf8)',
    tags: ['Presidio', 'Edge Compute'],
    status: 'pending',
    path: '/compliance-sanitizer',
  },
  {
    title: 'FinTech Fraud Mitigator',
    description: 'Graph-based anomaly detection agent that suspends suspicious transactions in real-time.',
    icon: <Banknote size={22} color="#fff" />,
    iconBg: 'linear-gradient(135deg, #16a34a, #22c55e)',
    tags: ['Neo4j', 'Kafka'],
    status: 'pending',
    path: '/fintech-fraud',
  },
  {
    title: 'Medical Intake Nurse',
    description: 'HIPAA-compliant audio-to-text pipeline that structures patient symptoms into clinical SOAP notes.',
    icon: <Stethoscope size={22} color="#fff" />,
    iconBg: 'linear-gradient(135deg, #0369a1, #0ea5e9)',
    tags: ['Whisper', 'FHIR API'],
    status: 'pending',
    path: '/medical-nurse',
  },
  {
    title: 'Revenue Recovery Auditor',
    description: 'Batch processing agent that analyzes historical billing data to identify undercharged accounts.',
    icon: <DollarSign size={22} color="#fff" />,
    iconBg: 'linear-gradient(135deg, #15803d, #4ade80)',
    tags: ['Airflow', 'BigQuery'],
    status: 'pending',
    path: '/revenue-recovery',
  },
  {
    title: 'Feature Shippable Agent',
    description: 'GitHub-integrated bot that plans, writes, and tests code directly against your repository PRs.',
    icon: <SearchCode size={22} color="#fff" />,
    iconBg: 'linear-gradient(135deg, #7e22ce, #a855f7)',
    tags: ['AutoGPT', 'Docker Sandbox'],
    status: 'pending',
    path: '/feature-agent',
  },
  {
    title: 'Scientific Research Sandbox',
    description: 'Agentic researcher that ingests ArXiv papers to summarize novel approaches to user-defined problems.',
    icon: <FlaskConical size={22} color="#fff" />,
    iconBg: 'linear-gradient(135deg, #0e7490, #22d3ee)',
    tags: ['ArXiv API', 'Qdrant'],
    status: 'pending',
    path: '/scientific-sandbox',
  },
  {
    title: 'Service Dispatch Coordinator',
    description: 'Geospatial optimization agent mapping the fastest routes for field technicians dynamically.',
    icon: <Truck size={22} color="#fff" />,
    iconBg: 'linear-gradient(135deg, #b45309, #fbbf24)',
    tags: ['OR-Tools', 'Google Maps'],
    status: 'pending',
    path: '/service-dispatch',
  },
  {
    title: 'Travel Concierge Agent',
    description: 'End-to-end trip planner integrating flight APIs, hotel bookings, and localized itinerary generation.',
    icon: <PlaneTakeoff size={22} color="#fff" />,
    iconBg: 'linear-gradient(135deg, #be185d, #f472b6)',
    tags: ['Amadeus API', 'Celery'],
    status: 'pending',
    path: '/travel-concierge',
  },
];

const ACTIVE_COUNT = ALL_APPS.filter(a => a.status === 'active').length;
const PENDING_COUNT = ALL_APPS.filter(a => a.status === 'pending').length;

export default function HomeView({ onNavigate }: { onNavigate?: (path: string) => void }) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return ALL_APPS;
    return ALL_APPS.filter(a =>
      a.title.toLowerCase().includes(q) ||
      a.description.toLowerCase().includes(q) ||
      a.tags.some(t => t.toLowerCase().includes(q))
    );
  }, [query]);

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
      <div className="view-header">
        <h1 className="view-title">
          <span className="text-gradient">Agentic Ecosystem</span>
        </h1>
        <p className="view-subtitle">A centralized command center for enterprise AI systems</p>
      </div>

      {/* Stats Bar */}
      <div className="stats-bar">
        <div className="glass stat-card">
          <div className="stat-card-icon" style={{ background: 'rgba(16,185,129,0.15)' }}>
            <Activity size={20} color="var(--success)" />
          </div>
          <div>
            <div className="stat-card-value" style={{ color: 'var(--success)' }}>{ACTIVE_COUNT}</div>
            <div className="stat-card-label">Live Agents</div>
          </div>
        </div>
        <div className="glass stat-card">
          <div className="stat-card-icon" style={{ background: 'rgba(139,92,246,0.15)' }}>
            <Clock size={20} color="var(--accent-secondary)" />
          </div>
          <div>
            <div className="stat-card-value" style={{ color: 'var(--accent-secondary)' }}>{PENDING_COUNT}</div>
            <div className="stat-card-label">Pending Agents</div>
          </div>
        </div>
        <div className="glass stat-card">
          <div className="stat-card-icon" style={{ background: 'rgba(59,130,246,0.15)' }}>
            <Cloud size={20} color="var(--accent-primary)" />
          </div>
          <div>
            <div className="stat-card-value" style={{ color: 'var(--accent-primary)' }}>{ACTIVE_COUNT}</div>
            <div className="stat-card-label">Local & Cloud Services</div>
          </div>
        </div>
      </div>

      {/* Search and Grid */}
      <div style={{ marginBottom: 24 }}>
        <input
          type="text"
          className="search-input"
          placeholder="Filter agentic apps by name, tech stack, or description..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {filtered.length === 0 ? (
        <div className="no-results">
          🔍 No agentic apps match your filter query. Try another term!
        </div>
      ) : (
        <div className="app-grid">
          {filtered.map((app, index) => (
            <AppCard
              key={app.title}
              {...app}
              onClick={onNavigate && app.path ? () => onNavigate(app.path!) : undefined}
              animationDelay={index * 50}
            />
          ))}
        </div>
      )}
    </div>
  );
}
