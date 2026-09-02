"""Endpoints de santé (probe Container Apps + panneau statut front)."""

from __future__ import annotations

from fastapi import APIRouter, Depends

from .. import __version__
from ..config import Settings, get_settings
from ..deps import get_repository
from ..repository import Repository
from ..schemas import HealthResponse

router = APIRouter(tags=["health"])


@router.get("/healthz", response_model=HealthResponse)
@router.get("/api/email/health", response_model=HealthResponse)
async def health(
    settings: Settings = Depends(get_settings),
    repo: Repository = Depends(get_repository),
) -> HealthResponse:
    await repo.ping()
    return HealthResponse(
        version=__version__,
        env=settings.email_env,
        database=repo.kind,  # type: ignore[arg-type]
    )
