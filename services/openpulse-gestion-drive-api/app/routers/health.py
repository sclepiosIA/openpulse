"""Endpoints de santé et de readiness (probes Container Apps)."""

from __future__ import annotations

import asyncio

from fastapi import APIRouter, Depends, HTTPException, status

from .. import __version__
from ..config import Settings, get_settings
from ..deps import get_repository, get_storage
from ..repository import Repository
from ..schemas import HealthResponse
from ..storage import BlobStorage

router = APIRouter(tags=["health"])


def _health_payload(settings: Settings, repo: Repository, storage: BlobStorage) -> HealthResponse:
    return HealthResponse(
        version=__version__, env=settings.drive_env,
        database=repo.kind, blob_storage=storage.kind,  # type: ignore[arg-type]
        source_sha=settings.openpulse_git_sha,
    )


@router.get("/healthz", response_model=HealthResponse)
@router.get("/api/drive/health", response_model=HealthResponse)
async def health(
    settings: Settings = Depends(get_settings),
    repo: Repository = Depends(get_repository),
    storage: BlobStorage = Depends(get_storage),
) -> HealthResponse:
    """Liveness sans I/O distant : le processus peut servir des requêtes."""
    return _health_payload(settings, repo, storage)


@router.get("/readyz", response_model=HealthResponse)
async def readiness(
    settings: Settings = Depends(get_settings),
    repo: Repository = Depends(get_repository),
    storage: BlobStorage = Depends(get_storage),
) -> HealthResponse:
    """Readiness réelle : schéma Postgres et conteneurs Blob doivent répondre."""
    try:
        if not await repo.ping():
            raise RuntimeError("Drive schema unavailable")
        await asyncio.to_thread(
            storage.check_ready,
            (settings.drive_blob_container_files, settings.drive_blob_container_versions),
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Drive backends unavailable",
        ) from exc
    return _health_payload(settings, repo, storage)
