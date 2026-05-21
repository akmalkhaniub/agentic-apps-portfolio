# App 3: "Scientific Data Scientist" Sandbox

## Concept
An autonomous research assistant that handles messy data ingestion, extraction, and rigorous statistical analysis in a sandbox.

## Workflow
1.  **Ingestion:** Ingests messy PDF/DOCX reports or CSV files.
2.  **Structuring:** Uses a Python pipeline to extract key metrics into a structured format.
3.  **Sandbox Analysis:** Spawns a **Docker/E2B sandbox** to run Python scripts (Pandas, SciPy, Matplotlib).
4.  **Verification:** The agent reviews its own charts for anomalies or statistical significance.
5.  **Reporting:** Generates a real-time dashboard or a PDF report summarizing the findings.

## Tech Stack
- **Language:** Python 3.12
- **Agent Framework:** PydanticAI (for type-safe reasoning)
- **Document Parsing:** Docling (IBM) / MarkItDown (Microsoft)
- **Vector DB:** Qdrant (Hybrid Search)
- **Analysis Environment:** Modal.com (Serverless Python GPU/CPUs)
- **Frontend:** Streamlit (for rapid internal dashboarding)
