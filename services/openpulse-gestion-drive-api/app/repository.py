"""Couche données : Postgres (asyncpg) ou in-memory (dev/tests).

Le repository in-memory reproduit les contraintes clés du schéma SQL
(`unique(space_id, path)`, versions, feed d'événements) pour permettre des
tests unitaires sans base. Le repository Postgres utilise les tables
`drive_*` de migrations/0001_init_drive.sql.
"""

from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone
from typing import Any, Protocol
from uuid import UUID, uuid4

from .migration_state import migration_manifest


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _mfa_was_verified_after_challenge(
    mfa_verified_at: datetime, challenge_created_at: datetime
) -> bool:
    # Supabase encode le timestamp AMR à la seconde. Exiger la seconde suivante
    # évite qu'une preuve émise juste avant le challenge soit acceptée.
    not_before = challenge_created_at.replace(microsecond=0) + timedelta(seconds=1)
    return mfa_verified_at >= not_before


class RepositoryError(Exception):
    pass


class NotFoundError(RepositoryError):
    pass


class ConflictError(RepositoryError):
    pass


class Repository(Protocol):
    kind: str

    async def startup(self) -> None: ...
    async def shutdown(self) -> None: ...
    async def ping(self) -> bool: ...

    async def create_desktop_refresh_session(
        self, *, token_hash: str, family_id: UUID, user_id: str, email: str,
        app_role: str | None, display_name: str, expires_at: datetime,
    ) -> None: ...
    async def create_desktop_handoff_challenge(
        self, *, challenge_hash: str, user_id: str, nonce_hash: str, expires_at: datetime,
    ) -> None: ...
    async def redeem_desktop_handoff_challenge(
        self, *, challenge_hash: str, user_id: str, nonce_hash: str,
        mfa_verified_at: datetime, token_hash: str, family_id: UUID, email: str,
        display_name: str, expires_at: datetime,
    ) -> bool: ...
    async def rotate_desktop_refresh_session(
        self, *, token_hash: str, replacement_hash: str, expires_at: datetime,
    ) -> dict[str, Any] | None: ...
    async def revoke_desktop_refresh_family(self, token_hash: str) -> bool: ...

    async def list_spaces(self) -> list[dict[str, Any]]: ...
    async def create_space(self, data: dict[str, Any]) -> dict[str, Any]: ...
    async def get_space(self, space_id: UUID) -> dict[str, Any]: ...

    async def get_tree(self, space_id: UUID) -> tuple[list[dict], list[dict]]: ...

    async def get_file(self, file_id: UUID) -> dict[str, Any]: ...
    async def get_file_by_path(self, space_id: UUID, path: str) -> dict[str, Any] | None: ...
    async def get_file_version(self, file_id: UUID, version: int) -> dict[str, Any] | None: ...
    async def move_file(self, file_id: UUID, *, name: str, path: str, folder_id: UUID | None, actor: UUID | None) -> dict[str, Any]: ...
    async def soft_delete_file(self, file_id: UUID, *, actor: UUID | None) -> dict[str, Any]: ...
    async def restore_file(self, file_id: UUID, *, actor: UUID | None) -> dict[str, Any]: ...

    async def ensure_folders(self, space_id: UUID, folder_path: str | None, actor: UUID | None) -> UUID | None: ...

    async def create_file_placeholder(
        self, *, file_id: UUID, space_id: UUID, folder_id: UUID | None, name: str, path: str,
        blob_container: str, blob_name: str, content_type: str | None,
        size_bytes: int, sha256: str | None, actor: UUID | None,
    ) -> dict[str, Any]: ...

    async def finalize_upload(
        self, *, file_id: UUID, version: int, size_bytes: int | None,
        sha256: str | None, etag: str | None, actor: UUID | None,
    ) -> tuple[dict[str, Any], int]: ...

    async def bump_version_placeholder(
        self, *, file_id: UUID, blob_container: str, make_blob_name,
        size_bytes: int, sha256: str | None, actor: UUID | None,
    ) -> tuple[int, str]: ...

    async def add_event(
        self, *, space_id: UUID, event_type: str, file_id: UUID | None = None,
        folder_id: UUID | None = None, payload: dict | None = None,
        actor: UUID | None = None,
    ) -> int: ...

    async def get_changes(self, space_id: UUID, since_event_id: int, limit: int) -> tuple[list[dict], int]: ...

    # --- permissions (P1 gouvernance) ---

    async def list_permissions(
        self, space_id: UUID, folder_id: UUID | None = None, file_id: UUID | None = None,
    ) -> list[dict[str, Any]]: ...

    async def get_permission(self, permission_id: UUID) -> dict[str, Any]: ...

    async def create_permission(self, data: dict[str, Any]) -> dict[str, Any]: ...

    async def update_permission(self, permission_id: UUID, permission: str) -> dict[str, Any]: ...

    async def delete_permission(self, permission_id: UUID) -> dict[str, Any]: ...

    # --- audit minimal ---

    async def add_audit(
        self, *, user_id: UUID | None, action: str, entity_type: str,
        entity_id: UUID | None = None, payload: dict | None = None,
    ) -> int: ...

    async def get_audit(
        self, *, entity_type: str | None = None, entity_id: UUID | None = None, limit: int = 100,
    ) -> list[dict[str, Any]]: ...


# ---------------------------------------------------------------------------
# In-memory (dev/tests)
# ---------------------------------------------------------------------------

