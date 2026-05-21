# Cloud Security Sentinel

A proactive security agent built in Rust that continuously monitors AWS infrastructure, detects vulnerabilities, simulates exploitability, and generates Terraform/CDK patches with human-in-the-loop approval via Slack.

## Architecture

```
┌──────────────────────────────────────────────────────────────────────────┐
│                       AWS INFRASTRUCTURE                                 │
│        (CloudWatch Logs, VPC Configs, S3 Buckets, IAM Policies)          │
└─────────────────────────────────┬────────────────────────────────────────┘
                                  │  Continuous polling via AWS SDK
                                  ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                     MONITORING ENGINE (Axum + Rust)                       │
│                                                                          │
│  ┌──────────────────────┐   ┌──────────────────────┐                    │
│  │  CloudWatch Scanner  │   │  VPC Config Auditor  │                    │
│  │  Log anomaly detect  │   │  Security group rules│                    │
│  └──────────┬───────────┘   └──────────┬───────────┘                    │
│             └───────────────┬──────────┘                                 │
│                             ▼                                            │
│                  ┌───────────────────┐                                   │
│                  │  DETECTION AGENT  │                                   │
│                  │  (AutoGen Multi)  │                                   │
│                  │                   │                                   │
│                  │  Public S3?       │                                   │
│                  │  Open ports?      │                                   │
│                  │  Overly permissive│                                   │
│                  │  IAM roles?       │                                   │
│                  └────────┬──────────┘                                   │
│                           │  vulnerability found                         │
│                           ▼                                              │
│                  ┌───────────────────┐                                   │
│                  │  SIMULATION       │                                   │
│                  │  SANDBOX          │                                   │
│                  │                   │                                   │
│                  │  Can this vuln    │                                   │
│                  │  be exploited?    │                                   │
│                  │  Isolated test    │                                   │
│                  └────────┬──────────┘                                   │
│                           │  exploitable = true                          │
│                           ▼                                              │
│          ┌───────────────────────────────────┐                          │
│          │  PATCH GENERATOR                   │                          │
│          │                                    │                          │
│          │  Generate Terraform / CDK diff     │──▶ ClickHouse           │
│          │  to remediate the vulnerability    │    (log all findings)    │
│          └──────────────┬─────────────────────┘                          │
│                         │                                                │
│                         ▼                                                │
│          ┌───────────────────────────────────┐                          │
│          │  APPROVAL GATE                     │                          │
│          │                                    │                          │
│          │  Slack message with diff preview   │                          │
│          │  + Amazon SNS notification          │                          │
│          │                                    │                          │
│          │  [Approve]  [Reject]  [Defer]      │                          │
│          └──────────────┬─────────────────────┘                          │
│                         │  human clicks "Approve"                        │
│                         ▼                                                │
│          ┌───────────────────────────────────┐                          │
│          │  DEPLOYMENT                        │                          │
│          │  terraform apply / cdk deploy      │                          │
│          └───────────────────────────────────┘                          │
└──────────────────────────────────────────────────────────────────────────┘
```

## Tech Stack

| Component | Technology | Purpose |
|-----------|-----------|---------|
| Language | Rust | Memory safety and high performance for log processing |
| HTTP Framework | Axum | Async web server for API and webhook endpoints |
| Log Analytics | ClickHouse | OLAP database for millions of security log entries |
| Cloud SDK | AWS SDK for Rust | Direct access to CloudWatch, S3, IAM, VPC |
| Agent Framework | AutoGen | Multi-agent collaboration for detection and patching |
| IaC | Terraform / AWS CDK | Infrastructure patch generation |
| Notifications | Amazon SNS + Slack | Human-in-the-loop approval workflow |

## Quick Start

```bash
cargo build --release
cargo run
```

Configure AWS credentials and Slack webhook URL via environment variables:

```bash
export AWS_REGION=us-east-1
export SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...
export CLICKHOUSE_URL=http://localhost:8123
```

## API Examples

### Trigger a manual scan
```bash
curl -X POST http://localhost:3000/scan \
  -H "Content-Type: application/json" \
  -d '{"scope": ["s3", "vpc", "iam"], "region": "us-east-1"}'
```

### List detected vulnerabilities
```bash
curl http://localhost:3000/vulnerabilities?severity=critical
```

### Review a proposed patch
```bash
curl http://localhost:3000/patches/PATCH-042
```

## Design Decisions

- **Rust for the hot path**: Log ingestion and pattern matching run at native speed with zero garbage collection pauses, critical when processing millions of CloudWatch entries.
- **Simulation before patching**: Not every misconfiguration is exploitable. The sandbox step reduces alert fatigue by only escalating confirmed risks.
- **Human-in-the-loop deployment**: Auto-patching infrastructure is dangerous. The Slack approval gate ensures a human reviews every Terraform diff before `apply`.
- **ClickHouse for analytics**: Security teams need to query historical findings across time ranges. ClickHouse handles these OLAP queries orders of magnitude faster than PostgreSQL.
