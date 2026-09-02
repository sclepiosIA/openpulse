"""Endpoints Gestion Drive — Milestone 1.

GET  /api/drive/spaces
POST /api/drive/spaces
GET  /api/drive/tree?space_id=...
POST /api/drive/upload-intent
POST /api/drive/upload-complete
POST /api/drive/download-url
GET  /api/drive/changes?space_id=...&since_event_id=...
"""

from __future__ import annotations

import asyncio
from datetime import datetime, timezone
from uuid import NAMESPACE_URL, UUID, uuid5

from fastapi import APIRouter, Depends, HTTPException, Query, status

from ..auth import CurrentUser, get_current_user
from ..authorization import filter_authorized_spaces, require_global_admin, require_space_role
from ..config import Settings, get_settings
from ..deps import get_repository, get_storage
from ..paths import (
    InvalidPathError,
    blob_name_for_file,
    blob_name_for_version,
    file_name,
    is_ignored_name,
    normalize_drive_path,
    parent_path,
)
from ..repository import ConflictError, NotFoundError, Repository
from ..schemas import (
    ChangesResponse,
    DownloadUrlRequest,
    DownloadUrlResponse,
    FileMoveRequest,
    FileNode,
    FolderNode,
    Space,
    SpaceCreate,
    SyncEvent,
    TreeResponse,
    UploadCompleteRequest,
    UploadCompleteResponse,
    UploadIntentRequest,
    UploadIntentResponse,
)
from ..storage import BlobStorage
from ..tokens import UploadTokenError, make_upload_token, verify_upload_token

router = APIRouter(prefix="/api/drive", tags=["drive"])

CHANGES_PAGE_SIZE = 500


def _actor(user: CurrentUser) -> UUID | None:
    try:
        return UUID(user.user_id) if user.user_id else None
    except ValueError:
        return None


# ---------------------------------------------------------------------------
# Spaces
# ---------------------------------------------------------------------------

_SPACE_TYPE_FALLBACKS = {
    "general": "gsi",
    "documents": "gsi",
    "institution": "etablissement",
    "establishment": "etablissement",
    "dpo_rssi": "dpo",
    "templates": "template",
}

_DEFAULT_SPACE_DEFINITIONS = [
    ("OpenPulse — Documents généraux", "openpulse-documents", "gsi", "standard", "allowed"),
    ("Établissement — CH Démo", "etablissement-ch-demo", "etablissement", "sensitive", "allowed"),
    ("DPO/RSSI — Preuves", "dpo-rssi-preuves", "dpo", "dpo_restricted", "web_only"),
    ("Templates & liasses", "templates-liasses", "template", "standard", "allowed"),
]


def _fallback_spaces() -> list[dict]:
    now = datetime(2026, 1, 1, tzinfo=timezone.utc)
    return [
        {
            "id": uuid5(NAMESPACE_URL, f"openpulse-drive-space:{slug}"),
            "name": name,
            "slug": slug,
            "type": typ,
            "etablissement_id": None,
            "sensitivity": sensitivity,
            "sync_policy": sync_policy,
            "status": "active",
            "created_at": now,
            "updated_at": now,
        }
        for name, slug, typ, sensitivity, sync_policy in _DEFAULT_SPACE_DEFINITIONS
    ]


def _normalise_space_payload(raw: dict) -> dict:
    """Keep legacy/dirty DB rows from breaking the whole /spaces response."""
    space = dict(raw)
    typ = str(space.get("type") or "gsi")
    space["type"] = _SPACE_TYPE_FALLBACKS.get(typ, typ)
    if space["type"] not in {"gsi", "etablissement", "project", "dpo", "template", "personal"}:
        space["type"] = "gsi"

    sensitivity = str(space.get("sensitivity") or "standard")
    if sensitivity not in {"standard", "sensitive", "hds", "dpo_restricted"}:
        space["sensitivity"] = "standard"

    sync_policy = str(space.get("sync_policy") or "allowed")
    if sync_policy not in {"allowed", "web_only", "approval_required"}:
        space["sync_policy"] = "web_only" if sync_policy in {"web", "web-only", "no_sync"} else "allowed"

    status_value = str(space.get("status") or "active")
    if status_value not in {"active", "archived"}:
        space["status"] = "active"
    return space


