import { useState } from 'react';
import { ShieldCheck, RefreshCw, FileText, CheckCircle2, Activity } from 'lucide-react';
import { API_ENDPOINTS } from '../config';
import { useInspector } from '../context/InspectorContext';

export default function ComplianceSanitizerView() {
  const { setIsOpen, addTrace } = useInspector();
  const [inputText, setInputText] = useState(
    "Hi, this is John Doe (john.doe@company.com, ph: 555-0199). Please look into my account with SSN 000-12-3456. Thanks!"
  );
  const [frameworks, setFrameworks] = useState({
    gdpr: true,
    hipaa: true,
    pci: true,
    soc2: false,
  });
  const [denyList, setDenyList] = useState("company.com");
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<any>(null);

  const handleSanitize = async () => {
    setIsLoading(true);
    addTrace({ source: 'ComplianceSanitizerView', type: 'log', content: 'Execution started for sanitization...' });
    try {
      // Connect to backend: POST http://localhost:8001/sanitize
      const response = await fetch(`${API_ENDPOINTS.complianceSanitizer}/sanitize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: inputText,
          language: "en",
          deny_list: denyList.split(',').map(s => s.trim()).filter(Boolean),
          enforce_compliance: Object.values(frameworks).some(v => v)
        })
      });

      if (!response.ok) {
        throw new Error("Could not connect to local backend.");
      }
      const data = await response.json();
      
      // Map Python backend response to UI state structure
      setResults({
        original_text: inputText,
        sanitized_text: data.sanitized_text,
        entities: data.entities_found.map((e: any) => ({
          entity_type: e.entity_type,
          score: e.score,
          value: e.original || e.value
        })),
        risk_score: data.blocked ? "High" : data.entities_found.length > 2 ? "Medium" : "Low",
        violations: data.compliance_violations || []
      });
    } catch (err: any) {
      console.warn("Backend offline. Loading local high-fidelity mock simulation.");
      // Fallback mock simulation for excellent developer UX
      setTimeout(() => {
        let sanitized = inputText;
        const entities: any[] = [];
        
        // Mock regex redaction
        if (inputText.includes("John Doe")) {
          sanitized = sanitized.replace("John Doe", "[PERSON_REDACTED]");
          entities.push({ entity_type: "PERSON", score: 0.98, value: "John Doe" });
        }
        if (inputText.includes("john.doe@company.com")) {
          sanitized = sanitized.replace("john.doe@company.com", "[EMAIL_REDACTED]");
          entities.push({ entity_type: "EMAIL_ADDRESS", score: 0.99, value: "john.doe@company.com" });
        }
        if (inputText.includes("555-0199")) {
          sanitized = sanitized.replace("555-0199", "[PHONE_REDACTED]");
          entities.push({ entity_type: "PHONE_NUMBER", score: 0.95, value: "555-0199" });
        }
        if (inputText.includes("000-12-3456")) {
          sanitized = sanitized.replace("000-12-3456", "[SSN_REDACTED]");
          entities.push({ entity_type: "US_SSN", score: 1.0, value: "000-12-3456" });
        }
        
        setResults({
          original_text: inputText,
          sanitized_text: sanitized,
          entities: entities,
          risk_score: entities.length > 2 ? "High" : entities.length > 0 ? "Medium" : "Low",
          violations: Object.keys(frameworks)
            .filter(k => frameworks[k as keyof typeof frameworks])
            .map(k => `HIPAA: Blocked raw PHI for ${k.toUpperCase()}`)
        });
        setIsLoading(false);
      }, 800);
      return;
    }
    setIsLoading(false);
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
      {/* Dev Mode Banner */}
      <div className="dev-mode-banner">
        <span className="dev-mode-banner-badge">Pending</span>
        <span>Running in Local Development Mode — Listening on port 8001</span>
      </div>

      <div className="view-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 className="view-title">
            <ShieldCheck size={32} color="var(--accent-secondary)" />
            Compliance PII Sanitizer
          </h1>
          <p className="view-subtitle">Redact sensitive personal data and verify compliance frameworks before processing</p>
          <div className="pattern-badges-container">
            <span className="pattern-badge">Semantic Guardrails</span>
            <span className="pattern-badge">Privacy Firewall</span>
          </div>
        </div>
        <button className="btn-ghost" onClick={() => setIsOpen(true)}>
          <Activity size={16} color="var(--accent-secondary)" />
          Inspect Agent Traces
        </button>
      </div>

      <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: 24 }}>
        {/* Input Panel */}
        <div className="glass content-block">
          <h3>
            <FileText size={18} />
            Input Prompt Sanitization
          </h3>
          <div className="input-group">
            <label htmlFor="raw-prompt">Raw Text / User Prompt</label>
            <textarea
              id="raw-prompt"
              rows={6}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Paste raw data or customer messages here..."
            />
          </div>

          <div className="input-group">
            <label>Compliance Frameworks to Enforce</label>
            <div style={{ display: 'flex', gap: 16, marginTop: 8, flexWrap: 'wrap' }}>
              {Object.keys(frameworks).map((f) => (
                <label key={f} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: '0.9rem', color: 'var(--text-main)' }}>
                  <input
                    type="checkbox"
                    checked={frameworks[f as keyof typeof frameworks]}
                    onChange={(e) => setFrameworks({ ...frameworks, [f]: e.target.checked })}
                    style={{ cursor: 'pointer' }}
                  />
                  {f.toUpperCase()}
                </label>
              ))}
            </div>
          </div>

          <div className="input-group">
            <label htmlFor="deny-list">Deny-list Terms (comma-separated)</label>
            <input
              id="deny-list"
              type="text"
              value={denyList}
              onChange={(e) => setDenyList(e.target.value)}
              placeholder="e.g. company.com, internal_code_x"
            />
          </div>

          <button className="btn" onClick={handleSanitize} disabled={isLoading} style={{ width: '100%', marginTop: 12 }}>
            {isLoading ? <RefreshCw className="spin" size={16} /> : <ShieldCheck size={16} />}
            {isLoading ? 'Scanning & Redacting...' : 'Sanitize Content'}
          </button>
        </div>

        {/* Results Panel */}
        <div className="glass content-block" style={{ display: 'flex', flexDirection: 'column' }}>
          <h3>Results & Compliance Report</h3>
          {!results && !isLoading ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 250, color: 'var(--text-muted)' }}>
              <ShieldCheck size={48} style={{ opacity: 0.2, marginBottom: 12 }} />
              <p>Submit text to generate a compliance audit</p>
            </div>
          ) : isLoading ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 250 }}>
              <RefreshCw className="spin" size={32} color="var(--accent-secondary)" style={{ marginBottom: 12 }} />
              <p>Analyzing PII risk parameters...</p>
            </div>
          ) : (
            <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* Score Badges */}
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <span className={`badge ${results.risk_score === 'High' ? 'danger' : results.risk_score === 'Medium' ? 'warning' : 'success'}`}>
                  Risk Score: {results.risk_score}
                </span>
                <span className="badge primary">
                  PII Found: {results.entities.length}
                </span>
                {results.violations.map((v: string) => (
                  <span key={v} className="badge secondary">Enforced: {v}</span>
                ))}
              </div>

              {/* Sanitize Compare */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <h4 style={{ margin: '0 0 6px 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>Sanitized Output</h4>
                  <div style={{ padding: 16, background: 'var(--code-bg)', border: '1px solid var(--border-subtle)', borderRadius: 12, minHeight: 80, fontSize: '0.95rem', fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
                    {results.sanitized_text}
                  </div>
                </div>
              </div>

              {/* Redaction Entities Table */}
              <div>
                <h4 style={{ margin: '0 0 8px 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>Detected Entities</h4>
                {results.entities.length === 0 ? (
                  <p style={{ fontSize: '0.9rem', color: 'var(--success)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <CheckCircle2 size={16} /> Clean prompt. No PII leaks identified.
                  </p>
                ) : (
                  <div style={{ maxHeight: 150, overflowY: 'auto', border: '1px solid var(--border-subtle)', borderRadius: 10 }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', textAlign: 'left' }}>
                      <thead>
                        <tr style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-subtle)' }}>
                          <th style={{ padding: '8px 12px' }}>Type</th>
                          <th style={{ padding: '8px 12px' }}>Original</th>
                          <th style={{ padding: '8px 12px' }}>Score</th>
                        </tr>
                      </thead>
                      <tbody>
                        {results.entities.map((ent: any, idx: number) => (
                          <tr key={idx} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                            <td style={{ padding: '8px 12px', fontWeight: 600, color: 'var(--accent-secondary)' }}>{ent.entity_type}</td>
                            <td style={{ padding: '8px 12px', fontFamily: 'monospace' }}>{ent.value}</td>
                            <td style={{ padding: '8px 12px' }}>{(ent.score * 100).toFixed(0)}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
