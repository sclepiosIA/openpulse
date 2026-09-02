"""Régressions P0 : authentification JWT et isolation par profil."""

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

JWT_SECRET = "test-secret-with-at-least-32-characters"
JWT_ISSUER = "https://auth.gestion.test"
JWT_AUDIENCE = "openpulse-email-api"
PROFILE_A = "11111111-1111-4111-8111-111111111111"
PROFILE_B = "22222222-2222-4222-8222-222222222222"


def _b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode().rstrip("=")


def make_token(profile_id: str, **claim_overrides: object) -> str:
    now = int(time.time())
    claims: dict[str, object] = {
        "iss": JWT_ISSUER,
        "aud": JWT_AUDIENCE,
        "sub": profile_id,
        "iat": now,
        "nbf": now,
        "exp": now + 300,
    }
    claims.update(claim_overrides)
    header = _b64url(json.dumps({"alg": "HS256", "typ": "JWT"}).encode())
    payload = _b64url(json.dumps(claims, separators=(",", ":")).encode())
    signature = hmac.new(
        JWT_SECRET.encode(), f"{header}.{payload}".encode(), hashlib.sha256
    ).digest()
    return f"{header}.{payload}.{_b64url(signature)}"


@pytest.fixture()
def jwt_client(monkeypatch):
    monkeypatch.setenv("EMAIL_ENV", "test")
    monkeypatch.setenv("DATABASE_URL", "")
    monkeypatch.setenv("EMAIL_AUTH_MODE", "jwt")
    monkeypatch.setenv("EMAIL_JWT_SECRET", JWT_SECRET)
    monkeypatch.setenv("EMAIL_JWT_ISSUER", JWT_ISSUER)
    monkeypatch.setenv("EMAIL_JWT_AUDIENCE", JWT_AUDIENCE)
    get_settings.cache_clear()
    app = create_app()
    with TestClient(app) as client:
        yield client
    get_settings.cache_clear()


def auth(profile_id: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {make_token(profile_id)}"}


def test_jwt_policy_rejects_malformed_wrong_issuer_audience_and_missing_identity(jwt_client):
    for token in (
        "not-a-jwt",
        make_token(PROFILE_A, iss="https://evil.invalid"),
        make_token(PROFILE_A, aud="another-api"),
        make_token(PROFILE_A, sub=None),
    ):
        response = jwt_client.get(
            "/api/email/accounts",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 401


def test_two_identities_cannot_read_each_others_accounts_or_sync_status(jwt_client):
    created = jwt_client.post(
        "/api/email/accounts",
        headers=auth(PROFILE_A),
        json={
            "email_address": "owner-a@example.com",
            "provider": "imap_smtp",
            "secret_ref": "kv://email/owner-a",
        },
    )
    assert created.status_code == 201, created.text
    assert created.json()["profile_id"] == PROFILE_A

    own_accounts = jwt_client.get("/api/email/accounts", headers=auth(PROFILE_A))
    assert [account["email_address"] for account in own_accounts.json()] == [
        "owner-a@example.com"
    ]

    other_accounts = jwt_client.get("/api/email/accounts", headers=auth(PROFILE_B))
    assert other_accounts.status_code == 200
    assert other_accounts.json() == []

    other_sync = jwt_client.get("/api/email/sync/status", headers=auth(PROFILE_B))
    assert other_sync.status_code == 200
    assert other_sync.json()["accounts"] == []
