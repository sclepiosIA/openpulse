"""Configuration via variables d'environnement (voir .env.example)."""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    meetings_env: str = "dev"

    # PostgreSQL Azure (tables meeting_*_azure / transcription_*_azure).
    # Vide => store in-memory (dev/tests).
    database_url: str = ""

    # Azure Blob — vide => URLs SAS stub (dev/tests, aucun upload réel)
    azure_storage_connection_string: str = ""
    azure_storage_account: str = ""
    azure_storage_account_key: str = ""

    meetings_blob_container_recordings: str = "gestion-meetings-recordings"
    meetings_sas_ttl_minutes: int = 30

    # Auth: "disabled" (dev) ou "jwt" (JWT HS256 Gestion/Supabase)
    meetings_auth_mode: str = "disabled"
    meetings_jwt_secret: str = ""
    meetings_jwt_issuer: str = ""
    meetings_jwt_audience: str = ""

    meetings_cors_origins: str = "http://localhost:5173"

    @property
    def cors_origins(self) -> list[str]:
        return [o.strip() for o in self.meetings_cors_origins.split(",") if o.strip()]

    @property
    def has_azure_storage(self) -> bool:
        return bool(
            self.azure_storage_connection_string
            or (self.azure_storage_account and self.azure_storage_account_key)
        )

    @property
    def is_production(self) -> bool:
        return self.meetings_env.lower() in {"prod", "production"}

    def validate_runtime(self) -> None:
        """Reject unsafe production wiring before serving any request."""
        if not self.is_production:
            return
        if self.meetings_auth_mode != "jwt":
            raise RuntimeError("la production exige l'authentification JWT")
        if not all((self.meetings_jwt_secret, self.meetings_jwt_issuer, self.meetings_jwt_audience)):
            raise RuntimeError("la production exige secret, issuer et audience JWT")
        if not self.has_azure_storage:
            raise RuntimeError("la production exige un stockage Azure Blob configuré")


@lru_cache
def get_settings() -> Settings:
    return Settings()
