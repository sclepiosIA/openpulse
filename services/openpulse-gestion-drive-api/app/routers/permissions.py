"""Endpoints permissions Gestion Drive — P1 gouvernance fichiers.

GET    /api/drive/permissions?space_id=&folder_id=&file_id=
POST   /api/drive/permissions
PATCH  /api/drive/permissions/{id}
DELETE /api/drive/permissions/{id}
GET    /api/drive/audit?entity_type=&entity_id=

Scopes de lecture :
- space_id seul          → permissions directes de l'espace ;
- space_id + folder_id   → permissions directes du dossier ;
- space_id + file_id     → permissions directes du fichier.

Chaque mutation écrit une entrée `drive_audit_logs` (audit minimal) et un
événement `permission_changed` dans le feed sync (consommé par le desktop).
"""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status

from ..auth import CurrentUser, get_current_user
from ..authorization import require_global_admin, require_space_role
from ..deps import get_repository
from ..repository import ConflictError, NotFoundError, Repository
from ..schemas import (
    AuditEntry,
    AuditResponse,
    Permission,
    PermissionCreate,
    PermissionsResponse,
    PermissionUpdate,
)

router = APIRouter(prefix="/api/drive", tags=["drive-permissions"])

AUDIT_PAGE_SIZE = 100


def _actor(user: CurrentUser) -> UUID | None:
    try:
        return UUID(user.user_id) if user.user_id else None
    except ValueError:
        return None


async def _validate_scope(
    repo: Repository,
    space_id: UUID,
    folder_id: UUID | None,
    file_id: UUID | None,
) -> None:
    """Vérifie l'existence de l'espace et la cohérence dossier/fichier ↔ espace."""
    if folder_id is not None and file_id is not None:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            "folder_id et file_id sont mutuellement exclusifs",
        )
    try:
        await repo.get_space(space_id)
    except NotFoundError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(exc)) from exc

    if file_id is not None:
        try:
            file = await repo.get_file(file_id)
        except NotFoundError as exc:
            raise HTTPException(status.HTTP_404_NOT_FOUND, str(exc)) from exc
        if file["space_id"] != space_id:
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_CONTENT,
                "file_id n'appartient pas à cet espace",
            )

    if folder_id is not None:
        folders, _ = await repo.get_tree(space_id)
        if not any(f["id"] == folder_id for f in folders):
            raise HTTPException(
                status.HTTP_404_NOT_FOUND, f"dossier introuvable dans l'espace: {folder_id}"
            )


def _require_effective_permission_contract(body: PermissionCreate) -> None:
    """Refuse les scopes encore stockés mais non appliqués à l'autorisation runtime."""

    if body.folder_id is not None or body.file_id is not None:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            "Permissions dossier/fichier indisponibles tant que l'héritage n'est pas appliqué",
        )
    if body.subject_type not in {"user", "role"}:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            "Seuls les sujets user et role sont actuellement appliqués",
        )
    if body.permission == "no_sync_local":
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            "no_sync_local indisponible tant que le filtre de synchronisation n'est pas appliqué",
        )


# ---------------------------------------------------------------------------
# Permissions CRUD
# ---------------------------------------------------------------------------

@router.get("/permissions", response_model=PermissionsResponse)
async def list_permissions(
    space_id: UUID = Query(...),
    folder_id: UUID | None = Query(None),
    file_id: UUID | None = Query(None),
    repo: Repository = Depends(get_repository),
    user: CurrentUser = Depends(get_current_user),
) -> PermissionsResponse:
    await _validate_scope(repo, space_id, folder_id, file_id)
    await require_space_role(repo, space_id, user, "admin")
    permissions = await repo.list_permissions(space_id, folder_id=folder_id, file_id=file_id)
    return PermissionsResponse(
        space_id=space_id,
        folder_id=folder_id,
        file_id=file_id,
        permissions=[Permission(**p) for p in permissions],
    )


