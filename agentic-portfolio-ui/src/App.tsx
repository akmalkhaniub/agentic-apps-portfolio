import { BrowserRouter as Router, Routes, Route, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import {
  MessageSquare, Server, Search, Home, Database,
  ShieldAlert, Code2, ShieldCheck, Sun, Moon,
  Zap, GitBranch, LayoutDashboard,
  FileKey, Banknote, Stethoscope, DollarSign, SearchCode,
  FlaskConical, Truck, PlaneTakeoff, Network, Users
} from 'lucide-react';
import CustomerSupportView from './components/CustomerSupportView';
import ModelRouterView from './components/ModelRouterView';
import MultimodalQAView from './components/MultimodalQAView';
import RealEstateView from './components/RealEstateView';
import ProcurementView from './components/ProcurementView';
import RedTeamerView from './components/RedTeamerView';
import DevRelView from './components/DevRelView';
import CloudSecurityView from './components/CloudSecurityView';
import ComplianceSanitizerView from './components/ComplianceSanitizerView';
import FintechFraudView from './components/FintechFraudView';
import MedicalNurseView from './components/MedicalNurseView';
import RevenueAuditorView from './components/RevenueAuditorView';
import FeatureAgentView from './components/FeatureAgentView';
import ScientificSandboxView from './components/ScientificSandboxView';
import ServiceDispatchView from './components/ServiceDispatchView';
import TravelConciergeView from './components/TravelConciergeView';
import EnterpriseSwarmView from './components/EnterpriseSwarmView';
import MultiAgentDebateView from './components/MultiAgentDebateView';
import HomeView from './components/HomeView';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { InspectorProvider } from './context/InspectorContext';
import AgentInspector from './components/AgentInspector';

const SIDEBAR_GROUPS = [
  {
    name: 'Customer & Front-Office',
    items: [
      { to: '/support',               icon: MessageSquare, label: 'Customer Support',   color: '#3b82f6' },
      { to: '/router',                icon: Server,        label: 'Model Router',        color: '#8b5cf6' },
      { to: '/travel-concierge',      icon: PlaneTakeoff,  label: 'Travel Concierge',    color: '#be185d' },
    ]
  },
  {
    name: 'Data & Research',
    items: [
      { to: '/multimodal',            icon: Search,        label: 'Multimodal QA',       color: '#ec4899' },
      { to: '/scientific-sandbox',    icon: FlaskConical,  label: 'Research Sandbox',    color: '#0e7490' },
      { to: '/procurement',           icon: Database,      label: 'Procurement',         color: '#f59e0b' },
    ]
  },
  {
    name: 'Operations & Field',
    items: [
      { to: '/real-estate',           icon: Home,          label: 'Real Estate',         color: '#10b981' },
      { to: '/service-dispatch',      icon: Truck,         label: 'Service Dispatch',    color: '#b45309' },
      { to: '/revenue-recovery',      icon: DollarSign,    label: 'Revenue Recovery',    color: '#15803d' },
    ]
  },
  {
    name: 'Engineering & SecOps',
    items: [
      { to: '/feature-agent',         icon: SearchCode,    label: 'Feature Agent',       color: '#7e22ce' },
      { to: '/cloud-security',        icon: ShieldCheck,   label: 'Security Sentinel',   color: '#14b8a6' },
      { to: '/red-teamer',            icon: ShieldAlert,   label: 'Red Teamer',          color: '#ef4444' },
      { to: '/compliance-sanitizer',  icon: FileKey,       label: 'PII Sanitizer',       color: '#64748b' },
      { to: '/devrel',                icon: GitBranch,     label: 'DevRel Agent',        color: '#f43f5e' },
      { to: '/fintech-fraud',         icon: Banknote,      label: 'Fraud Mitigator',     color: '#16a34a' },
    ]
  },
  {
    name: 'Healthcare',
    items: [
      { to: '/medical-nurse',         icon: Stethoscope,   label: 'Intake Nurse',        color: '#ef4444' },
    ]
  },
  {
    name: 'Enterprise AI',
    items: [
      { to: '/enterprise-swarm',      icon: Network,       label: 'Knowledge Swarm',     color: '#4f46e5' },
      { to: '/multi-agent-debate',    icon: Users,         label: 'Agent Debate',        color: '#eab308' },
    ]
  }
];

const ROUTE_TITLES: Record<string, string> = {
  '/':                      'Dashboard — Agentic Portfolio',
  '/support':               'Customer Support — Agentic Portfolio',
  '/router':                'Model Router — Agentic Portfolio',
  '/multimodal':            'Multimodal QA — Agentic Portfolio',
  '/real-estate':           'Real Estate — Agentic Portfolio',
  '/procurement':           'Procurement — Agentic Portfolio',
  '/red-teamer':            'Red Teamer — Agentic Portfolio',
  '/devrel':                'DevRel Assistant — Agentic Portfolio',
  '/cloud-security':        'Security Sentinel — Agentic Portfolio',
  '/compliance-sanitizer':  'Compliance Sanitizer — Agentic Portfolio',
  '/fintech-fraud':         'Fraud Mitigator — Agentic Portfolio',
  '/medical-nurse':         'Intake Nurse — Agentic Portfolio',
  '/revenue-recovery':      'Revenue Recovery — Agentic Portfolio',
  '/feature-agent':         'Feature Agent — Agentic Portfolio',
  '/scientific-sandbox':    'Research Sandbox — Agentic Portfolio',
  '/service-dispatch':      'Service Dispatch — Agentic Portfolio',
  '/travel-concierge':      'Travel Concierge — Agentic Portfolio',
};

function TitleUpdater() {
  const location = useLocation();
  useEffect(() => {
    document.title = ROUTE_TITLES[location.pathname] ?? 'Agentic Portfolio';
  }, [location.pathname]);
  return null;
}

function NotFoundView() {
  const navigate = useNavigate();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 24, textAlign: 'center' }}>
      <div style={{ fontSize: '5rem', lineHeight: 1 }}>🤖</div>
      <h1 className="view-title">404 — Page Not Found</h1>
      <p className="view-subtitle">This agent doesn't exist (yet).</p>
      <button className="btn" onClick={() => navigate('/')}>← Back to Dashboard</button>
    </div>
  );
}

