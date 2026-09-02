"""Supervision sync — GET /api/email/sync/status (contrat front lot 1).

Le front (src/services/email/emailAzureApi.ts) valide `backend === 'azure'`
et `Array.isArray(accounts)` : ces invariants sont garantis par le schéma.
"""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends

from ..auth import CurrentUser, get_current_user
from ..deps import get_repository
from ..repository import Repository
from ..schemas import SyncStatusResponse

router = APIRouter(prefix="/api/email/sync", tags=["sync"])


@router.get("/status", response_model=SyncStatusResponse)
async def sync_status(
    repo: Repository = Depends(get_repository),
    user: CurrentUser = Depends(get_current_user),
) -> SyncStatusResponse:
    accounts, queue = await repo.sync_statuses(user.user_id)
    return SyncStatusResponse(
        generated_at=datetime.now(timezone.utc),
        accounts=accounts,
        queue=queue,
    )
