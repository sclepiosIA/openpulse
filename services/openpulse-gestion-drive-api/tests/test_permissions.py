"""Tests API permissions Drive — CRUD + audit minimal + feed permission_changed."""

from __future__ import annotations

import hashlib
from datetime import UTC, datetime
from uuid import UUID, uuid4

SHA = hashlib.sha256(b"contenu perms").hexdigest()

UNKNOWN_UUID = "00000000-0000-0000-0000-000000000000"


def _upload_file(client, space_id, path="/DPO/preuve.pdf"):
    intent = client.post("/api/drive/upload-intent", json={
        "space_id": space_id, "path": path, "size_bytes": 12, "sha256": SHA,
    }).json()
    client.post("/api/drive/upload-complete", json={
        "upload_token": intent["upload_token"],
        "file_id": intent["file_id"], "version": 1,
    })
    return intent["file_id"]


def _folder_id(client, space_id, path="/DPO"):
    tree = client.get("/api/drive/tree", params={"space_id": space_id}).json()
    return next(f["id"] for f in tree["folders"] if f["path"] == path)


class TestListPermissions:
    def test_empty_space_scope(self, client, space_id):
        resp = client.get("/api/drive/permissions", params={"space_id": space_id})
        assert resp.status_code == 200
        body = resp.json()
        assert body["space_id"] == space_id
        assert body["permissions"] == []

    def test_unknown_space_404(self, client):
        resp = client.get("/api/drive/permissions", params={"space_id": UNKNOWN_UUID})
        assert resp.status_code == 404

    def test_folder_and_file_exclusive_422(self, client, space_id):
        file_id = _upload_file(client, space_id)
        folder_id = _folder_id(client, space_id)
        resp = client.get("/api/drive/permissions", params={
            "space_id": space_id, "folder_id": folder_id, "file_id": file_id,
        })
        assert resp.status_code == 422

    def test_scoped_permission_creation_is_rejected_until_enforced(self, client, space_id):
        file_id = _upload_file(client, space_id)
        folder_id = _folder_id(client, space_id)

        file_response = client.post("/api/drive/permissions", json={
            "space_id": space_id, "file_id": file_id, "subject_type": "user",
            "subject_id": "u-file", "permission": "viewer",
        })
        folder_response = client.post("/api/drive/permissions", json={
            "space_id": space_id, "folder_id": folder_id, "subject_type": "role",
            "subject_id": "rssi", "permission": "admin",
        })

        assert file_response.status_code == 422
        assert folder_response.status_code == 422


class TestCreatePermission:
    def test_create_space_permission(self, client, space_id):
        resp = client.post("/api/drive/permissions", json={
            "space_id": space_id, "subject_type": "user",
            "subject_id": "alice@gsi.fr", "permission": "editor",
        })
        assert resp.status_code == 201, resp.text
        perm = resp.json()
        assert perm["subject_type"] == "user"
        assert perm["permission"] == "editor"
        assert perm["folder_id"] is None and perm["file_id"] is None

    def test_rejects_file_scope_and_team_subject(self, client, space_id):
        file_id = _upload_file(client, space_id)
        resp = client.post("/api/drive/permissions", json={
            "space_id": space_id, "file_id": file_id,
            "subject_type": "team", "subject_id": "dpo-team", "permission": "viewer",
        })
        assert resp.status_code == 422

    def test_rejects_folder_scope_until_inheritance_is_enforced(self, client, space_id):
        _upload_file(client, space_id)
        folder_id = _folder_id(client, space_id)
        resp = client.post("/api/drive/permissions", json={
            "space_id": space_id, "folder_id": folder_id,
            "subject_type": "role", "subject_id": "rssi", "permission": "admin",
        })
        assert resp.status_code == 422

    def test_rejects_unenforced_subjects_and_no_sync_role(self, client, space_id):
        for payload in (
            {"subject_type": "team", "subject_id": "dpo-team", "permission": "viewer"},
            {"subject_type": "establishment", "subject_id": "hopital", "permission": "viewer"},
            {"subject_type": "user", "subject_id": "alice@gsi.fr", "permission": "no_sync_local"},
        ):
            response = client.post(
                "/api/drive/permissions",
                json={"space_id": space_id, **payload},
            )
            assert response.status_code == 422

    def test_duplicate_subject_409(self, client, space_id):
        payload = {
            "space_id": space_id, "subject_type": "user",
            "subject_id": "bob@gsi.fr", "permission": "viewer",
        }
        assert client.post("/api/drive/permissions", json=payload).status_code == 201
        assert client.post("/api/drive/permissions", json=payload).status_code == 409

    def test_invalid_role_422(self, client, space_id):
        resp = client.post("/api/drive/permissions", json={
            "space_id": space_id, "subject_type": "user",
            "subject_id": "x", "permission": "superuser",
        })
        assert resp.status_code == 422

    def test_unknown_space_404(self, client):
        resp = client.post("/api/drive/permissions", json={
            "space_id": UNKNOWN_UUID, "subject_type": "user",
            "subject_id": "x", "permission": "viewer",
        })
        assert resp.status_code == 404

    def test_file_from_other_space_422(self, client, space_id):
        file_id = _upload_file(client, space_id)
        other = client.post("/api/drive/spaces", json={
            "name": "Autre", "slug": "autre", "type": "gsi",
        }).json()["id"]
        resp = client.post("/api/drive/permissions", json={
            "space_id": other, "file_id": file_id,
            "subject_type": "user", "subject_id": "x", "permission": "viewer",
        })
        assert resp.status_code == 422

    def test_unknown_folder_404(self, client, space_id):
        resp = client.post("/api/drive/permissions", json={
            "space_id": space_id, "folder_id": UNKNOWN_UUID,
            "subject_type": "user", "subject_id": "x", "permission": "viewer",
        })
        assert resp.status_code == 404

    def test_emits_permission_changed_event(self, client, space_id):
        client.post("/api/drive/permissions", json={
            "space_id": space_id, "subject_type": "user",
            "subject_id": "eve@gsi.fr", "permission": "uploader",
        })
        feed = client.get("/api/drive/changes",
                          params={"space_id": space_id, "since_event_id": 0}).json()
        events = [e for e in feed["events"] if e["event_type"] == "permission_changed"]
        assert len(events) == 1
        assert events[0]["payload"]["action"] == "created"
        assert events[0]["payload"]["subject_id"] == "eve@gsi.fr"


