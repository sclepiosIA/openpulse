"""Conversations + messages — sous-ensemble du plan §12 (squelette)."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status

from ..auth import CurrentUser, get_current_user
from ..deps import get_repository
from ..repository import ConversationForbidden, ConversationNotFound, Repository
from ..schemas import Conversation, ConversationCreate, Message, SendMessageInput

router = APIRouter(prefix="/api/pulse", tags=["conversations"])


@router.get("/conversations", response_model=list[Conversation])
async def list_conversations(
    repo: Repository = Depends(get_repository),
    user: CurrentUser = Depends(get_current_user),
) -> list[Conversation]:
    return await repo.list_conversations(user.user_id or "dev")


@router.post(
    "/conversations", response_model=Conversation, status_code=status.HTTP_201_CREATED
)
async def create_conversation(
    data: ConversationCreate,
    repo: Repository = Depends(get_repository),
    user: CurrentUser = Depends(get_current_user),
) -> Conversation:
    return await repo.create_conversation(data, created_by=user.user_id or "dev")


@router.get("/conversations/{conversation_id}/messages", response_model=list[Message])
async def list_messages(
    conversation_id: str,
    before: str | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    repo: Repository = Depends(get_repository),
    user: CurrentUser = Depends(get_current_user),
) -> list[Message]:
    try:
        return await repo.list_messages(
            conversation_id, user.user_id or "dev", limit=limit, before=before
        )
    except ConversationNotFound as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "conversation inconnue") from exc
    except ConversationForbidden as exc:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "accès interdit") from exc


@router.post(
    "/conversations/{conversation_id}/messages",
    response_model=Message,
    status_code=status.HTTP_201_CREATED,
)
async def send_message(
    conversation_id: str,
    data: SendMessageInput,
    repo: Repository = Depends(get_repository),
    user: CurrentUser = Depends(get_current_user),
) -> Message:
    try:
        return await repo.send_message(conversation_id, data, author=user.user_id or "dev")
    except ConversationNotFound as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "conversation inconnue") from exc
    except ConversationForbidden as exc:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "accès interdit") from exc
