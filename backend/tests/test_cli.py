from datetime import date

import pytest

from legal_acts_ingest.cli import default_date_from
from legal_acts_ingest.config import ConfigError, Settings


def test_default_date_from_is_two_weeks_back():
    assert default_date_from(14, today=date(2026, 10, 9)) == "2026-09-25"


def test_default_date_from_crosses_month_boundary():
    assert default_date_from(14, today=date(2026, 1, 5)) == "2025-12-22"


def test_publishable_key_is_rejected(monkeypatch):
    monkeypatch.setenv("SUPABASE_URL", "https://example.supabase.co")
    monkeypatch.setenv("SUPABASE_SECRET_KEY", "sb_publishable_abc")

    with pytest.raises(ConfigError, match="sb_secret_"):
        Settings.from_env()


def test_missing_credentials_are_reported(monkeypatch):
    monkeypatch.delenv("SUPABASE_URL", raising=False)
    monkeypatch.delenv("SUPABASE_SECRET_KEY", raising=False)

    with pytest.raises(ConfigError, match="SUPABASE_URL"):
        Settings.from_env()


def test_dry_run_does_not_require_credentials(monkeypatch):
    monkeypatch.delenv("SUPABASE_URL", raising=False)
    monkeypatch.delenv("SUPABASE_SECRET_KEY", raising=False)

    settings = Settings.from_env(require_supabase=False)

    assert settings.publishers == ("DU", "MP")
    assert settings.lookback_days == 14
