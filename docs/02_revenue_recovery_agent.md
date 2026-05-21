# App 2: Real-Time "Revenue Recovery" Auditor

## Concept
A multi-agent system that monitors Stripe and Slack to detect and fix subscription leakage or failed payments.

## Workflow
1.  **Event Listening:** Monitors Stripe webhooks for `invoice.payment_failed`.
2.  **User Investigation:** Queries PostgreSQL to check the user's recent login activity and feature usage.
3.  **Autonomous Outreach:**
    - If active: Sends a "Soft nudge" via Slack/Email with an update link.
    - If inactive: Drafts a "Win-back" offer or asks for feedback on why they stopped.
4.  **Action Execution:** If the user responds with "Cancel," the agent calls the Stripe API to terminate the subscription and updates the CRM.

## Tech Stack
- **Language:** Go (Golang)
- **Backend:** Gin Gonic (High Performance)
- **Database:** PostgreSQL + Redis (for event deduplication)
- **Orchestration:** Temporal.io (for reliable long-running workflows)
- **Integrations:** Stripe SDK, Slack Web API
- **Streaming:** NATS (for event-driven communication)
