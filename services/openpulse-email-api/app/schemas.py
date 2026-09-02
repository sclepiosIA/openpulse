"""Schémas Pydantic — contrat aligné sur src/types/emailAzure.ts (front)."""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

EmailProvider = Literal["imap_smtp", "microsoft_graph", "gmail_api", "shared_mailbox"]
MailboxHealth = Literal["healthy", "degraded", "error", "unknown"]
AccountStatus = Literal["active", "paused", "error", "disabled"]


class HealthResponse(BaseModel):
    status: Literal["ok"] = "ok"
    service: str = "openpulse-email-api"
    version: str
    env: str
    database: Literal["postgres", "memory"]


class AccountSyncStatus(BaseModel):
    """Miroir de EmailAzureAccountSyncStatus (front)."""

    account_id: str
    email_address: str
    provider: EmailProvider
    sync_enabled: bool
    last_sync_at: datetime | None = None
    last_error: str | None = None
    error_count: int = 0
    pending_messages: int = 0
    health: MailboxHealth = "unknown"


class SyncQueueStatus(BaseModel):
    ai_pending: int = 0
    unclassified: int = 0


class SyncStatusResponse(BaseModel):
    """Réponse GET /api/email/sync/status — miroir EmailAzureSyncStatusResponse."""

    backend: Literal["azure"] = "azure"
    generated_at: datetime
    accounts: list[AccountSyncStatus]
    queue: SyncQueueStatus


class AccountCreate(BaseModel):
    """Enregistrement d'un compte (référence Key Vault, jamais de secret)."""

    email_address: str = Field(min_length=3, max_length=320)
    display_name: str | None = None
    provider: EmailProvider
    is_shared: bool = False
    sync_enabled: bool = True
    secret_ref: str = Field(min_length=1, max_length=500)


class Account(BaseModel):
    """Miroir de la table email_accounts_azure."""

    id: str
    profile_id: str
    email_address: str
    display_name: str | None = None
    provider: EmailProvider
    is_shared: bool = False
    sync_enabled: bool = True
    last_sync_at: datetime | None = None
    status: AccountStatus = "active"
    secret_ref: str
    created_at: datetime
    updated_at: datetime
