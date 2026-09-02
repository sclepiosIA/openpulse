"""Endpoint de santé — GET /healthz (contrat AzurePulseHealth côté front)."""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends

from .. import __version__
from ..deps import get_repository
from ..repository import Repository
from ..schemas import HealthResponse

router = APIRouter(tags=["health"])


@router.get("/healthz", response_model=HealthResponse)
@router.get("/api/pulse/health", response_model=HealthResponse)
async def health(repo: Repository = Depends(get_repository)) -> HealthResponse:
    dependencies: dict[str, str] = {}
    status = "ok"
    try:
        await repo.ping()
        dependencies["database"] = "ok"
    except Exception:  # pragma: no cover - dégradation infra
        dependencies["database"] = "down"
        status = "degraded"
    return HealthResponse(
        status=status,  # type: ignore[arg-type]
        version=__version__,
        timestamp=datetime.now(timezone.utc),
        dependencies=dependencies,  # type: ignore[arg-type]
    )
