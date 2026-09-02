"""Repository Pulse — in-memory (dev/tests) ou PostgreSQL (prod, minimal)."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Protocol

from .schemas import Conversation, ConversationCreate, Message, SendMessageInput


def _now() -> datetime:
    return datetime.now(timezone.utc)


class ConversationNotFound(LookupError):
    pass


class ConversationForbidden(PermissionError):
    pass


class Repository(Protocol):
    kind: str

    async def startup(self) -> None: ...
    async def shutdown(self) -> None: ...
    async def ping(self) -> None: ...
    async def list_conversations(self, member_profile_id: str) -> list[Conversation]: ...
    async def create_conversation(
        self, data: ConversationCreate, created_by: str
    ) -> Conversation: ...
    async def list_messages(
        self,
        conversation_id: str,
        member_profile_id: str,
        limit: int = 50,
        before: str | None = None,
    ) -> list[Message]: ...
    async def send_message(
        self, conversation_id: str, data: SendMessageInput, author: str
    ) -> Message: ...


class MemoryRepository:
    """Store en mémoire — dev/tests. Pas de persistance."""

    kind = "memory"

    def __init__(self) -> None:
        self._conversations: dict[str, Conversation] = {}
        self._messages: dict[str, list[Message]] = {}
        self._members: dict[str, set[str]] = {}

    async def startup(self) -> None:  # pragma: no cover - trivial
        return None

    async def shutdown(self) -> None:  # pragma: no cover - trivial
        return None

    async def ping(self) -> None:
        return None

    async def list_conversations(self, member_profile_id: str) -> list[Conversation]:
        result = []
        for conv in sorted(self._conversations.values(), key=lambda c: c.updated_at, reverse=True):
            if member_profile_id not in self._members.get(conv.id, set()):
                continue
            messages = self._messages.get(conv.id, [])
            result.append(
                conv.model_copy(
                    update={"last_message": messages[-1] if messages else None}
                )
            )
        return result

    async def create_conversation(
        self, data: ConversationCreate, created_by: str
    ) -> Conversation:
        now = _now()
        members = set(data.member_profile_ids)
        members.add(created_by)
        conv = Conversation(
            id=str(uuid.uuid4()),
            name=data.name,
            description=data.description,
            type=data.type,
            project_key=data.project_key,
            etablissement_id=data.etablissement_id,
            is_private=data.is_private,
            status="active",
            created_by=created_by,
            created_at=now,
            updated_at=now,
            member_count=len(members),
        )
        self._conversations[conv.id] = conv
        self._messages[conv.id] = []
        self._members[conv.id] = members
        return conv

    def _require(self, conversation_id: str) -> Conversation:
        conv = self._conversations.get(conversation_id)
        if conv is None:
            raise ConversationNotFound(conversation_id)
        return conv

    def _require_membership(self, conversation_id: str, member_profile_id: str) -> None:
        self._require(conversation_id)
        if member_profile_id not in self._members.get(conversation_id, set()):
            raise ConversationForbidden(conversation_id)

    async def list_messages(
        self,
        conversation_id: str,
        member_profile_id: str,
        limit: int = 50,
        before: str | None = None,
    ) -> list[Message]:
        self._require_membership(conversation_id, member_profile_id)
        messages = self._messages.get(conversation_id, [])
        if before:
            index = next((i for i, m in enumerate(messages) if m.id == before), None)
            if index is not None:
                messages = messages[:index]
        return messages[-limit:]

    async def send_message(
        self, conversation_id: str, data: SendMessageInput, author: str
    ) -> Message:
        self._require_membership(conversation_id, author)
        conv = self._require(conversation_id)
        message = Message(
            id=str(uuid.uuid4()),
            conversation_id=conversation_id,
            parent_message_id=data.parent_message_id,
            author_profile_id=author,
            body=data.body,
            body_format=data.body_format,
            metadata=data.metadata,
            created_at=_now(),
        )
        self._messages[conversation_id].append(message)
        self._conversations[conversation_id] = conv.model_copy(update={"updated_at": _now()})
        return message


class PostgresRepository:
    """Implémentation minimale sur les tables pulse_*_azure (asyncpg)."""

    kind = "postgres"

    def __init__(self, database_url: str) -> None:
        self._database_url = database_url
        self._pool = None

    async def startup(self) -> None:
        import asyncpg

        self._pool = await asyncpg.create_pool(self._database_url, min_size=1, max_size=5)

    async def shutdown(self) -> None:
        if self._pool is not None:
            await self._pool.close()

    async def ping(self) -> None:
        assert self._pool is not None
        async with self._pool.acquire() as conn:
            await conn.execute("select 1")

    async def list_conversations(self, member_profile_id: str) -> list[Conversation]:
        assert self._pool is not None
        rows = await self._pool.fetch(
            """
            select c.id::text, c.name, c.description, c.type, c.project_key,
                   c.etablissement_id::text, c.is_private, c.status,
                   c.created_by::text, c.created_at, c.updated_at,
                   (select count(*) from pulse_members_azure m
                     where m.conversation_id = c.id) as member_count
            from pulse_conversations_azure c
            join pulse_members_azure viewer
              on viewer.conversation_id = c.id and viewer.profile_id = $1::uuid
            where c.status = 'active'
            order by c.updated_at desc
            """,
            member_profile_id,
        )
        return [Conversation(**dict(row)) for row in rows]

    async def create_conversation(
        self, data: ConversationCreate, created_by: str
    ) -> Conversation:
        assert self._pool is not None
        member_ids = set(data.member_profile_ids)
        member_ids.add(created_by)
        async with self._pool.acquire() as conn:
            async with conn.transaction():
                row = await conn.fetchrow(
                    """
                    insert into pulse_conversations_azure
                        (name, description, type, project_key, etablissement_id, is_private, created_by)
                    values ($1, $2, $3, $4, $5::uuid, $6, $7::uuid)
                    returning id::text, name, description, type, project_key,
                              etablissement_id::text, is_private, status,
                              created_by::text, created_at, updated_at
                    """,
                    data.name,
                    data.description,
                    data.type,
                    data.project_key,
                    data.etablissement_id,
                    data.is_private,
                    created_by,
                )
                await conn.executemany(
                    """
                    insert into pulse_members_azure (conversation_id, profile_id, role)
                    values ($1::uuid, $2::uuid, $3)
                    """,
                    [
                        (row["id"], member_id, "owner" if member_id == created_by else "member")
                        for member_id in member_ids
                    ],
                )
        return Conversation(**dict(row), member_count=len(member_ids))

    async def _require_membership(
        self, conversation_id: str, member_profile_id: str
    ) -> None:
        assert self._pool is not None
        row = await self._pool.fetchrow(
            """
            select exists(
                       select 1 from pulse_conversations_azure where id = $1::uuid
                   ) as conversation_exists,
                   exists(
                       select 1 from pulse_members_azure
                       where conversation_id = $1::uuid and profile_id = $2::uuid
                   ) as is_member
            """,
            conversation_id,
            member_profile_id,
        )
        if not row["conversation_exists"]:
            raise ConversationNotFound(conversation_id)
        if not row["is_member"]:
            raise ConversationForbidden(conversation_id)

    async def list_messages(
        self,
        conversation_id: str,
        member_profile_id: str,
        limit: int = 50,
        before: str | None = None,
    ) -> list[Message]:
        assert self._pool is not None
        await self._require_membership(conversation_id, member_profile_id)
        rows = await self._pool.fetch(
            """
            select id::text, conversation_id::text, parent_message_id::text,
                   author_profile_id::text, body, body_format, status,
                   coalesce(metadata, '{}'::jsonb) as metadata,
                   created_at, edited_at, deleted_at
            from pulse_messages_azure
            where conversation_id = $1::uuid
              and ($2::uuid is null or created_at <
                   (select created_at from pulse_messages_azure where id = $2::uuid))
            order by created_at desc
            limit $3
            """,
            conversation_id,
            before,
            limit,
        )
        return [Message(**dict(row)) for row in reversed(rows)]

    async def send_message(
        self, conversation_id: str, data: SendMessageInput, author: str
    ) -> Message:
        assert self._pool is not None
        import json

        await self._require_membership(conversation_id, author)
        row = await self._pool.fetchrow(
            """
            insert into pulse_messages_azure
                (conversation_id, parent_message_id, author_profile_id, body,
                 body_format, metadata)
            values ($1::uuid, $2::uuid, $3::uuid, $4, $5, $6::jsonb)
            returning id::text, conversation_id::text, parent_message_id::text,
                      author_profile_id::text, body, body_format, status,
                      coalesce(metadata, '{}'::jsonb) as metadata,
                      created_at, edited_at, deleted_at
            """,
            conversation_id,
            data.parent_message_id,
            author,
            data.body,
            data.body_format,
            json.dumps(data.metadata),
        )
        return Message(**dict(row))


def build_repository(database_url: str) -> Repository:
    if database_url:
        return PostgresRepository(database_url)
    return MemoryRepository()
