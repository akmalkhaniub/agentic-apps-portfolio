"""
API Stack — ECS Fargate for FastAPI and MCP server, ECR repositories,
Application Load Balancer, Secrets Manager, and IAM roles.
"""

from __future__ import annotations

import aws_cdk as cdk
import aws_cdk.aws_ec2 as ec2
import aws_cdk.aws_ecr as ecr
import aws_cdk.aws_ecs as ecs
import aws_cdk.aws_ecs_patterns as ecs_patterns
import aws_cdk.aws_iam as iam
import aws_cdk.aws_secretsmanager as sm
from constructs import Construct


class ApiStack(cdk.Stack):
    def __init__(
        self,
        scope: Construct,
        construct_id: str,
        vpc: ec2.Vpc,
        db_secret: sm.Secret,
        guardrail_id: str,
        **kwargs,
    ) -> None:
        super().__init__(scope, construct_id, **kwargs)

        # ── ECR Repositories ──────────────────────────────────────────────────
        api_repo = ecr.Repository(
            self, "ApiRepo",
            repository_name="procurement-api",
            removal_policy=cdk.RemovalPolicy.RETAIN,
            lifecycle_rules=[ecr.LifecycleRule(max_image_count=5)],
        )

        mcp_repo = ecr.Repository(
            self, "McpRepo",
            repository_name="procurement-mcp-server",
            removal_policy=cdk.RemovalPolicy.RETAIN,
            lifecycle_rules=[ecr.LifecycleRule(max_image_count=5)],
        )

        # ── IAM Role for ECS tasks ────────────────────────────────────────────
        task_role = iam.Role(
            self, "TaskRole",
            assumed_by=iam.ServicePrincipal("ecs-tasks.amazonaws.com"),
            role_name="procurement-ecs-task-role",
        )

        # Bedrock permissions (least privilege)
        task_role.add_to_policy(iam.PolicyStatement(
            effect=iam.Effect.ALLOW,
            actions=[
                "bedrock:InvokeModel",
                "bedrock:InvokeModelWithResponseStream",
                "bedrock:ApplyGuardrail",
            ],
            resources=[
                f"arn:aws:bedrock:{self.region}::foundation-model/anthropic.claude-3-5-sonnet-20241022-v2:0",
                f"arn:aws:bedrock:{self.region}:{self.account}:guardrail/*",
            ],
        ))

        # Secrets Manager read
        db_secret.grant_read(task_role)

        task_role.add_to_policy(iam.PolicyStatement(
            effect=iam.Effect.ALLOW,
            actions=["secretsmanager:GetSecretValue"],
            resources=[f"arn:aws:secretsmanager:{self.region}:{self.account}:secret:procurement/*"],
        ))

        # S3 read for document storage
        task_role.add_to_policy(iam.PolicyStatement(
            effect=iam.Effect.ALLOW,
            actions=["s3:GetObject", "s3:ListBucket"],
            resources=[
                f"arn:aws:s3:::procurement-intelligence-docs",
                f"arn:aws:s3:::procurement-intelligence-docs/*",
            ],
        ))

        # ── ECS Cluster ───────────────────────────────────────────────────────
        cluster = ecs.Cluster(
            self, "Cluster",
            vpc=vpc,
            cluster_name="procurement-cluster",
            container_insights=True,
        )

        # ── Shared secrets for both services ──────────────────────────────────
        shared_secrets = {
            "DB_HOST": ecs.Secret.from_secrets_manager(db_secret, field="host"),
            "DB_PASSWORD": ecs.Secret.from_secrets_manager(db_secret, field="password"),
            "PINECONE_API_KEY": ecs.Secret.from_secrets_manager(
                sm.Secret.from_secret_name_v2(self, "PineconeSecret", "procurement/pinecone-api-key")
            ),
        }

        # ── MCP Server Service (FIX #17: CDK deployment for MCP) ─────────────
        mcp_task_def = ecs.FargateTaskDefinition(
            self, "McpTaskDef",
            cpu=512,
            memory_limit_mib=1024,
            task_role=task_role,
        )

        mcp_container = mcp_task_def.add_container(
            "McpContainer",
            image=ecs.ContainerImage.from_ecr_repository(mcp_repo, tag="latest"),
            port_mappings=[ecs.PortMapping(container_port=8080)],
            environment={
                "AWS_REGION": self.region,
                "MCP_PORT": "8080",
            },
            secrets=shared_secrets,
            logging=ecs.LogDrivers.aws_logs(stream_prefix="procurement-mcp"),
        )

        mcp_service = ecs.FargateService(
            self, "McpService",
            cluster=cluster,
            task_definition=mcp_task_def,
            service_name="procurement-mcp-server",
            desired_count=1,
            assign_public_ip=False,
        )

        # ── FastAPI Service (ALB Fargate) ─────────────────────────────────────
        api_service = ecs_patterns.ApplicationLoadBalancedFargateService(
            self, "ApiService",
            cluster=cluster,
            service_name="procurement-api",
            cpu=1024,
            memory_limit_mib=2048,
            desired_count=2,
            task_image_options=ecs_patterns.ApplicationLoadBalancedTaskImageOptions(
                image=ecs.ContainerImage.from_ecr_repository(api_repo, tag="latest"),
                container_port=8000,
                task_role=task_role,
                environment={
                    "AWS_REGION": self.region,
                    "BEDROCK_GUARDRAIL_ID": guardrail_id,
                    "API_PORT": "8000",
                    # MCP server is discovered via ECS service discovery
                    "MCP_TRANSPORT": "streamable-http",
                    "MCP_SERVER_URL": f"http://procurement-mcp-server.procurement-cluster:8080/mcp",
                },
                secrets={
                    **shared_secrets,
                    "JWT_SECRET_KEY": ecs.Secret.from_secrets_manager(
                        sm.Secret.from_secret_name_v2(self, "JwtSecret", "procurement/jwt-secret")
                    ),
                },
                log_driver=ecs.LogDrivers.aws_logs(
                    stream_prefix="procurement-api",
                ),
            ),
            public_load_balancer=True,
        )

        # Health check config
        api_service.target_group.configure_health_check(
            path="/health",
            healthy_http_codes="200",
            interval=cdk.Duration.seconds(30),
        )

        # ── Outputs ───────────────────────────────────────────────────────────
        cdk.CfnOutput(self, "ApiUrl",
            value=f"http://{api_service.load_balancer.load_balancer_dns_name}",
            description="Procurement Intelligence API URL",
        )

        cdk.CfnOutput(self, "ApiEcrUri",
            value=api_repo.repository_uri,
            description="FastAPI ECR repository URI",
        )

        cdk.CfnOutput(self, "McpEcrUri",
            value=mcp_repo.repository_uri,
            description="MCP Server ECR repository URI",
        )
