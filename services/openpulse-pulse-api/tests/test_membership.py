"""Régressions P0 : cloisonnement des conversations par propriétaire/membres."""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import time

from fastapi.testclient import TestClient

from app.config import get_settings
from app.main import create_app

SECRET = "pulse-membership-secret-long-enough"
ISSUER = "https://auth.gestion.test"
AUDIENCE = "openpulse-pulse-api"
ALICE_ID = "11111111-1111-1111-1111-111111111111"
BOB_ID = "22222222-2222-2222-2222-222222222222"
CHARLIE_ID = "33333333-3333-3333-3333-333333333333"


def _b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode().rstrip("=")


def _headers(user_id: str) -> dict[str, str]:
    now = int(time.time())
    claims = {
        "sub": user_id,
        "iss": ISSUER,
        "aud": AUDIENCE,
        "iat": now,
        "exp": now + 600,
    }
    header = _b64url(json.dumps({"alg": "HS256", "typ": "JWT"}).encode())
    payload = _b64url(json.dumps(claims, separators=(",", ":")).encode())
    signature = hmac.new(
        SECRET.encode(), f"{header}.{payload}".encode(), hashlib.sha256
    ).digest()
    token = f"{header}.{payload}.{_b64url(signature)}"
    return {"Authorization": f"Bearer {token}"}


def test_alice_and_bob_only_access_conversations_where_they_are_members(monkeypatch):
    monkeypatch.setenv("PULSE_ENV", "test")
    monkeypatch.setenv("DATABASE_URL", "")
    monkeypatch.setenv("PULSE_AUTH_MODE", "jwt")
    monkeypatch.setenv("PULSE_JWT_SECRET", SECRET)
    monkeypatch.setenv("PULSE_JWT_ISSUER", ISSUER)
    monkeypatch.setenv("PULSE_JWT_AUDIENCE", AUDIENCE)
    get_settings.cache_clear()

    alice = _headers(ALICE_ID)
    bob = _headers(BOB_ID)
    charlie = _headers(CHARLIE_ID)

    with TestClient(create_app()) as client:
        shared_response = client.post(
            "/api/pulse/conversations",
            headers=alice,
            json={
                "name": "Alice + Bob",
                "type": "group",
                "is_private": True,
                "member_profile_ids": [ALICE_ID, BOB_ID, BOB_ID],
            },
        )
        assert shared_response.status_code == 201, shared_response.text
        shared = shared_response.json()
        assert shared["created_by"] == ALICE_ID
        assert shared["member_count"] == 2

        alice_only_response = client.post(
            "/api/pulse/conversations",
            headers=alice,
            json={"name": "Alice only", "type": "direct", "is_private": True},
        )
        assert alice_only_response.status_code == 201, alice_only_response.text
        alice_only = alice_only_response.json()
        assert alice_only["member_count"] == 1

        assert {item["id"] for item in client.get(
            "/api/pulse/conversations", headers=alice
        ).json()} == {shared["id"], alice_only["id"]}
        assert [item["id"] for item in client.get(
            "/api/pulse/conversations", headers=bob
        ).json()] == [shared["id"]]
        assert client.get(
            "/api/pulse/conversations", headers=charlie
        ).json() == []

        alice_message = client.post(
            f"/api/pulse/conversations/{shared['id']}/messages",
            headers=alice,
            json={"body": "Bonjour Bob"},
        )
        assert alice_message.status_code == 201, alice_message.text

        bob_messages = client.get(
            f"/api/pulse/conversations/{shared['id']}/messages", headers=bob
        )
        assert bob_messages.status_code == 200
        assert [message["body"] for message in bob_messages.json()] == ["Bonjour Bob"]
        assert client.post(
            f"/api/pulse/conversations/{shared['id']}/messages",
            headers=bob,
            json={"body": "Bonjour Alice"},
        ).status_code == 201

        for method in ("get", "post"):
            request = getattr(client, method)
            kwargs = {"json": {"body": "intrusion"}} if method == "post" else {}
            assert request(
                f"/api/pulse/conversations/{shared['id']}/messages",
                headers=charlie,
                **kwargs,
            ).status_code == 403
            assert request(
                f"/api/pulse/conversations/{alice_only['id']}/messages",
                headers=bob,
                **kwargs,
            ).status_code == 403

    get_settings.cache_clear()
