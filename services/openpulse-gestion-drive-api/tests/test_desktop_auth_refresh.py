"""Régressions d'authentification Gestion Desktop avec refresh Drive-scopé."""

from __future__ import annotations

import base64
import json
import time
from uuid import uuid4

import httpx
import pytest
from fastapi import HTTPException
from starlette.requests import Request

from app.auth import decode_hs256_jwt
from app.config import Settings
from app.repository import MemoryRepository
from app.routers import desktop_auth
from app.schemas import DesktopRefreshRequest


class _ProviderResponse:
    def __init__(self, status_code: int, payload: dict):
        self.status_code = status_code
        self._payload = payload

    def json(self) -> dict:
        return self._payload


class _ProviderClient:
    response = _ProviderResponse(500, {})
    calls: list[dict] = []

    def __init__(self, **_kwargs):
        pass

    async def __aenter__(self):
        return self

    async def __aexit__(self, *_args):
        return None

    async def get(self, url: str, **kwargs):
        self.calls.append({"method": "GET", "url": url, **kwargs})
        return self.response


class _OfflineProviderClient(_ProviderClient):
    async def get(self, url: str, **kwargs):
        request = httpx.Request("GET", url)
        raise httpx.ConnectError("offline", request=request)


def _settings() -> Settings:
    return Settings(
        drive_env="test",
        drive_jwt_secret="drive-secret-long-enough-for-tests-123456",
        drive_jwt_ttl_seconds=3600,
        desktop_refresh_ttl_seconds=30 * 24 * 3600,
        supabase_url="https://auth.example.test",
        supabase_anon_key="anon-test-key",
    )


def _provider_access_token(
    aal: str = "aal2", *, mfa_timestamp: int | None = None, subject: str = "user-1"
) -> str:
    def encode(value: dict) -> str:
        return base64.urlsafe_b64encode(json.dumps(value).encode()).decode().rstrip("=")

    claims: dict[str, object] = {"sub": subject, "aal": aal}
    if mfa_timestamp is not None:
        claims["amr"] = [{"method": "totp", "timestamp": mfa_timestamp}]
    return f"{encode({'alg': 'HS256'})}.{encode(claims)}.signature"


def _request_with_bearer(
    token: str,
    *,
    desktop: bool = False,
    nonce: str | None = None,
    challenge: str | None = None,
) -> Request:
    headers = [(b"authorization", f"Bearer {token}".encode())]
    if desktop:
        headers.append((b"x-openpulse-desktop-handoff", b"1"))
    if nonce:
        headers.append((b"x-openpulse-desktop-nonce", nonce.encode()))
    if challenge:
        headers.append((b"x-openpulse-desktop-challenge", challenge.encode()))
    return Request(
        {
            "type": "http",
            "method": "POST",
            "path": "/api/drive/desktop/web/token",
            "headers": headers,
        }
    )


async def _desktop_handoff(repo: MemoryRepository):
    nonce = f"desktop-nonce-{uuid4()}"
    with pytest.raises(HTTPException) as required:
        await desktop_auth.exchange_web_token(
            _request_with_bearer(
                _provider_access_token("aal2", mfa_timestamp=1),
                desktop=True,
                nonce=nonce,
            ),
            _settings(),
            repo,
        )
    challenge_created_at = max(
        row["created_at"] for row in repo.desktop_handoff_challenges.values()
    )
    return await desktop_auth.exchange_web_token(
        _request_with_bearer(
            _provider_access_token(
                "aal2", mfa_timestamp=int(challenge_created_at.timestamp()) + 1
            ),
            desktop=True,
            nonce=nonce,
            challenge=required.value.detail["handoff_challenge"],
        ),
        _settings(),
        repo,
    )


@pytest.mark.asyncio
async def test_password_login_is_disabled_without_parsing_credentials():
    with pytest.raises(HTTPException) as error:
        await desktop_auth.desktop_login()

    assert error.value.status_code == 410


