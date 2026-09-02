"""Upload tokens signés (HMAC) reliant upload-intent → upload-complete.

Le token encode file_id/version/blob et une expiration ; il empêche un client
de finaliser un upload qu'il n'a pas initié (stateless, pas de table dédiée
en Milestone 1).
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import time


class UploadTokenError(ValueError):
    pass


def _sign(payload_b64: str, secret: str) -> str:
    sig = hmac.new(secret.encode(), payload_b64.encode(), hashlib.sha256).digest()
    return base64.urlsafe_b64encode(sig).decode().rstrip("=")


def make_upload_token(
    *, file_id: str, version: int, blob_container: str, blob_name: str,
    secret: str, size_bytes: int | None = None, sha256: str | None = None,
    ttl_seconds: int = 3600,
) -> str:
    payload = {
        "fid": file_id,
        "v": version,
        "c": blob_container,
        "b": blob_name,
        "size": size_bytes,
        "sha256": sha256,
        "exp": int(time.time()) + ttl_seconds,
    }
    payload_b64 = base64.urlsafe_b64encode(json.dumps(payload, separators=(",", ":")).encode()).decode().rstrip("=")
    return f"{payload_b64}.{_sign(payload_b64, secret)}"


def verify_upload_token(token: str, *, secret: str) -> dict:
    try:
        payload_b64, sig = token.split(".")
    except ValueError as exc:
        raise UploadTokenError("format de token invalide") from exc
    if not hmac.compare_digest(sig, _sign(payload_b64, secret)):
        raise UploadTokenError("signature de token invalide")
    padding = "=" * (-len(payload_b64) % 4)
    payload = json.loads(base64.urlsafe_b64decode(payload_b64 + padding))
    if time.time() > payload.get("exp", 0):
        raise UploadTokenError("token d'upload expiré")
    return payload
