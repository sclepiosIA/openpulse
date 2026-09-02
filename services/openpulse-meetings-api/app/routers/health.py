"""Endpoint de santé — contrat AzureMeetingsHealth (panneau /meeting-notes)."""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Request

from .. import __version__
from ..deps import get_repository
from ..repository import Repository
from ..schemas import HealthResponse

router = APIRouter(tags=["health"])


@router.get("/healthz", response_model=HealthResponse)
@router.get("/api/meetings/health", response_model=HealthResponse)
async def health(
    request: Request, repo: Repository = Depends(get_repository)
) -> HealthResponse:
    services: dict[str, str] = {}
    status = "ok"
    try:
        await repo.ping()
        services["database"] = "ok"
    except Exception:  # pragma: no cover - dégradation infra
        services["database"] = "down"
        status = "degraded"
    storage = getattr(request.app.state, "storage", None)
    services["blob_storage"] = "ok" if storage is not None else "down"
    return HealthResponse(
        status=status,  # type: ignore[arg-type]
        version=__version__,
        timestamp=datetime.now(timezone.utc),
        services=services,  # type: ignore[arg-type]
    )