class MemoryRepository:
    kind = "memory"

    def __init__(self) -> None:
        self.spaces: dict[UUID, dict] = {}
        self.folders: dict[UUID, dict] = {}
        self.files: dict[UUID, dict] = {}
        self.versions: dict[tuple[UUID, int], dict] = {}
        self.events: list[dict] = []
        self._event_seq = 0
        self.permissions: dict[UUID, dict] = {}
        self.audit_logs: list[dict] = []
        self.desktop_refresh_sessions: dict[str, dict[str, Any]] = {}
        self.desktop_handoff_challenges: dict[str, dict[str, Any]] = {}
        self._audit_seq = 0

    async def startup(self) -> None:  # pragma: no cover - trivial
        return None

    async def shutdown(self) -> None:  # pragma: no cover - trivial
        return None

    async def ping(self) -> bool:
        return True

    # --- desktop refresh sessions ---

    async def create_desktop_handoff_challenge(
        self, *, challenge_hash, user_id, nonce_hash, expires_at
    ) -> None:
        now = _now()
        for challenge in self.desktop_handoff_challenges.values():
            if challenge["user_id"] == user_id and challenge["consumed_at"] is None:
                challenge["consumed_at"] = now
        self.desktop_handoff_challenges[challenge_hash] = {
            "challenge_hash": challenge_hash,
            "user_id": user_id,
            "nonce_hash": nonce_hash,
            "created_at": now,
            "expires_at": expires_at,
            "consumed_at": None,
        }

    async def redeem_desktop_handoff_challenge(
        self,
        *,
        challenge_hash,
        user_id,
        nonce_hash,
        mfa_verified_at,
        token_hash,
        family_id,
        email,
        display_name,
        expires_at,
    ) -> bool:
        challenge = self.desktop_handoff_challenges.get(challenge_hash)
        now = _now()
        if (
            challenge is None
            or challenge["user_id"] != user_id
            or challenge["nonce_hash"] != nonce_hash
            or challenge["consumed_at"] is not None
            or challenge["expires_at"] <= now
            or not _mfa_was_verified_after_challenge(
                mfa_verified_at, challenge["created_at"]
            )
        ):
            return False
        challenge["consumed_at"] = now
        await self.create_desktop_refresh_session(
            token_hash=token_hash,
            family_id=family_id,
            user_id=user_id,
            email=email,
            app_role=None,
            display_name=display_name,
            expires_at=expires_at,
        )
        return True

    async def create_desktop_refresh_session(
        self, *, token_hash, family_id, user_id, email, app_role, display_name, expires_at
    ) -> None:
        now = _now()
        # Une seule famille Desktop active par identité : un nouveau handoff MFA
        # invalide les grants antérieurs, contrairement aux échanges web ordinaires.
        for session in self.desktop_refresh_sessions.values():
            if session["user_id"] == user_id and session["revoked_at"] is None:
                session["revoked_at"] = now
        self.desktop_refresh_sessions[token_hash] = {
            "token_hash": token_hash,
            "family_id": family_id,
            "user_id": user_id,
            "email": email,
            "app_role": app_role,
            "display_name": display_name,
            "expires_at": expires_at,
            "created_at": now,
            "rotated_at": None,
            "revoked_at": None,
            "replaced_by_hash": None,
        }

    def _revoke_desktop_family(self, family_id: UUID, now: datetime) -> bool:
        changed = False
        for session in self.desktop_refresh_sessions.values():
            if session["family_id"] == family_id and session["revoked_at"] is None:
                session["revoked_at"] = now
                changed = True
        return changed

    async def rotate_desktop_refresh_session(
        self, *, token_hash, replacement_hash, expires_at
    ) -> dict | None:
        current = self.desktop_refresh_sessions.get(token_hash)
        now = _now()
        if current is None or current["revoked_at"] is not None or current["expires_at"] <= now:
            return None
        if current["rotated_at"] is not None:
            # Réutilisation détectée : toute la chaîne est potentiellement compromise.
            self._revoke_desktop_family(current["family_id"], now)
            return None
        current["rotated_at"] = now
        current["replaced_by_hash"] = replacement_hash
        replacement = {
            **current,
            "token_hash": replacement_hash,
            "expires_at": expires_at,
            "created_at": now,
            "rotated_at": None,
            "revoked_at": None,
            "replaced_by_hash": None,
        }
        self.desktop_refresh_sessions[replacement_hash] = replacement
        return dict(replacement)

    async def revoke_desktop_refresh_family(self, token_hash: str) -> bool:
        current = self.desktop_refresh_sessions.get(token_hash)
        if current is None:
            return False
        return self._revoke_desktop_family(current["family_id"], _now())

    # --- spaces ---

    async def list_spaces(self) -> list[dict]:
        return sorted(self.spaces.values(), key=lambda s: s["name"].lower())

    async def create_space(self, data: dict) -> dict:
        if any(s["slug"] == data["slug"] for s in self.spaces.values()):
            raise ConflictError(f"slug déjà utilisé: {data['slug']}")
        now = _now()
        space = {
            "id": uuid4(),
            "name": data["name"],
            "slug": data["slug"],
            "type": data["type"],
            "etablissement_id": data.get("etablissement_id"),
            "sensitivity": data.get("sensitivity", "standard"),
            "sync_policy": data.get("sync_policy", "allowed"),
            "status": "active",
            "created_at": now,
            "updated_at": now,
        }
        self.spaces[space["id"]] = space
        return space

    async def get_space(self, space_id: UUID) -> dict:
        space = self.spaces.get(space_id)
        if not space:
            raise NotFoundError(f"space introuvable: {space_id}")
        return space

    # --- tree ---

    async def get_tree(self, space_id: UUID) -> tuple[list[dict], list[dict]]:
        await self.get_space(space_id)
        folders = [f for f in self.folders.values() if f["space_id"] == space_id and f["status"] == "active"]
        files = [f for f in self.files.values() if f["space_id"] == space_id and f["status"] == "active"]
        folders.sort(key=lambda f: f["path"])
        files.sort(key=lambda f: f["path"])
        return folders, files

    # --- files ---

    async def get_file(self, file_id: UUID) -> dict:
        file = self.files.get(file_id)
        if not file:
            raise NotFoundError(f"fichier introuvable: {file_id}")
        return file

    async def get_file_by_path(self, space_id: UUID, path: str) -> dict | None:
        for f in self.files.values():
            if f["space_id"] == space_id and f["path"] == path and f["status"] != "deleted":
                return f
        return None

    async def get_file_version(self, file_id: UUID, version: int) -> dict | None:
        return self.versions.get((file_id, version))

    async def ensure_folders(self, space_id: UUID, folder_path: str | None, actor: UUID | None) -> UUID | None:
        if not folder_path:
            return None
        segments = [s for s in folder_path.split("/") if s]
        parent_id: UUID | None = None
        current = ""
        for seg in segments:
            current = f"{current}/{seg}"
            existing = next(
                (f for f in self.folders.values()
                 if f["space_id"] == space_id and f["path"] == current and f["status"] == "active"),
                None,
            )
            if existing:
                parent_id = existing["id"]
                continue
            now = _now()
            folder = {
                "id": uuid4(), "space_id": space_id, "parent_id": parent_id,
                "name": seg, "path": current, "status": "active",
                "created_by": actor, "updated_by": actor,
                "created_at": now, "updated_at": now,
            }
            self.folders[folder["id"]] = folder
            await self.add_event(space_id=space_id, event_type="folder_created",
                                 folder_id=folder["id"], payload={"path": current}, actor=actor)
            parent_id = folder["id"]
        return parent_id

    async def create_file_placeholder(self, *, file_id, space_id, folder_id, name, path,
                                      blob_container, blob_name, content_type,
                                      size_bytes, sha256, actor) -> dict:
        if await self.get_file_by_path(space_id, path):
            raise ConflictError(f"fichier déjà présent: {path}")
        now = _now()
        file = {
            "id": file_id, "space_id": space_id, "folder_id": folder_id,
            "name": name, "path": path,
            "blob_container": blob_container, "blob_name": blob_name,
            "content_type": content_type, "size_bytes": size_bytes,
            "sha256": sha256, "etag": None, "current_version": 1,
            "status": "uploading",  # devient 'active' à upload-complete
            "created_by": actor, "updated_by": actor,
            "created_at": now, "updated_at": now, "deleted_at": None,
        }
        self.files[file["id"]] = file
        self.versions[(file["id"], 1)] = {
            "file_id": file["id"], "version": 1,
            "blob_container": blob_container, "blob_name": blob_name,
            "sha256": sha256, "size_bytes": size_bytes, "etag": None,
            "created_by": actor, "created_at": now, "pending": True,
        }
        return file

    async def bump_version_placeholder(self, *, file_id, blob_container, make_blob_name,
                                       size_bytes, sha256, actor) -> tuple[int, str]:
        file = await self.get_file(file_id)
        existing_versions = [v for (fid, v) in self.versions if fid == file_id]
        new_version = max(existing_versions, default=file["current_version"]) + 1
        blob_name = make_blob_name(new_version)
        self.versions[(file_id, new_version)] = {
            "file_id": file_id, "version": new_version,
            "blob_container": blob_container, "blob_name": blob_name,
            "sha256": sha256, "size_bytes": size_bytes, "etag": None,
            "created_by": actor, "created_at": _now(), "pending": True,
        }
        return new_version, blob_name

    async def finalize_upload(self, *, file_id, version, size_bytes, sha256, etag, actor) -> tuple[dict, int]:
        file = await self.get_file(file_id)
        ver = self.versions.get((file_id, version))
        if not ver:
            raise NotFoundError(f"version {version} inconnue pour {file_id}")
        if not ver.get("pending") and ver.get("completion_event_id"):
            return file, int(ver["completion_event_id"])
        if version < file["current_version"]:
            raise ConflictError(
                f"version {version} obsolète; version courante {file['current_version']}"
            )
        ver["pending"] = False
        if sha256:
            ver["sha256"] = sha256
        if etag:
            ver["etag"] = etag
        if size_bytes is not None:
            ver["size_bytes"] = size_bytes
        file.update({
            "current_version": version,
            "status": "active",
            "sha256": ver["sha256"],
            "etag": ver["etag"],
            "size_bytes": ver["size_bytes"],
            "blob_container": ver["blob_container"],
            "blob_name": ver["blob_name"],
            "updated_by": actor,
            "updated_at": _now(),
        })
        event_id = await self.add_event(
            space_id=file["space_id"], event_type="file_created" if version == 1 else "file_updated",
            file_id=file["id"], payload={"path": file["path"], "version": version}, actor=actor,
        )
        ver["completion_event_id"] = event_id
        ver["completed_at"] = _now()
        return file, event_id

    # --- events ---

    async def add_event(self, *, space_id, event_type, file_id=None,
                        folder_id=None, payload=None, actor=None) -> int:
        self._event_seq += 1
        self.events.append({
            "id": self._event_seq, "space_id": space_id,
            "file_id": file_id, "folder_id": folder_id,
            "event_type": event_type, "payload": payload or {},
            "actor_user_id": actor, "created_at": _now(),
        })
        return self._event_seq

    async def get_changes(self, space_id: UUID, since_event_id: int, limit: int) -> tuple[list[dict], int]:
        matching = [e for e in self.events if e["space_id"] == space_id and e["id"] > since_event_id]
        last_id = self._event_seq
        return matching[:limit], last_id

    # --- permissions ---

    async def list_permissions(self, space_id, folder_id=None, file_id=None) -> list[dict]:
        result = []
        for p in self.permissions.values():
            if p["space_id"] != space_id:
                continue
            if folder_id is not None and p["folder_id"] != folder_id:
                continue
            if file_id is not None and p["file_id"] != file_id:
                continue
            if folder_id is None and file_id is None:
                # Scope espace uniquement : pas les permissions dossier/fichier.
                if p["folder_id"] is not None or p["file_id"] is not None:
                    continue
            result.append(p)
        result.sort(key=lambda p: (p["subject_type"], p["subject_id"]))
        return result

    async def get_permission(self, permission_id: UUID) -> dict:
        perm = self.permissions.get(permission_id)
        if not perm:
            raise NotFoundError(f"permission introuvable: {permission_id}")
        return perm

    async def create_permission(self, data: dict) -> dict:
        for p in self.permissions.values():
            if (
                p["space_id"] == data["space_id"]
                and p["folder_id"] == data.get("folder_id")
                and p["file_id"] == data.get("file_id")
                and p["subject_type"] == data["subject_type"]
                and p["subject_id"] == data["subject_id"]
            ):
                raise ConflictError(
                    f"permission déjà définie pour {data['subject_type']}:{data['subject_id']}"
                )
        perm = {
            "id": uuid4(),
            "space_id": data["space_id"],
            "folder_id": data.get("folder_id"),
            "file_id": data.get("file_id"),
            "subject_type": data["subject_type"],
            "subject_id": data["subject_id"],
            "permission": data["permission"],
            "created_by": data.get("created_by"),
            "created_at": _now(),
        }
        self.permissions[perm["id"]] = perm
        return perm

    async def update_permission(self, permission_id: UUID, permission: str) -> dict:
        perm = await self.get_permission(permission_id)
        perm["permission"] = permission
        return perm

    async def delete_permission(self, permission_id: UUID) -> dict:
        perm = await self.get_permission(permission_id)
        del self.permissions[permission_id]
        return perm

    # --- audit ---

    async def add_audit(self, *, user_id, action, entity_type,
                        entity_id=None, payload=None) -> int:
        self._audit_seq += 1
        self.audit_logs.append({
            "id": self._audit_seq, "user_id": user_id,
            "device_id": None, "action": action,
            "entity_type": entity_type, "entity_id": entity_id,
            "ip": None, "user_agent": None,
            "payload": payload or {}, "created_at": _now(),
        })
        return self._audit_seq

    async def get_audit(self, *, entity_type=None, entity_id=None, limit=100) -> list[dict]:
        entries = self.audit_logs
        if entity_type is not None:
            entries = [e for e in entries if e["entity_type"] == entity_type]
        if entity_id is not None:
            entries = [e for e in entries if e["entity_id"] == entity_id]
        return sorted(entries, key=lambda e: e["id"], reverse=True)[:limit]


