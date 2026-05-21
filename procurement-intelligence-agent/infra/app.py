"""
AWS CDK App — Deploys all Procurement Intelligence Agent infrastructure.

Stacks:
- DatabaseStack: RDS MySQL on private subnet
- BedrockStack: Guardrail configuration
- ApiStack: ECS Fargate (FastAPI + MCP), ECR, API Gateway, IAM
"""

from __future__ import annotations

import aws_cdk as cdk
from infra.stacks.database_stack import DatabaseStack
from infra.stacks.bedrock_stack import BedrockStack
from infra.stacks.api_stack import ApiStack

app = cdk.App()

env = cdk.Environment(
    account=app.node.try_get_context("account") or "123456789012",
    region=app.node.try_get_context("region") or "us-east-1",
)

# ── Stack 1: Database (RDS MySQL) ─────────────────────────────────────────────
db_stack = DatabaseStack(
    app,
    "ProcurementDatabaseStack",
    env=env,
    description="Procurement Intelligence Agent — RDS MySQL on private subnet",
)

# ── Stack 2: Bedrock Guardrails ───────────────────────────────────────────────
bedrock_stack = BedrockStack(
    app,
    "ProcurementBedrockStack",
    env=env,
    description="Procurement Intelligence Agent — Bedrock Guardrail configuration",
)

# ── Stack 3: API (ECS + MCP) ──────────────────────────────────────────────────
api_stack = ApiStack(
    app,
    "ProcurementApiStack",
    vpc=db_stack.vpc,
    db_secret=db_stack.db_secret,
    guardrail_id=bedrock_stack.guardrail_id,
    env=env,
    description="Procurement Intelligence Agent — ECS Fargate API + MCP server",
)

# Explicit dependency ordering
api_stack.add_dependency(db_stack)
api_stack.add_dependency(bedrock_stack)

cdk.Tags.of(app).add("Project", "ProcurementIntelligenceAgent")
cdk.Tags.of(app).add("Environment", "production")
cdk.Tags.of(app).add("ManagedBy", "CDK")

app.synth()
