"""Auth JWT partagée (même contrat que openpulse-gestion-drive-api).

Modes :
- disabled : dev/tests — utilisateur anonyme "dev".
- jwt      : valide un JWT HS256 (token Gestion/Supabase) via stdlib.
"""

from __future__ import annotations

import base64
import binascii
import hashlib
import hmac
import json
import math
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


def _numeric_date(value: object) -> float:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise AuthError("claims temporels JWT invalides")
    numeric_value = float(value)
    if not math.isfinite(numeric_value):
        raise AuthError("claims temporels JWT invalides")
    return numeric_value


def _b64url_decode(segment: str) -> bytes:
    if not segment:
        raise AuthError("JWT malformé")
    padding = "=" * (-len(segment) % 4)
    try:
        return base64.b64decode(segment + padding, altchars=b"-_", validate=True)
    except (binascii.Error, ValueError) as exc:
        raise AuthError("JWT malformé") from exc


def decode_hs256_jwt(token: str, secret: str, *, issuer: str, audience: str) -> dict:
    """Valide un JWT HS256 borné à l'audience exclusive de Pulse."""
    try:
        header_b64, payload_b64, sig_b64 = token.split(".")
    except ValueError as exc:
        raise AuthError("format JWT invalide") from exc

    try:
        header = json.loads(_b64url_decode(header_b64))
        claims = json.loads(_b64url_decode(payload_b64))
        supplied_signature = _b64url_decode(sig_b64)
    except (json.JSONDecodeError, UnicodeDecodeError, TypeError) as exc:
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
    subject = claims.get("sub")
    iat = claims.get("iat")
    if not isinstance(subject, str) or not subject.strip() or exp is None or iat is None:
        raise AuthError("claims JWT obligatoires absents")
    now = time.time()
    if now > _numeric_date(exp):
        raise AuthError("token expiré")
    nbf = claims.get("nbf")
    if nbf is not None and now < _numeric_date(nbf):
        raise AuthError("token pas encore valide")
    issued_at = _numeric_date(iat)
    if issued_at > now + 60:
        raise AuthError("date d'émission JWT invalide")
    if _numeric_date(exp) - issued_at > 24 * 3600:
        raise AuthError("durée de vie JWT excessive")

    if claims.get("iss") != issuer:
        raise AuthError("émetteur JWT invalide")

    token_audience = claims.get("aud")
    if token_audience not in (audience, [audience]):
        raise AuthError("audience JWT invalide")
    return claims


def _unauthorized() -> HTTPException:
    return HTTPException(
        status.HTTP_401_UNAUTHORIZED,
        "Authentification invalide",
        headers={"WWW-Authenticate": "Bearer"},
    )


def get_current_user(
    request: Request, settings: Settings = Depends(get_settings)
) -> CurrentUser:
    if settings.pulse_auth_mode == "disabled":
        return CurrentUser(user_id="dev", email="dev@local")

    authorization = request.headers.get("authorization", "")
    scheme, separator, token = authorization.partition(" ")
    if not separator or scheme.lower() != "bearer" or not token.strip():
        raise _unauthorized()
    if not settings.pulse_jwt_secret:
        raise _unauthorized()
    try:
        claims = decode_hs256_jwt(
            token.strip(),
            settings.pulse_jwt_secret,
            issuer=settings.pulse_jwt_issuer,
            audience=settings.pulse_jwt_audience,
        )
    except AuthError as exc:
        raise _unauthorized() from exc
    return CurrentUser(
        user_id=claims.get("sub"),
        email=claims.get("email"),
        raw_claims=claims,
    )
