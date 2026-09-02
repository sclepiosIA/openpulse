"""Fixtures pytest — app FastAPI en mode memory + storage stub."""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import time

import pytest
from fastapi.testclient import TestClient

from app.config import get_settings
from app.main import create_app


@pytest.fixture()
def client(monkeypatch):
    monkeypatch.setenv("MEETINGS_ENV", "test")
    monkeypatch.setenv("DATABASE_URL", "")
    monkeypatch.setenv("AZURE_STORAGE_CONNECTION_STRING", "")
    monkeypatch.setenv("AZURE_STORAGE_ACCOUNT", "")
    monkeypatch.setenv("AZURE_STORAGE_ACCOUNT_KEY", "")
    monkeypatch.setenv("MEETINGS_AUTH_MODE", "disabled")
    get_settings.cache_clear()
    app = create_app()
    with TestClient(app) as c:
        yield c
    get_settings.cache_clear()


def make_jwt(claims: dict, secret: str = "test-secret") -> str:
    """Build a deliberately small HS256 token for API contract tests."""
    def encode(value: dict) -> str:
        return base64.urlsafe_b64encode(json.dumps(value, separators=(",", ":")).encode()).rstrip(b"=").decode()

    header = encode({"alg": "HS256", "typ": "JWT"})
    payload = encode(claims)
    signature = hmac.new(secret.encode(), f"{header}.{payload}".encode(), hashlib.sha256).digest()
    return f"{header}.{payload}.{base64.urlsafe_b64encode(signature).rstrip(b'=').decode()}"


@pytest.fixture()
def jwt_client(monkeypatch):
    monkeypatch.setenv("MEETINGS_ENV", "test")
    monkeypatch.setenv("DATABASE_URL", "")
    monkeypatch.setenv("AZURE_STORAGE_CONNECTION_STRING", "")
    monkeypatch.setenv("MEETINGS_AUTH_MODE", "jwt")
    monkeypatch.setenv("MEETINGS_JWT_SECRET", "test-secret")
    monkeypatch.setenv("MEETINGS_JWT_ISSUER", "https://issuer.test")
    monkeypatch.setenv("MEETINGS_JWT_AUDIENCE", "openpulse-meetings-api")
    get_settings.cache_clear()
    app = create_app()
    with TestClient(app) as c:
        yield c
    get_settings.cache_clear()


@pytest.fixture()
def valid_claims():
    now = int(time.time())
    return {
        "iss": "https://issuer.test",
        "aud": "openpulse-meetings-api",
        "sub": "alice",
        "iat": now - 1,
        "nbf": now - 1,
        "exp": now + 300,
    }
