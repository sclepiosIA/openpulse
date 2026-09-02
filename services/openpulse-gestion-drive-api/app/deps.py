"""Dépendances FastAPI partagées (repository, storage)."""

from __future__ import annotations

from fastapi import Request

from .repository import Repository
from .storage import BlobStorage


def get_repository(request: Request) -> Repository:
    return request.app.state.repository


def get_storage(request: Request) -> BlobStorage:
    return request.app.state.storage
