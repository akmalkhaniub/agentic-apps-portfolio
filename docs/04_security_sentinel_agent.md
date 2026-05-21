# App 4: "Cloud Security Sentinel" (Auto-Patching)

## Concept
An agent that proactively monitors AWS infrastructure, detects vulnerabilities, and proposes/deploys patches.

## Workflow
1.  **Monitoring:** Continuously scans AWS CloudWatch logs and VPC configurations.
2.  **Detection:** Identifies risks (e.g., "Publicly accessible S3 bucket with sensitive tags").
3.  **Investigation:** Runs a "Simulation" in a sandbox to see if the vulnerability is exploitable.
4.  **Patching:** Generates a Terraform/CDK diff to fix the issue.
5.  **Deployment:** Pushes the fix after a human "Approve" signal from Slack.

## Tech Stack
- **Language:** Rust
- **Backend:** Axum (Memory Safe & Fast)
- **Logging/Analytics:** ClickHouse (OLAP for millions of logs)
- **Infrastructure:** AWS SDK for Rust
- **Agent Framework:** AutoGen (Multi-agent collaboration)
- **Notification:** Amazon SNS
