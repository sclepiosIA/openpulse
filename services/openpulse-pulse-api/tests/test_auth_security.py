"""Régressions P0 : JWT cloisonné Pulse et démarrage production fail-closed."""

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

SECRET = "pulse-test-secret-long-enough"
ISSUER = "https://auth.gestion.test"
AUDIENCE = "openpulse-pulse-api"


def _b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode().rstrip("=")


def _token(**overrides: object) -> str:
    now = int(time.time())
    claims: dict[str, object] = {
        "sub": "11111111-1111-1111-1111-111111111111",
        "email": "alice@example.test",
        "iss": ISSUER,
        "aud": AUDIENCE,
        "iat": now,
        "exp": now + 600,
    }
    claims.update(overrides)
    header = _b64url(json.dumps({"alg": "HS256", "typ": "JWT"}).encode())
    payload = _b64url(json.dumps(claims, separators=(",", ":")).encode())
    signature = hmac.new(
        SECRET.encode(), f"{header}.{payload}".encode(), hashlib.sha256
    ).digest()
    return f"{header}.{payload}.{_b64url(signature)}"


def _jwt_client(monkeypatch) -> TestClient:
    monkeypatch.setenv("PULSE_ENV", "test")
    monkeypatch.setenv("DATABASE_URL", "")
    monkeypatch.setenv("PULSE_AUTH_MODE", "jwt")
    monkeypatch.setenv("PULSE_JWT_SECRET", SECRET)
    monkeypatch.setenv("PULSE_JWT_ISSUER", ISSUER)
    monkeypatch.setenv("PULSE_JWT_AUDIENCE", AUDIENCE)
    get_settings.cache_clear()
    return TestClient(create_app(), raise_server_exceptions=False)


def test_jwt_rejects_a_token_for_another_service_audience(monkeypatch):
    with _jwt_client(monkeypatch) as client:
        pulse = client.get(
            "/api/pulse/conversations",
            headers={"Authorization": f"Bearer {_token()}"},
        )
        drive = client.get(
            "/api/pulse/conversations",
            headers={"Authorization": f"Bearer {_token(aud='openpulse-drive-api')}"},
        )

    assert pulse.status_code == 200
    assert drive.status_code == 401


def test_all_invalid_credentials_return_the_same_401(monkeypatch):
    invalid_headers = [
        {},
        {"Authorization": "Bearer "},
        {"Authorization": "Bearer a.b.c"},
        {"Authorization": f"Bearer {_token(sub='')}"},
        {"Authorization": f"Bearer {_token(iss='https://evil.invalid')}"},
        {"Authorization": f"Bearer {_token(aud='')}"},
        {"Authorization": f"Bearer {_token(exp='not-a-timestamp')}"},
        {"Authorization": f"Bearer {_token(exp=float('nan'))}"},
        {"Authorization": f"Bearer {_token(nbf=float('nan'))}"},
    ]

    with _jwt_client(monkeypatch) as client:
        responses = [
            client.get("/api/pulse/conversations", headers=headers)
            for headers in invalid_headers
        ]

    assert {
        (response.status_code, response.json().get("detail"), response.headers.get("www-authenticate"))
        for response in responses
    } == {(401, "Authentification invalide", "Bearer")}


@pytest.mark.parametrize(
    ("environment", "expected_error"),
    [
        (
            {
                "PULSE_AUTH_MODE": "disabled",
                "PULSE_JWT_SECRET": SECRET,
                "DATABASE_URL": "postgresql://unused.example/pulse",
            },
            "PULSE_AUTH_MODE",
        ),
        (
            {
                "PULSE_AUTH_MODE": "jwt",
                "PULSE_JWT_SECRET": SECRET,
                "DATABASE_URL": "",
            },
            "DATABASE_URL",
        ),
        (
            {
                "PULSE_AUTH_MODE": "jwt",
                "PULSE_JWT_SECRET": "",
                "DATABASE_URL": "postgresql://unused.example/pulse",
            },
            "PULSE_JWT_SECRET",
        ),
    ],
)
def test_production_startup_rejects_unsafe_fallbacks(
    monkeypatch, environment: dict[str, str], expected_error: str
):
    monkeypatch.setenv("PULSE_ENV", "prod")
    monkeypatch.setenv("PULSE_JWT_ISSUER", ISSUER)
    monkeypatch.setenv("PULSE_JWT_AUDIENCE", AUDIENCE)
    for key, value in environment.items():
        monkeypatch.setenv(key, value)
    get_settings.cache_clear()

    with pytest.raises(RuntimeError, match=expected_error):
        with TestClient(create_app()):
            pass
