import { useState } from 'react';
import { Stethoscope, HeartPulse, Clock, Check, AlertOctagon, Phone, Activity } from 'lucide-react';
import { API_ENDPOINTS } from '../config';
import { useInspector } from '../context/InspectorContext';

export default function MedicalNurseView() {
  const { setIsOpen, addTrace } = useInspector();
  const [patientName, setPatientName] = useState("Jane Doe");
  const [phone, setPhone] = useState("+1-555-0144");
  const [symptoms, setSymptoms] = useState("I have had a sudden sharp chest pain radiating to my left arm for the past hour and it is hard to catch my breath.");
  const [severity, setSeverity] = useState(8);
  const [duration, setDuration] = useState("1 day");
  const [isLoading, setIsLoading] = useState(false);
  const [triageReport, setTriageReport] = useState<any>(null);
  const [isBooked, setIsBooked] = useState(false);

  const handleTriage = async () => {
    setIsLoading(true);
    setIsBooked(false);
    addTrace({ source: 'MedicalNurse', type: 'log', content: 'Execution started...' });
    try {
      const callId = `sim_call_${Date.now()}`;
      
      // 1. call.started
      await fetch(`${API_ENDPOINTS.medicalNurse}/vapi/webhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: "call.started", call_id: callId })
      });

      // 2. collect_symptoms
      await fetch(`${API_ENDPOINTS.medicalNurse}/vapi/webhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: "function_call",
          call_id: callId,
          function: {
            name: "collect_symptoms",
            arguments: { symptoms: [{ name: symptoms, severity, duration }] }
          }
        })
      });

      // 3. assess_severity
      const triageRes = await fetch(`${API_ENDPOINTS.medicalNurse}/vapi/webhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: "function_call",
          call_id: callId,
          function: { name: "assess_severity", arguments: {} }
        })
      });
      const triageData = await triageRes.json();
      const triage = triageData.result.triage;

      // 4. book_appointment
      const bookRes = await fetch(`${API_ENDPOINTS.medicalNurse}/vapi/webhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: "function_call",
          call_id: callId,
          function: { name: "book_appointment", arguments: { patient_name: patientName, patient_phone: phone } }
        })
      });
      const bookData = await bookRes.json();
      const appointment = bookData.result.appointment;

      // Map to UI expectations
      const triageLevel = triage.level === 'ER' ? 'ER' : triage.level === 'urgent_care' ? 'Urgent Care' : 'Routine';
      const soapNote = 
