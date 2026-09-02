"""Fixtures pytest — app FastAPI en mode memory + stub blob."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.config import get_settings
from app.main import create_app


@pytest.fixture()
def client(monkeypatch):
    # Environnement de test : pas de DB, pas d'Azure, auth désactivée.
    monkeypatch.setenv("DRIVE_ENV", "test")
    monkeypatch.setenv("DATABASE_URL", "")
    monkeypatch.setenv("AZURE_STORAGE_CONNECTION_STRING", "")
    monkeypatch.setenv("AZURE_STORAGE_ACCOUNT", "")
    monkeypatch.setenv("AZURE_STORAGE_ACCOUNT_KEY", "")
    monkeypatch.setenv("DRIVE_AUTH_MODE", "disabled")
    monkeypatch.setenv("DRIVE_APP_SECRET", "test-secret")
    get_settings.cache_clear()
    app = create_app()
    with TestClient(app) as c:
        yield c
    get_settings.cache_clear()


@pytest.fixture()
def space_id(client) -> str:
    resp = client.post(
        "/api/drive/spaces",
        json={"name": "Espace Test", "slug": "espace-test", "type": "gsi"},
    )
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]