# ---------------------------------------------------------------------------
# Postgres (asyncpg) — utilisé quand DATABASE_URL est défini
# ---------------------------------------------------------------------------

class PostgresRepository:
    kind = "postgres"

    def __init__(self, database_url: str) -> None:
        self._url = database_url
        self._pool = None

    async def startup(self) -> None:
        import asyncpg

        self._pool = await asyncpg.create_pool(self._url, min_size=1, max_size=5)

    async def shutdown(self) -> None:
        if self._pool:
            await self._pool.close()

    async def ping(self) -> bool:
        expected_tables = [
            "drive_spaces", "drive_folders", "drive_files", "drive_file_versions",
            "drive_permissions", "drive_sync_devices", "drive_sync_events",
            "drive_audit_logs", "drive_schema_migrations",
            "drive_desktop_refresh_sessions",
            "drive_desktop_handoff_challenges",
        ]
        async with self._pool.acquire() as conn:
            present = await conn.fetchval(
                """
                select count(*)
                from unnest($1::text[]) as expected(name)
                where to_regclass('public.' || expected.name) is not null
                """,
                expected_tables,
            )
            columns = await conn.fetch(
                """
                select table_name, column_name
                from information_schema.columns
                where table_schema = 'public' and table_name = 'drive_file_versions'
                """
            )
            version_columns = {row["column_name"] for row in columns}
            completion_index = await conn.fetchval(
                "select to_regclass('public.uq_drive_file_versions_completion_event')"
            )
            receipts = await conn.fetch(
                "select version, checksum from drive_schema_migrations order by version"
            )
            actual_manifest = {
                row["version"]: str(row["checksum"]).strip() for row in receipts
            }
            return (
                present == len(expected_tables)
                and {"completed_at", "completion_event_id"}.issubset(version_columns)
                and completion_index is not None
                and actual_manifest == migration_manifest()
            )

    @staticmethod
    def _row(row) -> dict:
        d = dict(row)
        if isinstance(d.get("payload"), str):
            d["payload"] = json.loads(d["payload"])
        return d

    # --- desktop refresh sessions ---

    async def create_desktop_handoff_challenge(
        self, *, challenge_hash, user_id, nonce_hash, expires_at
    ) -> None:
        async with self._pool.acquire() as conn:
            async with conn.transaction():
                await conn.execute(
                    "select pg_advisory_xact_lock(hashtextextended($1, 0))",
                    user_id,
                )
                await conn.execute(
                    """
                    update drive_desktop_handoff_challenges
                    set consumed_at = coalesce(consumed_at, now())
                    where user_id = $1 and consumed_at is null
                    """,
                    user_id,
                )
                await conn.execute(
                    """
                    insert into drive_desktop_handoff_challenges
                      (challenge_hash, user_id, nonce_hash, expires_at)
                    values ($1, $2, $3, $4)
                    """,
                    challenge_hash,
                    user_id,
                    nonce_hash,
                    expires_at,
                )

    async def redeem_desktop_handoff_challenge(
        self,
        *,
        challenge_hash,
        user_id,
        nonce_hash,
        mfa_verified_at,
        token_hash,
        family_id,
        email,
        display_name,
        expires_at,
    ) -> bool:
        async with self._pool.acquire() as conn:
            async with conn.transaction():
                await conn.execute(
                    "select pg_advisory_xact_lock(hashtextextended($1, 0))",
                    user_id,
                )
                challenge = await conn.fetchrow(
                    """
                    select * from drive_desktop_handoff_challenges
                    where challenge_hash = $1 and user_id = $2 and nonce_hash = $3
                    for update
                    """,
                    challenge_hash,
                    user_id,
                    nonce_hash,
                )
                now = _now()
                if (
                    not challenge
                    or challenge["consumed_at"] is not None
                    or challenge["expires_at"] <= now
                    or not _mfa_was_verified_after_challenge(
                        mfa_verified_at, challenge["created_at"]
                    )
                ):
                    return False
                await conn.execute(
                    """
                    update drive_desktop_handoff_challenges
                    set consumed_at = now()
                    where challenge_hash = $1
                    """,
                    challenge_hash,
                )
                await conn.execute(
                    """
                    update drive_desktop_refresh_sessions
                    set revoked_at = coalesce(revoked_at, now())
                    where user_id = $1 and revoked_at is null
                    """,
                    user_id,
                )
                await conn.execute(
                    """
                    insert into drive_desktop_refresh_sessions
                      (token_hash, family_id, user_id, email, app_role, display_name, expires_at)
                    values ($1, $2, $3, $4, null, $5, $6)
                    """,
                    token_hash,
                    family_id,
                    user_id,
                    email,
                    display_name,
                    expires_at,
                )
                return True

    async def create_desktop_refresh_session(
        self, *, token_hash, family_id, user_id, email, app_role, display_name, expires_at
    ) -> None:
        async with self._pool.acquire() as conn:
            async with conn.transaction():
                await conn.execute(
                    "select pg_advisory_xact_lock(hashtextextended($1, 0))",
                    user_id,
                )
                await conn.execute(
                    """
                    update drive_desktop_refresh_sessions
                    set revoked_at = coalesce(revoked_at, now())
                    where user_id = $1 and revoked_at is null
                    """,
                    user_id,
                )
                await conn.execute(
                    """
                    insert into drive_desktop_refresh_sessions
                      (token_hash, family_id, user_id, email, app_role, display_name, expires_at)
                    values ($1, $2, $3, $4, $5, $6, $7)
                    """,
                    token_hash,
                    family_id,
                    user_id,
                    email,
                    app_role,
                    display_name,
                    expires_at,
                )

    async def rotate_desktop_refresh_session(
        self, *, token_hash, replacement_hash, expires_at
    ) -> dict | None:
        async with self._pool.acquire() as conn:
            async with conn.transaction():
                identity = await conn.fetchrow(
                    "select user_id from drive_desktop_refresh_sessions where token_hash = $1",
                    token_hash,
                )
                if not identity:
                    return None
                await conn.execute(
                    "select pg_advisory_xact_lock(hashtextextended($1, 0))",
                    identity["user_id"],
                )
                current = await conn.fetchrow(
                    """
                    select * from drive_desktop_refresh_sessions
                    where token_hash = $1
                    for update
                    """,
                    token_hash,
                )
                if (
                    not current
                    or current["revoked_at"] is not None
                    or current["expires_at"] <= _now()
                ):
                    return None
                if current["rotated_at"] is not None:
                    await conn.execute(
                        """
                        update drive_desktop_refresh_sessions
                        set revoked_at = coalesce(revoked_at, now())
                        where family_id = $1 and revoked_at is null
                        """,
                        current["family_id"],
                    )
                    return None
                await conn.execute(
                    """
                    update drive_desktop_refresh_sessions
                    set rotated_at = now(), replaced_by_hash = $2
                    where token_hash = $1
                    """,
                    token_hash, replacement_hash,
                )
                replacement = await conn.fetchrow(
                    """
                    insert into drive_desktop_refresh_sessions
                      (token_hash, family_id, user_id, email, app_role, display_name, expires_at)
                    values ($1, $2, $3, $4, $5, $6, $7)
                    returning *
                    """,
                    replacement_hash,
                    current["family_id"],
                    current["user_id"],
                    current["email"],
                    current["app_role"],
                    current["display_name"],
                    expires_at,
                )
                return self._row(replacement)

    async def revoke_desktop_refresh_family(self, token_hash: str) -> bool:
        async with self._pool.acquire() as conn:
            async with conn.transaction():
                identity = await conn.fetchrow(
                    "select user_id from drive_desktop_refresh_sessions where token_hash = $1",
                    token_hash,
                )
                if not identity:
                    return False
                await conn.execute(
                    "select pg_advisory_xact_lock(hashtextextended($1, 0))",
                    identity["user_id"],
                )
                result = await conn.execute(
                    """
                    with target as (
                      select family_id from drive_desktop_refresh_sessions where token_hash = $1
                    )
                    update drive_desktop_refresh_sessions
                    set revoked_at = coalesce(revoked_at, now())
                    where family_id = (select family_id from target) and revoked_at is null
                    """,
                    token_hash,
                )
                return result != "UPDATE 0"

    async def list_spaces(self) -> list[dict]:
        rows = await self._pool.fetch(
            "select * from drive_spaces where status = 'active' order by lower(name)"
        )
        return [self._row(r) for r in rows]

    async def create_space(self, data: dict) -> dict:
        try:
            row = await self._pool.fetchrow(
                """
                insert into drive_spaces (name, slug, type, etablissement_id, sensitivity, sync_policy)
                values ($1, $2, $3, $4, $5, $6) returning *
                """,
                data["name"], data["slug"], data["type"],
                data.get("etablissement_id"), data.get("sensitivity", "standard"),
                data.get("sync_policy", "allowed"),
            )
        except Exception as exc:  # UniqueViolation
            if "unique" in str(exc).lower():
                raise ConflictError(f"slug déjà utilisé: {data['slug']}") from exc
            raise
        return self._row(row)

    async def get_space(self, space_id: UUID) -> dict:
        row = await self._pool.fetchrow("select * from drive_spaces where id = $1", space_id)
        if not row:
            raise NotFoundError(f"space introuvable: {space_id}")
        return self._row(row)

    async def get_tree(self, space_id: UUID) -> tuple[list[dict], list[dict]]:
        await self.get_space(space_id)
        folders = await self._pool.fetch(
            "select * from drive_folders where space_id = $1 and status = 'active' order by path",
            space_id,
        )
        files = await self._pool.fetch(
            "select * from drive_files where space_id = $1 and status = 'active' order by path",
            space_id,
        )
        return [self._row(r) for r in folders], [self._row(r) for r in files]

    async def get_file(self, file_id: UUID) -> dict:
        row = await self._pool.fetchrow("select * from drive_files where id = $1", file_id)
        if not row:
            raise NotFoundError(f"fichier introuvable: {file_id}")
        return self._row(row)

    async def get_file_by_path(self, space_id: UUID, path: str) -> dict | None:
        row = await self._pool.fetchrow(
            "select * from drive_files where space_id = $1 and path = $2 and status <> 'deleted'",
            space_id, path,
        )
        return self._row(row) if row else None

    async def get_file_version(self, file_id: UUID, version: int) -> dict | None:
        row = await self._pool.fetchrow(
            "select * from drive_file_versions where file_id = $1 and version = $2",
            file_id, version,
        )
        return self._row(row) if row else None

    async def ensure_folders(self, space_id: UUID, folder_path: str | None, actor: UUID | None) -> UUID | None:
        if not folder_path:
            return None
        segments = [s for s in folder_path.split("/") if s]
        parent_id: UUID | None = None
        current = ""
        async with self._pool.acquire() as conn:
            for seg in segments:
                current = f"{current}/{seg}"
                row = await conn.fetchrow(
                    "select id from drive_folders where space_id = $1 and path = $2 and status = 'active'",
                    space_id, current,
                )
                if row:
                    parent_id = row["id"]
                    continue
                row = await conn.fetchrow(
                    """
                    insert into drive_folders (space_id, parent_id, name, path, created_by, updated_by)
                    values ($1, $2, $3, $4, $5, $5)
                    on conflict (space_id, path) where status <> 'deleted'
                      do update set updated_at = now()
                    returning id
                    """,
                    space_id, parent_id, seg, current, actor,
                )
                parent_id = row["id"]
                await self.add_event(space_id=space_id, event_type="folder_created",
                                     folder_id=parent_id, payload={"path": current}, actor=actor)
        return parent_id

    async def create_file_placeholder(self, *, file_id, space_id, folder_id, name, path,
                                      blob_container, blob_name, content_type,
                                      size_bytes, sha256, actor) -> dict:
        try:
            async with self._pool.acquire() as conn:
                async with conn.transaction():
                    row = await conn.fetchrow(
                        """
                        insert into drive_files
                          (id, space_id, folder_id, name, path, blob_container, blob_name,
                           content_type, size_bytes, sha256, status, created_by, updated_by)
                        values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'uploading',$11,$11)
                        returning *
                        """,
                        file_id, space_id, folder_id, name, path, blob_container, blob_name,
                        content_type, size_bytes, sha256, actor,
                    )
                    await conn.execute(
                        """
                        insert into drive_file_versions
                          (file_id, version, blob_container, blob_name, sha256, size_bytes, created_by)
                        values ($1, 1, $2, $3, $4, $5, $6)
                        """,
                        row["id"], blob_container, blob_name, sha256, size_bytes, actor,
                    )
        except Exception as exc:
            if "unique" in str(exc).lower():
                raise ConflictError(f"fichier déjà présent: {path}") from exc
            raise
        return self._row(row)

    async def bump_version_placeholder(self, *, file_id, blob_container, make_blob_name,
                                       size_bytes, sha256, actor) -> tuple[int, str]:
        async with self._pool.acquire() as conn:
            async with conn.transaction():
                locked_file = await conn.fetchval(
                    "select id from drive_files where id = $1 for update", file_id,
                )
                if not locked_file:
                    raise NotFoundError(f"fichier introuvable: {file_id}")
                new_version = await conn.fetchval(
                    "select coalesce(max(version), 0) + 1 from drive_file_versions where file_id = $1",
                    file_id,
                )
                blob_name = make_blob_name(new_version)
                await conn.execute(
                    """
                    insert into drive_file_versions
                      (file_id, version, blob_container, blob_name, sha256, size_bytes, created_by)
                    values ($1,$2,$3,$4,$5,$6,$7)
                    """,
                    file_id, new_version, blob_container, blob_name, sha256, size_bytes, actor,
                )
        return new_version, blob_name

    async def finalize_upload(self, *, file_id, version, size_bytes, sha256, etag, actor) -> tuple[dict, int]:
        async with self._pool.acquire() as conn:
            async with conn.transaction():
                current = await conn.fetchrow(
                    "select * from drive_files where id = $1 for update", file_id,
                )
                if not current:
                    raise NotFoundError(f"fichier introuvable: {file_id}")
                ver = await conn.fetchrow(
                    """
                    select * from drive_file_versions
                    where file_id = $1 and version = $2 for update
                    """,
                    file_id, version,
                )
                if not ver:
                    raise NotFoundError(f"version {version} inconnue pour {file_id}")
                if ver["completed_at"] is not None and ver["completion_event_id"] is not None:
                    return self._row(current), int(ver["completion_event_id"])
                if version < current["current_version"]:
                    raise ConflictError(
                        f"version {version} obsolète; version courante {current['current_version']}"
                    )
                await conn.execute(
                    """
                    update drive_file_versions
                    set sha256 = coalesce($3, sha256), etag = coalesce($4, etag),
                        size_bytes = coalesce($5, size_bytes)
                    where file_id = $1 and version = $2
                    """,
                    file_id, version, sha256, etag, size_bytes,
                )
                row = await conn.fetchrow(
                    """
                    update drive_files f
                    set current_version = $2, status = 'active',
                        sha256 = v.sha256, etag = v.etag, size_bytes = v.size_bytes,
                        blob_container = v.blob_container, blob_name = v.blob_name,
                        updated_by = $3, updated_at = now()
                    from drive_file_versions v
                    where f.id = $1 and v.file_id = $1 and v.version = $2
                    returning f.*
                    """,
                    file_id, version, actor,
                )
                if not row:
                    raise NotFoundError(f"fichier introuvable: {file_id}")
                event_id = await conn.fetchval(
                    """
                    insert into drive_sync_events
                      (space_id, file_id, event_type, payload, actor_user_id)
                    values ($1, $2, $3, $4::jsonb, $5) returning id
                    """,
                    row["space_id"], file_id,
                    "file_created" if version == 1 else "file_updated",
                    json.dumps({"path": row["path"], "version": version}), actor,
                )
                await conn.execute(
                    """
                    update drive_file_versions
                    set completed_at = now(), completion_event_id = $3
                    where file_id = $1 and version = $2
                    """,
                    file_id, version, event_id,
                )
                return self._row(row), int(event_id)

    async def add_event(self, *, space_id, event_type, file_id=None,
                        folder_id=None, payload=None, actor=None) -> int:
        return await self._pool.fetchval(
            """
            insert into drive_sync_events (space_id, file_id, folder_id, event_type, payload, actor_user_id)
            values ($1,$2,$3,$4,$5::jsonb,$6) returning id
            """,
            space_id, file_id, folder_id, event_type, json.dumps(payload or {}), actor,
        )

    async def get_changes(self, space_id: UUID, since_event_id: int, limit: int) -> tuple[list[dict], int]:
        rows = await self._pool.fetch(
            """
            select * from drive_sync_events
            where space_id = $1 and id > $2 order by id asc limit $3
            """,
            space_id, since_event_id, limit,
        )
        last_id = await self._pool.fetchval(
            "select coalesce(max(id), 0) from drive_sync_events where space_id = $1",
            space_id,
        )
        return [self._row(r) for r in rows], last_id

    # --- permissions ---

    async def list_permissions(self, space_id, folder_id=None, file_id=None) -> list[dict]:
        if file_id is not None:
            rows = await self._pool.fetch(
                """
                select * from drive_permissions
                where space_id = $1 and file_id = $2
                order by subject_type, subject_id
                """,
                space_id, file_id,
            )
        elif folder_id is not None:
            rows = await self._pool.fetch(
                """
                select * from drive_permissions
                where space_id = $1 and folder_id = $2
                order by subject_type, subject_id
                """,
                space_id, folder_id,
            )
        else:
            rows = await self._pool.fetch(
                """
                select * from drive_permissions
                where space_id = $1 and folder_id is null and file_id is null
                order by subject_type, subject_id
                """,
                space_id,
            )
        return [self._row(r) for r in rows]

    async def get_permission(self, permission_id: UUID) -> dict:
        row = await self._pool.fetchrow(
            "select * from drive_permissions where id = $1", permission_id
        )
        if not row:
            raise NotFoundError(f"permission introuvable: {permission_id}")
        return self._row(row)

    async def create_permission(self, data: dict) -> dict:
        existing = await self._pool.fetchrow(
            """
            select id from drive_permissions
            where space_id = $1
              and folder_id is not distinct from $2
              and file_id is not distinct from $3
              and subject_type = $4 and subject_id = $5
            """,
            data["space_id"], data.get("folder_id"), data.get("file_id"),
            data["subject_type"], data["subject_id"],
        )
        if existing:
            raise ConflictError(
                f"permission déjà définie pour {data['subject_type']}:{data['subject_id']}"
            )
        row = await self._pool.fetchrow(
            """
            insert into drive_permissions
              (space_id, folder_id, file_id, subject_type, subject_id, permission, created_by)
            values ($1,$2,$3,$4,$5,$6,$7) returning *
            """,
            data["space_id"], data.get("folder_id"), data.get("file_id"),
            data["subject_type"], data["subject_id"], data["permission"],
            data.get("created_by"),
        )
        return self._row(row)

    async def update_permission(self, permission_id: UUID, permission: str) -> dict:
        row = await self._pool.fetchrow(
            "update drive_permissions set permission = $2 where id = $1 returning *",
            permission_id, permission,
        )
        if not row:
            raise NotFoundError(f"permission introuvable: {permission_id}")
        return self._row(row)

    async def delete_permission(self, permission_id: UUID) -> dict:
        row = await self._pool.fetchrow(
            "delete from drive_permissions where id = $1 returning *", permission_id
        )
        if not row:
            raise NotFoundError(f"permission introuvable: {permission_id}")
        return self._row(row)

    # --- audit ---

    async def add_audit(self, *, user_id, action, entity_type,
                        entity_id=None, payload=None) -> int:
        return await self._pool.fetchval(
            """
            insert into drive_audit_logs (user_id, action, entity_type, entity_id, payload)
            values ($1,$2,$3,$4,$5::jsonb) returning id
            """,
            user_id, action, entity_type, entity_id, json.dumps(payload or {}),
        )

    async def get_audit(self, *, entity_type=None, entity_id=None, limit=100) -> list[dict]:
        clauses, args = [], []
        if entity_type is not None:
            args.append(entity_type)
            clauses.append(f"entity_type = ${len(args)}")
        if entity_id is not None:
            args.append(entity_id)
            clauses.append(f"entity_id = ${len(args)}")
        where = f"where {' and '.join(clauses)}" if clauses else ""
        args.append(limit)
        rows = await self._pool.fetch(
            f"select * from drive_audit_logs {where} order by id desc limit ${len(args)}",
            *args,
        )
        return [self._row(r) for r in rows]


