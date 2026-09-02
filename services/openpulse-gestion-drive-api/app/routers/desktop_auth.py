"""Auth Desktop Drive via session Gestion MFA et refresh Drive-scopé.

Le bearer fournisseur est validé uniquement pendant le handoff web. Le shell
Tauri reçoit un JWT Drive court et un grant opaque, rotatif et révocable stocké
haché côté serveur. Aucun refresh fournisseur n'est transmis au Desktop.
"""

from __future__ import annotations

import base64
import hashlib
import json
import re
import secrets
import time
from datetime import UTC, datetime, timedelta
from uuid import uuid4

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status

from ..auth import make_hs256_jwt
from ..config import Settings, get_settings
from ..deps import get_repository
from ..repository import Repository
from ..schemas import DesktopLoginResponse, DesktopRefreshRequest

router = APIRouter(prefix="/api/drive/desktop", tags=["desktop-auth"])

_REVOKED_REFRESH_DETAIL = {
    "code": "refresh_revoked",
    "message": "Session Desktop révoquée",
}
_DESKTOP_NONCE_RE = re.compile(r"^[A-Za-z0-9_-]{12,128}$")
_HANDOFF_CHALLENGE_TTL = timedelta(minutes=5)
_FRESH_MFA_MAX_AGE_SECONDS = 5 * 60
_FRESH_MFA_DETAIL = {
    "code": "fresh_mfa_required",
    "message": "Validation MFA récente requise pour appairer ce Desktop",
}


def _provider_claims(provider_access_token: str) -> dict:
    try:
        _header, payload, _signature = provider_access_token.split(".")
        padding = "=" * (-len(payload) % 4)
        claims = json.loads(base64.urlsafe_b64decode(payload + padding))
    except (ValueError, TypeError, json.JSONDecodeError, UnicodeDecodeError) as exc:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "Session MFA AAL2 requise",
        ) from exc
    if not isinstance(claims, dict):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Session MFA AAL2 requise")
    return claims


def _require_provider_aal2(provider_access_token: str, *, required: bool = True) -> dict:
    """Valide la session du provider, en exigeant MFA AAL2 si `required`.

    `required` reflète `DRIVE_REQUIRE_MFA` : vrai par défaut, désactivé sur les
    déploiements internes dont les comptes n'ont pas de TOTP. Les claims sont
    décodés dans tous les cas — la cohérence `sub` / utilisateur reste vérifiée
    par l'appelant, seule l'exigence de second facteur est levée.
    """

    claims = _provider_claims(provider_access_token)
    if required and claims.get("aal") != "aal2":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Session MFA AAL2 requise")
    return claims


def _require_fresh_totp(claims: dict) -> datetime:
    now = int(time.time())
    timestamps = [
        entry.get("timestamp")
        for entry in claims.get("amr", [])
        if isinstance(entry, dict) and entry.get("method") == "totp"
    ]
    valid = [value for value in timestamps if isinstance(value, int) and not isinstance(value, bool)]
    if not valid or max(valid) < now - _FRESH_MFA_MAX_AGE_SECONDS or max(valid) > now + 30:
        raise HTTPException(status.HTTP_403_FORBIDDEN, _FRESH_MFA_DETAIL)
    return datetime.fromtimestamp(max(valid), UTC)


def _display_name(email: str, metadata: dict | None) -> str:
    if metadata:
        candidate = metadata.get("full_name") or metadata.get("name")
        if isinstance(candidate, str) and candidate.strip():
            return candidate.strip()
    return email.split("@")[0].replace(".", " ")


def _drive_token(
    *, user_id: str, email: str, app_role: str | None, settings: Settings
) -> str:
    now = int(time.time())
    return make_hs256_jwt(
        {
            "sub": user_id,
            "email": email,
            "app_role": app_role,
            "iss": settings.drive_jwt_issuer,
            "aud": settings.drive_jwt_audience,
            "iat": now,
            "nbf": now,
            "exp": now + settings.drive_jwt_ttl_seconds,
            "provider": "supabase-bridge",
            "aal": "aal2",
        },
        settings.drive_jwt_secret,
    )


def _new_refresh_token() -> str:
    return secrets.token_urlsafe(48)


