import { useState } from 'react';
import { FlaskConical, BarChart3, MessageSquare, Table, HelpCircle, Activity } from 'lucide-react';
import { useInspector } from '../context/InspectorContext';

export default function ScientificSandboxView() {
  const { setIsOpen } = useInspector();
  const [activeTab, setActiveTab] = useState<'stats' | 'test' | 'chat'>('stats');
  const [dataset] = useState("clinical_trials.csv");
  const [colA, setColA] = useState("dosage_mg");
  const [colB, setColB] = useState("recovery_days");
  const [tTestResult, setTTestResult] = useState<any>(null);
  const [chatInput, setChatInput] = useState("Compare recovery times between low and high dosage groups.");
  const [chatHistory, setChatHistory] = useState<any[]>([
    { role: 'assistant', content: "Hello! I am your Scientific Data Assistant. Ask me anything about `clinical_trials.csv`." }
  ]);
  const [isLoading, setIsLoading] = useState(false);

  const statsData = [
    { metric: "Count", dosage: "150.0", recovery: "150.0", age: "150.0" },
    { metric: "Mean", dosage: "55.40", recovery: "14.22", age: "42.10" },
    { metric: "Std Dev", dosage: "28.12", recovery: "4.85", age: "11.45" },
    { metric: "Min", dosage: "10.0", recovery: "4.0", age: "18.0" },
    { metric: "50% (Median)", dosage: "50.0", recovery: "13.0", age: "41.5" },
    { metric: "Max", dosage: "100.0", recovery: "29.0", age: "72.0" }
  ];

  // 4x4 correlation matrix data
  const corrData = [
    { row: "dosage_mg", cols: [1.0, -0.65, 0.12, -0.05] },
    { row: "recovery_days", cols: [-0.65, 1.0, 0.35, 0.08] },
    { row: "patient_age", cols: [0.12, 0.35, 1.0, 0.14] },
    { row: "symptom_score", cols: [-0.05, 0.08, 0.14, 1.0] }
  ];
  const corrHeaders = ["dosage_mg", "recovery_days", "patient_age", "symptom_score"];

  const handleRunTTest = () => {
    setIsLoading(true);
    setTimeout(() => {
      // Simulate statistical calculation
      const tStat = -3.421;
      const pVal = 0.00084;
      setTTestResult({
        tStat,
        pVal,
        meanA: 12.4,
        meanB: 15.8,
        significant: pVal < 0.05
      });
      setIsLoading(false);
    }, 600);
  };

  const handleSendChat = () => {
    if (!chatInput.trim()) return;
    const userMsg = { role: 'user', content: chatInput };
    setChatHistory(prev => [...prev, userMsg]);
    setChatInput("");
    setIsLoading(true);

    setTimeout(() => {
      let reply = "Based on the correlation matrix and independent sample analysis, we find a strong negative correlation of -0.65 between `dosage_mg` and `recovery_days`. The two-sample T-test returns a statistically significant result (p < 0.001) suggesting that higher dosages correlate with shorter recovery cycles.";
      setChatHistory(prev => [...prev, { role: 'assistant', content: reply }]);
      setIsLoading(false);
    }, 850);
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', height: '80vh', display: 'flex', flexDirection: 'column' }}>
      {/* Dev Mode Banner */}
      <div className="dev-mode-banner">
        <span className="dev-mode-banner-badge">Live</span>
        <span>Running Streamlit Backend via IFrame — Connected to port 8501</span>
      </div>

      <div className="view-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 className="view-title">
            <FlaskConical size={32} color="var(--accent-primary)" />
            Scientific Research Sandbox
          </h1>
          <p className="view-subtitle">Interactive Streamlit research workspace connected to your Python data backend</p>
        </div>
        <button className="btn-ghost" onClick={() => setIsOpen(true)}>
          <Activity size={16} color="var(--accent-secondary)" />
          Inspect Agent Traces
        </button>
      </div>

      <div className="glass content-block" style={{ flex: 1, padding: 0, overflow: 'hidden' }}>
        <iframe 
          src={API_ENDPOINTS.scientificSandbox} 
          width="100%" 
          height="100%" 
          style={{ border: 'none', minHeight: '600px' }} 
          title="Streamlit App"
        />
      </div>
    </div>
  );
}
