"""Repository sessions de transcription — in-memory (dev/tests) ou PostgreSQL.

Milestone squelette : create/list/get/mark-uploaded. Le worker de
transcription (Container Apps Job, plan §9) consommera les sessions
`queued` dans les lots suivants.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Protocol

from .schemas import (
    MeetingAiOutput,
    TranscriptionSegment,
    TranscriptionSession,
    TranscriptionSessionDetails,
    UploadIntentRequest,
)


def _now() -> datetime:
    return datetime.now(timezone.utc)


class SessionNotFound(LookupError):
    pass


class Repository(Protocol):
    kind: str

    async def startup(self) -> None: ...
    async def shutdown(self) -> None: ...
    async def ping(self) -> None: ...
    async def create_session(
        self,
        data: UploadIntentRequest,
        blob_name: str,
        created_by: str | None,
        session_id: str | None = None,
    ) -> TranscriptionSession: ...
    async def mark_uploaded(self, session_id: str, created_by: str) -> TranscriptionSession: ...
    async def list_sessions(
        self, created_by: str, page: int = 1, page_size: int = 50
    ) -> tuple[list[TranscriptionSession], int]: ...
    async def get_session(self, session_id: str, created_by: str) -> TranscriptionSessionDetails: ...


class MemoryRepository:
    """Store en mémoire — dev/tests. Pas de persistance."""

    kind = "memory"

    def __init__(self) -> None:
        self._sessions: dict[str, TranscriptionSession] = {}

    async def startup(self) -> None:  # pragma: no cover - trivial
        return None

    async def shutdown(self) -> None:  # pragma: no cover - trivial
        return None

    async def ping(self) -> None:
        return None

    async def create_session(
        self,
        data: UploadIntentRequest,
        blob_name: str,
        created_by: str | None,
        session_id: str | None = None,
    ) -> TranscriptionSession:
        session = TranscriptionSession(
            id=session_id or str(uuid.uuid4()),
            room_id=data.room_id,
            source_type=data.source_type,
            source_blob=blob_name,
            status="queued",
            language=data.language,
            diarization_enabled=data.diarization_enabled,
            created_by=created_by,
            created_at=_now(),
            title=data.title,
        )
        self._sessions[session.id] = session
        return session

    def _require(self, session_id: str, created_by: str) -> TranscriptionSession:
        session = self._sessions.get(session_id)
        if session is None or session.created_by != created_by:
            raise SessionNotFound(session_id)
        return session

    async def mark_uploaded(self, session_id: str, created_by: str) -> TranscriptionSession:
        session = self._require(session_id, created_by)
        # L'upload est confirmé : la session reste `queued`, prête pour le
        # worker de transcription (lot suivant).
        updated = session.model_copy(update={"status": "queued"})
        self._sessions[session_id] = updated
        return updated

    async def list_sessions(
        self, created_by: str, page: int = 1, page_size: int = 50
    ) -> tuple[list[TranscriptionSession], int]:
        ordered = sorted(
            (session for session in self._sessions.values() if session.created_by == created_by),
            key=lambda session: session.created_at,
            reverse=True,
        )
        start = (page - 1) * page_size
        return ordered[start : start + page_size], len(ordered)

    async def get_session(self, session_id: str, created_by: str) -> TranscriptionSessionDetails:
        session = self._require(session_id, created_by)
        return TranscriptionSessionDetails(**session.model_dump())


class PostgresRepository:
    """Implémentation minimale sur transcription_sessions_azure (asyncpg)."""

    kind = "postgres"

    def __init__(self, database_url: str) -> None:
        self._database_url = database_url
        self._pool = None

    async def startup(self) -> None:
        import asyncpg  # import paresseux

        self._pool = await asyncpg.create_pool(self._database_url, min_size=1, max_size=5)

    async def shutdown(self) -> None:
        if self._pool is not None:
            await self._pool.close()

    async def ping(self) -> None:
        assert self._pool is not None
        async with self._pool.acquire() as conn:
            await conn.execute("select 1")

    async def create_session(
        self,
        data: UploadIntentRequest,
        blob_name: str,
        created_by: str | None,
        session_id: str | None = None,
    ) -> TranscriptionSession:
        assert self._pool is not None
        row = await self._pool.fetchrow(
            """
            insert into transcription_sessions_azure
                (id, room_id, source_type, source_blob, language, diarization_enabled, created_by)
            values (coalesce($7::uuid, gen_random_uuid()), $1::uuid, $2, $3, $4, $5, $6::uuid)
            returning id::text, room_id::text, source_type, source_blob, status,
                      language, model, diarization_enabled, created_by::text,
                      created_at, completed_at
            """,
            data.room_id,
            data.source_type,
            blob_name,
            data.language,
            data.diarization_enabled,
            created_by,
            session_id,
        )
        return TranscriptionSession(**dict(row), title=data.title)

    async def mark_uploaded(self, session_id: str, created_by: str) -> TranscriptionSession:
        assert self._pool is not None
        row = await self._pool.fetchrow(
            """
            update transcription_sessions_azure
               set status = 'queued'
             where id = $1::uuid and created_by = $2::uuid
            returning id::text, room_id::text, source_type, source_blob, status,
                      language, model, diarization_enabled, created_by::text,
                      created_at, completed_at
            """,
            session_id,
            created_by,
        )
        if row is None:
            raise SessionNotFound(session_id)
        return TranscriptionSession(**dict(row))

    async def list_sessions(
        self, created_by: str, page: int = 1, page_size: int = 50
    ) -> tuple[list[TranscriptionSession], int]:
        assert self._pool is not None
        offset = (page - 1) * page_size
        rows = await self._pool.fetch(
            """
            select id::text, room_id::text, source_type, source_blob, status,
                   language, model, diarization_enabled, created_by::text,
                   created_at, completed_at
            from transcription_sessions_azure
            where created_by = $1::uuid
            order by created_at desc
            limit $2 offset $3
            """,
            created_by,
            page_size,
            offset,
        )
        total_row = await self._pool.fetchrow(
            "select count(*) as n from transcription_sessions_azure where created_by = $1::uuid",
            created_by,
        )
        return [TranscriptionSession(**dict(r)) for r in rows], total_row["n"]

    async def get_session(self, session_id: str, created_by: str) -> TranscriptionSessionDetails:
        assert self._pool is not None
        row = await self._pool.fetchrow(
            """
            select id::text, room_id::text, source_type, source_blob, status,
                   language, model, diarization_enabled, created_by::text,
                   created_at, completed_at
            from transcription_sessions_azure
            where id = $1::uuid and created_by = $2::uuid
            """,
            session_id,
            created_by,
        )
        if row is None:
            raise SessionNotFound(session_id)
        segments = await self._pool.fetch(
            """
            select id::text, session_id::text, speaker_label,
                   speaker_profile_id::text, start_ms, end_ms, text,
                   confidence, created_at
            from transcription_segments_azure
            where session_id = $1::uuid
            order by start_ms
            """,
            session_id,
        )
        outputs = await self._pool.fetch(
            """
            select id::text, session_id::text, output_type,
                   coalesce(payload, '{}'::jsonb) as payload, model, created_at
            from meeting_ai_outputs_azure
            where session_id = $1::uuid
            order by created_at
            """,
            session_id,
        )
        return TranscriptionSessionDetails(
            **dict(row),
            segments=[TranscriptionSegment(**dict(s)) for s in segments],
            ai_outputs=[MeetingAiOutput(**dict(o)) for o in outputs],
        )


def build_repository(database_url: str) -> Repository:
    if database_url:
        return PostgresRepository(database_url)
    return MemoryRepository()
