from app.auth import decode_hs256_jwt
from app.config import Settings
from app.routers.desktop_auth import _drive_token


def test_user_metadata_role_never_elevates_drive_claims():
    settings = Settings(
        drive_jwt_secret="test-secret-long-enough-for-validation",
        drive_jwt_issuer="openpulse-drive",
        drive_jwt_audience="openpulse-drive-api",
    )
    token = _drive_token(
        user_id="user-1",
        email="user@example.test",
        app_role=None,
        settings=settings,
    )
    claims = decode_hs256_jwt(
        token,
        settings.drive_jwt_secret,
        issuer=settings.drive_jwt_issuer,
        audience=settings.drive_jwt_audience,
        require_identity=True,
    )
    assert claims.get("app_role") is None


def test_signed_app_metadata_role_is_preserved():
    settings = Settings(
        drive_jwt_secret="test-secret-long-enough-for-validation",
        drive_jwt_issuer="openpulse-drive",
        drive_jwt_audience="openpulse-drive-api",
    )
    token = _drive_token(
        user_id="admin-1",
        email="admin@example.test",
        app_role="admin",
        settings=settings,
    )
    claims = decode_hs256_jwt(
        token,
        settings.drive_jwt_secret,
        issuer=settings.drive_jwt_issuer,
        audience=settings.drive_jwt_audience,
        require_identity=True,
    )
    assert claims["app_role"] == "admin"
