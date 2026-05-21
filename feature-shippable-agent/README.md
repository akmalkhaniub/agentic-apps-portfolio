# Feature Shippable Agent

An autonomous coding agent that takes a high-level requirement and delivers a tested, shippable Pull Request — including implementation, test execution, self-correction, and PR submission.

## Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                    USER / CI TRIGGER                                  │
│          POST /requirements { requirement, owner, repo }             │
└───────────────────────────┬──────────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────────────┐
│                     NestJS APPLICATION                                │
│                                                                      │
│  RequirementController ──▶ AgentService.runAgent()                   │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │                  LangGraph STATE MACHINE                       │  │
│  │                                                                │  │
│  │   ┌──────────┐    ┌─────────────┐    ┌──────────────┐        │  │
│  │   │ ANALYZE  │───▶│ IMPLEMENT   │───▶│    TEST      │        │  │
│  │   │          │    │             │    │              │        │  │
│  │   │ Parse    │    │ Generate    │    │ Run suite    │        │  │
│  │   │ require- │    │ code across │    │ in sandbox   │        │  │
│  │   │ ment via │    │ multiple    │    │              │        │  │
│  │   │ GPT-4o   │    │ files       │    │ npm test     │        │  │
│  │   └──────────┘    └─────────────┘    └──────┬───────┘        │  │
│  │                                              │                │  │
│  │                              ┌───────────────┤                │  │
│  │                              │               │                │  │
│  │                         FAIL │          PASS │                │  │
│  │                    (iter < 5)│               │                │  │
│  │                              ▼               ▼                │  │
│  │                       ┌──────────┐    ┌──────────┐           │  │
│  │                       │   FIX    │    │   SHIP   │           │  │
│  │                       │          │    │          │           │  │
│  │                       │ Feed err │    │ Create   │           │  │
│  │                       │ back to  │    │ PR via   │           │  │
│  │                       │ LLM, re- │    │ GitHub   │           │  │
│  │                       │ generate │    │ API      │           │  │
│  │                       └────┬─────┘    └──────────┘           │  │
│  │                            │                                  │  │
│  │                            └──▶ back to TEST                  │  │
│  │                                                                │  │
│  │   State: { requirement, repo, files, testResults, iterations } │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────────┐    │
│  │ GithubService   │  │ SandboxService  │  │ Prisma + PG      │    │
│  │                 │  │                 │  │                  │    │
│  │ • Clone repo    │  │ • E2B micro-VM  │  │ • Task tracking  │    │
│  │ • Create branch │  │ • Install deps  │  │ • Run history    │    │
│  │ • Open PR       │  │ • Execute tests │  │ • PR metadata    │    │
│  │ • Commit files  │  │ • Collect output│  │                  │    │
│  └─────────────────┘  └─────────────────┘  └──────────────────┘    │
└──────────────────────────────────────────────────────────────────────┘
```

## Self-Correction Loop Detail

```
       ┌─────────────────────────────┐
       │                             │
       ▼                             │
  ┌─────────┐   FAIL + iter < 5  ┌──┴──────┐
  │  TEST   │───────────────────▶│   FIX   │
  │ (E2B)   │                    │ (GPT-4o)│
  └────┬────┘                    └─────────┘
       │
       │ PASS or iter ≥ 5
       ▼
  ┌─────────┐
  │  SHIP   │──▶ GitHub PR
  └─────────┘
```

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Backend | NestJS (TypeScript) | Modular service architecture |
| Agent Logic | LangGraph.js | State machine with conditional edges |
| LLM | GPT-4o | Code generation and error analysis |
| Sandbox | E2B SDK | Isolated micro-VMs for safe code execution |
| VCS | Octokit / GitHub API | Clone, branch, commit, PR creation |
| Database | Prisma + PostgreSQL | Task tracking and run history |

## Project Structure

```
src/
├── main.ts                    # NestJS bootstrap
├── app.module.ts              # Root module
├── agent/
│   ├── agent.module.ts
│   └── agent.service.ts       # LangGraph workflow: analyze → implement → test → fix → ship
├── github/
│   ├── github.module.ts
│   └── github.service.ts      # Octokit wrapper: clone, branch, commit, PR
├── requirement/
│   ├── requirement.module.ts
│   ├── requirement.controller.ts  # POST /requirements endpoint
│   └── requirement.service.ts
├── sandbox/
│   ├── sandbox.module.ts
│   └── sandbox.service.ts     # E2B SDK: spawn VM, run commands, collect output
└── prisma/
    └── schema.prisma
```

## Quick Start

```bash
# Install dependencies
npm install

# Set up environment
cp .env.example .env
# Fill in: OPENAI_API_KEY, GITHUB_TOKEN, E2B_API_KEY, DATABASE_URL

# Run database migrations
npx prisma migrate dev

# Start the agent
npm run dev
```

## API

### `POST /requirements`

```json
{
  "requirement": "Add a forgot password link to the login page",
  "owner": "myorg",
  "repo": "myapp"
}
```

Response:
```json
{
  "prUrl": "https://github.com/myorg/myapp/pull/42",
  "iterations": 2,
  "filesChanged": ["src/pages/login.tsx", "src/api/auth.ts"]
}
```

## Design Decisions

- **LangGraph state machine**: Explicit nodes and edges make the workflow debuggable and extensible — add a "review" node without rewriting the pipeline.
- **E2B sandboxing**: Code runs in isolated micro-VMs, not on the host. Safe to execute untrusted generated code.
- **Self-correction cap**: Max 5 iterations prevents infinite loops on fundamentally broken requirements.
- **NestJS modules**: Each concern (GitHub, sandbox, agent logic) is a separate injectable module — easy to test and swap implementations.