def _refresh_hash(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _require_desktop_nonce(request: Request) -> str:
    nonce = request.headers.get("x-openpulse-desktop-nonce", "")
    if not _DESKTOP_NONCE_RE.fullmatch(nonce):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Nonce Desktop invalide")
    return nonce


def _refresh_expiry(settings: Settings) -> datetime:
    return datetime.now(UTC) + timedelta(seconds=settings.desktop_refresh_ttl_seconds)


def _provider_headers(settings: Settings, authorization: str) -> dict[str, str]:
    return {
        "apikey": settings.supabase_anon_key,
        "Authorization": authorization,
    }


def _response_from_identity(
    *,
    user_id: str,
    email: str,
    app_role: str | None,
    display_name: str,
    refresh_token: str | None,
    settings: Settings,
) -> DesktopLoginResponse:
    if not settings.drive_jwt_secret:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Secret JWT Drive non configuré")
    return DesktopLoginResponse(
        access_token=_drive_token(
            user_id=user_id,
            email=email,
            app_role=app_role,
            settings=settings,
        ),
        refresh_token=refresh_token,
        expires_at=int(time.time()) + settings.drive_jwt_ttl_seconds,
        user_email=email,
        display_name=display_name,
    )


@router.post("/login", response_model=DesktopLoginResponse)
async def desktop_login() -> DesktopLoginResponse:
    # Aucun schéma password n'est exposé dans OpenAPI : l'ancien client reçoit
    # un 410 quel que soit son corps et doit basculer vers le bridge MFA.
    raise HTTPException(
        status.HTTP_410_GONE,
        "Connexion par mot de passe désactivée ; utilisez la session Gestion MFA",
    )


@router.post("/refresh", response_model=DesktopLoginResponse)
async def desktop_refresh(
    body: DesktopRefreshRequest,
    settings: Settings = Depends(get_settings),
    repo: Repository = Depends(get_repository),
) -> DesktopLoginResponse:
    if not settings.drive_jwt_secret:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "Pont d'auth desktop non configuré",
        )
    replacement = _new_refresh_token()
    session = await repo.rotate_desktop_refresh_session(
        token_hash=_refresh_hash(body.refresh_token),
        replacement_hash=_refresh_hash(replacement),
        expires_at=_refresh_expiry(settings),
    )
    if session is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, _REVOKED_REFRESH_DETAIL)
    return _response_from_identity(
        user_id=session["user_id"],
        email=session["email"],
        # Les rôles provider ne survivent jamais dans un grant long : une
        # rétrogradation prend effet au plus tard à l'expiration du JWT court.
        app_role=None,
        display_name=session["display_name"],
        refresh_token=replacement,
        settings=settings,
    )


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def desktop_logout(
    body: DesktopRefreshRequest,
    repo: Repository = Depends(get_repository),
) -> Response:
    # Réponse idempotente pour ne pas créer d'oracle de jetons.
    await repo.revoke_desktop_refresh_family(_refresh_hash(body.refresh_token))
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/web/token", response_model=DesktopLoginResponse)
async def exchange_web_token(
    request: Request,
    settings: Settings = Depends(get_settings),
    repo: Repository = Depends(get_repository),
) -> DesktopLoginResponse:
    authorization = request.headers.get("authorization", "")
    if not authorization.lower().startswith("bearer "):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Bearer Supabase requis")
    if not settings.supabase_url or not settings.supabase_anon_key or not settings.drive_jwt_secret:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Pont web Drive non configuré")
    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            response = await client.get(
                f"{settings.supabase_url.rstrip('/')}/auth/v1/user",
                headers=_provider_headers(settings, authorization),
            )
    except httpx.HTTPError as exc:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, "Provider d'auth inaccessible") from exc
    if response.status_code != 200:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Session Gestion invalide")
    user = response.json()
    user_id = user.get("id") if isinstance(user, dict) else None
    email = user.get("email") if isinstance(user, dict) else None
    if not isinstance(user_id, str) or not user_id.strip() or not isinstance(email, str) or not email:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Identité Gestion incomplète")

    provider_access_token = authorization[7:].strip()
    provider_claims = _require_provider_aal2(
        provider_access_token, required=settings.drive_require_mfa
    )
    if provider_claims.get("sub") != user_id:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Session Gestion incohérente")
    app_metadata = user.get("app_metadata") or {}
    app_role = app_metadata.get("role") if isinstance(app_metadata, dict) else None
    if not isinstance(app_role, str):
        app_role = None
    display_name = _display_name(email, user.get("user_metadata"))
    desktop_handoff = request.headers.get("x-openpulse-desktop-handoff") == "1"
    challenge = request.headers.get("x-openpulse-desktop-challenge")
    if desktop_handoff and not challenge:
        nonce = _require_desktop_nonce(request)
        handoff_challenge = _new_refresh_token()
        await repo.create_desktop_handoff_challenge(
            challenge_hash=_refresh_hash(handoff_challenge),
            user_id=user_id,
            nonce_hash=_refresh_hash(nonce),
            expires_at=datetime.now(UTC) + _HANDOFF_CHALLENGE_TTL,
        )
        raise HTTPException(
            status.HTTP_428_PRECONDITION_REQUIRED,
            {
                "code": "fresh_mfa_required",
                "handoff_challenge": handoff_challenge,
            },
        )
    refresh_token: str | None = None
    if desktop_handoff and challenge:
        nonce = _require_desktop_nonce(request)
        mfa_verified_at = _require_fresh_totp(provider_claims)
        refresh_token = _new_refresh_token()
        redeemed = await repo.redeem_desktop_handoff_challenge(
            challenge_hash=_refresh_hash(challenge),
            user_id=user_id,
            nonce_hash=_refresh_hash(nonce),
            mfa_verified_at=mfa_verified_at,
            token_hash=_refresh_hash(refresh_token),
            family_id=uuid4(),
            email=email,
            display_name=display_name,
            expires_at=_refresh_expiry(settings),
        )
        if not redeemed:
            raise HTTPException(status.HTTP_403_FORBIDDEN, _FRESH_MFA_DETAIL)
    return _response_from_identity(
        user_id=user_id,
        email=email,
        app_role=app_role,
        display_name=display_name,
        refresh_token=refresh_token,
        settings=settings,
    )
