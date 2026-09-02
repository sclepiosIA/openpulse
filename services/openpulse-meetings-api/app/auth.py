"""Authentication for meetings APIs.

Development can explicitly use the local ``disabled`` mode. JWT mode validates
signature plus all identity and temporal claims before exposing any resource.
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


def decode_hs256_jwt(token: str, secret: str, issuer: str, audience: str) -> dict:
    """Validate HS256 signature and required issuer/audience/identity/time claims."""
    try:
        header_b64, payload_b64, sig_b64 = token.split(".")
        header = json.loads(_b64url_decode(header_b64))
        claims = json.loads(_b64url_decode(payload_b64))
    except (ValueError, UnicodeDecodeError, json.JSONDecodeError, TypeError) as exc:
        raise AuthError("format JWT invalide") from exc
    if not isinstance(header, dict) or not isinstance(claims, dict):
        raise AuthError("format JWT invalide")
    if header.get("alg") != "HS256":
        raise AuthError(f"algorithme non supporté: {header.get('alg')}")

    expected = hmac.new(secret.encode(), f"{header_b64}.{payload_b64}".encode(), hashlib.sha256).digest()
    try:
        signature = _b64url_decode(sig_b64)
    except (ValueError, UnicodeDecodeError) as exc:
        raise AuthError("format JWT invalide") from exc
    if not hmac.compare_digest(expected, signature):
        raise AuthError("signature JWT invalide")

    if claims.get("iss") != issuer:
        raise AuthError("issuer JWT invalide")
    token_audience = claims.get("aud")
    if not (token_audience == audience or isinstance(token_audience, list) and audience in token_audience):
        raise AuthError("audience JWT invalide")
    if not isinstance(claims.get("sub"), str) or not claims["sub"].strip():
        raise AuthError("subject JWT invalide")
    try:
        exp, iat, nbf = (claims[name] for name in ("exp", "iat", "nbf"))
        if any(isinstance(value, bool) or not isinstance(value, (int, float)) for value in (exp, iat, nbf)):
            raise ValueError
    except (KeyError, ValueError) as exc:
        raise AuthError("claims temporels JWT invalides") from exc
    now = time.time()
    if now >= exp:
        raise AuthError("token expiré")
    if iat > now or nbf > now:
        raise AuthError("token JWT pas encore valide")
    return claims


def get_current_user(request: Request, settings: Settings = Depends(get_settings)) -> CurrentUser:
    if settings.meetings_auth_mode == "disabled":
        return CurrentUser(user_id="dev", email="dev@local")

    authorization = request.headers.get("authorization", "")
    if not authorization.lower().startswith("bearer "):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Bearer token requis")
    token = authorization[7:].strip()
    if settings.meetings_auth_mode != "jwt" or not all((settings.meetings_jwt_secret, settings.meetings_jwt_issuer, settings.meetings_jwt_audience)):
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, "configuration JWT invalide")
    try:
        claims = decode_hs256_jwt(token, settings.meetings_jwt_secret, settings.meetings_jwt_issuer, settings.meetings_jwt_audience)
    except AuthError as exc:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, str(exc)) from exc
    return CurrentUser(user_id=claims["sub"], email=claims.get("email"), raw_claims=claims)