class TestUpdatePermission:
    def test_patch_role(self, client, space_id):
        perm = client.post("/api/drive/permissions", json={
            "space_id": space_id, "subject_type": "user",
            "subject_id": "carol@gsi.fr", "permission": "viewer",
        }).json()
        resp = client.patch(f"/api/drive/permissions/{perm['id']}",
                            json={"permission": "editor"})
        assert resp.status_code == 200
        assert resp.json()["permission"] == "editor"

    def test_patch_unknown_404(self, client):
        resp = client.patch(f"/api/drive/permissions/{UNKNOWN_UUID}",
                            json={"permission": "editor"})
        assert resp.status_code == 404

    def test_patch_invalid_role_422(self, client, space_id):
        perm = client.post("/api/drive/permissions", json={
            "space_id": space_id, "subject_type": "user",
            "subject_id": "d@gsi.fr", "permission": "viewer",
        }).json()
        resp = client.patch(f"/api/drive/permissions/{perm['id']}",
                            json={"permission": "root"})
        assert resp.status_code == 422

    def test_patch_no_sync_local_is_rejected_until_sync_filter_exists(self, client, space_id):
        perm = client.post("/api/drive/permissions", json={
            "space_id": space_id, "subject_type": "user",
            "subject_id": "nosync@gsi.fr", "permission": "viewer",
        }).json()
        response = client.patch(
            f"/api/drive/permissions/{perm['id']}",
            json={"permission": "no_sync_local"},
        )
        assert response.status_code == 422

    def test_patch_rejects_legacy_unenforced_permission(self, client, space_id):
        permission_id = uuid4()
        repo = client.app.state.repository
        repo.permissions[permission_id] = {
            "id": permission_id,
            "space_id": UUID(space_id),
            "folder_id": None,
            "file_id": None,
            "subject_type": "team",
            "subject_id": "legacy-team",
            "permission": "viewer",
            "created_by": None,
            "created_at": datetime.now(UTC),
        }

        response = client.patch(
            f"/api/drive/permissions/{permission_id}",
            json={"permission": "editor"},
        )

        assert response.status_code == 422
        assert repo.permissions[permission_id]["permission"] == "viewer"


class TestDeletePermission:
    def test_delete_then_gone(self, client, space_id):
        perm = client.post("/api/drive/permissions", json={
            "space_id": space_id, "subject_type": "user",
            "subject_id": "frank@gsi.fr", "permission": "owner",
        }).json()
        assert client.delete(f"/api/drive/permissions/{perm['id']}").status_code == 204
        listing = client.get("/api/drive/permissions",
                             params={"space_id": space_id}).json()
        assert listing["permissions"] == []
        # Idempotence : second delete → 404
        assert client.delete(f"/api/drive/permissions/{perm['id']}").status_code == 404


class TestAudit:
    def test_full_lifecycle_audited(self, client, space_id):
        perm = client.post("/api/drive/permissions", json={
            "space_id": space_id, "subject_type": "user",
            "subject_id": "grace@gsi.fr", "permission": "viewer",
        }).json()
        client.patch(f"/api/drive/permissions/{perm['id']}", json={"permission": "admin"})
        client.delete(f"/api/drive/permissions/{perm['id']}")

        audit = client.get("/api/drive/audit",
                           params={"entity_type": "permission",
                                   "entity_id": perm["id"]}).json()
        actions = [e["action"] for e in audit["entries"]]
        # Ordre anté-chronologique (plus récent d'abord)
        assert actions == ["permission_deleted", "permission_updated", "permission_created"]
        updated = next(e for e in audit["entries"] if e["action"] == "permission_updated")
        assert updated["payload"]["permission_before"] == "viewer"
        assert updated["payload"]["permission_after"] == "admin"

    def test_audit_unfiltered_and_limit(self, client, space_id):
        for i in range(3):
            client.post("/api/drive/permissions", json={
                "space_id": space_id, "subject_type": "user",
                "subject_id": f"user-{i}@gsi.fr", "permission": "viewer",
            })
        resp = client.get("/api/drive/audit", params={"limit": 2})
        assert resp.status_code == 200
        assert len(resp.json()["entries"]) == 2

    def test_audit_limit_bounds_422(self, client):
        assert client.get("/api/drive/audit", params={"limit": 0}).status_code == 422
        assert client.get("/api/drive/audit", params={"limit": 9999}).status_code == 422