@pytest.mark.asyncio
async def test_desktop_exchange_requires_a_server_challenge_before_issuing_refresh(monkeypatch):
    provider_token = _provider_access_token("aal2")
    _ProviderClient.calls = []
    _ProviderClient.response = _ProviderResponse(
        200,
        {
            "id": "user-1",
            "email": "user@example.test",
            "app_metadata": {"role": "admin"},
            "user_metadata": {"full_name": "Utilisateur Test"},
        },
    )
    monkeypatch.setattr(desktop_auth.httpx, "AsyncClient", _ProviderClient)
    repo = MemoryRepository()

    with pytest.raises(HTTPException) as required:
        await desktop_auth.exchange_web_token(
            _request_with_bearer(
                provider_token,
                desktop=True,
                nonce="desktop-nonce-server-bound-1234",
            ),
            _settings(),
            repo,
        )

    assert required.value.status_code == 428
    assert required.value.detail["code"] == "fresh_mfa_required"
    assert len(required.value.detail["handoff_challenge"]) >= 32
    assert repo.desktop_refresh_sessions == {}
    assert _ProviderClient.calls == [
        {
            "method": "GET",
            "url": "https://auth.example.test/auth/v1/user",
            "headers": {
                "apikey": "anon-test-key",
                "Authorization": f"Bearer {provider_token}",
            },
        }
    ]


@pytest.mark.asyncio
async def test_desktop_exchange_rejects_a_challenge_redeemed_without_fresh_mfa(monkeypatch):
    provider_token = _provider_access_token("aal2", mfa_timestamp=1)
    _ProviderClient.response = _ProviderResponse(
        200,
        {"id": "user-1", "email": "user@example.test", "app_metadata": {}},
    )
    monkeypatch.setattr(desktop_auth.httpx, "AsyncClient", _ProviderClient)
    repo = MemoryRepository()
    nonce = "desktop-nonce-fresh-mfa-1234"
    with pytest.raises(HTTPException) as required:
        await desktop_auth.exchange_web_token(
            _request_with_bearer(provider_token, desktop=True, nonce=nonce),
            _settings(),
            repo,
        )
    challenge = required.value.detail["handoff_challenge"]

    with pytest.raises(HTTPException) as stale:
        await desktop_auth.exchange_web_token(
            _request_with_bearer(
                provider_token,
                desktop=True,
                nonce=nonce,
                challenge=challenge,
            ),
            _settings(),
            repo,
        )

    assert stale.value.status_code == 403
    assert stale.value.detail["code"] == "fresh_mfa_required"
    assert repo.desktop_refresh_sessions == {}


@pytest.mark.asyncio
async def test_fresh_mfa_redeems_the_server_challenge_exactly_once(monkeypatch):
    _ProviderClient.response = _ProviderResponse(
        200,
        {"id": "user-1", "email": "user@example.test", "app_metadata": {}},
    )
    monkeypatch.setattr(desktop_auth.httpx, "AsyncClient", _ProviderClient)
    repo = MemoryRepository()
    nonce = "desktop-nonce-one-time-mfa-1234"
    with pytest.raises(HTTPException) as required:
        await desktop_auth.exchange_web_token(
            _request_with_bearer(
                _provider_access_token("aal2", mfa_timestamp=1),
                desktop=True,
                nonce=nonce,
            ),
            _settings(),
            repo,
        )
    challenge = required.value.detail["handoff_challenge"]
    challenge_created_at = next(iter(repo.desktop_handoff_challenges.values()))["created_at"]
    fresh_token = _provider_access_token(
        "aal2", mfa_timestamp=int(challenge_created_at.timestamp()) + 1
    )
    request = _request_with_bearer(
        fresh_token,
        desktop=True,
        nonce=nonce,
        challenge=challenge,
    )

    response = await desktop_auth.exchange_web_token(request, _settings(), repo)

    assert response.refresh_token is not None
    assert len(repo.desktop_refresh_sessions) == 1
    assert next(iter(repo.desktop_handoff_challenges.values()))["consumed_at"] is not None
    with pytest.raises(HTTPException) as replayed:
        await desktop_auth.exchange_web_token(request, _settings(), repo)
    assert replayed.value.status_code == 403
    assert len(repo.desktop_refresh_sessions) == 1


