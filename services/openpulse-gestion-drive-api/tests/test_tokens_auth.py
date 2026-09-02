"""Tests unitaires — upload tokens et JWT stub."""

import time

import pytest

from app.auth import AuthError, decode_hs256_jwt
from app.tokens import UploadTokenError, make_upload_token, verify_upload_token


class TestUploadTokens:
    def test_roundtrip(self):
        token = make_upload_token(
            file_id="f1", version=2, blob_container="c", blob_name="b",
            secret="s3cret",
        )
        claims = verify_upload_token(token, secret="s3cret")
        assert claims["fid"] == "f1"
        assert claims["v"] == 2
        assert claims["c"] == "c"
        assert claims["b"] == "b"

    def test_wrong_secret_rejected(self):
        token = make_upload_token(
            file_id="f1", version=1, blob_container="c", blob_name="b", secret="a",
        )
        with pytest.raises(UploadTokenError):
            verify_upload_token(token, secret="b")

    def test_expired_rejected(self):
        token = make_upload_token(
            file_id="f1", version=1, blob_container="c", blob_name="b",
            secret="s", ttl_seconds=-1,
        )
        with pytest.raises(UploadTokenError):
            verify_upload_token(token, secret="s")

    def test_garbage_rejected(self):
        with pytest.raises(UploadTokenError):
            verify_upload_token("not-a-token", secret="s")


def _make_jwt(payload: dict, secret: str) -> str:
    import base64
    import hashlib
    import hmac
    import json

    def b64(data: bytes) -> str:
        return base64.urlsafe_b64encode(data).decode().rstrip("=")

    header = b64(json.dumps({"alg": "HS256", "typ": "JWT"}).encode())
    body = b64(json.dumps(payload).encode())
    sig = b64(hmac.new(secret.encode(), f"{header}.{body}".encode(), hashlib.sha256).digest())
    return f"{header}.{body}.{sig}"


class TestJwtStub:
    def test_valid_jwt(self):
        token = _make_jwt({"sub": "user-1", "exp": time.time() + 60}, "gestion-secret")
        claims = decode_hs256_jwt(token, "gestion-secret")
        assert claims["sub"] == "user-1"

    def test_bad_signature(self):
        token = _make_jwt({"sub": "user-1"}, "wrong")
        with pytest.raises(AuthError):
            decode_hs256_jwt(token, "gestion-secret")

    def test_expired(self):
        token = _make_jwt({"sub": "u", "exp": time.time() - 10}, "s")
        with pytest.raises(AuthError):
            decode_hs256_jwt(token, "s")

    def test_malformed(self):
        with pytest.raises(AuthError):
            decode_hs256_jwt("abc.def", "s")
