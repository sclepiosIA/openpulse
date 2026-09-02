"""Configuration via variables d'environnement (voir .env.example)."""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    pulse_env: str = "dev"

    # PostgreSQL Azure (tables pulse_*_azure). Vide => store in-memory (dev/tests).
    database_url: str = ""

    # Auth: "disabled" (dev) ou "jwt" (JWT HS256 Gestion/Supabase)
    pulse_auth_mode: str = "disabled"
    pulse_jwt_secret: str = ""
    pulse_jwt_issuer: str = ""
    pulse_jwt_audience: str = "openpulse-pulse-api"

    pulse_cors_origins: str = "http://localhost:5173"

    @property
    def cors_origins(self) -> list[str]:
        return [o.strip() for o in self.pulse_cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()


def validate_runtime_settings(settings: Settings) -> None:
    """Refuse les configurations qui affaibliraient l'auth ou la persistance."""
    auth_mode = settings.pulse_auth_mode.strip().lower()
    if auth_mode not in {"disabled", "jwt"}:
        raise RuntimeError("PULSE_AUTH_MODE doit valoir 'disabled' ou 'jwt'")
    if auth_mode == "jwt" and not settings.pulse_jwt_secret.strip():
        raise RuntimeError("PULSE_JWT_SECRET est requis en mode jwt")
    if auth_mode == "jwt" and not all(
        (settings.pulse_jwt_issuer.strip(), settings.pulse_jwt_audience.strip())
    ):
        raise RuntimeError("PULSE_JWT_ISSUER/AUDIENCE sont requis en mode jwt")

    if settings.pulse_env.strip().lower() not in {"prod", "production"}:
        return
    if auth_mode != "jwt":
        raise RuntimeError("PULSE_AUTH_MODE=jwt est obligatoire en production")
    if not settings.database_url.strip():
        raise RuntimeError("DATABASE_URL est obligatoire en production")
    if settings.pulse_jwt_secret.strip() in {
        "CHANGE_ME",
        "CHANGE_ME_JWT_SECRET",
        "dev-only-secret",
    }:
        raise RuntimeError("PULSE_JWT_SECRET ne peut pas être une valeur par défaut")
