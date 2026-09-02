"""Point d'entrée FastAPI — openpulse-meetings-api (Gestion Visio/Transcription)."""

from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from . import __version__
from .config import get_settings
from .repository import build_repository
from .routers import health, transcriptions
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
        title="openpulse-meetings-api",
        version=__version__,
        description="Gestion Meetings — API Azure Visio/Transcription (squelette)",
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
    app.include_router(transcriptions.router)
    return app


app = create_app()
