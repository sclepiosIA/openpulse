"""Production configuration must make auth and provenance explicit."""

from typing import Any

import pytest

from app.config import Settings


def _prod_settings(**overrides: Any) -> Settings:
    values: dict[str, Any] = {
        "drive_env": "prod",
        "openpulse_git_sha": "a" * 40,
        "database_url": "postgresql://example.invalid/gestion",
        "azure_storage_connection_string": "DefaultEndpointsProtocol=https;AccountName=test;AccountKey=test",
        "drive_auth_mode": "jwt",
        "drive_jwt_secret": "j" * 32,
        "drive_app_secret": "a" * 32,
        "supabase_url": "https://auth.example.invalid",
        "supabase_anon_key": "anon-key-for-production-bridge",
    }
    values.update(overrides)
    return Settings(**values)


def test_prod_accepts_explicit_auth_provider() -> None:
    _prod_settings().validate_runtime()


def test_prod_refuses_implicit_auth_provider() -> None:
    with pytest.raises(RuntimeError, match="SUPABASE_URL"):
        _prod_settings(supabase_url="").validate_runtime()


def test_prod_refuses_missing_auth_provider_key() -> None:
    with pytest.raises(RuntimeError, match="SUPABASE_ANON_KEY"):
        _prod_settings(supabase_anon_key="").validate_runtime()


def test_prod_refuses_missing_source_provenance() -> None:
    with pytest.raises(RuntimeError, match="OPENPULSE_GIT_SHA"):
        _prod_settings(openpulse_git_sha="0" * 40).validate_runtime()
