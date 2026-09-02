"""Smoke contract against a real PostgreSQL instance.

Run with DRIVE_TEST_POSTGRES_URL after applying scripts/migrate.py. The default
unit suite stays hermetic and skips this module when no disposable database is
provided.
"""

from __future__ import annotations

import base64
import hashlib
import json
import os
import time
from concurrent.futures import ThreadPoolExecutor
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from app.config import get_settings
from app.main import create_app
from app.routers import desktop_auth


class _ProviderResponse:
    status_code = 200

    @staticmethod
    def json() -> dict:
        return {
            "id": "postgres-refresh-user",
            "email": "postgres-refresh@example.test",
            "app_metadata": {"role": "admin"},
            "user_metadata": {"full_name": "Postgres Refresh"},
        }


class _ProviderClient:
    def __init__(self, **_kwargs):
        pass

    async def __aenter__(self):
        return self

    async def __aexit__(self, *_args):
        return None

    async def get(self, _url: str, **_kwargs):
        return _ProviderResponse()


def _provider_access_token(mfa_timestamp: int) -> str:
    def encode(value: dict) -> str:
        return base64.urlsafe_b64encode(json.dumps(value).encode()).decode().rstrip("=")

    claims = {
        "sub": "postgres-refresh-user",
        "aal": "aal2",
        "amr": [{"method": "totp", "timestamp": mfa_timestamp}],
    }
    return f"{encode({'alg': 'HS256'})}.{encode(claims)}.signature"


