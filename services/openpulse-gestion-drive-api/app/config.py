"""Configuration via variables d'environnement (voir .env.example)."""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    drive_env: str = "dev"
    openpulse_git_sha: str = "0000000000000000000000000000000000000000"

    # PostgreSQL — vide => repository in-memory (dev/tests)
    database_url: str = ""

    # Azure Blob — vide => URLs stub (dev/tests)
    azure_storage_connection_string: str = ""
    azure_storage_account: str = ""
    azure_storage_account_key: str = ""

    drive_blob_container_files: str = "gestion-drive-files"
    drive_blob_container_versions: str = "gestion-drive-versions"
    drive_sas_ttl_minutes: int = 15

    # Auth: "disabled" (dev) ou "jwt"
    drive_auth_mode: str = "disabled"
    # Exiger une session MFA AAL2 du fournisseur pour ouvrir une session Drive.
    # Vrai par défaut : aucun déploiement ne perd la protection sans acte
    # explicite. Mis à false sur l'instance interne Gestion, où les comptes
    # n'ont pas de TOTP — sans quoi AUCUN utilisateur ne peut ouvrir le Drive
    # ni créer de document (décision utilisateur du 2026-08-15, usage interne).
    drive_require_mfa: bool = True
    drive_jwt_secret: str = ""
    drive_jwt_issuer: str = "openpulse-drive"
    drive_jwt_audience: str = "openpulse-drive-api"
    drive_jwt_ttl_seconds: int = 3600
    desktop_refresh_ttl_seconds: int = 30 * 24 * 3600
    drive_app_secret: str = "dev-only-secret"

    # Pont d'auth transitoire : l'URL du fournisseur est injectée au déploiement.
    # Ne jamais laisser une URL Supabase hébergée en fallback dans l'image : cela
    # rendrait un futur cutover Azure incomplet même après mise à jour des secrets.
    supabase_url: str = ""
    supabase_anon_key: str = ""

    drive_cors_origins: str = "http://localhost:5173"

    @property
    def cors_origins(self) -> list[str]:
        return [o.strip() for o in self.drive_cors_origins.split(",") if o.strip()]

    @property
    def has_azure_storage(self) -> bool:
        return bool(
            self.azure_storage_connection_string
            or (self.azure_storage_account and self.azure_storage_account_key)
        )

    def validate_runtime(self) -> None:
        if self.drive_env != "prod":
            return
        missing: list[str] = []
        if not self.database_url:
            missing.append("DATABASE_URL")
        if (
            len(self.openpulse_git_sha) != 40
            or set(self.openpulse_git_sha) == {"0"}
            or any(c not in "0123456789abcdef" for c in self.openpulse_git_sha.lower())
        ):
            missing.append("OPENPULSE_GIT_SHA complet")
        if not self.has_azure_storage:
            missing.append("AZURE_STORAGE_CONNECTION_STRING/account credentials")
        if self.drive_auth_mode != "jwt":
            missing.append("DRIVE_AUTH_MODE=jwt")
        if not self.supabase_url:
            missing.append("SUPABASE_URL (provider d'auth explicite)")
        if not self.supabase_anon_key:
            missing.append("SUPABASE_ANON_KEY (provider d'auth explicite)")
        if len(self.drive_jwt_secret) < 32:
            missing.append("DRIVE_JWT_SECRET fort")
        if not 900 <= self.drive_jwt_ttl_seconds <= 86400:
            missing.append("DRIVE_JWT_TTL_SECONDS entre 900 et 86400")
        if not 86400 <= self.desktop_refresh_ttl_seconds <= 90 * 24 * 3600:
            missing.append("DESKTOP_REFRESH_TTL_SECONDS entre 1 et 90 jours")
        if len(self.drive_app_secret) < 32 or self.drive_app_secret == "dev-only-secret":
            missing.append("DRIVE_APP_SECRET fort")
        if missing:
            raise RuntimeError("Configuration production Drive refusée: " + ", ".join(missing))


@lru_cache
def get_settings() -> Settings:
    return Settings()
