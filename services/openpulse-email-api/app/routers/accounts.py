"""Comptes email Azure — CRUD minimal (squelette lot 2).

Les secrets ne transitent JAMAIS ici : seul `secret_ref` (référence
Key Vault) est stocké, conformément au plan Smart Inbox §5.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, status

from ..auth import CurrentUser, get_current_user
from ..deps import get_repository
from ..repository import Repository
from ..schemas import Account, AccountCreate

router = APIRouter(prefix="/api/email/accounts", tags=["accounts"])


@router.get("", response_model=list[Account])
async def list_accounts(
    repo: Repository = Depends(get_repository),
    user: CurrentUser = Depends(get_current_user),
) -> list[Account]:
    return await repo.list_accounts(user.user_id)


@router.post("", response_model=Account, status_code=status.HTTP_201_CREATED)
async def create_account(
    data: AccountCreate,
    repo: Repository = Depends(get_repository),
    user: CurrentUser = Depends(get_current_user),
) -> Account:
    return await repo.create_account(user.user_id, data)