function SidebarGroup({ group }: { group: typeof SIDEBAR_GROUPS[0] }) {
  const [isOpen, setIsOpen] = useState(true);
  const location = useLocation();

  // If a child is active, we might want to ensure it's open, but state might override.
  useEffect(() => {
    if (group.items.some(item => item.to === location.pathname)) {
      setIsOpen(true);
    }
  }, [location.pathname, group.items]);

  return (
    <div style={{ marginBottom: 8 }}>
      <div 
        className="sidebar-section-label" 
        onClick={() => setIsOpen(!isOpen)}
        style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
      >
        {group.name}
        <span style={{ fontSize: '0.8rem', opacity: 0.5, transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>
          ▶
        </span>
      </div>
      {isOpen && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {group.items.map(({ to, icon: Icon, label, color }) => (
            <NavLink key={to} to={to} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <div className="nav-link-icon" style={{ color }}>
                <Icon size={17} />
              </div>
              {label}
            </NavLink>
          ))}
        </div>
      )}
    </div>
  );
}

function Sidebar() {
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="sidebar">
      {/* Logo */}
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon">
          <Zap size={18} color="white" fill="white" />
        </div>
        Agentic Portfolio
      </div>

      {/* Dashboard */}
      <NavLink to="/" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} end>
        <div className="nav-link-icon">
          <LayoutDashboard size={17} />
        </div>
        Dashboard
      </NavLink>

      <div style={{ marginTop: 16 }}>
        {SIDEBAR_GROUPS.map((group) => (
          <SidebarGroup key={group.name} group={group} />
        ))}
      </div>

      {/* Footer */}
      <div className="sidebar-footer">
        <a
          href="https://github.com/akmalkhaniub"
          target="_blank"
          rel="noopener noreferrer"
          className="btn-ghost"
          style={{ textDecoration: 'none', width: '100%' }}
        >
          <GitBranch size={16} />
          GitHub
        </a>
        <button onClick={toggleTheme} className="btn-ghost" style={{ width: '100%' }}>
          {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
        </button>
      </div>
    </div>
  );
}

function HomeRoute() {
  const navigate = useNavigate();
  return <HomeView onNavigate={(path) => navigate(path)} />;
}

export default function App() {
  return (
    <ThemeProvider>
      <InspectorProvider>
        <Router>
          <TitleUpdater />
          <div className="app-container" style={{ position: 'relative' }}>
            <Sidebar />
            <div className="main-content">
              <Routes>
                <Route path="/"                       element={<HomeRoute />} />
                <Route path="/support"                element={<CustomerSupportView />} />
                <Route path="/router"                 element={<ModelRouterView />} />
                <Route path="/multimodal"             element={<MultimodalQAView />} />
                <Route path="/real-estate"            element={<RealEstateView />} />
                <Route path="/procurement"            element={<ProcurementView />} />
                <Route path="/red-teamer"             element={<RedTeamerView />} />
                <Route path="/devrel"                 element={<DevRelView />} />
                <Route path="/cloud-security"         element={<CloudSecurityView />} />
                <Route path="/compliance-sanitizer"   element={<ComplianceSanitizerView />} />
                <Route path="/fintech-fraud"          element={<FintechFraudView />} />
                <Route path="/medical-nurse"          element={<MedicalNurseView />} />
                <Route path="/revenue-recovery"       element={<RevenueAuditorView />} />
                <Route path="/feature-agent"          element={<FeatureAgentView />} />
                <Route path="/scientific-sandbox"     element={<ScientificSandboxView />} />
                <Route path="/service-dispatch"       element={<ServiceDispatchView />} />
                <Route path="/travel-concierge"       element={<TravelConciergeView />} />
                <Route path="/enterprise-swarm"       element={<EnterpriseSwarmView />} />
                <Route path="/multi-agent-debate"     element={<MultiAgentDebateView />} />
                <Route path="*"                      element={<NotFoundView />} />
              </Routes>
            </div>
            <AgentInspector />
          </div>
        </Router>
      </InspectorProvider>
    </ThemeProvider>
  );
}
