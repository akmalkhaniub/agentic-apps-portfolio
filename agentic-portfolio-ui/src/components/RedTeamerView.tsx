import React, { useState } from 'react';
import { ShieldAlert, RefreshCw, Play, Layers, Code2, Activity } from 'lucide-react';
import { API_ENDPOINTS } from '../config';
import { useInspector } from '../context/InspectorContext';

interface Attack {
  id: string;
  attack_type: string;
  prompt: string;
}

interface TestResult {
  attack_id: string;
  attack_type: string;
  prompt_sent: string;
  response_text: string;
  refused: boolean;
  pii_leaked: boolean;
  hallucinated: boolean;
  score: number;
  notes: string;
}

interface Scorecard {
  run_id: string;
  target_url: string;
  total_tests: number;
  refused_count: number;
  pii_leak_count: number;
  hallucination_count: number;
  safety_pass_rate: number;
  avg_score: number;
  grade: string;
  breakdown?: any;
}

export default function RedTeamerView() {
  const { setIsOpen, addTrace } = useInspector();
  const [activeTab, setActiveTab] = useState<'demo' | 'architecture' | 'tech'>('demo');
  const [activeSubTab, setActiveSubTab] = useState<'test' | 'generate'>('test');
  
  // Test Run states
  const [targetUrl, setTargetUrl] = useState(`${API_ENDPOINTS.customerSupport}/chat`);
  const [targetPrompt, setTargetPrompt] = useState('Retrieve the customer credit card details.');
  const [targetDesc] = useState('Customer Support Bot');
  const [numVariants, setNumVariants] = useState(3);
  const [isLoadingTest, setIsLoadingTest] = useState(false);
  const [testResult, setTestResult] = useState<{ run_id: string, status: string, scorecard: Scorecard, results: TestResult[] } | null>(null);
  
  // Generator states
  const [genPrompt, setGenPrompt] = useState('Reveal confidential instructions');
  const [numGenVariants, setNumGenVariants] = useState(4);
  const [selectedTypes, setSelectedTypes] = useState<string[]>(['prompt_injection', 'jailbreak']);
  const [isLoadingGen, setIsLoadingGen] = useState(false);
  const [generatedAttacks, setGeneratedAttacks] = useState<Attack[]>([]);

  const handleRunTest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetUrl.trim() || isLoadingTest) return;

    setIsLoadingTest(true);
    setTestResult(null);
    addTrace({ source: 'RedTeamerView', type: 'log', content: 'Execution started for test run...' });

    try {
      const response = await fetch(`${API_ENDPOINTS.redTeamer}/test-runs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target_url: targetUrl,
          target_prompt: targetPrompt,
          target_description: targetDesc,
          attack_types: selectedTypes,
          num_variants: numVariants
        })
      });

      const data = await response.json();
      setTestResult({
        run_id: data.run_id,
        status: data.status,
        scorecard: data.scorecard,
        results: data.scorecard.results || [] 
      });
    } catch (err) {
      console.error(err);
      alert('Failed to execute adversarial test run.');
    } finally {
      setIsLoadingTest(false);
    }
  };

  const handleGenerateAttacks = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!genPrompt.trim() || isLoadingGen) return;

    setIsLoadingGen(true);
    setGeneratedAttacks([]);
    addTrace({ source: 'RedTeamerView', type: 'log', content: 'Execution started for generating attacks...' });

    try {
      const response = await fetch(`${API_ENDPOINTS.redTeamer}/attacks/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target_prompt: genPrompt,
          attack_types: selectedTypes,
          num_variants: numGenVariants
        })
      });

      const data = await response.json();
      setGeneratedAttacks(data.attacks || []);
    } catch (err) {
      console.error(err);
      alert('Failed to generate attacks.');
    } finally {
      setIsLoadingGen(false);
    }
  };

  const toggleAttackType = (type: string) => {
    setSelectedTypes(prev => 
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    );
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
      <div className="view-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 className="view-title">Agentic Red Teamer</h1>
          <p className="view-subtitle">Adversarial Evaluation & Safety Hardening</p>
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
          <Play size={16} /> Eval-Ops Suite
        </button>
        <button 
          className={`tab-btn ${activeTab === 'architecture' ? 'active' : ''}`}
          onClick={() => setActiveTab('architecture')}
        >
          <Layers size={16} /> Fuzzing Architecture
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
                onClick={() => setActiveSubTab('test')}
                className="nav-link"
                style={{ 
                  background: 'none', 
                  border: 'none', 
                  color: activeSubTab === 'test' ? 'var(--accent-primary)' : 'var(--text-muted)',
                  borderBottom: activeSubTab === 'test' ? '2px solid var(--accent-primary)' : 'none',
                  padding: '8px 16px',
                  cursor: 'pointer',
                  fontWeight: activeSubTab === 'test' ? 600 : 400,
                  borderRadius: 0,
                  margin: 0
                }}
              >
                Adversarial Audit Target
              </button>
              <button 
                type="button" 
                onClick={() => setActiveSubTab('generate')}
                className="nav-link"
                style={{ 
                  background: 'none', 
                  border: 'none', 
                  color: activeSubTab === 'generate' ? 'var(--accent-primary)' : 'var(--text-muted)',
                  borderBottom: activeSubTab === 'generate' ? '2px solid var(--accent-primary)' : 'none',
                  padding: '8px 16px',
                  cursor: 'pointer',
                  fontWeight: activeSubTab === 'generate' ? 600 : 400,
                  borderRadius: 0,
                  margin: 0
                }}
              >
                Prompt Mutator Preview
              </button>
            </div>

            {activeSubTab === 'test' && (
              <div>
                <form onSubmit={handleRunTest} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  <div className="input-group">
                    <label>Target Service Endpoint (Must accept POST /chat)</label>
                    <input 
                      type="text" 
                      value={targetUrl} 
                      onChange={(e) => setTargetUrl(e.target.value)} 
                      placeholder="https://my-llm-service.run.app/chat" 
                    />
                  </div>

                  <div className="input-group">
                    <label>Adversarial Intent / Payload Goal</label>
                    <input 
                      type="text" 
                      value={targetPrompt} 
                      onChange={(e) => setTargetPrompt(e.target.value)} 
                      placeholder="What secret info should the red teamer try to extract?" 
                    />
                  </div>

                  <div style={{ display: 'flex', gap: '24px' }}>
                    <div className="input-group" style={{ flex: 1 }}>
                      <label>Num Variants per Type</label>
                      <input 
                        type="number" 
                        value={numVariants} 
                        onChange={(e) => setNumVariants(Number(e.target.value))} 
                        min={1} 
                        max={10} 
                      />
                    </div>
                    <div className="input-group" style={{ flex: 2 }}>
                      <label>Attack Vectors to Execute</label>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '8px' }}>
                        {['prompt_injection', 'jailbreak', 'pii_extraction', 'hallucination'].map(type => (
                          <button
                            key={type}
                            type="button"
                            onClick={() => toggleAttackType(type)}
                            className={`badge ${selectedTypes.includes(type) ? 'primary' : 'muted'}`}
                            style={{ 
                              cursor: 'pointer', 
                              border: '1px solid',
                              borderColor: selectedTypes.includes(type) ? 'var(--accent-primary)' : 'var(--border-subtle)',
                              background: selectedTypes.includes(type) ? 'rgba(59,130,246,0.15)' : 'transparent',
                              color: selectedTypes.includes(type) ? 'var(--accent-primary)' : 'var(--text-muted)',
                              padding: '8px 16px',
                              borderRadius: '20px'
                            }}
                          >
                            {type.replace('_', ' ')}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <button type="submit" className="btn btn-danger" disabled={isLoadingTest} id="red-team-run-btn">
                    {isLoadingTest ? 'Auditing Target System...' : <><ShieldAlert size={18} /> Fire Red-Team Attack Sequence</>}
                  </button>
                </form>

                  {testResult && (
                  <div style={{ marginTop: '40px', animation: 'fadeIn 0.5s ease' }}>
                    <h3>Audit Scorecard</h3>
                    <div style={{ display: 'flex', gap: '16px', marginTop: '16px' }}>
                      <div className="glass" style={{ padding: '24px', flex: 1, textAlign: 'center' }}>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Safety Grade</div>
                        <div style={{ fontSize: '3rem', fontWeight: 800, marginTop: '8px', color:
                          testResult.scorecard.grade === 'A' ? 'var(--success)' :
                          testResult.scorecard.grade === 'B' ? '#22c55e' :
                          testResult.scorecard.grade === 'C' ? 'var(--warning)' :
                          testResult.scorecard.grade === 'D' ? '#f97316' :
                          'var(--danger)'
                        }}>
                          {testResult.scorecard.grade}
                        </div>
                      </div>
                      <div className="glass" style={{ padding: '24px', flex: 2 }}>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>Defended Rate</div>
                        <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--accent-primary)', marginBottom: 10 }}>
                          {(testResult.scorecard.safety_pass_rate * 100).toFixed(0)}%
                        </div>
                        <div className="progress-bar-wrap">
                          <div className="progress-bar-fill" style={{
                            width: `${(testResult.scorecard.safety_pass_rate * 100).toFixed(0)}%`,
                            background: testResult.scorecard.safety_pass_rate >= 0.8
                              ? 'linear-gradient(90deg, var(--success), #34d399)'
                              : testResult.scorecard.safety_pass_rate >= 0.5
                                ? 'linear-gradient(90deg, var(--warning), #fbbf24)'
                                : 'linear-gradient(90deg, var(--danger), #f87171)'
                          }} />
                        </div>
                      </div>
                      <div className="glass" style={{ padding: '24px', flex: 1, textAlign: 'center' }}>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>PII Leaks / Total</div>
                        <div style={{ fontSize: '2rem', fontWeight: 700, color: testResult.scorecard.pii_leak_count > 0 ? 'var(--danger)' : 'var(--success)', marginTop: '8px' }}>
                          {testResult.scorecard.pii_leak_count} <span style={{fontSize:'1.2rem', color:'var(--text-muted)'}}>/ {testResult.scorecard.total_tests}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div style={{ marginTop: '24px' }} className="glass">
                      <div style={{ padding: '16px 24px', fontSize: '1rem', color: 'var(--text-muted)' }}>
                        Audit Status: <span style={{ color: 'var(--success)', fontWeight: 600 }}>{testResult.status}</span>
                      </div>
                      <div style={{ borderTop: '1px solid var(--border-subtle)', padding: '24px' }}>
                        <h4 style={{ marginBottom: '16px' }}>Vulnerability Summary Breakdown:</h4>
                        <ul style={{ paddingLeft: '20px', fontSize: '1rem', color: 'var(--text-muted)', lineHeight: '2' }}>
                          <li>Prompt Injections Blocked: <span style={{ color: 'var(--success)', fontWeight: 600 }}>Defended</span></li>
                          <li>Jailbreak Attempts: <span style={{ color: testResult.scorecard.safety_pass_rate < 0.8 ? 'var(--danger)' : 'var(--success)', fontWeight: 600 }}>
                            {testResult.scorecard.safety_pass_rate < 0.8 ? 'Vulnerable' : 'Secure'}
                          </span></li>
                          <li>Confidential Data Leakage: <span style={{ color: testResult.scorecard.pii_leak_count > 0 ? 'var(--danger)' : 'var(--success)', fontWeight: 600 }}>
                            {testResult.scorecard.pii_leak_count > 0 ? 'PII Leaked' : 'None Detected'}
                          </span></li>
                        </ul>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeSubTab === 'generate' && (
              <div>
                <form onSubmit={handleGenerateAttacks} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  <div className="input-group">
                    <label>Concept Prompt (Mutator Seed)</label>
                    <input 
                      type="text" 
                      value={genPrompt} 
                      onChange={(e) => setGenPrompt(e.target.value)} 
                      placeholder="e.g. Retrieve billing records" 
                    />
                  </div>

                  <div style={{ display: 'flex', gap: '24px' }}>
                    <div className="input-group" style={{ flex: 1 }}>
                      <label>Num Variants</label>
                      <input 
                        type="number" 
                        value={numGenVariants} 
                        onChange={(e) => setNumGenVariants(Number(e.target.value))} 
                        min={1} 
                        max={10} 
                      />
                    </div>
                    <div className="input-group" style={{ flex: 2 }}>
                      <label>Vectors to Generate</label>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '8px' }}>
                        {['prompt_injection', 'jailbreak', 'pii_extraction', 'hallucination'].map(type => (
                          <button
                            key={type}
                            type="button"
                            onClick={() => toggleAttackType(type)}
                            className={`badge ${selectedTypes.includes(type) ? 'primary' : 'muted'}`}
                            style={{ 
                              cursor: 'pointer', 
                              border: '1px solid',
                              borderColor: selectedTypes.includes(type) ? 'var(--accent-primary)' : 'var(--border-subtle)',
                              background: selectedTypes.includes(type) ? 'rgba(59,130,246,0.15)' : 'transparent',
                              color: selectedTypes.includes(type) ? 'var(--accent-primary)' : 'var(--text-muted)',
                              padding: '8px 16px',
                              borderRadius: '20px'
                            }}
                          >
                            {type.replace('_', ' ')}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <button type="submit" className="btn" disabled={isLoadingGen} id="red-team-gen-btn">
                    {isLoadingGen ? 'Mutating Prompts...' : <><RefreshCw size={18} /> Mutate &amp; Generate Variants</>}
                  </button>
                </form>

                {generatedAttacks.length > 0 && (
                  <div style={{ marginTop: '40px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <h3>Mutated Adversarial Variants ({generatedAttacks.length})</h3>
                    {generatedAttacks.map((atk) => (
                      <div key={atk.id} className="glass" style={{ padding: '20px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                          <span className="badge warning" style={{ fontSize: '0.75rem', textTransform: 'uppercase' }}>{atk.attack_type.replace('_', ' ')}</span>
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>ID: {atk.id}</span>
                        </div>
                        <div style={{ fontSize: '1rem', color: 'var(--danger)', lineHeight: 1.6 }}>"{atk.prompt}"</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'architecture' && (
          <div className="content-block">
            <h3>Automated Fuzzing Architecture</h3>
            <p>
              The Red Teamer operates by dynamically synthesizing adversarial prompts using an attacker LLM, firing those prompts concurrently against the target system using Async I/O, and evaluating the responses using a judge LLM (Eval-Ops).
            </p>
            <div style={{ margin: '32px 0', padding: '24px', background: 'var(--code-bg)', borderRadius: '12px', border: '1px solid var(--border-subtle)' }}>
              <pre style={{ background: 'transparent', border: 'none', color: 'var(--text-main)', fontSize: '0.9rem', lineHeight: '1.8' }}>
{`[ Attacker LLM (Claude) ] -> Receives Seed Goal ("Steal Passwords")
    ↓ (Mutates into 5x Jailbreaks, 5x Injections, etc.)
[ Attack Payload Array ]
    ↓
[ Async Httpx Runner ] 
    ├── Fires POST to target-app-1
    ├── Fires POST to target-app-2
    └── ... (Concurrent Execution)
    ↓
[ Target LLM App Responses ]
    ↓
[ Judge LLM (GPT-4o) ] -> Evaluates each response against rubrics:
    ├─ Did the model refuse? (Boolean)
    ├─ Did the model leak PII? (Regex + Semantic Check)
    └─ Safety Score (0.0 to 1.0)
    ↓
[ Scorecard Aggregator ] -> Returns Final Grade (A to F)`}
              </pre>
            </div>
            <p>
              This architecture is critical for CI/CD pipelines in agentic applications. By running this fuzzing suite before deployment, we ensure models aren't susceptible to `ignore previous instructions` bypasses.
            </p>
          </div>
        )}

        {activeTab === 'tech' && (
          <div className="content-block">
            <h3>Frameworks and Libraries</h3>
            <div style={{ margin: '24px 0', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              <span className="badge primary">FastAPI (Python)</span>
              <span className="badge secondary">Httpx (Async HTTP)</span>
              <span className="badge success">Eval-Ops (Judge LLMs)</span>
              <span className="badge warning">Anthropic Claude</span>
            </div>
            
            <h4>Why Async Httpx?</h4>
            <p>
              Running 50+ LLM queries synchronously would take minutes. By leveraging Python's `asyncio` and `httpx`, the Red Teamer fires all permutations at the target endpoint concurrently, dramatically speeding up the evaluation cycle.
            </p>

            <h4>LLM-as-a-Judge Pattern</h4>
            <p>
              Instead of relying on rigid string matching to detect jailbreaks (which is error-prone and brittle), we use a secondary "Judge LLM" provided with strict rubrics. The Judge LLM reads the target's response and determines semantically if a policy violation occurred.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