# File lifecycle operations are attached to both repository implementations so
# the in-memory test double and production backend share exactly the same API.
async def _memory_move_file(self, file_id, *, name, path, folder_id, actor):
    file = await self.get_file(file_id)
    if file["status"] != "active":
        raise ConflictError("seul un fichier actif peut être déplacé")
    collision = await self.get_file_by_path(file["space_id"], path)
    if collision and collision["id"] != file_id:
        raise ConflictError(f"fichier déjà présent: {path}")
    file.update({"name": name, "path": path, "folder_id": folder_id, "updated_by": actor, "updated_at": _now()})
    return file

async def _memory_soft_delete_file(self, file_id, *, actor):
    file = await self.get_file(file_id)
    if file["status"] != "active":
        raise ConflictError("seul un fichier actif peut être supprimé")
    now = _now()
    file.update({"status": "deleted", "deleted_at": now, "updated_by": actor, "updated_at": now})
    return file

async def _memory_restore_file(self, file_id, *, actor):
    file = await self.get_file(file_id)
    if file["status"] != "deleted":
        raise ConflictError("seul un fichier supprimé peut être restauré")
    collision = await self.get_file_by_path(file["space_id"], file["path"])
    if collision and collision["id"] != file_id:
        raise ConflictError(f"fichier déjà présent: {file['path']}")
    file.update({"status": "active", "deleted_at": None, "updated_by": actor, "updated_at": _now()})
    return file

