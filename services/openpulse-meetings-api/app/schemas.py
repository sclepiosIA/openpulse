"""Schémas Pydantic — contrat aligné sur src/types/meetingsAzure.ts (front)."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field

SourceType = Literal["visio_recording", "manual_upload", "external"]
TranscriptionStatus = Literal["queued", "processing", "completed", "failed", "validated"]


class HealthResponse(BaseModel):
    """Miroir de AzureMeetingsHealth (front) — GET /api/meetings/health."""

    status: Literal["ok", "degraded", "down"] = "ok"
    service: str = "openpulse-meetings-api"
    version: str
    timestamp: datetime
    services: dict[str, Literal["ok", "degraded", "down"]] = Field(default_factory=dict)


class UploadIntentRequest(BaseModel):
    """Miroir de AzureUploadIntentRequest."""

    file_name: str = Field(min_length=1, max_length=500)
    content_type: str = Field(min_length=1, max_length=200)
    size_bytes: int = Field(gt=0, le=5 * 1024 * 1024 * 1024)  # 5 GiB max
    title: str = Field(min_length=1, max_length=300)
    language: str = "fr"
    etablissement_id: str | None = None
    room_id: str | None = None
    source_type: SourceType = "manual_upload"
    diarization_enabled: bool = True


class UploadIntentResponse(BaseModel):
    """Miroir de AzureUploadIntentResponse — SAS pré-signée + session."""

    session_id: str
    upload_url: str
    blob_container: str
    blob_name: str
    expires_at: datetime


class UploadCompleteRequest(BaseModel):
    """Miroir de AzureUploadCompleteRequest."""

    session_id: str
    sha256: str | None = None
    size_bytes: int | None = None


class UploadCompleteResponse(BaseModel):
    session_id: str
    status: TranscriptionStatus


class TranscriptionSession(BaseModel):
    """Miroir de AzureTranscriptionSession / table transcription_sessions_azure."""

    id: str
    room_id: str | None = None
    source_type: SourceType
    source_blob: str
    status: TranscriptionStatus = "queued"
    language: str = "fr"
    model: str | None = None
    diarization_enabled: bool = True
    created_by: str | None = None
    created_at: datetime
    completed_at: datetime | None = None
    # Métadonnées d'affichage (title conservé dans le squelette in-memory)
    title: str | None = None


class TranscriptionSegment(BaseModel):
    id: str
    session_id: str
    speaker_label: str | None = None
    speaker_profile_id: str | None = None
    start_ms: int
    end_ms: int
    text: str
    confidence: float | None = None
    created_at: datetime


class MeetingAiOutput(BaseModel):
    id: str
    session_id: str
    output_type: Literal[
        "summary", "decisions", "actions", "risks", "minutes", "email_followup", "pulse_post"
    ]
    payload: dict[str, Any] = Field(default_factory=dict)
    model: str | None = None
    created_at: datetime


class TranscriptionSessionDetails(TranscriptionSession):
    """Miroir de AzureTranscriptionSessionDetails."""

    segments: list[TranscriptionSegment] = Field(default_factory=list)
    ai_outputs: list[MeetingAiOutput] = Field(default_factory=list)


class Page(BaseModel):
    """Miroir de AzureMeetingsPage<T>."""

    items: list[TranscriptionSession]
    total: int
    page: int = 1
    page_size: int = 50
