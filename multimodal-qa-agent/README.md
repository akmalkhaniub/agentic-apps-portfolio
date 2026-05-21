# Multimodal QA Agent

An autonomous visual testing agent that crawls web applications using Playwright, sends screenshots to vision LLMs for UI auditing against brand guidelines, and auto-generates bug reports as GitHub Issues.

## Architecture

```
┌──────────────────────────────────────────────────────────────────────────┐
│                      TARGET APPLICATION                                  │
│               (Staging URL of web app under test)                        │
└──────────────────────────────────▲───────────────────────────────────────┘
                                   │  Playwright crawl
                                   │
┌──────────────────────────────────┼───────────────────────────────────────┐
│                                  │                                       │
│  ┌───────────────────────────────┴───────────────────────────────┐      │
│  │                  EXPLORATION ENGINE (Playwright)               │      │
│  │                                                               │      │
│  │  1. Navigate to target URL                                    │      │
│  │  2. Discover all unique pages / routes                        │      │
│  │  3. Screenshot each page state                                │      │
│  │  4. Capture responsive variants (mobile, tablet, desktop)     │      │
│  └───────────────────────────────┬───────────────────────────────┘      │
│                                  │  screenshots + DOM snapshots          │
│                                  ▼                                       │
│  ┌───────────────────────────────────────────────────────────────┐      │
│  │                  VISUAL AUDIT AGENT                            │      │
│  │                                                               │      │
│  │  ┌─────────────────┐      ┌───────────────────┐              │      │
│  │  │  Vision LLM     │      │  LlamaIndex        │              │      │
│  │  │  (GPT-4o /      │      │  Multi-modal RAG  │              │      │
│  │  │   Claude 3.5)   │      │                   │              │      │
│  │  │                 │◀────▶│  Brand Guidelines  │              │      │
│  │  │  Analyze each   │      │  PDF embeddings   │              │      │
│  │  │  screenshot     │      │  (colors, fonts,  │              │      │
│  │  │                 │      │   spacing rules)  │              │      │
│  │  └────────┬────────┘      └───────────────────┘              │      │
│  │           │                                                   │      │
│  │           ▼                                                   │      │
│  │  Findings:                                                    │      │
│  │    - Misaligned button on /checkout (mobile)                  │      │
│  │    - Broken image on /about                                   │      │
│  │    - "Lorem ipsum" placeholder on /pricing                    │      │
│  │    - Submit button hidden behind footer                       │      │
│  └───────────────────────────────┬───────────────────────────────┘      │
│                                  │  structured findings                  │
│                                  ▼                                       │
│  ┌───────────────────────────────────────────────────────────────┐      │
│  │                  BUG REPORT GENERATOR                         │      │
│  │                                                               │      │
│  │  For each finding:                                            │      │
│  │    1. Attach screenshot with annotation                       │      │
│  │    2. Include DOM path of offending element                   │      │
│  │    3. Severity classification (critical / warning / info)     │      │
│  │    4. Suggested fix                                           │      │
│  └───────────────────────────────┬───────────────────────────────┘      │
│                                  │                                       │
│                                  ▼                                       │
│  ┌───────────────────────────────────────────────────────────────┐      │
│  │                  ISSUE CREATION (Octokit)                     │      │
│  │                                                               │      │
│  │  ┌─────────────────────────────────────────────────────┐     │      │
│  │  │  GitHub Issue #342                                   │     │      │
│  │  │  Title: [Visual Bug] Submit button hidden on mobile  │     │      │
│  │  │  Labels: visual-bug, mobile, critical                │     │      │
│  │  │  Body: screenshot + DOM path + repro steps           │     │      │
│  │  └─────────────────────────────────────────────────────┘     │      │
│  │                                                               │      │
│  │  Also supports: Jira, Linear                                  │      │
│  └───────────────────────────────────────────────────────────────┘      │
└──────────────────────────────────────────────────────────────────────────┘
```

## Tech Stack

| Component | Technology | Purpose |
|-----------|-----------|---------|
| Language | Python 3.12 | ML and automation ecosystem |
| Browser Automation | Playwright | Headless crawling and screenshotting |
| Vision Models | GPT-4o / Claude 3.5 Sonnet | Screenshot analysis and UI defect detection |
| Multi-modal RAG | LlamaIndex | Brand guidelines retrieval for comparison |
| Issue Tracking | Octokit (GitHub API) | Automated bug report creation |
| Backup Automation | Selenium | Fallback browser engine |

## Quick Start

```bash
cd multimodal-qa-agent
python -m venv venv
venv\Scripts\activate        # Windows
pip install -r requirements.txt
playwright install
python run_audit.py --url https://staging.myapp.com
```

Configure via environment variables:

```bash
export OPENAI_API_KEY=...
export ANTHROPIC_API_KEY=...
export GITHUB_TOKEN=ghp_...
export GITHUB_REPO=org/repo
```

## API Examples

### Start a visual audit
```bash
curl -X POST http://localhost:8000/audit \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://staging.myapp.com",
    "viewports": ["mobile", "desktop"],
    "brand_guidelines_id": "bg_corp_v2"
  }'
```

### Get audit results
```bash
curl http://localhost:8000/audits/audit_abc123
```

### List created issues
```bash
curl http://localhost:8000/audits/audit_abc123/issues
```

## Design Decisions

- **Vision LLMs over rule-based checks**: Traditional visual regression tools compare pixels. Vision models understand intent -- they can flag a button that is technically visible but practically unreachable behind overlapping elements.
- **Brand guidelines RAG**: Instead of hardcoding style rules, the agent retrieves relevant brand specs (color palette, font sizes, spacing) from an embedded PDF, adapting to any organization's standards.
- **Playwright over Selenium**: Playwright provides built-in multi-browser support, auto-waiting, and network interception with a cleaner API. Selenium is kept as a fallback.
- **Structured DOM paths**: Each bug report includes the CSS selector path to the offending element, making it immediately actionable for developers without requiring them to reproduce the visual state.
