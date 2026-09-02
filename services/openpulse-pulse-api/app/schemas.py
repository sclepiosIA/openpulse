"""Schémas Pydantic — contrat aligné sur src/types/pulse-azure.ts (front)."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field

ConversationType = Literal["direct", "group", "project", "establishment", "incident", "dpo"]
ConversationStatus = Literal["active", "archived"]
MessageStatus = Literal["active", "edited", "deleted", "system"]
BodyFormat = Literal["markdown", "plaintext"]


class HealthResponse(BaseModel):
    """Miroir de AzurePulseHealth (front) — GET /healthz."""

    status: Literal["ok", "degraded", "down"] = "ok"
    service: str = "openpulse-pulse-api"
    version: str
    timestamp: datetime
    dependencies: dict[str, Literal["ok", "degraded", "down"]] = Field(default_factory=dict)


class Message(BaseModel):
    """Miroir de AzurePulseMessage / table pulse_messages_azure."""

    id: str
    conversation_id: str
    parent_message_id: str | None = None
    author_profile_id: str
    body: str
    body_format: BodyFormat = "markdown"
    status: MessageStatus = "active"
    metadata: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime
    edited_at: datetime | None = None
    deleted_at: datetime | None = None


class Conversation(BaseModel):
    """Miroir de AzurePulseConversation / table pulse_conversations_azure."""

    id: str
    name: str
    description: str | None = None
    type: ConversationType
    project_key: str | None = None
    etablissement_id: str | None = None
    is_private: bool = False
    status: ConversationStatus = "active"
    created_by: str | None = None
    created_at: datetime
    updated_at: datetime
    # Champs dérivés côté API (contrat front)
    unread_count: int = 0
    last_message: Message | None = None
    member_count: int = 0


class ConversationCreate(BaseModel):
    """Miroir de AzureCreateConversationInput."""

    name: str = Field(min_length=1, max_length=200)
    description: str | None = None
    type: ConversationType
    project_key: str | None = None
    etablissement_id: str | None = None
    is_private: bool = False
    member_profile_ids: list[str] = Field(default_factory=list)


class SendMessageInput(BaseModel):
    """Miroir de AzureSendMessageInput."""

    body: str = Field(min_length=1, max_length=20_000)
    body_format: BodyFormat = "markdown"
    parent_message_id: str | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)