@router.get("/spaces", response_model=list[Space])
async def list_spaces(
    repo: Repository = Depends(get_repository),
    user: CurrentUser = Depends(get_current_user),
    settings: Settings = Depends(get_settings),
) -> list[Space]:
    try:
        spaces = await repo.list_spaces()
    except Exception as exc:
        if settings.drive_auth_mode == "jwt" or settings.drive_env == "prod":
            raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Métadonnées Drive indisponibles") from exc
        spaces = _fallback_spaces()
    normalised = [_normalise_space_payload(s) for s in spaces]
    if not normalised and settings.drive_auth_mode == "disabled":
        normalised = _fallback_spaces()
    authorized = await filter_authorized_spaces(repo, normalised, user)
    return [Space(**s) for s in authorized]


@router.post("/spaces", response_model=Space, status_code=status.HTTP_201_CREATED)
async def create_space(
    body: SpaceCreate,
    repo: Repository = Depends(get_repository),
    user: CurrentUser = Depends(get_current_user),
) -> Space:
    require_global_admin(user)
    try:
        space = await repo.create_space(body.model_dump())
    except ConflictError as exc:
        raise HTTPException(status.HTTP_409_CONFLICT, str(exc)) from exc
    if user.user_id:
        await repo.create_permission({
            "space_id": space["id"], "folder_id": None, "file_id": None,
            "subject_type": "user", "subject_id": user.user_id,
            "permission": "owner", "created_by": _actor(user),
        })
    return Space(**space)


# ---------------------------------------------------------------------------
# Tree
# ---------------------------------------------------------------------------

@router.get("/tree", response_model=TreeResponse)
async def get_tree(
    space_id: UUID = Query(...),
    repo: Repository = Depends(get_repository),
    user: CurrentUser = Depends(get_current_user),
) -> TreeResponse:
    await require_space_role(repo, space_id, user, "viewer")
    try:
        folders, files = await repo.get_tree(space_id)
    except NotFoundError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(exc)) from exc
    return TreeResponse(
        space_id=space_id,
        folders=[FolderNode(**f) for f in folders],
        files=[FileNode(**f) for f in files],
    )


# ---------------------------------------------------------------------------
# Upload
# ---------------------------------------------------------------------------

@router.post("/upload-intent", response_model=UploadIntentResponse)
async def upload_intent(
    body: UploadIntentRequest,
    repo: Repository = Depends(get_repository),
    storage: BlobStorage = Depends(get_storage),
    settings: Settings = Depends(get_settings),
    user: CurrentUser = Depends(get_current_user),
) -> UploadIntentResponse:
    try:
        path = normalize_drive_path(body.path)
    except InvalidPathError as exc:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, f"path invalide: {exc}") from exc

    name = file_name(path)
    if is_ignored_name(name):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, f"fichier ignoré par la sync: {name}")

    try:
        await repo.get_space(body.space_id)
    except NotFoundError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(exc)) from exc
    await require_space_role(repo, body.space_id, user, "uploader")

    actor = _actor(user)
    existing = await repo.get_file_by_path(body.space_id, path)

    if existing:
        # Fichier connu → nouvelle version.
        if body.sha256 and existing.get("sha256") == body.sha256:
            return UploadIntentResponse(
                action="noop", file_id=existing["id"],
                version=existing["current_version"], conflict=False,
            )
        conflict = bool(
            body.base_version is not None
            and body.base_version != existing["current_version"]
        )
        if conflict:
            return UploadIntentResponse(
                action="conflict",
                file_id=existing["id"],
                version=existing["current_version"],
                conflict=True,
                conflict_reason=(
                    f"version de base {body.base_version} != version courante "
                    f"{existing['current_version']}"
                ),
            )
        new_version, blob = await repo.bump_version_placeholder(
            file_id=existing["id"],
            blob_container=settings.drive_blob_container_versions,
            make_blob_name=lambda v: blob_name_for_version(
                str(body.space_id), str(existing["id"]), v, name
            ),
            size_bytes=body.size_bytes, sha256=body.sha256, actor=actor,
        )
        signed = storage.make_upload_url(settings.drive_blob_container_versions, blob, body.content_type)
        token = make_upload_token(
            file_id=str(existing["id"]), version=new_version,
            blob_container=settings.drive_blob_container_versions, blob_name=blob,
            secret=settings.drive_app_secret,
            size_bytes=body.size_bytes,
            sha256=body.sha256,
        )
        return UploadIntentResponse(
            action="upload", upload_url=signed.url, upload_token=token,
            file_id=existing["id"], version=new_version,
            blob_container=settings.drive_blob_container_versions, blob_name=blob,
            conflict=conflict,
            conflict_reason=(
                f"version de base {body.base_version} != version courante {existing['current_version']}"
                if conflict else None
            ),
            expires_at=signed.expires_at,
        )

    # Nouveau fichier — l'id est généré ici pour construire le blob name
    # AVANT l'insert (le path utilisateur n'est jamais la clé blob, plan §6).
    from uuid import uuid4

    new_file_id = uuid4()
    blob = blob_name_for_file(str(body.space_id), str(new_file_id), name)
    folder_id = await repo.ensure_folders(body.space_id, parent_path(path), actor)
    try:
        file = await repo.create_file_placeholder(
            file_id=new_file_id, space_id=body.space_id, folder_id=folder_id,
            name=name, path=path,
            blob_container=settings.drive_blob_container_files, blob_name=blob,
            content_type=body.content_type, size_bytes=body.size_bytes,
            sha256=body.sha256, actor=actor,
        )
    except ConflictError as exc:
        raise HTTPException(status.HTTP_409_CONFLICT, str(exc)) from exc

    signed = storage.make_upload_url(settings.drive_blob_container_files, blob, body.content_type)
    token = make_upload_token(
        file_id=str(file["id"]), version=1,
        blob_container=settings.drive_blob_container_files, blob_name=blob,
        secret=settings.drive_app_secret,
        size_bytes=body.size_bytes,
        sha256=body.sha256,
    )
    return UploadIntentResponse(
        action="upload", upload_url=signed.url, upload_token=token,
        file_id=file["id"], version=1,
        blob_container=settings.drive_blob_container_files, blob_name=blob,
        conflict=False, expires_at=signed.expires_at,
    )


