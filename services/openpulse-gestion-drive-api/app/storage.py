"""Stockage objet : Azure Blob (SAS) avec repli stub pour dev/tests.

- AzureBlobStorage : génère des SAS courts scoped au blob (plan §12).
- StubBlobStorage : URLs factices, aucun appel réseau — utilisé quand les
  variables d'environnement Azure ne sont pas fournies (dev/tests).
"""

from __future__ import annotations

import hashlib
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Protocol

from .config import Settings


@dataclass
class SignedUrl:
    url: str
    expires_at: datetime


@dataclass
class BlobProperties:
    size_bytes: int | None
    etag: str | None


class BlobStorage(Protocol):
    kind: str

    def make_upload_url(self, container: str, blob_name: str, content_type: str | None) -> SignedUrl: ...

    def make_download_url(self, container: str, blob_name: str, filename: str | None = None) -> SignedUrl: ...
    def get_blob_properties(self, container: str, blob_name: str) -> BlobProperties | None: ...
    def compute_blob_sha256(self, container: str, blob_name: str, expected_etag: str) -> str | None: ...
    def check_ready(self, containers: tuple[str, ...]) -> None: ...


class StubBlobStorage:
    """Stockage factice pour dev/tests — aucun réseau, aucune donnée réelle."""

    kind = "stub"

    def __init__(self, ttl_minutes: int = 15) -> None:
        self._ttl = ttl_minutes

    def _expiry(self) -> datetime:
        return datetime.now(timezone.utc) + timedelta(minutes=self._ttl)

    def make_upload_url(self, container: str, blob_name: str, content_type: str | None) -> SignedUrl:
        return SignedUrl(
            url=f"https://stub.blob.local/{container}/{blob_name}?sig=stub-upload",
            expires_at=self._expiry(),
        )

    def make_download_url(self, container: str, blob_name: str, filename: str | None = None) -> SignedUrl:
        return SignedUrl(
            url=f"https://stub.blob.local/{container}/{blob_name}?sig=stub-download",
            expires_at=self._expiry(),
        )

    def get_blob_properties(self, container: str, blob_name: str) -> BlobProperties | None:
        return BlobProperties(size_bytes=None, etag=None)

    def compute_blob_sha256(self, container: str, blob_name: str, expected_etag: str) -> str | None:
        del container, blob_name, expected_etag
        return None

    def check_ready(self, containers: tuple[str, ...]) -> None:
        del containers


class AzureBlobStorage:
    """SAS Azure réels — nécessite azure-storage-blob et des credentials env."""

    kind = "azure"

    def __init__(self, settings: Settings) -> None:
        # Import local pour ne pas exiger le SDK en mode stub/tests.
        from azure.storage.blob import BlobServiceClient

        self._ttl = settings.drive_sas_ttl_minutes
        if settings.azure_storage_connection_string:
            self._client = BlobServiceClient.from_connection_string(
                settings.azure_storage_connection_string
            )
        else:
            account_url = f"https://{settings.azure_storage_account}.blob.core.windows.net"
            self._client = BlobServiceClient(
                account_url=account_url, credential=settings.azure_storage_account_key
            )
        self._account_name = self._client.account_name
        self._account_key = self._extract_account_key(settings)

    @staticmethod
    def _extract_account_key(settings: Settings) -> str:
        if settings.azure_storage_account_key:
            return settings.azure_storage_account_key
        # Extraction depuis la connection string
        for part in settings.azure_storage_connection_string.split(";"):
            if part.startswith("AccountKey="):
                return part[len("AccountKey="):]
        raise ValueError("AccountKey introuvable pour générer des SAS")

    def _sas(self, container: str, blob_name: str, *, write: bool, filename: str | None = None) -> SignedUrl:
        from azure.storage.blob import BlobSasPermissions, generate_blob_sas

        expiry = datetime.now(timezone.utc) + timedelta(minutes=self._ttl)
        permission = BlobSasPermissions(create=True) if write else BlobSasPermissions(read=True)
        kwargs: dict = {}
        if not write and filename:
            kwargs["content_disposition"] = f'attachment; filename="{filename}"'
        token = generate_blob_sas(
            account_name=self._account_name,
            account_key=self._account_key,
            container_name=container,
            blob_name=blob_name,
            permission=permission,
            expiry=expiry,
            start=datetime.now(timezone.utc) - timedelta(minutes=5),
            **kwargs,
        )
        url = f"https://{self._account_name}.blob.core.windows.net/{container}/{blob_name}?{token}"
        return SignedUrl(url=url, expires_at=expiry)

    def make_upload_url(self, container: str, blob_name: str, content_type: str | None) -> SignedUrl:
        return self._sas(container, blob_name, write=True)

    def make_download_url(self, container: str, blob_name: str, filename: str | None = None) -> SignedUrl:
        return self._sas(container, blob_name, write=False, filename=filename)

    def get_blob_properties(self, container: str, blob_name: str) -> BlobProperties | None:
        from azure.core.exceptions import ResourceNotFoundError
        try:
            props = self._client.get_blob_client(container=container, blob=blob_name).get_blob_properties()
        except ResourceNotFoundError:
            return None
        return BlobProperties(size_bytes=props.size, etag=str(props.etag) if props.etag else None)

    def compute_blob_sha256(self, container: str, blob_name: str, expected_etag: str) -> str | None:
        blob = self._client.get_blob_client(container=container, blob=blob_name)
        before = blob.get_blob_properties()
        observed_before = str(before.etag) if before.etag else ""
        if not expected_etag or observed_before != expected_etag:
            raise RuntimeError("ETag Blob modifié avant vérification")
        digest = hashlib.sha256()
        for chunk in blob.download_blob().chunks():
            digest.update(chunk)
        after = blob.get_blob_properties()
        observed_after = str(after.etag) if after.etag else ""
        if observed_after != expected_etag:
            raise RuntimeError("ETag Blob modifié pendant vérification")
        return digest.hexdigest()

    def check_ready(self, containers: tuple[str, ...]) -> None:
        for container in containers:
            self._client.get_container_client(container).get_container_properties()


def build_storage(settings: Settings) -> BlobStorage:
    if settings.has_azure_storage:
        return AzureBlobStorage(settings)
    return StubBlobStorage(ttl_minutes=settings.drive_sas_ttl_minutes)