async def _postgres_move_file(self, file_id, *, name, path, folder_id, actor):
    try:
        row = await self._pool.fetchrow("update drive_files set name=$2,path=$3,folder_id=$4,updated_by=$5,updated_at=now() where id=$1 and status='active' returning *", file_id, name, path, folder_id, actor)
    except Exception as exc:
        if "unique" in str(exc).lower():
            raise ConflictError(f"fichier déjà présent: {path}") from exc
        raise
    if not row:
        await self.get_file(file_id)
        raise ConflictError("seul un fichier actif peut être déplacé")
    return self._row(row)

async def _postgres_soft_delete_file(self, file_id, *, actor):
    row = await self._pool.fetchrow("update drive_files set status='deleted',deleted_at=now(),updated_by=$2,updated_at=now() where id=$1 and status='active' returning *", file_id, actor)
    if not row:
        await self.get_file(file_id)
        raise ConflictError("seul un fichier actif peut être supprimé")
    return self._row(row)

async def _postgres_restore_file(self, file_id, *, actor):
    try:
        row = await self._pool.fetchrow("update drive_files set status='active',deleted_at=null,updated_by=$2,updated_at=now() where id=$1 and status='deleted' returning *", file_id, actor)
    except Exception as exc:
        if "unique" in str(exc).lower():
            raise ConflictError("un fichier actif utilise déjà ce chemin") from exc
        raise
    if not row:
        await self.get_file(file_id)
        raise ConflictError("seul un fichier supprimé peut être restauré")
    return self._row(row)

MemoryRepository.move_file = _memory_move_file
MemoryRepository.soft_delete_file = _memory_soft_delete_file
MemoryRepository.restore_file = _memory_restore_file
PostgresRepository.move_file = _postgres_move_file
PostgresRepository.soft_delete_file = _postgres_soft_delete_file
PostgresRepository.restore_file = _postgres_restore_file


def build_repository(database_url: str) -> Repository:
    if database_url:
        return PostgresRepository(database_url)
    return MemoryRepository()