@pytest.mark.asyncio
async def test_desktop_challenge_rejects_mfa_from_the_challenge_second(monkeypatch):
    _ProviderClient.response = _ProviderResponse(
        200,
        {"id": "user-1", "email": "user@example.test"},
    )
    monkeypatch.setattr(desktop_auth.httpx, "AsyncClient", _ProviderClient)
    repo = MemoryRepository()
    nonce = "desktop-nonce-same-second-1234"
    with pytest.raises(HTTPException) as challenge_error:
        await desktop_auth.exchange_web_token(
            _request_with_bearer(
                _provider_access_token("aal2", mfa_timestamp=1), desktop=True, nonce=nonce
            ),
            _settings(),
            repo,
        )
    challenge = challenge_error.value.detail["handoff_challenge"]
    created_at = next(iter(repo.desktop_handoff_challenges.values()))["created_at"]

    with pytest.raises(HTTPException) as too_early:
        await desktop_auth.exchange_web_token(
            _request_with_bearer(
                _provider_access_token(
                    "aal2", mfa_timestamp=int(created_at.timestamp())
                ),
                desktop=True,
                nonce=nonce,
                challenge=challenge,
            ),
            _settings(),
            repo,
        )

    assert too_early.value.status_code == 403
    assert repo.desktop_refresh_sessions == {}


@pytest.mark.asyncio
async def test_desktop_challenge_is_bound_to_its_original_nonce(monkeypatch):
    _ProviderClient.response = _ProviderResponse(
        200,
        {"id": "user-1", "email": "user@example.test"},
    )
    monkeypatch.setattr(desktop_auth.httpx, "AsyncClient", _ProviderClient)
    repo = MemoryRepository()
    original_nonce = "desktop-nonce-original-1234"
    with pytest.raises(HTTPException) as challenge_error:
        await desktop_auth.exchange_web_token(
            _request_with_bearer(
                _provider_access_token("aal2", mfa_timestamp=1),
                desktop=True,
                nonce=original_nonce,
            ),
            _settings(),
            repo,
        )
    challenge = challenge_error.value.detail["handoff_challenge"]

    with pytest.raises(HTTPException) as mismatch:
        await desktop_auth.exchange_web_token(
            _request_with_bearer(
                _provider_access_token("aal2", mfa_timestamp=int(time.time())),
                desktop=True,
                nonce="desktop-nonce-substituted-5678",
                challenge=challenge,
            ),
            _settings(),
            repo,
        )

    assert mismatch.value.status_code == 403
    assert repo.desktop_refresh_sessions == {}


@pytest.mark.asyncio
async def test_desktop_challenge_rejects_a_future_mfa_timestamp(monkeypatch):
    _ProviderClient.response = _ProviderResponse(
        200,
        {"id": "user-1", "email": "user@example.test"},
    )
    monkeypatch.setattr(desktop_auth.httpx, "AsyncClient", _ProviderClient)
    repo = MemoryRepository()
    nonce = "desktop-nonce-future-mfa-1234"
    with pytest.raises(HTTPException) as challenge_error:
        await desktop_auth.exchange_web_token(
            _request_with_bearer(
                _provider_access_token("aal2", mfa_timestamp=1), desktop=True, nonce=nonce
            ),
            _settings(),
            repo,
        )
    challenge = challenge_error.value.detail["handoff_challenge"]

    with pytest.raises(HTTPException) as future:
        await desktop_auth.exchange_web_token(
            _request_with_bearer(
                _provider_access_token("aal2", mfa_timestamp=int(time.time()) + 3600),
                desktop=True,
                nonce=nonce,
                challenge=challenge,
            ),
            _settings(),
            repo,
        )

    assert future.value.status_code == 403
    assert repo.desktop_refresh_sessions == {}


