from __future__ import annotations

import time

from fastapi.testclient import TestClient

from app.auth import make_hs256_jwt
from app.config import Settings, get_settings
from app.main import create_app

SECRET = "rbac-test-secret-long-enough"


def test_prod_configuration_fails_closed_without_secure_backends():
    settings = Settings(drive_env="prod")
    try:
        settings.validate_runtime()
    except RuntimeError as exc:
        assert "Configuration production Drive refusée" in str(exc)
    else:
        raise AssertionError("Une configuration prod incomplète ne doit jamais démarrer")


def _token(
    user_id: str,
    email: str,
    *,
    role: str | None = None,
    aal: str = "aal2",
) -> str:
    now = int(time.time())
    return make_hs256_jwt(
        {
            "sub": user_id,
            "email": email,
            "app_role": role,
            "aal": aal,
            "iss": "openpulse-drive",
            "aud": "openpulse-drive-api",
            "iat": now,
            "nbf": now,
            "exp": now + 600,
        },
        SECRET,
    )


def _headers(
    user_id: str,
    email: str,
    *,
    role: str | None = None,
    aal: str = "aal2",
) -> dict[str, str]:
    return {"Authorization": f"Bearer {_token(user_id, email, role=role, aal=aal)}"}


def test_only_global_admin_can_create_space_and_owner_is_isolated(monkeypatch):
    monkeypatch.setenv("DRIVE_ENV", "test")
    monkeypatch.setenv("DATABASE_URL", "")
    monkeypatch.setenv("AZURE_STORAGE_CONNECTION_STRING", "")
    monkeypatch.setenv("DRIVE_AUTH_MODE", "jwt")
    monkeypatch.setenv("DRIVE_JWT_SECRET", SECRET)
    monkeypatch.setenv("DRIVE_JWT_ISSUER", "openpulse-drive")
    monkeypatch.setenv("DRIVE_JWT_AUDIENCE", "openpulse-drive-api")
    monkeypatch.setenv("DRIVE_APP_SECRET", "upload-test-secret")
    get_settings.cache_clear()

    alice = _headers("11111111-1111-1111-1111-111111111111", "alice@example.test")
    admin = _headers(
        "33333333-3333-3333-3333-333333333333",
        "admin@example.test",
        role="global_admin",
    )
    bob = _headers("22222222-2222-2222-2222-222222222222", "bob@example.test")
    app = create_app()
    with TestClient(app) as client:
        assert client.post(
            "/api/drive/spaces",
            headers=alice,
            json={"name": "Alice", "slug": "alice", "type": "personal"},
        ).status_code == 403

        created = client.post(
            "/api/drive/spaces",
            headers=admin,
            json={"name": "Administré", "slug": "administre", "type": "project"},
        )
        assert created.status_code == 201, created.text
        space_id = created.json()["id"]

        for legacy_role in ("admin", "owner", "service_role"):
            legacy_admin = _headers(
                f"44444444-4444-4444-4444-{len(legacy_role):012d}",
                f"{legacy_role}@example.test",
                role=legacy_role,
            )
            assert client.post(
                "/api/drive/spaces",
                headers=legacy_admin,
                json={"name": legacy_role, "slug": legacy_role.replace("_", "-"), "type": "project"},
            ).status_code == 403
            assert client.get("/api/drive/spaces", headers=legacy_admin).json() == []
            assert client.get(
                "/api/drive/tree", headers=legacy_admin, params={"space_id": space_id}
            ).status_code == 403

        assert [s["id"] for s in client.get("/api/drive/spaces", headers=admin).json()] == [space_id]
        assert client.get("/api/drive/spaces", headers=alice).json() == []
        assert client.get("/api/drive/spaces", headers=bob).json() == []
        assert client.get(
            "/api/drive/tree", headers=bob, params={"space_id": space_id}
        ).status_code == 403
        assert client.post(
            "/api/drive/upload-intent",
            headers=bob,
            json={"space_id": space_id, "path": "/intrusion.txt", "size_bytes": 1},
        ).status_code == 403
        assert client.get(
            "/api/drive/permissions", headers=bob, params={"space_id": space_id}
        ).status_code == 403

    get_settings.cache_clear()


def test_aal1_drive_token_is_rejected(monkeypatch):
    monkeypatch.setenv("DRIVE_ENV", "test")
    monkeypatch.setenv("DRIVE_AUTH_MODE", "jwt")
    monkeypatch.setenv("DRIVE_JWT_SECRET", SECRET)
    monkeypatch.setenv("DRIVE_JWT_ISSUER", "openpulse-drive")
    monkeypatch.setenv("DRIVE_JWT_AUDIENCE", "openpulse-drive-api")
    get_settings.cache_clear()
    app = create_app()
    headers = _headers("11111111-1111-1111-1111-111111111111", "user@example.test", aal="aal1")
    with TestClient(app, raise_server_exceptions=False) as client:
        assert client.get("/api/drive/spaces", headers=headers).status_code == 401
    get_settings.cache_clear()


def test_malformed_or_incomplete_jwt_is_always_401(monkeypatch):
    monkeypatch.setenv("DRIVE_ENV", "test")
    monkeypatch.setenv("DRIVE_AUTH_MODE", "jwt")
    monkeypatch.setenv("DRIVE_JWT_SECRET", SECRET)
    monkeypatch.setenv("DRIVE_JWT_ISSUER", "openpulse-drive")
    monkeypatch.setenv("DRIVE_JWT_AUDIENCE", "openpulse-drive-api")
    get_settings.cache_clear()
    app = create_app()
    with TestClient(app, raise_server_exceptions=False) as client:
        assert client.get(
            "/api/drive/spaces", headers={"Authorization": "Bearer a.b.c"}
        ).status_code == 401
        token_without_sub = make_hs256_jwt(
            {"iss": "openpulse-drive", "aud": "openpulse-drive-api", "iat": int(time.time()), "exp": int(time.time()) + 60},
            SECRET,
        )
        assert client.get(
            "/api/drive/spaces", headers={"Authorization": f"Bearer {token_without_sub}"}
        ).status_code == 401
    get_settings.cache_clear()
