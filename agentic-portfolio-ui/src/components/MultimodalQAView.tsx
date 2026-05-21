import React, { useState, useRef } from 'react';
import { Upload, Search, Image as ImageIcon, Play, Layers, Code2, Activity } from 'lucide-react';
import { API_ENDPOINTS } from '../config';
import { useInspector } from '../context/InspectorContext';

interface QAData {
  answer: string;
}

export default function MultimodalQAView() {
  const { setIsOpen, addTrace } = useInspector();
  const [activeTab, setActiveTab] = useState<'demo' | 'architecture' | 'tech'>('demo');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [question, setQuestion] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<QAData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result as string);
      };
      reader.readAsDataURL(selectedFile);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !question.trim() || isLoading) return;

    setIsLoading(true);
    setError(null);
    setResult(null);
    
    addTrace({ source: 'MultimodalQA', type: 'log', content: 'Execution started...' });

    const formData = new FormData();
    formData.append('file', file);
    formData.append('question', question);

    try {
      const response = await fetch(`${API_ENDPOINTS.multimodalQA}/api/v1/analyze`, {
        method: 'POST',
        body: formData
      });
      
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || 'Analysis failed');
      
      setResult(data);
    } catch (err: any) {
      console.error(err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
      <div className="view-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 className="view-title">Multimodal QA Agent</h1>
          <p className="view-subtitle">Vision-capable intelligence for image analysis & extraction</p>
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
          <Layers size={16} /> Vision Pipeline
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
            <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '32px' }}>
              <div>
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    border: '2px dashed var(--border-highlight)',
                    borderRadius: '16px',
                    height: '250px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    overflow: 'hidden',
                    background: preview ? 'transparent' : 'var(--input-bg)',
                    position: 'relative'
                  }}
                >
                  {preview ? (
                    <img src={preview} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                  ) : (
                    <div style={{ color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                      <Upload size={32} />
                      <span>Click to upload image (JPG/PNG)</span>
                    </div>
                  )}
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handleFileChange} 
                    accept="image/*" 
                    style={{ display: 'none' }} 
                  />
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div className="input-group" style={{ margin: 0 }}>
                  <label>What would you like to know about this image?</label>
                  <textarea
                    rows={4}
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    placeholder="e.g., 'Extract all the text from this receipt' or 'What is the main subject in this photo?'"
                    disabled={isLoading}
                  />
                </div>
                <button type="submit" className="btn" disabled={isLoading || !file || !question.trim()} id="multimodal-submit-btn">
                  {isLoading ? 'Analyzing Image...' : <><Search size={18} /> Analyze with Vision Model</>}
                </button>
                
                {error && (
                  <div className="glass" style={{ padding: '16px', borderLeft: '4px solid var(--danger)', color: 'var(--danger)' }}>
                    {error}
                  </div>
                )}
              </div>
            </form>

            {result && (
              <div className="glass" style={{ padding: '32px', marginTop: '32px', animation: 'slideUp 0.4s ease' }}>
                <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                  <ImageIcon size={20} color="var(--accent-primary)" /> Vision Analysis Result
                </h3>
                <div style={{ lineHeight: '1.6', whiteSpace: 'pre-wrap', fontSize: '1.05rem' }}>
                  {result.answer}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'architecture' && (
          <div className="content-block">
            <h3>Multimodal Processing Pipeline</h3>
            <p>
              This agent uses base64 encoding to serialize raw image binary data and ship it directly to a Multimodal Vision-Language Model (VLM). This allows the LLM to "see" documents, photographs, UI mockups, and charts with human-level accuracy.
            </p>
            <div style={{ margin: '32px 0', padding: '24px', background: 'var(--code-bg)', borderRadius: '12px', border: '1px solid var(--border-subtle)' }}>
              <pre style={{ background: 'transparent', border: 'none', color: 'var(--text-main)', fontSize: '0.9rem', lineHeight: '1.8' }}>
{`Client (React JS)
    ├─ Validates MIME type (image/png, image/jpeg)
    ├─ Appends to FormData object
    └─ POST /api/v1/analyze

FastAPI Server
    ├─ Read UploadFile binary payload
    ├─ Convert bytes -> base64 string
    ├─ Construct LangChain HumanMessage:
    │     [
    │       {"type": "text", "text": "Extract all text from this receipt."},
    │       {"type": "image_url", "image_url": {"url": "data:image/jpeg;base64,..."}}
    │     ]
    └─ Invoke ChatAnthropic (claude-3-5-sonnet)

LLM Response 
    └─ Parse result & return to Client`}
              </pre>
            </div>
            <p>
              Using Claude 3.5 Sonnet's vision capabilities, this agent is incredibly powerful for OCR tasks, unstructured data extraction (like invoice parsing), and visual reasoning (identifying UX bugs in screenshots).
            </p>
          </div>
        )}

        {activeTab === 'tech' && (
          <div className="content-block">
            <h3>Frameworks and Libraries</h3>
            <div style={{ margin: '24px 0', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              <span className="badge primary">FastAPI (Python)</span>
              <span className="badge secondary">LangChain (Core)</span>
              <span className="badge success">Anthropic Claude 3.5 Sonnet</span>
              <span className="badge warning">Python Base64</span>
            </div>
            
            <h4>Why LangChain?</h4>
            <p>
              LangChain handles the complexity of formatting the multimodal message array. Different providers (OpenAI vs Anthropic vs Google) have slightly different JSON structures for passing images. LangChain's `HumanMessage` abstraction standardizes this, making it trivial to switch from Claude 3.5 to GPT-4o if required.
            </p>

            <h4>File Upload Constraints</h4>
            <p>
              The FastAPI backend relies on `UploadFile` to stream the image into memory instead of saving it to disk. This is a critical security and performance optimization, ensuring the server doesn't leave temporary files behind and processes the request purely in RAM.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