@pytest.mark.asyncio
async def test_drive_refresh_rotates_and_replay_revokes_the_whole_family(monkeypatch):
    _ProviderClient.calls = []
    _ProviderClient.response = _ProviderResponse(
        200,
        {
            "id": "user-1",
            "email": "user@example.test",
            "app_metadata": {"role": "global_admin"},
            "user_metadata": {"full_name": "Utilisateur Test"},
        },
    )
    monkeypatch.setattr(desktop_auth.httpx, "AsyncClient", _ProviderClient)
    repo = MemoryRepository()
    initial = await _desktop_handoff(repo)
    _ProviderClient.calls = []

    rotated = await desktop_auth.desktop_refresh(
        DesktopRefreshRequest(refresh_token=initial.refresh_token or ""),
        _settings(),
        repo,
    )
    rerotated = await desktop_auth.desktop_refresh(
        DesktopRefreshRequest(refresh_token=rotated.refresh_token or ""),
        _settings(),
        repo,
    )

    assert rotated.refresh_token not in {None, initial.refresh_token}
    assert rerotated.refresh_token not in {initial.refresh_token, rotated.refresh_token}
    assert rotated.user_email == initial.user_email
    assert _ProviderClient.calls == []
    initial_claims = decode_hs256_jwt(
        initial.access_token,
        _settings().drive_jwt_secret,
        audience=_settings().drive_jwt_audience,
        issuer=_settings().drive_jwt_issuer,
    )
    rotated_claims = decode_hs256_jwt(
        rotated.access_token,
        _settings().drive_jwt_secret,
        audience=_settings().drive_jwt_audience,
        issuer=_settings().drive_jwt_issuer,
    )
    assert initial_claims["app_role"] == "global_admin"
    assert rotated_claims.get("app_role") is None

    with pytest.raises(HTTPException) as reused:
        await desktop_auth.desktop_refresh(
            DesktopRefreshRequest(refresh_token=initial.refresh_token or ""),
            _settings(),
            repo,
        )
    assert reused.value.status_code == 401
    assert reused.value.detail == {
        "code": "refresh_revoked",
        "message": "Session Desktop révoquée",
    }
    with pytest.raises(HTTPException) as family_revoked:
        await desktop_auth.desktop_refresh(
            DesktopRefreshRequest(refresh_token=rerotated.refresh_token or ""),
            _settings(),
            repo,
        )
    assert family_revoked.value.status_code == 401


@pytest.mark.asyncio
async def test_web_exchange_does_not_issue_desktop_refresh_without_handoff_header(monkeypatch):
    _ProviderClient.response = _ProviderResponse(
        200,
        {"id": "user-1", "email": "user@example.test", "app_metadata": {}},
    )
    monkeypatch.setattr(desktop_auth.httpx, "AsyncClient", _ProviderClient)
    repo = MemoryRepository()

    response = await desktop_auth.exchange_web_token(
        _request_with_bearer(_provider_access_token()), _settings(), repo
    )

    assert response.refresh_token is None
    assert repo.desktop_refresh_sessions == {}


@pytest.mark.asyncio
async def test_new_desktop_handoff_revokes_every_previous_family(monkeypatch):
    _ProviderClient.response = _ProviderResponse(
        200,
        {"id": "user-1", "email": "user@example.test", "app_metadata": {}},
    )
    monkeypatch.setattr(desktop_auth.httpx, "AsyncClient", _ProviderClient)
    repo = MemoryRepository()
    first = await _desktop_handoff(repo)
    second = await _desktop_handoff(repo)

    with pytest.raises(HTTPException) as superseded:
        await desktop_auth.desktop_refresh(
            DesktopRefreshRequest(refresh_token=first.refresh_token or ""),
            _settings(),
            repo,
        )
    assert superseded.value.status_code == 401
    assert (
        await desktop_auth.desktop_refresh(
            DesktopRefreshRequest(refresh_token=second.refresh_token or ""),
            _settings(),
            repo,
        )
    ).refresh_token


