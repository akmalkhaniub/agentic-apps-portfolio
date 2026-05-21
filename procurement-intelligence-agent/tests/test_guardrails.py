"""
Tests for the guardrail tier system, SQL validator, and JSON extraction.
"""

from __future__ import annotations

import pytest
from guardrails.tiers import get_tier_config, tier_from_jwt_claim, TierConfig, TIER_CONFIGS
from sql_agent.validator import SQLValidator


# ── Tier config tests ─────────────────────────────────────────────────────────

class TestTierConfig:
    def test_internal_has_highest_token_budget(self):
        internal = get_tier_config("INTERNAL")
        partner = get_tier_config("PARTNER")
        public = get_tier_config("PUBLIC")
        assert internal.max_tokens > partner.max_tokens > public.max_tokens

    def test_public_has_strictest_guardrail(self):
        public = get_tier_config("PUBLIC")
        assert public.bedrock_guardrail_strength == "HIGH"
        assert public.pii_action == "BLOCK"

    def test_internal_no_denied_topics(self):
        internal = get_tier_config("INTERNAL")
        assert len(internal.denied_topics) == 0

    def test_public_has_most_denied_topics(self):
        public = get_tier_config("PUBLIC")
        internal = get_tier_config("INTERNAL")
        assert len(public.denied_topics) > len(internal.denied_topics)

    def test_tier_from_jwt_defaults_to_public(self):
        assert tier_from_jwt_claim(None) == "PUBLIC"
        assert tier_from_jwt_claim("unknown") == "PUBLIC"
        assert tier_from_jwt_claim("INTERNAL") == "INTERNAL"
        assert tier_from_jwt_claim("partner") == "PARTNER"

    def test_all_tiers_have_rate_limits(self):
        for tier_name, config in TIER_CONFIGS.items():
            assert config.rate_limit_rpm > 0, f"{tier_name} has no rate limit"

    def test_internal_rate_limit_highest(self):
        assert TIER_CONFIGS["INTERNAL"].rate_limit_rpm > TIER_CONFIGS["PARTNER"].rate_limit_rpm
        assert TIER_CONFIGS["PARTNER"].rate_limit_rpm > TIER_CONFIGS["PUBLIC"].rate_limit_rpm

    def test_row_limits_follow_tier_order(self):
        assert TIER_CONFIGS["INTERNAL"].max_rows > TIER_CONFIGS["PARTNER"].max_rows
        assert TIER_CONFIGS["PARTNER"].max_rows > TIER_CONFIGS["PUBLIC"].max_rows

    def test_all_tiers_have_guardrail_api_enabled(self):
        for config in TIER_CONFIGS.values():
            assert config.apply_guardrail_api is True

    def test_unknown_tier_raises_error(self):
        with pytest.raises(ValueError, match="Unknown tier"):
            get_tier_config("ADMIN")


# ── SQL Validator tests ───────────────────────────────────────────────────────

class TestSQLValidator:
    def setup_method(self):
        self.validator = SQLValidator()

    def test_valid_select_passes(self):
        sql = "SELECT vendor_id, vendor_name FROM vendors WHERE is_active = TRUE LIMIT 10;"
        valid, err = self.validator.validate(sql)
        assert valid is True
        assert err is None

    def test_valid_join_passes(self):
        sql = "SELECT v.vendor_name, SUM(po.amount_usd) FROM vendors v JOIN purchase_orders po ON v.vendor_id = po.vendor_id GROUP BY v.vendor_id LIMIT 20;"
        valid, err = self.validator.validate(sql)
        assert valid is True

    def test_drop_blocked(self):
        sql = "DROP TABLE vendors;"
        valid, err = self.validator.validate(sql)
        assert valid is False
        assert err is not None

    def test_delete_blocked(self):
        sql = "DELETE FROM purchase_orders WHERE po_id = '123';"
        valid, err = self.validator.validate(sql)
        assert valid is False

    def test_update_blocked(self):
        sql = "UPDATE vendors SET risk_score = 0.1 WHERE vendor_id = 'V001';"
        valid, err = self.validator.validate(sql)
        assert valid is False

    def test_information_schema_blocked(self):
        sql = "SELECT * FROM INFORMATION_SCHEMA.TABLES;"
        valid, err = self.validator.validate(sql)
        assert valid is False

    def test_unknown_table_blocked(self):
        sql = "SELECT * FROM users LIMIT 10;"
        valid, err = self.validator.validate(sql)
        assert valid is False
        assert "unknown tables" in (err or "").lower()

    def test_empty_sql_blocked(self):
        valid, err = self.validator.validate("")
        assert valid is False

    def test_non_select_blocked(self):
        sql = "SHOW TABLES;"
        valid, err = self.validator.validate(sql)
        assert valid is False

    def test_cte_allowed(self):
        sql = """
        WITH spend AS (
            SELECT vendor_id, SUM(amount_usd) AS total
            FROM purchase_orders
            GROUP BY vendor_id
        )
        SELECT v.vendor_name, s.total FROM vendors v JOIN spend s ON v.vendor_id = s.vendor_id LIMIT 10;
        """
        valid, err = self.validator.validate(sql)
        assert valid is True
