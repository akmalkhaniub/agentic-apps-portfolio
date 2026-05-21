# App 1: The Autonomous "Feature Shippable" Agent

## Concept
An agent that takes a high-level software requirement and delivers a tested, shippable Pull Request.

## Workflow
1.  **Requirement Analysis:** Parses the user prompt (e.g., "Add a 'forgot password' link").
2.  **Codebase RAG:** Queries a vector DB to understand existing patterns and file structures.
3.  **Sandbox Execution:** Spawns an **E2B sandbox**, clones the repo, and installs dependencies.
4.  **Implementation:** Writes the code across multiple files.
5.  **Self-Correction Loop:**
    - Runs the test suite (`npm test`).
    - Pipes errors back to the LLM.
    - Iterates until tests pass.
6.  **Shipping:** Submits a PR with a comprehensive summary.

## Tech Stack
- **Languages:** TypeScript (Strict Mode)
- **Backend:** NestJS (Modular Architecture)
- **Database:** Prisma + PostgreSQL (Supabase)
- **Agent Logic:** LangGraph.js
- **Sandbox:** E2B SDK (Ubuntu Micro-VMs)
- **Integrations:** GitHub App API / Octokit
