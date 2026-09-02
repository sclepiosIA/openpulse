"""Pipeline transcription — upload-intent / upload-complete / sessions.

Chemins identiques au client front `src/services/meetings/azureMeetingsApi.ts` :

- POST /api/transcriptions/upload-intent    → SAS Blob + session pré-créée
- POST /api/transcriptions/upload-complete  → confirme l'upload (status queued)
- GET  /api/transcriptions/sessions         → liste paginée
- GET  /api/transcriptions/sessions/{id}    → détails (segments, IA)
"""

from __future__ import annotations

import re
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status

from ..auth import CurrentUser, get_current_user
from ..deps import get_repository
from ..repository import Repository, SessionNotFound
from ..schemas import (
    Page,
    TranscriptionSessionDetails,
    UploadCompleteRequest,
    UploadCompleteResponse,
    UploadIntentRequest,
    UploadIntentResponse,
)

router = APIRouter(prefix="/api/transcriptions", tags=["transcriptions"])

_SAFE_CHARS = re.compile(r"[^a-zA-Z0-9._-]+")


def _safe_blob_name(session_id: str, file_name: str) -> str:
    cleaned = _SAFE_CHARS.sub("-", file_name).strip("-") or "recording"
    return f"sessions/{session_id}/{cleaned}"


@router.post(
    "/upload-intent", response_model=UploadIntentResponse, status_code=status.HTTP_201_CREATED
)
async def upload_intent(
    data: UploadIntentRequest,
    request: Request,
    repo: Repository = Depends(get_repository),
    user: CurrentUser = Depends(get_current_user),
) -> UploadIntentResponse:
    session_id = str(uuid.uuid4())
    blob_name = _safe_blob_name(session_id, data.file_name)
    storage = request.app.state.storage
    upload_url, container, expires_at = storage.make_upload_url(blob_name)
    session = await repo.create_session(
        data, blob_name=blob_name, created_by=user.user_id, session_id=session_id
    )
    return UploadIntentResponse(
        session_id=session.id,
        upload_url=upload_url,
        blob_container=container,
        blob_name=blob_name,
        expires_at=expires_at,
    )


@router.post("/upload-complete", response_model=UploadCompleteResponse)
async def upload_complete(
    data: UploadCompleteRequest,
    repo: Repository = Depends(get_repository),
    user: CurrentUser = Depends(get_current_user),
) -> UploadCompleteResponse:
    try:
        session = await repo.mark_uploaded(data.session_id, user.user_id)
    except SessionNotFound as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "session inconnue") from exc
    return UploadCompleteResponse(session_id=session.id, status=session.status)


@router.get("/sessions", response_model=Page)
async def list_sessions(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=200),
    repo: Repository = Depends(get_repository),
    user: CurrentUser = Depends(get_current_user),
) -> Page:
    items, total = await repo.list_sessions(user.user_id, page=page, page_size=page_size)
    return Page(items=items, total=total, page=page, page_size=page_size)


@router.get("/sessions/{session_id}", response_model=TranscriptionSessionDetails)
async def get_session(
    session_id: str,
    repo: Repository = Depends(get_repository),
    user: CurrentUser = Depends(get_current_user),
) -> TranscriptionSessionDetails:
    try:
        return await repo.get_session(session_id, user.user_id)
    except SessionNotFound as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "session inconnue") from exc