@pytest.mark.integration
def test_postgres_repository_upload_completion_is_idempotent(monkeypatch):
    database_url = os.getenv("DRIVE_TEST_POSTGRES_URL")
    if not database_url:
        pytest.skip("DRIVE_TEST_POSTGRES_URL is not configured")

    monkeypatch.setenv("DRIVE_ENV", "test")
    monkeypatch.setenv("DATABASE_URL", database_url)
    monkeypatch.setenv("AZURE_STORAGE_CONNECTION_STRING", "")
    monkeypatch.setenv("AZURE_STORAGE_ACCOUNT", "")
    monkeypatch.setenv("AZURE_STORAGE_ACCOUNT_KEY", "")
    monkeypatch.setenv("DRIVE_AUTH_MODE", "disabled")
    monkeypatch.setenv("DRIVE_APP_SECRET", "postgres-integration-secret-long-enough")
    monkeypatch.setenv("DRIVE_JWT_SECRET", "postgres-drive-jwt-secret-long-enough")
    monkeypatch.setenv("SUPABASE_URL", "https://auth.example.test")
    monkeypatch.setenv("SUPABASE_ANON_KEY", "anon-test-key")
    monkeypatch.setattr(desktop_auth.httpx, "AsyncClient", _ProviderClient)
    get_settings.cache_clear()

    slug = f"postgres-{uuid4().hex[:12]}"
    sha256 = hashlib.sha256(b"postgres integration").hexdigest()
    app = create_app()
    try:
        with TestClient(app) as client:
            readiness = client.get("/readyz")
            assert readiness.status_code == 200, readiness.text
            assert readiness.json()["database"] == "postgres"

            def handoff():
                nonce = f"desktop-nonce-{uuid4()}"
                challenge_response = client.post(
                    "/api/drive/desktop/web/token",
                    headers={
                        "Authorization": f"Bearer {_provider_access_token(1)}",
                        "X-OpenPulse-Desktop-Handoff": "1",
                        "X-OpenPulse-Desktop-Nonce": nonce,
                    },
                )
                assert challenge_response.status_code == 428, challenge_response.text
                challenge = challenge_response.json()["detail"]["handoff_challenge"]
                return client.post(
                    "/api/drive/desktop/web/token",
                    headers={
                        "Authorization": f"Bearer {_provider_access_token(int(time.time()) + 1)}",
                        "X-OpenPulse-Desktop-Handoff": "1",
                        "X-OpenPulse-Desktop-Nonce": nonce,
                        "X-OpenPulse-Desktop-Challenge": challenge,
                    },
                )

            initial_auth = handoff()
            assert initial_auth.status_code == 200, initial_auth.text
            initial_refresh = initial_auth.json()["refresh_token"]
            rotated_auth = client.post(
                "/api/drive/desktop/refresh",
                json={"refresh_token": initial_refresh},
            )
            assert rotated_auth.status_code == 200, rotated_auth.text
            rotated_refresh = rotated_auth.json()["refresh_token"]
            assert rotated_refresh != initial_refresh
            assert client.post(
                "/api/drive/desktop/refresh",
                json={"refresh_token": initial_refresh},
            ).status_code == 401
            assert client.post(
                "/api/drive/desktop/logout",
                json={"refresh_token": rotated_refresh},
            ).status_code == 204
            assert client.post(
                "/api/drive/desktop/refresh",
                json={"refresh_token": rotated_refresh},
            ).status_code == 401

            with ThreadPoolExecutor(max_workers=2) as pool:
                concurrent = list(pool.map(lambda _index: handoff(), range(2)))
            # Deux handoffs AAL2 peuvent tous deux achever leur réponse si le second
            # challenge est créé après la rédemption du premier. L'invariant de sécurité
            # porte sur les sessions actives : la transaction du second révoque la
            # première avant d'émettre sa propre famille.
            concurrent_refreshes = [
                response.json()["refresh_token"]
                for response in concurrent
                if response.status_code == 200
            ]
            assert len(concurrent_refreshes) in {1, 2}
            assert all(response.status_code in {200, 403} for response in concurrent)
            refresh_results = [
                client.post(
                    "/api/drive/desktop/refresh",
                    json={"refresh_token": refresh_token},
                )
                for refresh_token in concurrent_refreshes
            ]
            assert sum(response.status_code == 200 for response in refresh_results) == 1
            assert all(response.status_code in {200, 401} for response in refresh_results)

            race_initial_response = handoff()
            assert race_initial_response.status_code == 200
            race_initial = race_initial_response.json()["refresh_token"]
            race_rotated_response = client.post(
                "/api/drive/desktop/refresh",
                json={"refresh_token": race_initial},
            )
            assert race_rotated_response.status_code == 200
            race_rotated = race_rotated_response.json()["refresh_token"]

            def refresh(refresh_token: str):
                return client.post(
                    "/api/drive/desktop/refresh",
                    json={"refresh_token": refresh_token},
                )

            with ThreadPoolExecutor(max_workers=2) as pool:
                race = list(pool.map(refresh, [race_rotated, race_initial]))
            assert all(response.status_code in {200, 401} for response in race)
            assert sum(response.status_code == 200 for response in race) <= 1
            for response in race:
                if response.status_code == 200:
                    successor = response.json()["refresh_token"]
                    assert refresh(successor).status_code == 401

            created = client.post(
                "/api/drive/spaces",
                json={"name": "Postgres integration", "slug": slug, "type": "project"},
            )
            assert created.status_code == 201, created.text
            space_id = created.json()["id"]

            intent = client.post(
                "/api/drive/upload-intent",
                json={
                    "space_id": space_id,
                    "path": "/integration/idempotent.txt",
                    "size_bytes": 20,
                    "sha256": sha256,
                },
            )
            assert intent.status_code == 200, intent.text
            upload = intent.json()
            payload = {
                "upload_token": upload["upload_token"],
                "file_id": upload["file_id"],
                "version": upload["version"],
            }
            first = client.post("/api/drive/upload-complete", json=payload)
            second = client.post("/api/drive/upload-complete", json=payload)
            assert first.status_code == second.status_code == 200
            assert first.json()["event_id"] == second.json()["event_id"]

            changes = client.get(
                "/api/drive/changes",
                params={"space_id": space_id, "since_event_id": 0},
            )
            assert changes.status_code == 200, changes.text
            matching = [
                event
                for event in changes.json()["events"]
                if event["file_id"] == upload["file_id"]
                and event["event_type"] == "file_created"
            ]
            assert len(matching) == 1
    finally:
        get_settings.cache_clear()
