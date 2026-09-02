"""Stockage Blob — SAS réelles (azure-storage-blob) ou stub (dev/tests).

Même approche que openpulse-gestion-drive-api : sans credentials Azure, les URLs
retournées sont des stubs locaux permettant de dérouler le flux
upload-intent → upload-complete sans réseau.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from .config import Settings


class StubStorage:
    kind = "stub"

    def __init__(self, container: str, ttl_minutes: int) -> None:
        self._container = container
        self._ttl_minutes = ttl_minutes

    def make_upload_url(self, blob_name: str) -> tuple[str, str, datetime]:
        expires_at = datetime.now(timezone.utc) + timedelta(minutes=self._ttl_minutes)
        url = f"stub://blob/{self._container}/{blob_name}?sig=stub"
        return url, self._container, expires_at


class AzureBlobStorage:
    kind = "azure"

    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        values = {}
        if settings.azure_storage_connection_string:
            values = dict(
                part.split("=", 1)
                for part in settings.azure_storage_connection_string.split(";")
                if "=" in part
            )
        self._account_name = settings.azure_storage_account or values.get("AccountName", "")
        self._account_key = settings.azure_storage_account_key or values.get("AccountKey", "")
        if not self._account_name or not self._account_key:
            raise ValueError("Compte et clé Azure Blob requis")

    def make_upload_url(self, blob_name: str) -> tuple[str, str, datetime]:
        from azure.storage.blob import (  # import paresseux
            BlobSasPermissions,
            generate_blob_sas,
        )

        settings = self._settings
        expires_at = datetime.now(timezone.utc) + timedelta(
            minutes=settings.meetings_sas_ttl_minutes
        )
        container = settings.meetings_blob_container_recordings
        sas = generate_blob_sas(
            account_name=self._account_name,
            container_name=container,
            blob_name=blob_name,
            account_key=self._account_key,
            permission=BlobSasPermissions(write=True, create=True),
            expiry=expires_at,
        )
        url = (
            f"https://{self._account_name}.blob.core.windows.net/"
            f"{container}/{blob_name}?{sas}"
        )
        return url, container, expires_at


def build_storage(settings: Settings):
    if settings.has_azure_storage:
        return AzureBlobStorage(settings)
    return StubStorage(
        settings.meetings_blob_container_recordings, settings.meetings_sas_ttl_minutes
    )
