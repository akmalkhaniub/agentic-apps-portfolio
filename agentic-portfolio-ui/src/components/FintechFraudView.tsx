import { useState } from 'react';
import { Banknote, AlertTriangle, ShieldCheck, Activity, ShieldX, Play } from 'lucide-react';
import { API_ENDPOINTS } from '../config';
import { useInspector } from '../context/InspectorContext';

interface Transaction {
  userId: string;
  cardNumber: string;
  amount: number;
  merchant: string;
  location: string;
  time: string;
}

interface FraudAlert {
  id: string;
  transaction: Transaction;
  riskScore: number;
  level: 'Low' | 'Medium' | 'High' | 'Critical';
  signals: string[];
  status: 'Unresolved' | 'Approved' | 'Card Frozen' | 'Escalated';
}

export default function FintechFraudView() {
  const { setIsOpen, addTrace } = useInspector();
  const [userId, setUserId] = useState("user_983");
  const [amount, setAmount] = useState(1250);
  const [location, setLocation] = useState("London, UK");
  const [merchant, setMerchant] = useState("Crypto ATM");
  const [cardNumber, setCardNumber] = useState("4111-XXXX-XXXX-9021");
  const [isLoading, setIsLoading] = useState(false);
  const [alerts, setAlerts] = useState<FraudAlert[]>([
    {
      id: "alert_01",
      transaction: { userId: "user_102", cardNumber: "5521-XXXX-XXXX-0012", amount: 6200, merchant: "Gold Bullion Store", location: "Zurich, CH", time: "02:14 AM" },
      riskScore: 92,
      level: 'Critical',
      signals: ["high_amount", "unusual_location", "odd_hours"],
      status: 'Unresolved'
    },
    {
      id: "alert_02",
      transaction: { userId: "user_441", cardNumber: "4532-XXXX-XXXX-8821", amount: 450, merchant: "Electronics Ltd", location: "New York, USA", time: "11:45 AM" },
      riskScore: 35,
      level: 'Medium',
      signals: ["high_amount"],
      status: 'Approved'
    }
  ]);

  const handleIngest = async () => {
    setIsLoading(true);
    addTrace({ source: 'FintechFraudView', type: 'log', content: 'Execution started for transaction ingestion...' });
    const newTx: Transaction = {
      userId,
      cardNumber,
      amount: Number(amount),
      merchant,
      location,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    try {
      // Connect to backend: POST http://localhost:8081/transactions
      const response = await fetch(`${API_ENDPOINTS.fintechFraud}/transactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          card_last4: cardNumber.slice(-4),
          amount: Number(amount),
          currency: "USD",
          merchant: merchant,
          location: location
        })
      });
      if (!response.ok) throw new Error("Offline");
      const data = await response.json();
      
      // Map Go backend response to UI state
      const mappedAlert: FraudAlert = {
        id: data.id,
        transaction: newTx,
        riskScore: data.risk_score * 100, // Go returns 0.85
        level: data.risk_level.charAt(0).toUpperCase() + data.risk_level.slice(1) as any,
        signals: data.signals || [],
        status: data.status === 'pending' ? 'Unresolved' : data.status as any
      };
      setAlerts(prev => [mappedAlert, ...prev]);
    } catch (err) {
      console.warn("Backend offline. Simulating transaction ingestion and risk engine logic.");
      setTimeout(() => {
        // Run Risk Evaluation Rules locally
        const signals: string[] = [];
        let score = 5;

        if (amount > 1000) {
          signals.push("high_amount");
          score += 40;
        }
        if (location !== "New York, USA" && location !== "London, UK") {
          signals.push("unusual_location");
          score += 35;
        }
        if (merchant.toLowerCase().includes("crypto") || merchant.toLowerCase().includes("atm")) {
          signals.push("high_risk_merchant");
          score += 20;
        }

        let level: 'Low' | 'Medium' | 'High' | 'Critical' = 'Low';
        if (score >= 80) level = 'Critical';
        else if (score >= 50) level = 'High';
        else if (score >= 25) level = 'Medium';

        const newAlert: FraudAlert = {
          id: `alert_${Math.floor(100 + Math.random() * 900)}`,
          transaction: newTx,
          riskScore: score,
          level,
          signals,
          status: 'Unresolved'
        };

        setAlerts(prev => [newAlert, ...prev]);
        setIsLoading(false);
      }, 600);
    }
  };

  const handleResolve = async (id: string, action: 'Approved' | 'Card Frozen' | 'Escalated') => {
    // Map UI action to backend outcome
    const outcome = action === 'Approved' ? 'confirmed_legit' : action === 'Card Frozen' ? 'confirmed_fraud' : 'escalated';
    
    try {
      const response = await fetch(`${API_ENDPOINTS.fintechFraud}/alerts/${id}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ outcome, verified_by: "agent" })
      });
      if (response.ok) {
        setAlerts(prev => prev.map(a => a.id === id ? { ...a, status: action } : a));
      } else {
        throw new Error("Backend offline");
      }
    } catch (err) {
      console.warn("Backend offline. Simulating alert resolution.");
      setAlerts(prev => prev.map(a => a.id === id ? { ...a, status: action } : a));
    }
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
      {/* Dev Mode Banner */}
      <div className="dev-mode-banner">
        <span className="dev-mode-banner-badge">Pending</span>
        <span>Running in Local Development Mode — Listening on port 8081</span>
      </div>

      <div className="view-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 className="view-title">
            <Banknote size={32} color="var(--success)" />
            FinTech Fraud Mitigator
          </h1>
          <p className="view-subtitle">Graph-based transaction inspection engine utilizing real-time anomaly detection</p>
          <div className="pattern-badges-container">
            <span className="pattern-badge">Algorithmic Delegation</span>
            <span className="pattern-badge">Graph Anomalies</span>
          </div>
        </div>
        <button className="btn-ghost" onClick={() => setIsOpen(true)}>
          <Activity size={16} color="var(--accent-secondary)" />
          Inspect Agent Traces
        </button>
      </div>

      <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: 24 }}>
        {/* Transaction Simulator */}
        <div className="glass content-block">
          <h3>
            <Activity size={18} color="var(--success)" />
            Transaction Ingestion Simulator
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div className="input-group">
              <label htmlFor="user-id">User ID</label>
              <input id="user-id" type="text" value={userId} onChange={(e) => setUserId(e.target.value)} />
            </div>
            <div className="input-group">
              <label htmlFor="card-number">Card Number</label>
              <input id="card-number" type="text" value={cardNumber} onChange={(e) => setCardNumber(e.target.value)} />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div className="input-group">
              <label htmlFor="amount">Amount ($ USD)</label>
              <input id="amount" type="number" value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
            </div>
            <div className="input-group">
              <label htmlFor="location">Location</label>
              <input id="location" type="text" value={location} onChange={(e) => setLocation(e.target.value)} />
            </div>
          </div>
          <div className="input-group">
            <label htmlFor="merchant">Merchant</label>
            <input id="merchant" type="text" value={merchant} onChange={(e) => setMerchant(e.target.value)} />
          </div>

          <button className="btn" onClick={handleIngest} disabled={isLoading} style={{ width: '100%', marginTop: 12, background: 'linear-gradient(135deg, #16a34a, #22c55e)' }}>
            {isLoading ? <span className="spin">🔄</span> : <Play size={16} />}
            {isLoading ? 'Processing Ingestion...' : 'Ingest Transaction'}
          </button>

          {/* Graph Visualizer SVG */}
          <div style={{ marginTop: 24, padding: 16, background: 'rgba(0,0,0,0.15)', borderRadius: 16, textAlign: 'center' }}>
            <h4 style={{ margin: '0 0 12px 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>Graph Relational Risk Visualizer</h4>
            <svg width="100%" height="120" viewBox="0 0 400 120" style={{ overflow: 'visible' }}>
              {/* Lines */}
              <line x1="80" y1="60" x2="200" y2="60" stroke={amount > 1000 ? "var(--danger)" : "var(--border-highlight)"} strokeWidth="2" strokeDasharray={amount > 1000 ? "4 2" : "0"} />
              <line x1="200" y1="60" x2="320" y2="60" stroke={amount > 1000 ? "var(--danger)" : "var(--border-highlight)"} strokeWidth="2" />
              {/* User Node */}
              <circle cx="80" cy="60" r="22" fill="var(--bg-secondary)" stroke="var(--accent-primary)" strokeWidth="2" />
              <text x="80" y="64" fill="var(--text-main)" fontSize="9" textAnchor="middle" fontWeight="bold">User</text>
              {/* Card Transaction Node */}
              <circle cx="200" cy="60" r="28" fill="var(--bg-secondary)" stroke={amount > 1000 ? "var(--danger)" : "var(--success)"} strokeWidth="2" />
              <text x="200" y="64" fill="var(--text-main)" fontSize="9" textAnchor="middle" fontWeight="bold">Tx: ${amount}</text>
              {/* Merchant Node */}
              <circle cx="320" cy="60" r="22" fill="var(--bg-secondary)" stroke="var(--accent-secondary)" strokeWidth="2" />
              <text x="320" y="64" fill="var(--text-main)" fontSize="9" textAnchor="middle" fontWeight="bold">Store</text>
            </svg>
          </div>
        </div>

        {/* Live Fraud Alerts Grid */}
        <div className="glass content-block" style={{ display: 'flex', flexDirection: 'column' }}>
          <h3>
            <AlertTriangle size={18} color="var(--warning)" />
            Real-time Fraud Alerts Console
          </h3>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 16, overflowY: 'auto', maxHeight: 460 }}>
            {alerts.map((alert) => (
              <div key={alert.id} className="glass" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12, borderLeft: `4px solid ${alert.status !== 'Unresolved' ? 'var(--border-highlight)' : alert.level === 'Critical' ? 'var(--danger)' : 'var(--warning)'}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>{alert.id.toUpperCase()}</span>
                    <span className={`badge ${alert.level === 'Critical' ? 'danger' : alert.level === 'High' ? 'warning' : 'primary'}`}>
                      {alert.level} ({alert.riskScore}%)
                    </span>
                  </div>
                  <span className={`badge ${alert.status === 'Approved' ? 'success' : alert.status === 'Card Frozen' ? 'danger' : alert.status === 'Escalated' ? 'warning' : 'muted'}`}>
                    {alert.status}
                  </span>
                </div>

                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                  <div><strong>User:</strong> {alert.transaction.userId}</div>
                  <div><strong>Location:</strong> {alert.transaction.location}</div>
                  <div><strong>Amount:</strong> ${alert.transaction.amount} USD</div>
                  <div><strong>Merchant:</strong> {alert.transaction.merchant}</div>
                </div>

                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {alert.signals.map(s => (
                    <span key={s} className="badge danger" style={{ fontSize: '0.65rem' }}>⚠️ {s}</span>
                  ))}
                </div>

                {alert.status === 'Unresolved' && (
                  <div style={{ display: 'flex', gap: 8, borderTop: '1px solid var(--border-subtle)', paddingTop: 10 }}>
                    <button className="btn-ghost" onClick={() => handleResolve(alert.id, 'Approved')} style={{ flex: 1, padding: '6px 12px', fontSize: '0.8rem' }}>
                      <ShieldCheck size={14} color="var(--success)" /> Approve
                    </button>
                    <button className="btn-ghost" onClick={() => handleResolve(alert.id, 'Card Frozen')} style={{ flex: 1, padding: '6px 12px', fontSize: '0.8rem' }}>
                      <ShieldX size={14} color="var(--danger)" /> Freeze Card
                    </button>
                    <button className="btn-ghost" onClick={() => handleResolve(alert.id, 'Escalated')} style={{ flex: 1, padding: '6px 12px', fontSize: '0.8rem' }}>
                      Escalate
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
