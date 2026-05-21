# Scientific Research Sandbox

An autonomous research assistant that ingests messy documents (PDF, DOCX, CSV), extracts structured metrics, runs statistical analysis in isolated sandboxes, and generates verified reports with charts.

## Architecture

```
┌──────────────────────────────────────────────────────────────────────────┐
│                        DATA SOURCES                                      │
│          (PDF Reports, DOCX Papers, CSV Datasets, URLs)                  │
└─────────────────────────────────┬────────────────────────────────────────┘
                                  │  Upload / URL
                                  ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                     INGESTION PIPELINE (PydanticAI)                       │
│                                                                          │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────┐                │
│  │  Docling      │   │  MarkItDown  │   │  CSV/Excel   │                │
│  │  (IBM)        │   │  (Microsoft) │   │  Parser      │                │
│  │  PDF ▶ text   │   │  DOCX ▶ md   │   │  raw ▶ df    │                │
│  └──────┬───────┘   └──────┬───────┘   └──────┬───────┘                │
│         └──────────────────┼──────────────────┘                         │
│                            ▼                                             │
│                  ┌───────────────────┐                                   │
│                  │  STRUCTURING      │                                   │
│                  │  AGENT            │                                   │
│                  │                   │                                   │
│                  │  Extract metrics  │                                   │
│                  │  Normalize units  │                                   │
│                  │  Type validation  │                                   │
│                  └────────┬──────────┘                                   │
│                           │                                              │
│                           ▼                                              │
│                  ┌───────────────────┐      ┌───────────────────┐       │
│                  │  Qdrant           │      │  Modal.com        │       │
│                  │  Vector DB        │      │  Sandbox          │       │
│                  │                   │◀────▶│                   │       │
│                  │  Hybrid search    │      │  Pandas, SciPy    │       │
│                  │  over extracted   │      │  Matplotlib       │       │
│                  │  data + metadata  │      │  Isolated GPU/CPU │       │
│                  └───────────────────┘      └────────┬──────────┘       │
│                                                      │                   │
│                                                      ▼                   │
│                                            ┌───────────────────┐        │
│                                            │  VERIFICATION     │        │
│                                            │  AGENT            │        │
│                                            │                   │        │
│                                            │  Review charts    │        │
│                                            │  Check p-values   │        │
│                                            │  Flag anomalies   │        │
│                                            └────────┬──────────┘        │
│                                                     │                    │
│                                          ┌──────────┼──────────┐        │
│                                          ▼                     ▼        │
│                                   ┌────────────┐      ┌────────────┐   │
│                                   │  Streamlit │      │  PDF       │   │
│                                   │  Dashboard │      │  Report    │   │
│                                   └────────────┘      └────────────┘   │
└──────────────────────────────────────────────────────────────────────────┘
```

## Tech Stack

| Component | Technology | Purpose |
|-----------|-----------|---------|
| Language | Python 3.12 | Data science ecosystem compatibility |
| Agent Framework | PydanticAI | Type-safe agent reasoning and validation |
| PDF Parsing | Docling (IBM) | Extract text and tables from PDFs |
| DOCX Parsing | MarkItDown (Microsoft) | Convert Word documents to structured markdown |
| Vector DB | Qdrant | Hybrid search over extracted data and metadata |
| Compute Sandbox | Modal.com | Serverless isolated Python execution (GPU/CPU) |
| Analysis | Pandas, SciPy, Matplotlib | Statistical analysis and chart generation |
| Frontend | Streamlit | Real-time internal dashboarding |

## Quick Start

```bash
cd scientific-research-sandbox
python -m venv venv
venv\Scripts\activate        # Windows
pip install -r requirements.txt
streamlit run app.py
```

## API Examples

### Upload a document for analysis
```bash
curl -X POST http://localhost:8501/api/ingest \
  -F "file=@experiment_results.pdf" \
  -F "analysis_type=statistical_summary"
```

### Query extracted data
```bash
curl http://localhost:8501/api/query \
  -H "Content-Type: application/json" \
  -d '{"question": "What is the mean response time across all trials?"}'
```

## Design Decisions

- **Sandboxed execution**: All user-uploaded data is analyzed inside Modal.com containers, preventing untrusted code or malformed files from affecting the host system.
- **PydanticAI for type safety**: Extracted metrics pass through Pydantic models, catching unit mismatches and schema violations before analysis begins.
- **Self-verification**: The verification agent reviews generated charts for obvious anomalies (e.g., axes with wrong scale, p-values below machine epsilon) before surfacing results.
- **Qdrant hybrid search**: Combines dense vector embeddings with sparse keyword matching, which is critical for scientific data where exact terms (gene names, chemical formulas) matter as much as semantic similarity.