@router.post("/upload-complete", response_model=UploadCompleteResponse)
async def upload_complete(
    body: UploadCompleteRequest,
    repo: Repository = Depends(get_repository),
    storage: BlobStorage = Depends(get_storage),
    settings: Settings = Depends(get_settings),
    user: CurrentUser = Depends(get_current_user),
) -> UploadCompleteResponse:
    try:
        claims = verify_upload_token(body.upload_token, secret=settings.drive_app_secret)
    except UploadTokenError as exc:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, str(exc)) from exc

    if claims["fid"] != str(body.file_id) or claims["v"] != body.version:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "token d'upload ne correspond pas à la requête")

    actor = _actor(user)
    try:
        pending_file = await repo.get_file(body.file_id)
    except NotFoundError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(exc)) from exc
    await require_space_role(repo, pending_file["space_id"], user, "uploader")
    properties = await asyncio.to_thread(storage.get_blob_properties, claims["c"], claims["b"])
    if properties is None:
        raise HTTPException(status.HTTP_409_CONFLICT, "Blob uploadé introuvable")
    expected_size = claims.get("size")
    if properties.size_bytes is not None and expected_size is not None and properties.size_bytes != expected_size:
        raise HTTPException(status.HTTP_409_CONFLICT, "Taille du Blob différente de l'upload annoncé")
    verified_size = properties.size_bytes if properties.size_bytes is not None else expected_size
    verified_etag = properties.etag or body.etag
    if storage.kind == "azure" and not verified_etag:
        raise HTTPException(status.HTTP_409_CONFLICT, "ETag Azure Blob absent")
    try:
        observed_sha256 = await asyncio.to_thread(
            storage.compute_blob_sha256, claims["c"], claims["b"], verified_etag or ""
        )
    except RuntimeError as exc:
        raise HTTPException(status.HTTP_409_CONFLICT, "Intégrité du Blob modifiée") from exc
    except Exception as exc:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Vérification du Blob indisponible") from exc
    if observed_sha256 and claims.get("sha256") and observed_sha256 != claims["sha256"]:
        raise HTTPException(status.HTTP_409_CONFLICT, "SHA-256 du Blob différent de l'upload annoncé")
    verified_sha256 = observed_sha256 or claims.get("sha256")
    try:
        file, event_id = await repo.finalize_upload(
            file_id=body.file_id, version=body.version,
            size_bytes=verified_size, sha256=verified_sha256, etag=verified_etag, actor=actor,
        )
    except NotFoundError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(exc)) from exc
    except ConflictError as exc:
        raise HTTPException(status.HTTP_409_CONFLICT, str(exc)) from exc

    return UploadCompleteResponse(file=FileNode(**file), event_id=event_id)


# ---------------------------------------------------------------------------
# File lifecycle
# ---------------------------------------------------------------------------

async def _lifecycle_file(repo: Repository, file_id: UUID, user: CurrentUser) -> dict:
    try:
        file = await repo.get_file(file_id)
    except NotFoundError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(exc)) from exc
    await require_space_role(repo, file["space_id"], user, "editor")
    return file


