import React, { useState } from 'react';
import { ShieldCheck, Search, Play, Layers, Code2, CheckCircle, AlertTriangle, XCircle, Activity } from 'lucide-react';
import { API_ENDPOINTS } from '../config';
import { useInspector } from '../context/InspectorContext';

interface ExploitSimulation {
  vulnerability_id: string;
  is_exploitable: boolean;
  simulated_path: string;
  remediation_patch: string;
}

interface ScanResult {
  scan_id: string;
  timestamp: string;
  vulnerabilities_found: number;
  critical_count: number;
  high_count: number;
  details: {
    id: string;
    severity: string;
    description: string;
    resource: string;
  }[];
  exploit_simulation?: ExploitSimulation;
}

export default function CloudSecurityView() {
  const { setIsOpen, addTrace } = useInspector();
  const [activeTab, setActiveTab] = useState<'demo' | 'architecture' | 'tech'>('demo');
  const [targetRepo, setTargetRepo] = useState('agentic-infrastructure-v1');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);

  const handleScan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetRepo.trim() || isLoading) return;

    setIsLoading(true);
    setResult(null);
    addTrace({ source: 'CloudSecurityView', type: 'log', content: `Execution started for target: ${targetRepo}...` });

    try {
      const response = await fetch(`${API_ENDPOINTS.cloudSecurity}/api/v1/scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target: targetRepo })
      });

      const data = await response.json();
      setResult(data);
    } catch (err) {
      console.error(err);
      alert('Failed to execute security scan.');
    } finally {
      setIsLoading(false);
    }
  };

  const severityColor = (sev: string) => {
    switch(sev.toLowerCase()) {
      case 'critical': return 'var(--danger)';
      case 'high': return 'var(--warning)';
      case 'medium': return '#fbbf24';
      default: return 'var(--success)';
    }
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
      <div className="view-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 className="view-title">Cloud Security Sentinel</h1>
          <p className="view-subtitle">Rust-powered Terraform Security Scanner with LLM Remediation</p>
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
          <Layers size={16} /> Rust + LLM Pipeline
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
            <form onSubmit={handleScan} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div className="input-group">
                <label>Target Terraform Repository / Infrastructure ID</label>
                <div style={{ display: 'flex', gap: '16px' }}>
                  <input 
                    type="text" 
                    value={targetRepo} 
                    onChange={(e) => setTargetRepo(e.target.value)} 
                    placeholder="e.g. prod-gcp-network-tf" 
                    style={{ flex: 1 }}
                  />
                  <button type="submit" className="btn" disabled={isLoading || !targetRepo.trim()} id="cloudsec-submit-btn">
                    {isLoading ? 'Scanning Infrastructure...' : <><Search size={18} /> Initiate Scan</>}
                  </button>
                </div>
              </div>
            </form>

            {result && (
              <div style={{ marginTop: '40px', animation: 'fadeIn 0.5s ease', display: 'flex', flexDirection: 'column', gap: '24px' }}>
                <div style={{ display: 'flex', gap: '16px' }}>
                  <div className="glass" style={{ padding: '24px', flex: 1, textAlign: 'center' }}>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Status</div>
                    <div style={{ fontSize: '1.8rem', fontWeight: 700, color: result.vulnerabilities_found === 0 ? 'var(--success)' : 'var(--danger)', marginTop: '8px' }}>
                      {result.vulnerabilities_found === 0 ? 'Secure' : 'Vulnerable'}
                    </div>
                  </div>
                  <div className="glass" style={{ padding: '24px', flex: 1, textAlign: 'center' }}>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Total Findings</div>
                    <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--text-main)', marginTop: '8px' }}>
                      {result.vulnerabilities_found}
                    </div>
                  </div>
                  <div className="glass" style={{ padding: '24px', flex: 1, textAlign: 'center' }}>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Critical / High</div>
                    <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--warning)', marginTop: '8px' }}>
                      {result.critical_count} / {result.high_count}
                    </div>
                  </div>
                </div>

                {result.details.length > 0 && (
                  <div className="glass" style={{ padding: '24px' }}>
                    <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px', color: 'var(--text-main)' }}>
                      <AlertTriangle size={20} color="var(--warning)" /> Vulnerability Report
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      {result.details.map((vuln) => (
                        <div key={vuln.id} style={{ display: 'flex', gap: '16px', padding: '16px', background: 'var(--bg-card-hover)', borderRadius: '12px', borderLeft: `4px solid ${severityColor(vuln.severity)}` }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                              <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', padding: '4px 8px', borderRadius: '4px', background: 'var(--bg-card)', color: severityColor(vuln.severity) }}>
                                {vuln.severity}
                              </span>
                              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>ID: {vuln.id}</span>
                            </div>
                            <div style={{ fontSize: '1rem', color: 'var(--text-main)', marginBottom: '8px', fontWeight: 600 }}>{vuln.description}</div>
                            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>Resource: {vuln.resource}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {result.exploit_simulation && (
                  <div className="glass" style={{ padding: '24px', border: '1px solid var(--accent-tertiary)' }}>
                    <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px', color: 'var(--accent-tertiary)' }}>
                      <ShieldCheck size={20} /> LLM Exploit Simulation & Remediation
                    </h3>
                    
                    <div style={{ marginBottom: '20px' }}>
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '8px' }}>Target: {result.exploit_simulation.vulnerability_id}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                        <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-main)' }}>Is Exploitable:</span>
                        {result.exploit_simulation.is_exploitable ? 
                          <span style={{ color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: '4px' }}><XCircle size={16}/> YES (Verified via Attack Graph)</span> : 
                          <span style={{ color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '4px' }}><CheckCircle size={16}/> NO (Mitigating Controls Exist)</span>
                        }
                      </div>

                      <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '8px', fontWeight: 600 }}>Simulated Attack Path:</div>
                      <div style={{ padding: '16px', background: 'var(--bg-primary)', borderRadius: '8px', fontSize: '0.95rem', color: 'var(--danger)', fontStyle: 'italic', marginBottom: '24px', borderLeft: '3px solid var(--danger)' }}>
                        "{result.exploit_simulation.simulated_path}"
                      </div>

                      <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '8px', fontWeight: 600 }}>Suggested Terraform HCL Patch:</div>
                      <pre style={{ margin: 0 }}>
                        <code>{result.exploit_simulation.remediation_patch}</code>
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'architecture' && (
          <div className="content-block">
            <h3>Rust Determinism + LLM Heuristics</h3>
            <p>
              Security scanning requires absolute speed and determinism for known vulnerabilities, but heuristic reasoning to determine true exploitability in complex network topologies. We use Rust (Axum) for the blazing fast static analysis, and delegate complex reasoning to the LLM.
            </p>
            <div style={{ margin: '32px 0', padding: '24px', background: 'var(--code-bg)', borderRadius: '12px', border: '1px solid var(--border-subtle)' }}>
              <pre style={{ background: 'transparent', border: 'none', color: 'var(--text-main)', fontSize: '0.9rem', lineHeight: '1.8' }}>
{`[ Terraform Codebase ]
    ↓
[ Rust Axum Backend (Static Scanner) ]
    ├─ Parses HCL files / tfplan JSON in memory (sub 10ms)
    ├─ Flags exact line numbers of misconfigurations (e.g., public GCS bucket)
    └─ Generates deterministic ScanResult
    ↓
    (If critical vulnerability found)
    ↓
[ LLM Exploit Simulator (GPT-4o) ]
    ├─ Analyzes the full context (Is there a WAF in front? Are IAM roles restricted?)
    ├─ Traces an attack graph to confirm true exploitability
    └─ Generates the precise HCL code patch to fix it
    ↓
[ Client Dashboard ]`}
              </pre>
            </div>
          </div>
        )}

        {activeTab === 'tech' && (
          <div className="content-block">
            <h3>Frameworks and Libraries</h3>
            <div style={{ margin: '24px 0', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              <span className="badge primary">Rust (Axum)</span>
              <span className="badge secondary">Tokio (Async Runtime)</span>
              <span className="badge success">Reqwest</span>
              <span className="badge warning">Serde JSON</span>
              <span className="badge tertiary">OpenAI GPT-4o</span>
            </div>
            
            <h4>Why Rust & Axum?</h4>
            <p>
              Python is great for AI prototypes, but when scanning millions of lines of Infrastructure as Code (IaC) in a CI/CD pipeline, memory safety and execution speed are paramount. Axum provides an incredibly fast, concurrent web server backed by the Tokio async runtime, allowing us to process massive terraform plans instantaneously.
            </p>

            <h4>The Value of Agentic Security</h4>
            <p>
              Traditional scanners (like Checkov or tfsec) generate massive amounts of false positives, causing alert fatigue. By adding an LLM agent to simulate the exploit path against the actual infrastructure context, we filter out false positives and provide engineers with ready-to-merge fix code.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
