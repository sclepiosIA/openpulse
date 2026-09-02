"""Configuration via variables d'environnement (voir .env.example)."""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    email_env: str = "dev"

    # PostgreSQL Azure (tables email_*_azure). Vide => store in-memory (dev/tests).
    database_url: str = ""

    # Auth: "disabled" (dev) ou "jwt" (JWT HS256 Gestion/Supabase)
    email_auth_mode: str = "disabled"
    email_jwt_secret: str = ""
    email_jwt_issuer: str = ""
    email_jwt_audience: str = ""

    email_cors_origins: str = "http://localhost:5173"

    @property
    def cors_origins(self) -> list[str]:
        return [o.strip() for o in self.email_cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()


def validate_runtime_settings(settings: Settings) -> None:
    mode = settings.email_auth_mode.strip().lower()
    if mode not in {"disabled", "jwt"}:
        raise RuntimeError("EMAIL_AUTH_MODE doit valoir disabled ou jwt")
    if mode == "jwt" and not all(
        (settings.email_jwt_secret, settings.email_jwt_issuer, settings.email_jwt_audience)
    ):
        raise RuntimeError("EMAIL_JWT_SECRET/ISSUER/AUDIENCE sont requis en mode jwt")
    if settings.email_env.strip().lower() in {"prod", "production"}:
        if mode != "jwt" or not settings.database_url.strip():
            raise RuntimeError("la production Email exige JWT et PostgreSQL")
