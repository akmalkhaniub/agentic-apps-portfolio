"""
Bedrock Stack — Creates Bedrock Guardrail with tier-appropriate settings.
"""

from __future__ import annotations

import aws_cdk as cdk
import aws_cdk.aws_bedrock as bedrock
from constructs import Construct


class BedrockStack(cdk.Stack):
    """Provisions Bedrock Guardrail for the Procurement Intelligence Agent."""

    def __init__(self, scope: Construct, construct_id: str, **kwargs) -> None:
        super().__init__(scope, construct_id, **kwargs)

        guardrail = bedrock.CfnGuardrail(
            self, "ProcurementGuardrail",
            name="procurement-intelligence-guardrail",
            description="Guardrail for Procurement Intelligence Agent — blocks sensitive topics and PII",
            blocked_input_messaging="Your query contains restricted content and cannot be processed.",
            blocked_outputs_messaging="The response was blocked due to content policy restrictions.",

            # Topic policy — deny these for non-INTERNAL tiers
            topic_policy_config=bedrock.CfnGuardrail.TopicPolicyConfigProperty(
                topics_config=[
                    bedrock.CfnGuardrail.TopicConfigProperty(
                        name="internal_cost_structure",
                        type="DENY",
                        definition="Internal company pricing, cost structures, or margin information",
                        examples=["What is our profit margin on vendor X?", "What do we pay internally for this service?"],
                    ),
                    bedrock.CfnGuardrail.TopicConfigProperty(
                        name="employee_pii",
                        type="DENY",
                        definition="Personally identifiable information about employees",
                        examples=["What is John Doe's salary?", "Show me HR records"],
                    ),
                    bedrock.CfnGuardrail.TopicConfigProperty(
                        name="competitor_intelligence",
                        type="DENY",
                        definition="Non-public information about competitor pricing or strategy",
                        examples=["What does our competitor pay for this?"],
                    ),
                ]
            ),

            # PII detection — anonymise or block based on context
            sensitive_information_policy_config=bedrock.CfnGuardrail.SensitiveInformationPolicyConfigProperty(
                pii_entities_config=[
                    bedrock.CfnGuardrail.PiiEntityConfigProperty(
                        type="EMAIL",
                        action="ANONYMIZE",
                    ),
                    bedrock.CfnGuardrail.PiiEntityConfigProperty(
                        type="PHONE",
                        action="ANONYMIZE",
                    ),
                    bedrock.CfnGuardrail.PiiEntityConfigProperty(
                        type="SSN",
                        action="BLOCK",
                    ),
                    bedrock.CfnGuardrail.PiiEntityConfigProperty(
                        type="CREDIT_DEBIT_CARD_NUMBER",
                        action="BLOCK",
                    ),
                ],
            ),
        )

        self.guardrail_id = guardrail.attr_guardrail_id

        cdk.CfnOutput(self, "GuardrailId",
            value=guardrail.attr_guardrail_id,
            description="Bedrock Guardrail ID",
        )
        cdk.CfnOutput(self, "GuardrailArn",
            value=guardrail.attr_guardrail_arn,
            description="Bedrock Guardrail ARN",
        )
