"""Repository comptes/sync email — in-memory (dev/tests) ou PostgreSQL (prod).

Toutes les opérations métier sont bornées par ``profile_id``. Le repository
PostgreSQL conserve ce filtre dans la requête SQL afin qu'un oubli au niveau
d'une route ne puisse pas exposer les données d'un autre profil.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Protocol

from .schemas import Account, AccountCreate, AccountSyncStatus, SyncQueueStatus


def _now() -> datetime:
    return datetime.now(timezone.utc)


class Repository(Protocol):
    kind: str

    async def startup(self) -> None: ...
    async def shutdown(self) -> None: ...
    async def ping(self) -> None: ...
    async def list_accounts(self, profile_id: str) -> list[Account]: ...
    async def create_account(self, profile_id: str, data: AccountCreate) -> Account: ...
    async def sync_statuses(
        self, profile_id: str
    ) -> tuple[list[AccountSyncStatus], SyncQueueStatus]: ...


class MemoryRepository:
    """Store en mémoire — dev/tests. Pas de persistance."""

    kind = "memory"

    def __init__(self) -> None:
        self._accounts: dict[str, Account] = {}

    async def startup(self) -> None:  # pragma: no cover - trivial
        return None

    async def shutdown(self) -> None:  # pragma: no cover - trivial
        return None

    async def ping(self) -> None:
        return None

    async def list_accounts(self, profile_id: str) -> list[Account]:
        owned_accounts = (
            account
            for account in self._accounts.values()
            if account.profile_id == profile_id
        )
        return sorted(owned_accounts, key=lambda account: account.created_at)

    async def create_account(self, profile_id: str, data: AccountCreate) -> Account:
        now = _now()
        account = Account(
            id=str(uuid.uuid4()),
            profile_id=profile_id,
            email_address=data.email_address,
            display_name=data.display_name,
            provider=data.provider,
            is_shared=data.is_shared,
            sync_enabled=data.sync_enabled,
            last_sync_at=None,
            status="active",
            secret_ref=data.secret_ref,
            created_at=now,
            updated_at=now,
        )
        self._accounts[account.id] = account
        return account

    async def sync_statuses(
        self, profile_id: str
    ) -> tuple[list[AccountSyncStatus], SyncQueueStatus]:
        statuses = [
            AccountSyncStatus(
                account_id=account.id,
                email_address=account.email_address,
                provider=account.provider,
                sync_enabled=account.sync_enabled,
                last_sync_at=account.last_sync_at,
                last_error=None,
                error_count=0,
                pending_messages=0,
                health="unknown" if account.last_sync_at is None else "healthy",
            )
            for account in await self.list_accounts(profile_id)
        ]
        return statuses, SyncQueueStatus(ai_pending=0, unclassified=0)


class PostgresRepository:
    """Accès borné par profil aux tables email Azure."""

    kind = "postgres"

    def __init__(self, database_url: str) -> None:
        self._database_url = database_url
        self._pool = None

    async def startup(self) -> None:
        import asyncpg  # import paresseux : absent des tests memory

        self._pool = await asyncpg.create_pool(self._database_url, min_size=1, max_size=5)

    async def shutdown(self) -> None:
        if self._pool is not None:
            await self._pool.close()

    async def ping(self) -> None:
        assert self._pool is not None
        async with self._pool.acquire() as conn:
            await conn.execute("select 1")

    async def list_accounts(self, profile_id: str) -> list[Account]:
        assert self._pool is not None
        rows = await self._pool.fetch(
            """
            select id::text, profile_id::text, email_address, display_name, provider,
                   is_shared, sync_enabled, last_sync_at, status, secret_ref,
                   created_at, updated_at
            from email_accounts_azure
            where profile_id = $1::text::uuid
            order by created_at
            """,
            profile_id,
        )
        return [Account(**dict(row)) for row in rows]

    async def create_account(self, profile_id: str, data: AccountCreate) -> Account:
        assert self._pool is not None
        row = await self._pool.fetchrow(
            """
            insert into email_accounts_azure
                (profile_id, email_address, display_name, provider, is_shared, sync_enabled, secret_ref)
            values ($1::text::uuid, $2, $3, $4, $5, $6, $7)
            returning id::text, profile_id::text, email_address, display_name, provider,
                      is_shared, sync_enabled, last_sync_at, status, secret_ref,
                      created_at, updated_at
            """,
            profile_id,
            data.email_address,
            data.display_name,
            data.provider,
            data.is_shared,
            data.sync_enabled,
            data.secret_ref,
        )
        return Account(**dict(row))

    async def sync_statuses(
        self, profile_id: str
    ) -> tuple[list[AccountSyncStatus], SyncQueueStatus]:
        assert self._pool is not None
        rows = await self._pool.fetch(
            """
            select a.id::text as account_id, a.email_address, a.provider,
                   a.sync_enabled, a.last_sync_at,
                   c.last_error, coalesce(c.error_count, 0) as error_count
            from email_accounts_azure a
            left join email_sync_cursors c on c.account_id = a.id
            where a.profile_id = $1::text::uuid
            order by a.created_at
            """,
            profile_id,
        )
        statuses: list[AccountSyncStatus] = []
        for row in rows:
            error_count = row["error_count"]
            if row["last_error"]:
                health = "error" if error_count >= 3 else "degraded"
            elif row["last_sync_at"] is None:
                health = "unknown"
            else:
                health = "healthy"
            statuses.append(
                AccountSyncStatus(
                    account_id=row["account_id"],
                    email_address=row["email_address"],
                    provider=row["provider"],
                    sync_enabled=row["sync_enabled"],
                    last_sync_at=row["last_sync_at"],
                    last_error=row["last_error"],
                    error_count=error_count,
                    pending_messages=0,
                    health=health,  # type: ignore[arg-type]
                )
            )
        queue_row = await self._pool.fetchrow(
            """
            select
              count(*) filter (where i.status = 'pending') as ai_pending,
              count(*) filter (where i.status not in ('done')) as unclassified
            from email_ai_insights i
            join email_threads t on t.id = i.thread_id
            join user_email_accounts uea on uea.id = t.user_email_account_id
            where uea.profile_id = $1::text::uuid
            """,
            profile_id,
        )
        queue = SyncQueueStatus(
            ai_pending=queue_row["ai_pending"] or 0,
            unclassified=queue_row["unclassified"] or 0,
        )
        return statuses, queue


def build_repository(database_url: str) -> Repository:
    if database_url:
        return PostgresRepository(database_url)
    return MemoryRepository()
