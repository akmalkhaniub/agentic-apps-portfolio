import { useState } from 'react';
import { Truck, Navigation, MapPin, ShieldAlert, Activity } from 'lucide-react';
import { API_ENDPOINTS } from '../config';
import { useInspector } from '../context/InspectorContext';

interface Technician {
  id: string;
  name: string;
  lat: number;
  lon: number;
  distance: number;
  status: 'available' | 'dispatched' | 'offline';
}

export default function ServiceDispatchView() {
  const { setIsOpen, addTrace } = useInspector();
  const [description, setDescription] = useState("Burst water main pipe flooding commercial basement floor.");
  const [customerPhone, setCustomerPhone] = useState("+1-555-9012");
  const [lat, setLat] = useState(40.7128); // NYC
  const [lon, setLon] = useState(-74.0060);
  const [isLoading, setIsLoading] = useState(false);
  const [dispatchedTech, setDispatchedTech] = useState<Technician | null>(null);

  const technicians: Technician[] = [
    { id: "tech_01", name: "David Miller (Plumbing Expert)", lat: 40.7150, lon: -74.0110, distance: 0.35, status: 'available' },
    { id: "tech_02", name: "Sarah Connor (HVAC Senior)", lat: 40.7090, lon: -73.9980, distance: 0.52, status: 'available' },
    { id: "tech_03", name: "Marcus Wright (Electrical Lead)", lat: 40.7250, lon: -74.0200, distance: 1.12, status: 'available' }
  ];

  const handleDispatch = async () => {
    addTrace({ source: 'ServiceDispatchView', type: 'log', content: 'Execution started...' });
    setIsLoading(true);
    setDispatchedTech(null);

    try {
      // Connect to backend: POST http://localhost:3001/jobs/emergency
      const response = await fetch(`${API_ENDPOINTS.serviceDispatch}/jobs/emergency`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description, lat, lon, customerPhone })
      });
      if (!response.ok) throw new Error("Offline");
      const data = await response.json();
      
      if (data.status === 'DISPATCHED' && data.technician) {
        setDispatchedTech({
          id: data.technician.id,
          name: data.technician.name,
          lat: data.technician.location.lat,
          lon: data.technician.location.lon,
          distance: 1.5, // Mock distance since backend doesn't explicitly return the calc
          status: 'dispatched'
        });
      } else {
        alert("No technicians available or skilled enough for this emergency.");
      }
      setIsLoading(false);
    } catch (err) {
      console.warn("Backend offline. Simulating Google OR-Tools routing algorithms.");
      setTimeout(() => {
        // Automatically dispatch the nearest technician (tech_01)
        const nearest = technicians[0];
        setDispatchedTech({
          ...nearest,
          status: 'dispatched'
        });
        setIsLoading(false);
      }, 900);
    }
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
      {/* Dev Mode Banner */}
      <div className="dev-mode-banner">
        <span className="dev-mode-banner-badge">Pending</span>
        <span>Running in Local Development Mode — Listening on port 3001</span>
      </div>

      <div className="view-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 className="view-title">
            <Truck size={32} color="var(--warning)" />
            Service Dispatch Coordinator
          </h1>
          <p className="view-subtitle">Geospatial field operation coordinator matching urgent service jobs to technicians using OR-Tools</p>
          <div className="pattern-badges-container">
            <span className="pattern-badge">Heuristic Optimization</span>
            <span className="pattern-badge">Dispatching</span>
          </div>
        </div>
        <button className="btn-ghost" onClick={() => setIsOpen(true)}>
          <Activity size={16} color="var(--accent-secondary)" />
          Inspect Agent Traces
        </button>
      </div>

      <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: 24 }}>
        {/* Emergency Form */}
        <div className="glass content-block">
          <h3>
            <ShieldAlert size={18} color="var(--danger)" />
            Log Emergency Incident
          </h3>
          <div className="input-group">
            <label htmlFor="job-desc">Job Description / Emergency Details</label>
            <textarea
              id="job-desc"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe what happened..."
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div className="input-group">
              <label htmlFor="job-lat">Latitude Coordinate</label>
              <input id="job-lat" type="number" step="0.0001" value={lat} onChange={(e) => setLat(Number(e.target.value))} />
            </div>
            <div className="input-group">
              <label htmlFor="job-lon">Longitude Coordinate</label>
              <input id="job-lon" type="number" step="0.0001" value={lon} onChange={(e) => setLon(Number(e.target.value))} />
            </div>
          </div>
          <div className="input-group">
            <label htmlFor="cust-phone">Customer Contact Phone</label>
            <input id="cust-phone" type="text" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} />
          </div>

          <button className="btn" onClick={handleDispatch} disabled={isLoading} style={{ width: '100%', marginTop: 12, background: 'linear-gradient(135deg, #b45309, #fbbf24)' }}>
            {isLoading ? 'Running Routing Solver...' : 'Dispatch Nearest Technician'}
          </button>
        </div>

        {/* Dispatch Screen / Map SVG */}
        <div className="glass content-block" style={{ display: 'flex', flexDirection: 'column' }}>
          <h3>Technician Route Optimization Map</h3>
          
          {/* Map mockup */}
          <div style={{ background: '#0f172a', height: 180, borderRadius: 14, position: 'relative', overflow: 'hidden', border: '1px solid var(--border-subtle)', marginBottom: 20 }}>
            {/* SVG grid map representation */}
            <svg width="100%" height="100%">
              {/* Grid lines */}
              <defs>
                <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
                  <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#grid)" />

              {/* Draw Route lines if dispatched */}
              {dispatchedTech && (
                <line x1="200" y1="90" x2="120" y2="40" stroke="var(--success)" strokeWidth="3" strokeDasharray="5 3" />
              )}

              {/* Job location */}
              <circle cx="200" cy="90" r="8" fill="var(--danger)" />
              <circle cx="200" cy="90" r="16" fill="none" stroke="var(--danger)" strokeWidth="1.5" className="ping" style={{ transformOrigin: '200px 90px' }} />
              <text x="200" y="115" fill="var(--text-main)" fontSize="10" fontWeight="bold" textAnchor="middle">Emergency Job</text>

              {/* Technicians dots */}
              <circle cx="120" cy="40" r="6" fill={dispatchedTech ? "var(--success)" : "var(--accent-secondary)"} />
              <text x="120" y="30" fill="var(--text-muted)" fontSize="9" textAnchor="middle">David (0.35mi)</text>

              <circle cx="280" cy="50" r="6" fill="var(--accent-secondary)" />
              <text x="280" y="40" fill="var(--text-muted)" fontSize="9" textAnchor="middle">Sarah (0.52mi)</text>
            </svg>
          </div>

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <h4 style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>Technicians Availability Log</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {technicians.map((t) => {
                const isDispatched = dispatchedTech?.id === t.id;
                return (
                  <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', borderRadius: 10, background: 'var(--bg-secondary)', border: isDispatched ? '1px solid var(--success)' : '1px solid var(--border-subtle)' }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{t.name}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                        <MapPin size={10} /> {t.distance} miles away
                      </div>
                    </div>
                    <span className={`badge ${isDispatched ? 'success' : 'muted'}`}>
                      {isDispatched ? 'DISPATCHED' : 'AVAILABLE'}
                    </span>
                  </div>
                );
              })}
            </div>

            {dispatchedTech && (
              <div style={{ padding: 12, borderRadius: 12, background: 'var(--success-glow)', border: '1px solid rgba(16,185,129,0.3)', display: 'flex', gap: 8, alignItems: 'center', marginTop: 10 }}>
                <Navigation size={18} color="var(--success)" />
                <div style={{ fontSize: '0.85rem' }}>
                  <strong>Dispatch Confirmed:</strong> {dispatchedTech.name} has been routed to emergency site. ETA: <strong>11 mins</strong>.
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
