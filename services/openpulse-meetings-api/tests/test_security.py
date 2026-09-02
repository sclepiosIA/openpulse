"""Authorization, JWT, storage, and production safety contracts."""

from __future__ import annotations

import base64
import hashlib
import hmac
import json

import pytest
from fastapi.testclient import TestClient

from app.config import get_settings
from app.main import create_app
from app.storage import AzureBlobStorage


def make_jwt(claims: dict, secret: str = "test-secret") -> str:
    def encode(value: dict) -> str:
        return base64.urlsafe_b64encode(json.dumps(value, separators=(",", ":")).encode()).rstrip(b"=").decode()

    header = encode({"alg": "HS256", "typ": "JWT"})
    payload = encode(claims)
    signature = hmac.new(secret.encode(), f"{header}.{payload}".encode(), hashlib.sha256).digest()
    return f"{header}.{payload}.{base64.urlsafe_b64encode(signature).rstrip(b'=').decode()}"


def _headers(claims: dict) -> dict[str, str]:
    return {"Authorization": f"Bearer {make_jwt(claims)}"}


def _upload(client, headers: dict[str, str]) -> str:
    response = client.post(
        "/api/transcriptions/upload-intent",
        headers=headers,
        json={"file_name": "meeting.m4a", "content_type": "audio/mp4", "size_bytes": 12, "title": "Private"},
    )
    assert response.status_code == 201, response.text
    return response.json()["session_id"]


def test_alice_cannot_list_read_or_complete_bobs_session(jwt_client, valid_claims):
    alice = _headers(valid_claims)
    bob = _headers({**valid_claims, "sub": "bob"})
    session_id = _upload(jwt_client, alice)

    assert jwt_client.get("/api/transcriptions/sessions", headers=bob).json()["items"] == []
    assert jwt_client.get(f"/api/transcriptions/sessions/{session_id}", headers=bob).status_code == 404
    assert jwt_client.post("/api/transcriptions/upload-complete", headers=bob, json={"session_id": session_id}).status_code == 404
    assert jwt_client.post("/api/transcriptions/upload-complete", headers=alice, json={"session_id": session_id}).status_code == 200


@pytest.mark.parametrize(
    "claim,value",
    [("iss", "wrong-issuer"), ("aud", "wrong-audience"), ("sub", ""), ("exp", None), ("iat", None), ("nbf", None)],
)
def test_jwt_requires_valid_identity_and_temporal_claims(jwt_client, valid_claims, claim, value):
    claims = dict(valid_claims)
    if value is None:
        claims.pop(claim)
    else:
        claims[claim] = value
    assert jwt_client.get("/api/transcriptions/sessions", headers=_headers(claims)).status_code == 401


def test_malformed_jwt_returns_401_not_500(jwt_client):
    response = jwt_client.get("/api/transcriptions/sessions", headers={"Authorization": "Bearer not.a.jwt"})
    assert response.status_code == 401


def test_rejects_future_iat_and_nbf(jwt_client, valid_claims):
    future = {**valid_claims, "iat": valid_claims["exp"] + 1, "nbf": valid_claims["exp"] + 1}
    assert jwt_client.get("/api/transcriptions/sessions", headers=_headers(future)).status_code == 401


def test_production_refuses_disabled_auth_or_missing_jwt_configuration(monkeypatch):
    monkeypatch.setenv("MEETINGS_ENV", "production")
    monkeypatch.setenv("MEETINGS_AUTH_MODE", "disabled")
    get_settings.cache_clear()
    with pytest.raises(RuntimeError, match="authentification JWT"):
        with TestClient(create_app()):
            pass
    get_settings.cache_clear()


def test_connection_string_storage_uses_its_account_and_configured_container(monkeypatch):
    monkeypatch.setenv("AZURE_STORAGE_CONNECTION_STRING", "DefaultEndpointsProtocol=https;AccountName=meetingsacct;AccountKey=a2V5;EndpointSuffix=core.windows.net")
    monkeypatch.setenv("MEETINGS_BLOB_CONTAINER_RECORDINGS", "recordings")
    get_settings.cache_clear()
    storage = AzureBlobStorage(get_settings())
    url, container, _ = storage.make_upload_url("sessions/one/audio.m4a")
    assert container == "recordings"
    assert url.startswith("https://objets.openpulse.example.org/recordings/")
    get_settings.cache_clear()
