"""Validation d'accès Gestion Drive.

Modes :
- disabled : dev/tests — utilisateur anonyme "dev".
- jwt      : valide le JWT Drive HS256 court émis après handoff Gestion AAL2.

Les bearer/refresh du fournisseur d'identité ne sont jamais acceptés ici.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import time
from dataclasses import dataclass

from fastapi import Depends, HTTPException, Request, status

from .config import Settings, get_settings


@dataclass
class CurrentUser:
    user_id: str | None
    email: str | None = None
    raw_claims: dict | None = None


class AuthError(Exception):
    pass


def _b64url_decode(segment: str) -> bytes:
    padding = "=" * (-len(segment) % 4)
    return base64.urlsafe_b64decode(segment + padding)


def decode_hs256_jwt(
    token: str,
    secret: str,
    *,
    issuer: str | None = None,
    audience: str | None = None,
    require_identity: bool = False,
) -> dict:
    """Décode et valide un JWT HS256 (signature + exp). Stdlib uniquement."""
    try:
        header_b64, payload_b64, sig_b64 = token.split(".")
    except ValueError as exc:
        raise AuthError("format JWT invalide") from exc

    try:
        header = json.loads(_b64url_decode(header_b64))
        claims = json.loads(_b64url_decode(payload_b64))
        supplied_signature = _b64url_decode(sig_b64)
    except (ValueError, TypeError, json.JSONDecodeError, UnicodeDecodeError) as exc:
        raise AuthError("JWT malformé") from exc
    if not isinstance(header, dict) or not isinstance(claims, dict):
        raise AuthError("JWT malformé")
    if header.get("alg") != "HS256":
        raise AuthError(f"algorithme non supporté: {header.get('alg')}")

    expected = hmac.new(
        secret.encode(), f"{header_b64}.{payload_b64}".encode(), hashlib.sha256
    ).digest()
    if not hmac.compare_digest(expected, supplied_signature):
        raise AuthError("signature JWT invalide")

    exp = claims.get("exp")
    iat = claims.get("iat")
    nbf = claims.get("nbf")
    if require_identity and (not claims.get("sub") or exp is None or iat is None):
        raise AuthError("claims JWT obligatoires absents")
    try:
        now = time.time()
        if exp is not None and now > float(exp):
            raise AuthError("token expiré")
        if nbf is not None and now < float(nbf):
            raise AuthError("token pas encore valide")
        if iat is not None and float(iat) > now + 60:
            raise AuthError("date d'émission JWT invalide")
        if exp is not None and iat is not None and float(exp) - float(iat) > 24 * 3600:
            raise AuthError("durée de vie JWT excessive")
    except (TypeError, ValueError) as exc:
        raise AuthError("claims temporels JWT invalides") from exc
    if issuer and claims.get("iss") != issuer:
        raise AuthError("émetteur JWT invalide")
    aud = claims.get("aud")
    if audience and not (aud == audience or isinstance(aud, list) and audience in aud):
        raise AuthError("audience JWT invalide")
    return claims


def _b64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode().rstrip("=")


def make_hs256_jwt(claims: dict, secret: str) -> str:
    """Signe un JWT HS256 pour les clients Drive Desktop."""
    header_b64 = _b64url_encode(json.dumps({"alg": "HS256", "typ": "JWT"}).encode())
    payload_b64 = _b64url_encode(json.dumps(claims, separators=(",", ":")).encode())
    sig = hmac.new(secret.encode(), f"{header_b64}.{payload_b64}".encode(), hashlib.sha256).digest()
    return f"{header_b64}.{payload_b64}.{_b64url_encode(sig)}"


def get_current_user(
    request: Request, settings: Settings = Depends(get_settings)
) -> CurrentUser:
    if settings.drive_auth_mode == "disabled":
        return CurrentUser(user_id=None, email="dev@local")

    authorization = request.headers.get("authorization", "")
    if not authorization.lower().startswith("bearer "):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Bearer token requis")
    token = authorization[7:].strip()
    if not settings.drive_jwt_secret:
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, "DRIVE_JWT_SECRET non configuré")
    try:
        claims = decode_hs256_jwt(
            token,
            settings.drive_jwt_secret,
            issuer=settings.drive_jwt_issuer,
            audience=settings.drive_jwt_audience,
            require_identity=True,
        )
    except (AuthError, ValueError, TypeError, json.JSONDecodeError) as exc:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, str(exc)) from exc
    if claims.get("aal") != "aal2":
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Session MFA AAL2 requise")
    return CurrentUser(
        user_id=claims.get("sub"),
        email=claims.get("email"),
        raw_claims=claims,
    )
