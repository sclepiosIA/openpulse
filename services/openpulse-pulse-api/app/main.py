"""Point d'entrée FastAPI — openpulse-pulse-api (Pulse Azure Collaboration Hub)."""

from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from . import __version__
from .config import get_settings, validate_runtime_settings
from .repository import build_repository
from .routers import conversations, health


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    validate_runtime_settings(settings)
    app.state.repository = build_repository(settings.database_url)
    await app.state.repository.startup()
    yield
    await app.state.repository.shutdown()


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title="openpulse-pulse-api",
        version=__version__,
        description="Gestion Pulse — API Azure Collaboration Hub (squelette)",
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
    app.include_router(conversations.router)
    return app


app = create_app()
