"""Point d'entrée FastAPI — openpulse-gestion-drive-api."""

from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from . import __version__
from .config import get_settings
from .repository import build_repository
from .routers import desktop_auth, drive, health, permissions
from .storage import build_storage


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    app.state.repository = build_repository(settings.database_url)
    app.state.storage = build_storage(settings)
    await app.state.repository.startup()
    yield
    await app.state.repository.shutdown()


def create_app() -> FastAPI:
    settings = get_settings()
    settings.validate_runtime()
    app = FastAPI(
        title="openpulse-gestion-drive-api",
        version=__version__,
        description="Gestion Drive — API métadonnées + SAS Azure Blob (Milestone 1)",
        lifespan=lifespan,
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(health.router)
    app.include_router(desktop_auth.router)
    app.include_router(drive.router)
    app.include_router(permissions.router)
    return app


app = create_app()