@router.post("/files/{file_id}/move", response_model=FileNode)
async def move_file(file_id: UUID, body: FileMoveRequest, repo: Repository = Depends(get_repository), user: CurrentUser = Depends(get_current_user)) -> FileNode:
    file = await _lifecycle_file(repo, file_id, user)
    try:
        path = normalize_drive_path(body.path)
    except InvalidPathError as exc:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, f"path invalide: {exc}") from exc
    if is_ignored_name(file_name(path)):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "fichier ignoré par la sync")
    old_path = file["path"]
    folder_id = await repo.ensure_folders(file["space_id"], parent_path(path), _actor(user))
    try:
        moved = await repo.move_file(file_id, name=file_name(path), path=path, folder_id=folder_id, actor=_actor(user))
    except ConflictError as exc:
        raise HTTPException(status.HTTP_409_CONFLICT, str(exc)) from exc
    await repo.add_event(space_id=moved["space_id"], event_type="file_moved", file_id=file_id, payload={"old_path": old_path, "path": path}, actor=_actor(user))
    return FileNode(**moved)


@router.delete("/files/{file_id}", response_model=FileNode)
async def delete_file(file_id: UUID, repo: Repository = Depends(get_repository), user: CurrentUser = Depends(get_current_user)) -> FileNode:
    file = await _lifecycle_file(repo, file_id, user)
    try:
        deleted = await repo.soft_delete_file(file_id, actor=_actor(user))
    except ConflictError as exc:
        raise HTTPException(status.HTTP_409_CONFLICT, str(exc)) from exc
    await repo.add_event(space_id=deleted["space_id"], event_type="file_deleted", file_id=file_id, payload={"path": file["path"]}, actor=_actor(user))
    return FileNode(**deleted)


@router.post("/files/{file_id}/restore", response_model=FileNode)
async def restore_file(file_id: UUID, repo: Repository = Depends(get_repository), user: CurrentUser = Depends(get_current_user)) -> FileNode:
    await _lifecycle_file(repo, file_id, user)
    try:
        restored = await repo.restore_file(file_id, actor=_actor(user))
    except ConflictError as exc:
        raise HTTPException(status.HTTP_409_CONFLICT, str(exc)) from exc
    await repo.add_event(space_id=restored["space_id"], event_type="file_restored", file_id=file_id, payload={"path": restored["path"]}, actor=_actor(user))
    return FileNode(**restored)


# ---------------------------------------------------------------------------
# Download
# ---------------------------------------------------------------------------

@router.post("/download-url", response_model=DownloadUrlResponse)
async def download_url(
    body: DownloadUrlRequest,
    repo: Repository = Depends(get_repository),
    storage: BlobStorage = Depends(get_storage),
    user: CurrentUser = Depends(get_current_user),
) -> DownloadUrlResponse:
    try:
        file = await repo.get_file(body.file_id)
    except NotFoundError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(exc)) from exc

    await require_space_role(repo, file["space_id"], user, "viewer")
    if file["status"] not in ("active", "archived"):
        raise HTTPException(status.HTTP_409_CONFLICT, f"fichier non téléchargeable (status={file['status']})")

    version = body.version or file["current_version"]
    if version > file["current_version"]:
        raise HTTPException(status.HTTP_409_CONFLICT, "version non finalisée")
    ver = await repo.get_file_version(body.file_id, version)
    if not ver:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"version {version} inconnue")
    if ver.get("completed_at") is None:
        raise HTTPException(status.HTTP_409_CONFLICT, "version non finalisée")
    container, blob = ver["blob_container"], ver["blob_name"]

    signed = storage.make_download_url(container, blob, filename=file["name"])
    return DownloadUrlResponse(
        file_id=body.file_id, version=version,
        download_url=signed.url, expires_at=signed.expires_at,
    )


# ---------------------------------------------------------------------------
# Changes feed
# ---------------------------------------------------------------------------

@router.get("/changes", response_model=ChangesResponse)
async def get_changes(
    space_id: UUID = Query(...),
    since_event_id: int = Query(0, ge=0),
    repo: Repository = Depends(get_repository),
    user: CurrentUser = Depends(get_current_user),
) -> ChangesResponse:
    await require_space_role(repo, space_id, user, "viewer")
    try:
        await repo.get_space(space_id)
    except NotFoundError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(exc)) from exc

    events, last_event_id = await repo.get_changes(space_id, since_event_id, CHANGES_PAGE_SIZE)
    returned_max = events[-1]["id"] if events else since_event_id
    return ChangesResponse(
        space_id=space_id,
        since_event_id=since_event_id,
        last_event_id=last_event_id,
        events=[SyncEvent(**{k: v for k, v in e.items() if k != "actor_user_id"}) for e in events],
        has_more=returned_max < last_event_id,
    )