`[S] SUBJECTIVE: Patient ${patientName} (${phone}) reports ${symptoms}. Severity rated at ${severity}/10. Duration: ${duration}.
[O] OBJECTIVE: Mentally alert, conversant. Speech clear. Vital signs mock: HR 92 bpm, BP 130/85.
[A] ASSESSMENT: Primary triage rating: ${triageLevel}. Reasoning: ${triage.reasoning}
[P] PLAN: Recommended action: ${triage.recommended_action}.`;

      setTriageReport({
        triageLevel,
        action: triage.recommended_action,
        reasoning: triage.reasoning,
        soapNote,
        suggestedTime: new Date(appointment.scheduled_at).toLocaleString()
      });
      setIsLoading(false);

    } catch (err) {
      console.warn("Backend offline. Running local triage expert simulator.");
      setTimeout(() => {
        // Triage categorization
        const symptoms_lower = symptoms.toLowerCase();
        let triageLevel: 'ER' | 'Urgent Care' | 'Routine' = 'Routine';
        let action = "Schedule a routine clinic consultation.";
        let reasoning = "Symptoms indicate a non-acute condition that can be handled during normal clinic hours.";

        if (symptoms_lower.includes("chest pain") || symptoms_lower.includes("breathing") || symptoms_lower.includes("heart") || severity >= 8) {
          triageLevel = 'ER';
          action = "IMMEDIATELY PROCEED TO THE NEAREST EMERGENCY ROOM OR CALL 911.";
          reasoning = "Potential cardiac or pulmonary emergency. Immediate physical evaluation is mandatory.";
        } else if (symptoms_lower.includes("fever") || symptoms_lower.includes("cough") || symptoms_lower.includes("fracture") || severity >= 5) {
          triageLevel = 'Urgent Care';
          action = "Visit an Urgent Care facility within the next 4-6 hours.";
          reasoning = "Symptoms require prompt evaluation to prevent deterioration, but do not appear life-threatening.";
        }

        // SOAP Note generator
        const soapNote = 
`[S] SUBJECTIVE: Patient ${patientName} (${phone}) reports ${symptoms}. Severity rated at ${severity}/10. Duration: ${duration}.
[O] OBJECTIVE: Mentally alert, conversant. Speech clear. Vital signs mock: HR 92 bpm, BP 130/85.
[A] ASSESSMENT: Primary triage rating: ${triageLevel}. Reasoning: ${reasoning}
[P] PLAN: Recommended action: ${action}.`;

        setTriageReport({
          triageLevel,
          action,
          reasoning,
          soapNote,
          suggestedTime: triageLevel === 'ER' ? null : "Today at 3:15 PM"
        });
        setIsLoading(false);
      }, 700);
    }
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
      {/* Dev Mode Banner */}
      <div className="dev-mode-banner">
        <span className="dev-mode-banner-badge">Pending</span>
        <span>Running in Local Development Mode — Listening on port 8002</span>
      </div>

      <div className="view-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 className="view-title">
            <Stethoscope size={32} color="var(--accent-primary)" />
            Medical Intake Nurse
          </h1>
          <p className="view-subtitle">HIPAA-compliant patient intake simulation parsing symptoms into clinical SOAP structures</p>
          <div className="pattern-badges-container">
            <span className="pattern-badge">Tool Use</span>
            <span className="pattern-badge">Function Calling</span>
          </div>
        </div>
        <button className="btn-ghost" onClick={() => setIsOpen(true)}>
          <Activity size={16} color="var(--accent-secondary)" />
          Inspect Agent Traces
        </button>
      </div>

      <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: 24 }}>
        {/* Symptom Form */}
        <div className="glass content-block">
          <h3>
            <Phone size={18} color="var(--accent-primary)" />
            Patient Clinical Intake Form
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div className="input-group">
              <label htmlFor="patient-name">Patient Name</label>
              <input id="patient-name" type="text" value={patientName} onChange={(e) => setPatientName(e.target.value)} />
            </div>
            <div className="input-group">
              <label htmlFor="patient-phone">Phone Number</label>
              <input id="patient-phone" type="text" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div className="input-group">
              <label htmlFor="severity-slider">Severity (1 - 10)</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <input
                  id="severity-slider"
                  type="range"
                  min="1"
                  max="10"
                  value={severity}
                  onChange={(e) => setSeverity(Number(e.target.value))}
                  style={{ flex: 1, padding: 0 }}
                />
                <span style={{ fontWeight: 'bold', minWidth: 20 }}>{severity}</span>
              </div>
            </div>
            <div className="input-group">
              <label htmlFor="duration-select">Duration</label>
              <select id="duration-select" value={duration} onChange={(e) => setDuration(e.target.value)}>
                <option value="1 hour">Less than 2 hours</option>
                <option value="1 day">1 day</option>
                <option value="3 days">3 days</option>
                <option value="1 week">Over a week</option>
              </select>
            </div>
          </div>
          <div className="input-group">
            <label htmlFor="symptoms-input">Describe Symptoms</label>
            <textarea
              id="symptoms-input"
              rows={4}
              value={symptoms}
              onChange={(e) => setSymptoms(e.target.value)}
              placeholder="e.g. pain details, fever, nausea..."
            />
          </div>

          <button className="btn" onClick={handleTriage} disabled={isLoading} style={{ width: '100%', marginTop: 12 }}>
            {isLoading ? 'Processing Triage...' : 'Submit Triage Intake'}
          </button>
        </div>

        {/* Triage Output */}
        <div className="glass content-block" style={{ display: 'flex', flexDirection: 'column' }}>
          <h3>Clinical Assessment Summary</h3>
          {!triageReport && !isLoading ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 250, color: 'var(--text-muted)' }}>
              <HeartPulse size={48} style={{ opacity: 0.2, marginBottom: 12 }} />
              <p>Enter patient symptoms and submit for assessment</p>
            </div>
          ) : isLoading ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 250 }}>
              <span className="spin" style={{ fontSize: '2rem', marginBottom: 12 }}>🩺</span>
              <p>Analyzing clinical severity levels...</p>
            </div>
          ) : (
            <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* Triage Level Banner */}
              <div
                style={{
                  padding: 16,
                  borderRadius: 14,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  background: triageReport.triageLevel === 'ER' ? 'var(--danger-glow)' : triageReport.triageLevel === 'Urgent Care' ? 'var(--warning-glow)' : 'var(--success-glow)',
                  border: `1px solid ${triageReport.triageLevel === 'ER' ? 'rgba(220,38,38,0.3)' : triageReport.triageLevel === 'Urgent Care' ? 'rgba(245,158,11,0.3)' : 'rgba(16,185,129,0.3)'}`
                }}
              >
                <AlertOctagon size={24} color={triageReport.triageLevel === 'ER' ? 'var(--danger)' : triageReport.triageLevel === 'Urgent Care' ? 'var(--warning)' : 'var(--success)'} />
                <div>
                  <div style={{ fontWeight: 700, fontSize: '1.1rem', color: triageReport.triageLevel === 'ER' ? 'var(--danger)' : triageReport.triageLevel === 'Urgent Care' ? 'var(--warning)' : 'var(--success)' }}>
                    TRIAGE LEVEL: {triageReport.triageLevel.toUpperCase()}
                  </div>
                  <div style={{ fontSize: '0.85rem', marginTop: 4, fontWeight: 500 }}>
                    {triageReport.action}
                  </div>
                </div>
              </div>

              {/* Reasoning */}
              <div>
                <h4 style={{ margin: '0 0 6px 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>Clinical Reasoning</h4>
                <p style={{ fontSize: '0.95rem', lineHeight: 1.5 }}>{triageReport.reasoning}</p>
              </div>

              {/* SOAP Note Text */}
              <div>
                <h4 style={{ margin: '0 0 6px 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>Structured SOAP Note Output</h4>
                <pre style={{ margin: 0, padding: 12, fontSize: '0.8rem', background: 'var(--code-bg)', border: '1px solid var(--border-subtle)', borderRadius: 10, whiteSpace: 'pre-wrap' }}>
                  {triageReport.soapNote}
                </pre>
              </div>

              {/* Booking Segment */}
              {triageReport.suggestedTime && (
                <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Suggested Appointment</div>
                    <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                      <Clock size={14} color="var(--accent-primary)" /> {triageReport.suggestedTime}
                    </div>
                  </div>
                  {isBooked ? (
                    <span className="badge success" style={{ padding: '8px 16px' }}><Check size={14} /> Booked</span>
                  ) : (
                    <button className="btn" onClick={() => setIsBooked(true)} style={{ padding: '8px 16px', fontSize: '0.85rem' }}>
                      Book Appointment
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
