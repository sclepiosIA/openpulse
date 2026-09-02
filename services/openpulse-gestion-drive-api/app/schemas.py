"""Schémas Pydantic de l'API Gestion Drive (Milestone 1)."""

from __future__ import annotations

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field

SpaceType = Literal["gsi", "etablissement", "project", "dpo", "template", "personal"]
Sensitivity = Literal["standard", "sensitive", "hds", "dpo_restricted"]
SyncPolicy = Literal["allowed", "web_only", "approval_required"]


class HealthResponse(BaseModel):
    status: Literal["ok"] = "ok"
    service: str = "openpulse-gestion-drive-api"
    version: str
    env: str
    database: Literal["postgres", "memory"]
    blob_storage: Literal["azure", "stub"]
    source_sha: str


class DesktopRefreshRequest(BaseModel):
    refresh_token: str = Field(min_length=20, max_length=4096)


class DesktopLoginResponse(BaseModel):
    access_token: str
    refresh_token: str | None = None
    expires_at: int
    user_email: str
    display_name: str
    device_registered: bool = True


class Space(BaseModel):
    id: UUID
    name: str
    slug: str
    type: SpaceType
    etablissement_id: UUID | None = None
    sensitivity: Sensitivity = "standard"
    sync_policy: SyncPolicy = "allowed"
    status: Literal["active", "archived"] = "active"
    created_at: datetime
    updated_at: datetime


class SpaceCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    slug: str = Field(min_length=1, max_length=100, pattern=r"^[a-z0-9][a-z0-9-]*$")
    type: SpaceType
    etablissement_id: UUID | None = None
    sensitivity: Sensitivity = "standard"
    sync_policy: SyncPolicy = "allowed"


class FolderNode(BaseModel):
    id: UUID
    space_id: UUID
    parent_id: UUID | None = None
    name: str
    path: str
    status: str = "active"
    updated_at: datetime


class FileNode(BaseModel):
    id: UUID
    space_id: UUID
    folder_id: UUID | None = None
    name: str
    path: str
    content_type: str | None = None
    size_bytes: int = 0
    sha256: str | None = None
    etag: str | None = None
    current_version: int = 1
    status: str = "active"
    updated_at: datetime


class TreeResponse(BaseModel):
    space_id: UUID
    folders: list[FolderNode]
    files: list[FileNode]


class UploadIntentRequest(BaseModel):
    space_id: UUID
    path: str = Field(min_length=1, max_length=1024)
    size_bytes: int = Field(ge=0)
    sha256: str | None = Field(default=None, min_length=64, max_length=64)
    mtime: datetime | None = None
    base_file_id: UUID | None = None
    base_version: int | None = None
    content_type: str | None = None


class UploadIntentResponse(BaseModel):
    action: Literal["upload", "noop", "conflict"]
    upload_url: str | None = None
    upload_token: str | None = None
    file_id: UUID
    version: int
    blob_container: str | None = None
    blob_name: str | None = None
    conflict: bool = False
    conflict_reason: str | None = None
    expires_at: datetime | None = None


class UploadCompleteRequest(BaseModel):
    upload_token: str
    file_id: UUID
    version: int
    sha256: str | None = None
    etag: str | None = None
    size_bytes: int | None = Field(default=None, ge=0)


class UploadCompleteResponse(BaseModel):
    file: FileNode
    event_id: int


class DownloadUrlRequest(BaseModel):
    file_id: UUID
    version: int | None = None  # None => version courante


class DownloadUrlResponse(BaseModel):
    file_id: UUID
    version: int
    download_url: str
    expires_at: datetime


class FileMoveRequest(BaseModel):
    path: str = Field(min_length=1, max_length=1024)


PermissionRole = Literal["owner", "admin", "editor", "viewer", "uploader", "no_sync_local"]
PermissionSubjectType = Literal["user", "team", "role", "establishment"]


class Permission(BaseModel):
    id: UUID
    space_id: UUID
    folder_id: UUID | None = None
    file_id: UUID | None = None
    subject_type: PermissionSubjectType
    subject_id: str
    permission: PermissionRole
    created_by: UUID | None = None
    created_at: datetime


class PermissionCreate(BaseModel):
    space_id: UUID
    folder_id: UUID | None = None
    file_id: UUID | None = None
    subject_type: PermissionSubjectType
    subject_id: str = Field(min_length=1, max_length=200)
    permission: PermissionRole


class PermissionUpdate(BaseModel):
    permission: PermissionRole


class PermissionsResponse(BaseModel):
    space_id: UUID
    folder_id: UUID | None = None
    file_id: UUID | None = None
    permissions: list[Permission]


class AuditEntry(BaseModel):
    id: int
    user_id: UUID | None = None
    action: str
    entity_type: str
    entity_id: UUID | None = None
    payload: dict = Field(default_factory=dict)
    created_at: datetime


class AuditResponse(BaseModel):
    entries: list[AuditEntry]


class SyncEvent(BaseModel):
    id: int
    space_id: UUID
    file_id: UUID | None = None
    folder_id: UUID | None = None
    event_type: str
    payload: dict = Field(default_factory=dict)
    created_at: datetime


class ChangesResponse(BaseModel):
    space_id: UUID
    since_event_id: int
    last_event_id: int
    events: list[SyncEvent]
    has_more: bool = False
