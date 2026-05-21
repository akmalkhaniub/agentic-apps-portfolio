# App 5: Agentic Customer Support with Tool-Use

## Concept
A support agent that doesn't just "chat" but actually *fixes* customer problems by interacting with company APIs and databases.

## Workflow
1.  **Intent Recognition:** Detects if the user has a fixable problem (e.g., "Where is my refund?").
2.  **Tool Execution:** 
    - Queries the `orders` table in PostgreSQL.
    - Checks the status of the refund in the Stripe API.
3.  **Resolution:** If the refund is stuck, the agent triggers a re-process (with human guardrails for high amounts).
4.  **Closing:** Confirms the resolution to the user and updates the Zendesk/Intercom ticket.

## Tech Stack
- **Language:** Node.js
- **Runtime:** Hono (Edge-ready)
- **Database:** Drizzle ORM + Turso (Edge SQLite)
- **Vector DB:** ChromaDB
- **UI:** Remix (for fast, server-rendered support portals)
- **Integrations:** Vercel AI SDK, Zendesk API
