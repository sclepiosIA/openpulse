"""Auth JWT partagée (même contrat que openpulse-gestion-drive-api).

Modes :
- disabled : dev/tests — utilisateur anonyme "dev".
- jwt      : valide un JWT HS256 (token Gestion/Supabase) via stdlib.
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
    user_id: str
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
    issuer: str,
    audience: str,
) -> dict:
    """Validation stricte du JWT Gestion/Supabase."""
    try:
        header_b64, payload_b64, sig_b64 = token.split(".")
        header = json.loads(_b64url_decode(header_b64))
        claims = json.loads(_b64url_decode(payload_b64))
        supplied = _b64url_decode(sig_b64)
    except (ValueError, TypeError, json.JSONDecodeError, UnicodeDecodeError) as exc:
        raise AuthError("JWT malformé") from exc
    if not isinstance(header, dict) or not isinstance(claims, dict):
        raise AuthError("JWT malformé")
    if header.get("alg") != "HS256":
        raise AuthError("algorithme JWT non supporté")
    expected = hmac.new(
        secret.encode(), f"{header_b64}.{payload_b64}".encode(), hashlib.sha256
    ).digest()
    if not hmac.compare_digest(expected, supplied):
        raise AuthError("signature JWT invalide")
    if not claims.get("sub") or claims.get("exp") is None or claims.get("iat") is None:
        raise AuthError("claims JWT obligatoires absents")
    try:
        now = time.time()
        exp = float(claims["exp"])
        iat = float(claims["iat"])
        nbf = float(claims.get("nbf", iat))
    except (TypeError, ValueError) as exc:
        raise AuthError("claims temporels JWT invalides") from exc
    if now > exp:
        raise AuthError("token expiré")
    if now < nbf or iat > now + 60:
        raise AuthError("fenêtre temporelle JWT invalide")
    if exp - iat > 24 * 3600:
        raise AuthError("durée de vie JWT excessive")
    if claims.get("iss") != issuer:
        raise AuthError("émetteur JWT invalide")
    aud = claims.get("aud")
    if not (aud == audience or isinstance(aud, list) and audience in aud):
        raise AuthError("audience JWT invalide")
    return claims


def get_current_user(
    request: Request, settings: Settings = Depends(get_settings)
) -> CurrentUser:
    if settings.email_auth_mode == "disabled":
        return CurrentUser(
            user_id="00000000-0000-0000-0000-000000000000",
            email="dev@local",
        )

    authorization = request.headers.get("authorization", "")
    if not authorization.lower().startswith("bearer "):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Bearer token requis")
    token = authorization[7:].strip()
    if not settings.email_jwt_secret:
        raise HTTPException(
            status.HTTP_500_INTERNAL_SERVER_ERROR, "EMAIL_JWT_SECRET non configuré"
        )
    try:
        claims = decode_hs256_jwt(
            token,
            settings.email_jwt_secret,
            issuer=settings.email_jwt_issuer,
            audience=settings.email_jwt_audience,
        )
    except AuthError as exc:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, str(exc)) from exc
    return CurrentUser(
        user_id=str(claims["sub"]),
        email=claims.get("email"),
        raw_claims=claims,
    )
