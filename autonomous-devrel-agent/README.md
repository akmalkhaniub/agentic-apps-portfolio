# Autonomous DevRel Agent

An AI-powered developer relations agent that monitors community channels, answers technical questions using RAG, drafts missing documentation, and opens pull requests -- all with sandbox-verified code snippets.

## Architecture

```
┌──────────────────────────────────────────────────────────────────────────┐
│                     COMMUNITY CHANNELS                                   │
│          (Slack, Discord, GitHub Discussions)                             │
└─────────────────────────────────┬────────────────────────────────────────┘
                                  │  New question / thread
                                  ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                   LISTENER LAYER (Slack-Bolt / Discord.py)               │
│                                                                          │
│  on_message ──▶ classify intent ──▶ Haystack Pipeline                    │
│                                           │                              │
│                            ┌──────────────┼──────────────┐              │
│                            ▼                             ▼              │
│                  ┌───────────────────┐       ┌───────────────────┐      │
│                  │  RAG LOOKUP       │       │  Milvus           │      │
│                  │                   │       │  Vector DB        │      │
│                  │  Search codebase  │◀─────▶│                   │      │
│                  │  Search docs      │       │  Code embeddings  │      │
│                  │  Search issues    │       │  Doc embeddings   │      │
│                  └────────┬──────────┘       └───────────────────┘      │
│                           │                                              │
│                ┌──────────┼──────────┐                                   │
│                ▼                     ▼                                   │
│         Solution FOUND         Solution MISSING                         │
│         ┌─────────────┐        ┌──────────────┐                        │
│         │ REPLY to     │        │ DRAFT new    │                        │
│         │ user in      │        │ Markdown     │                        │
│         │ channel      │        │ doc page     │                        │
│         └─────────────┘        └──────┬───────┘                        │
│                                       │                                  │
│                                       ▼                                  │
│                              ┌───────────────────┐                      │
│                              │  SANDBOX           │                      │
│                              │  VERIFICATION      │                      │
│                              │                    │                      │
│                              │  Run code snippets │                      │
│                              │  from drafted doc  │                      │
│                              │  Confirm no errors │                      │
│                              └────────┬───────────┘                     │
│                                       │  all snippets pass              │
│                                       ▼                                  │
│                              ┌───────────────────┐                      │
│                              │  OPEN PR           │                      │
│                              │                    │                      │
│                              │  git branch        │                      │
│                              │  commit doc page   │                      │
│                              │  push + PR         │                      │
│                              └───────────────────┘                      │
│                                                                          │
│                       ┌───────────────────┐                              │
│                       │  Giskard           │                              │
│                       │  Agent Evaluation  │                              │
│                       │  (offline QA)      │                              │
│                       └───────────────────┘                              │
└──────────────────────────────────────────────────────────────────────────┘
```

## Tech Stack

| Component | Technology | Purpose |
|-----------|-----------|---------|
| Language | Python | Ecosystem compatibility with ML and NLP tooling |
| Orchestration | Haystack (Deepset) | RAG pipeline construction and execution |
| Vector DB | Milvus | Scalable vector search over code and docs |
| Community | Discord.py / Slack-Bolt | Real-time message listeners |
| Evaluation | Giskard | Automated agent quality testing |
| Version Control | GitHub API | PR creation for new documentation |

## Quick Start

```bash
cd autonomous-devrel-agent
python -m venv venv
venv\Scripts\activate        # Windows
pip install -r requirements.txt
python main.py
```

Configure tokens via environment variables:

```bash
export SLACK_BOT_TOKEN=xoxb-...
export DISCORD_TOKEN=...
export GITHUB_TOKEN=ghp_...
export MILVUS_URI=http://localhost:19530
```

## API Examples

### Ask a question programmatically
```bash
curl -X POST http://localhost:8000/ask \
  -H "Content-Type: application/json" \
  -d '{"question": "How do I configure retry logic in the SDK?", "channel": "slack"}'
```

### Trigger a documentation gap scan
```bash
curl -X POST http://localhost:8000/scan-gaps
```

## Design Decisions

- **Haystack orchestration**: Provides composable pipeline nodes (retriever, reader, generator) that can be swapped without rewriting the agent logic.
- **Sandbox verification**: Every code snippet in a drafted doc page is executed in isolation before PR submission, preventing broken examples from reaching production docs.
- **Milvus over Pinecone**: Self-hosted vector search avoids vendor lock-in and keeps code embeddings within the org's infrastructure boundary.
- **Giskard evaluation**: Offline test suites measure answer faithfulness and relevancy, catching quality regressions before they affect community trust.
