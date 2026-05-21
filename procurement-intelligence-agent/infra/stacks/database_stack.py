"""
Database Stack — RDS MySQL on a private subnet inside a dedicated VPC.
"""

from __future__ import annotations

import aws_cdk as cdk
import aws_cdk.aws_ec2 as ec2
import aws_cdk.aws_rds as rds
import aws_cdk.aws_secretsmanager as sm
from constructs import Construct


class DatabaseStack(cdk.Stack):
    """Provisions VPC + RDS MySQL for procurement data."""

    def __init__(self, scope: Construct, construct_id: str, **kwargs) -> None:
        super().__init__(scope, construct_id, **kwargs)

        # ── VPC ───────────────────────────────────────────────────────────────
        self.vpc = ec2.Vpc(
            self, "Vpc",
            vpc_name="procurement-vpc",
            max_azs=2,
            nat_gateways=1,
            subnet_configuration=[
                ec2.SubnetConfiguration(name="Public", subnet_type=ec2.SubnetType.PUBLIC, cidr_mask=24),
                ec2.SubnetConfiguration(name="Private", subnet_type=ec2.SubnetType.PRIVATE_WITH_EGRESS, cidr_mask=24),
                ec2.SubnetConfiguration(name="Isolated", subnet_type=ec2.SubnetType.PRIVATE_ISOLATED, cidr_mask=24),
            ],
        )

        # ── Security Group ─────────────────────────────────────────────────────
        db_sg = ec2.SecurityGroup(
            self, "DbSG",
            vpc=self.vpc,
            description="Procurement RDS MySQL SG",
            allow_all_outbound=False,
        )
        db_sg.add_ingress_rule(
            peer=ec2.Peer.ipv4(self.vpc.vpc_cidr_block),
            connection=ec2.Port.tcp(3306),
            description="MySQL from VPC",
        )

        # ── RDS Secret ────────────────────────────────────────────────────────
        self.db_secret = sm.Secret(
            self, "DbSecret",
            secret_name="procurement/rds-credentials",
            generate_secret_string=sm.SecretStringGenerator(
                secret_string_template='{"username": "admin", "dbname": "procurement"}',
                generate_string_key="password",
                exclude_characters='"@/\\',
                password_length=32,
            ),
        )

        # ── RDS MySQL ─────────────────────────────────────────────────────────
        self.db_instance = rds.DatabaseInstance(
            self, "Database",
            engine=rds.DatabaseInstanceEngine.mysql(
                version=rds.MysqlEngineVersion.VER_8_0_36
            ),
            instance_type=ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MEDIUM),
            vpc=self.vpc,
            vpc_subnets=ec2.SubnetSelection(subnet_type=ec2.SubnetType.PRIVATE_ISOLATED),
            security_groups=[db_sg],
            credentials=rds.Credentials.from_secret(self.db_secret),
            database_name="procurement",
            storage_encrypted=True,
            backup_retention=cdk.Duration.days(7),
            deletion_protection=True,
            enable_performance_insights=True,
            multi_az=True,
            removal_policy=cdk.RemovalPolicy.RETAIN,
        )

        # ── Outputs ───────────────────────────────────────────────────────────
        cdk.CfnOutput(self, "DbEndpoint",
            value=self.db_instance.db_instance_endpoint_address,
            description="RDS MySQL endpoint",
        )
        cdk.CfnOutput(self, "DbSecretArn",
            value=self.db_secret.secret_arn,
            description="RDS credentials secret ARN",
        )
