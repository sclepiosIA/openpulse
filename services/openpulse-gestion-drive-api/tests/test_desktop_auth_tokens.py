"""Tests du token Drive émis pour le client desktop."""

import time

from app.auth import decode_hs256_jwt, make_hs256_jwt


def test_make_drive_jwt_roundtrip_with_drive_secret():
    token = make_hs256_jwt(
        {"sub": "user-1", "email": "u@example.test", "exp": int(time.time()) + 60},
        "drive-secret",
    )
    claims = decode_hs256_jwt(token, "drive-secret")
    assert claims["sub"] == "user-1"
    assert claims["email"] == "u@example.test"