@router.post("/permissions", response_model=Permission, status_code=status.HTTP_201_CREATED)
async def create_permission(
    body: PermissionCreate,
    repo: Repository = Depends(get_repository),
    user: CurrentUser = Depends(get_current_user),
) -> Permission:
    await _validate_scope(repo, body.space_id, body.folder_id, body.file_id)
    await require_space_role(repo, body.space_id, user, "admin")
    _require_effective_permission_contract(body)
    actor = _actor(user)
    data = body.model_dump()
    data["created_by"] = actor
    try:
        perm = await repo.create_permission(data)
    except ConflictError as exc:
        raise HTTPException(status.HTTP_409_CONFLICT, str(exc)) from exc

    await repo.add_audit(
        user_id=actor, action="permission_created", entity_type="permission",
        entity_id=perm["id"],
        payload={
            "space_id": str(perm["space_id"]),
            "folder_id": str(perm["folder_id"]) if perm["folder_id"] else None,
            "file_id": str(perm["file_id"]) if perm["file_id"] else None,
            "subject_type": perm["subject_type"],
            "subject_id": perm["subject_id"],
            "permission": perm["permission"],
        },
    )
    await repo.add_event(
        space_id=perm["space_id"], event_type="permission_changed",
        file_id=perm["file_id"], folder_id=perm["folder_id"],
        payload={"action": "created", "permission_id": str(perm["id"]),
                 "subject_type": perm["subject_type"], "subject_id": perm["subject_id"],
                 "permission": perm["permission"]},
        actor=actor,
    )
    return Permission(**perm)


@router.patch("/permissions/{permission_id}", response_model=Permission)
async def update_permission(
    permission_id: UUID,
    body: PermissionUpdate,
    repo: Repository = Depends(get_repository),
    user: CurrentUser = Depends(get_current_user),
) -> Permission:
    if body.permission == "no_sync_local":
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            "no_sync_local indisponible tant que le filtre de synchronisation n'est pas appliqué",
        )
    actor = _actor(user)
    try:
        existing = await repo.get_permission(permission_id)
        await require_space_role(repo, existing["space_id"], user, "admin")
        _require_effective_permission_contract(PermissionCreate(**existing))
        # Copie de la valeur AVANT mutation (le repo memory renvoie le dict vivant).
        before_role = existing["permission"]
        perm = await repo.update_permission(permission_id, body.permission)
    except NotFoundError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(exc)) from exc

    await repo.add_audit(
        user_id=actor, action="permission_updated", entity_type="permission",
        entity_id=perm["id"],
        payload={
            "space_id": str(perm["space_id"]),
            "subject_type": perm["subject_type"],
            "subject_id": perm["subject_id"],
            "permission_before": before_role,
            "permission_after": perm["permission"],
        },
    )
    await repo.add_event(
        space_id=perm["space_id"], event_type="permission_changed",
        file_id=perm["file_id"], folder_id=perm["folder_id"],
        payload={"action": "updated", "permission_id": str(perm["id"]),
                 "subject_type": perm["subject_type"], "subject_id": perm["subject_id"],
                 "permission": perm["permission"]},
        actor=actor,
    )
    return Permission(**perm)


@router.delete("/permissions/{permission_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_permission(
    permission_id: UUID,
    repo: Repository = Depends(get_repository),
    user: CurrentUser = Depends(get_current_user),
) -> None:
    actor = _actor(user)
    try:
        existing = await repo.get_permission(permission_id)
        await require_space_role(repo, existing["space_id"], user, "admin")
        perm = await repo.delete_permission(permission_id)
    except NotFoundError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(exc)) from exc

    await repo.add_audit(
        user_id=actor, action="permission_deleted", entity_type="permission",
        entity_id=perm["id"],
        payload={
            "space_id": str(perm["space_id"]),
            "subject_type": perm["subject_type"],
            "subject_id": perm["subject_id"],
            "permission": perm["permission"],
        },
    )
    await repo.add_event(
        space_id=perm["space_id"], event_type="permission_changed",
        file_id=perm["file_id"], folder_id=perm["folder_id"],
        payload={"action": "deleted", "permission_id": str(perm["id"]),
                 "subject_type": perm["subject_type"], "subject_id": perm["subject_id"]},
        actor=actor,
    )
    return None


# ---------------------------------------------------------------------------
# Audit minimal
# ---------------------------------------------------------------------------

@router.get("/audit", response_model=AuditResponse)
async def get_audit(
    entity_type: str | None = Query(None, max_length=100),
    entity_id: UUID | None = Query(None),
    limit: int = Query(AUDIT_PAGE_SIZE, ge=1, le=500),
    repo: Repository = Depends(get_repository),
    user: CurrentUser = Depends(get_current_user),
) -> AuditResponse:
    require_global_admin(user)
    entries = await repo.get_audit(entity_type=entity_type, entity_id=entity_id, limit=limit)
    return AuditResponse(entries=[AuditEntry(**e) for e in entries])
