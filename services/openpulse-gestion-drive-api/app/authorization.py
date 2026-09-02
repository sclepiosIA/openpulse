"""Autorisation Drive centralisée, fail-closed en mode JWT."""

from __future__ import annotations

from uuid import UUID

from fastapi import HTTPException, status

from .auth import CurrentUser
from .repository import Repository

ROLE_LEVEL = {
    "viewer": 10,
    "uploader": 20,
    "editor": 30,
    "admin": 40,
    "owner": 50,
}


def _subjects(user: CurrentUser) -> set[str]:
    return {value for value in (user.user_id, user.email) if value}


def _is_disabled_auth_user(user: CurrentUser) -> bool:
    return user.user_id is None and user.email == "dev@local"


async def space_role(repo: Repository, space_id: UUID, user: CurrentUser) -> str | None:
    if _is_disabled_auth_user(user):
        return "owner"
    claims = user.raw_claims or {}
    app_role = claims.get("app_role") or claims.get("role")
    if app_role == "global_admin":
        return "owner"
    subjects = _subjects(user)
    if not subjects:
        return None
    permissions = await repo.list_permissions(space_id)
    roles = [
        p["permission"]
        for p in permissions
        if (
            p.get("subject_type") == "user"
            and str(p.get("subject_id")) in subjects
        ) or (
            p.get("subject_type") == "role"
            and app_role
            and str(p.get("subject_id")) == str(app_role)
        )
    ]
    return max(roles, key=lambda role: ROLE_LEVEL.get(role, -1), default=None)


async def require_space_role(
    repo: Repository,
    space_id: UUID,
    user: CurrentUser,
    minimum: str = "viewer",
) -> str:
    role = await space_role(repo, space_id, user)
    if role is None or ROLE_LEVEL.get(role, -1) < ROLE_LEVEL[minimum]:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Accès refusé à cet espace Drive")
    return role


async def filter_authorized_spaces(
    repo: Repository, spaces: list[dict], user: CurrentUser
) -> list[dict]:
    if _is_disabled_auth_user(user):
        return spaces
    result: list[dict] = []
    for space in spaces:
        if await space_role(repo, space["id"], user) is not None:
            result.append(space)
    return result


def require_global_admin(user: CurrentUser) -> None:
    if _is_disabled_auth_user(user):
        return
    claims = user.raw_claims or {}
    role = claims.get("app_role") or claims.get("role")
    if role != "global_admin":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Accès global_admin requis")
