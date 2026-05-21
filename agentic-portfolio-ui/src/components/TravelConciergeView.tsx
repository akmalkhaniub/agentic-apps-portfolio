import { useState } from 'react';
import { PlaneTakeoff, Calendar, CloudSun, Compass, Search, RefreshCw, Star, Activity } from 'lucide-react';
import { API_ENDPOINTS } from '../config';
import { useInspector } from '../context/InspectorContext';

export default function TravelConciergeView() {
  const { setIsOpen, addTrace } = useInspector();
  const [destination, setDestination] = useState("Paris, France");
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
  const [budget, setBudget] = useState(1500);
  const [interests, setInterests] = useState({
    sightseeing: true,
    food: true,
    culture: true,
    adventure: false
  });
  const [isLoading, setIsLoading] = useState(false);
  const [itinerary, setItinerary] = useState<any>(null);

  const handlePlanTrip = async () => {
    addTrace({ source: 'TravelConciergeView', type: 'log', content: 'Execution started...' });
    setIsLoading(true);
    const interestsList = Object.keys(interests).filter(k => interests[k as keyof typeof interests]);
    
    try {
      // Connect to backend: POST http://localhost:8003/trips/plan
      const response = await fetch(`${API_ENDPOINTS.travelConcierge}/trips/plan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          destination,
          start_date: startDate,
          end_date: endDate,
          budget,
          interests: interestsList
        })
      });
      if (!response.ok) throw new Error("Offline");
      const data = await response.json();
      setItinerary(data);
    } catch (err) {
      console.warn("Backend offline. Running local multi-agent planner simulator.");
      setTimeout(() => {
        // Fallback mock travel coordinator logic
        setItinerary({
          destination,
          budget,
          flights: [
            { airline: "SkyWay Airlines", flight_number: "SW-142", price: 349, departure: "NYC", arrival: destination, departure_time: "08:00 AM", arrival_time: "11:00 AM" },
            { airline: "Global Air", flight_number: "GA-887", price: 275, departure: "NYC", arrival: destination, departure_time: "12:00 PM", arrival_time: "03:30 PM" }
          ],
          hotels: [
            { name: "Grand Plaza Hotel", price_per_night: 189, rating: 4.5, ratingStars: 4 },
            { name: "Budget Inn Express", price_per_night: 89, rating: 3.8, ratingStars: 3 }
          ],
          activities: [
            { name: `Walking Tour of ${destination}`, duration_hours: 3, price: 25, category: "sightseeing" },
            { name: `Local Food Tasting`, duration_hours: 2, price: 55, category: "food" },
            { name: `Museum of History`, duration_hours: 2, price: 15, category: "culture" }
          ],
          weather: {
            condition: "Partly cloudy",
            high: 24,
            low: 16,
            humidity: 55
          }
        });
        setIsLoading(false);
      }, 800);
    }
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
      {/* Dev Mode Banner */}
      <div className="dev-mode-banner">
        <span className="dev-mode-banner-badge">Pending</span>
        <span>Running in Local Development Mode — Listening on port 8003</span>
      </div>

      <div className="view-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 className="view-title">
            <PlaneTakeoff size={32} color="var(--accent-tertiary)" />
            Travel Concierge Agent
          </h1>
          <p className="view-subtitle">End-to-end trip planner coordinating specialists to resolve flights, hotels, and activities</p>
          <div className="pattern-badges-container">
            <span className="pattern-badge">Multi-Agent Collaboration</span>
            <span className="pattern-badge">Routing</span>
          </div>
        </div>
        <button className="btn-ghost" onClick={() => setIsOpen(true)}>
          <Activity size={16} color="var(--accent-secondary)" />
          Inspect Agent Traces
        </button>
      </div>

      <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: 24 }}>
        {/* Planner Search Column */}
        <div className="glass content-block">
          <h3>
            <Compass size={18} color="var(--accent-tertiary)" />
            Itinerary Search Settings
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div className="input-group">
              <label htmlFor="destination-input">Destination</label>
              <input id="destination-input" type="text" value={destination} onChange={(e) => setDestination(e.target.value)} />
            </div>
            <div className="input-group">
              <label htmlFor="budget-input">Budget ($ USD)</label>
              <input id="budget-input" type="number" value={budget} onChange={(e) => setBudget(Number(e.target.value))} />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div className="input-group">
              <label htmlFor="start-date">Start Date</label>
              <input id="start-date" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="input-group">
              <label htmlFor="end-date">End Date</label>
              <input id="end-date" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          </div>
          <div className="input-group">
            <label>Interests & Categories</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 6 }}>
              {Object.keys(interests).map((int) => (
                <label key={int} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: '0.9rem' }}>
                  <input
                    type="checkbox"
                    checked={interests[int as keyof typeof interests]}
                    onChange={(e) => setInterests({ ...interests, [int]: e.target.checked })}
                  />
                  {int.toUpperCase()}
                </label>
              ))}
            </div>
          </div>

          <button className="btn" onClick={handlePlanTrip} disabled={isLoading} style={{ width: '100%', marginTop: 12, background: 'linear-gradient(135deg, #be185d, #f472b6)' }}>
            {isLoading ? <RefreshCw className="spin" size={16} /> : <Search size={16} />}
            {isLoading ? 'Coordinating Agents...' : 'Generate Itinerary'}
          </button>
        </div>

        {/* Board Results Column */}
        <div className="glass content-block" style={{ display: 'flex', flexDirection: 'column' }}>
          <h3>Concierge Recommendation Board</h3>
          {!itinerary && !isLoading ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 250, color: 'var(--text-muted)' }}>
              <Calendar size={48} style={{ opacity: 0.2, marginBottom: 12 }} />
              <p>Configure search options and run concierge optimizer</p>
            </div>
          ) : isLoading ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 250 }}>
              <span className="spin" style={{ fontSize: '2rem', marginBottom: 12 }}>✈️</span>
              <p>Routing to specialist travel agents...</p>
            </div>
          ) : (
            <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 20, maxHeight: 460, overflowY: 'auto', paddingRight: 8 }}>
              {/* Weather info */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-secondary)', padding: '12px 16px', borderRadius: 12, border: '1px solid var(--border-subtle)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <CloudSun size={20} color="var(--warning)" />
                  <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>Local Weather: {itinerary.weather.condition}</span>
                </div>
                <span style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>{itinerary.weather.high}°C / {itinerary.weather.low}°C</span>
              </div>

              {/* Flights Section */}
              <div>
                <h4 style={{ margin: '0 0 8px 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>Recommended Flights</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {itinerary.flights.map((f: any, idx: number) => (
                    <div key={idx} style={{ padding: 10, background: 'var(--bg-secondary)', borderRadius: 10, border: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{f.airline} ({f.flight_number})</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>{f.departure} → {f.arrival} | {f.departure_time} - {f.arrival_time}</div>
                      </div>
                      <span className="badge success" style={{ fontWeight: 'bold' }}>${f.price}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Hotels Section */}
              <div>
                <h4 style={{ margin: '0 0 8px 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>Recommended Hotels</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {itinerary.hotels.map((h: any, idx: number) => (
                    <div key={idx} style={{ padding: 10, background: 'var(--bg-secondary)', borderRadius: 10, border: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{h.name}</div>
                        <div style={{ display: 'flex', gap: 2, marginTop: 4 }}>
                          {[...Array(h.ratingStars)].map((_, i) => <Star key={i} size={10} fill="var(--warning)" stroke="var(--warning)" />)}
                        </div>
                      </div>
                      <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>${h.price_per_night} <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>/ night</span></span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Activities Section */}
              <div>
                <h4 style={{ margin: '0 0 8px 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>Suggested Activities</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {itinerary.activities.map((a: any, idx: number) => (
                    <div key={idx} style={{ padding: 10, background: 'var(--bg-secondary)', borderRadius: 10, border: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{a.name}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>Duration: {a.duration_hours}h | Category: {a.category}</div>
                      </div>
                      <span className="badge primary" style={{ fontWeight: 'bold' }}>{a.price === 0 ? "Free" : `$${a.price}`}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