@pytest.mark.asyncio
async def test_desktop_logout_revokes_refresh_idempotently(monkeypatch):
    _ProviderClient.response = _ProviderResponse(
        200,
        {
            "id": "user-1",
            "email": "user@example.test",
            "user_metadata": {"full_name": "Utilisateur Test"},
        },
    )
    monkeypatch.setattr(desktop_auth.httpx, "AsyncClient", _ProviderClient)
    repo = MemoryRepository()
    initial = await _desktop_handoff(repo)
    rotated = await desktop_auth.desktop_refresh(
        DesktopRefreshRequest(refresh_token=initial.refresh_token or ""),
        _settings(),
        repo,
    )
    body = DesktopRefreshRequest(refresh_token=rotated.refresh_token or "")

    first = await desktop_auth.desktop_logout(body, repo)
    second = await desktop_auth.desktop_logout(body, repo)

    assert first.status_code == 204
    assert second.status_code == 204
    with pytest.raises(HTTPException) as revoked:
        await desktop_auth.desktop_refresh(body, _settings(), repo)
    assert revoked.value.status_code == 401
    with pytest.raises(HTTPException) as family_revoked:
        await desktop_auth.desktop_refresh(
            DesktopRefreshRequest(refresh_token=initial.refresh_token or ""),
            _settings(),
            repo,
        )
    assert family_revoked.value.status_code == 401


@pytest.mark.asyncio
async def test_unknown_drive_refresh_is_reported_as_revoked():
    with pytest.raises(HTTPException) as error:
        await desktop_auth.desktop_refresh(
            DesktopRefreshRequest(refresh_token="unknown-drive-refresh-credential-long-enough"),
            _settings(),
            MemoryRepository(),
        )

    assert error.value.status_code == 401
    assert error.value.detail == {
        "code": "refresh_revoked",
        "message": "Session Desktop révoquée",
    }


@pytest.mark.asyncio
async def test_web_exchange_rejects_aal1_after_provider_validation(monkeypatch):
    provider_token = _provider_access_token("aal1")
    _ProviderClient.response = _ProviderResponse(
        200,
        {"id": "user-1", "email": "user@example.test"},
    )
    monkeypatch.setattr(desktop_auth.httpx, "AsyncClient", _ProviderClient)

    with pytest.raises(HTTPException) as error:
        await desktop_auth.exchange_web_token(
            _request_with_bearer(provider_token),
            _settings(),
            MemoryRepository(),
        )

    assert error.value.status_code == 403
    assert "mfa" in str(error.value.detail).lower()


@pytest.mark.asyncio
async def test_web_exchange_requires_provider_email(monkeypatch):
    provider_token = _provider_access_token("aal2")
    _ProviderClient.response = _ProviderResponse(200, {"id": "user-1"})
    monkeypatch.setattr(desktop_auth.httpx, "AsyncClient", _ProviderClient)

    with pytest.raises(HTTPException) as error:
        await desktop_auth.exchange_web_token(
            _request_with_bearer(provider_token),
            _settings(),
            MemoryRepository(),
        )

    assert error.value.status_code == 401
    assert "identité" in str(error.value.detail).lower()


@pytest.mark.asyncio
async def test_web_exchange_binds_provider_claims_to_the_validated_user(monkeypatch):
    _ProviderClient.response = _ProviderResponse(
        200,
        {"id": "user-1", "email": "user@example.test"},
    )
    monkeypatch.setattr(desktop_auth.httpx, "AsyncClient", _ProviderClient)

    with pytest.raises(HTTPException) as error:
        await desktop_auth.exchange_web_token(
            _request_with_bearer(_provider_access_token(subject="other-user")),
            _settings(),
            MemoryRepository(),
        )

    assert error.value.status_code == 401


@pytest.mark.asyncio
async def test_web_exchange_network_failure_is_generic(monkeypatch):
    monkeypatch.setattr(desktop_auth.httpx, "AsyncClient", _OfflineProviderClient)

    with pytest.raises(HTTPException) as error:
        await desktop_auth.exchange_web_token(
            _request_with_bearer(_provider_access_token()),
            _settings(),
            MemoryRepository(),
        )

    assert error.value.status_code == 502
    assert error.value.detail == "Provider d'auth inaccessible"
