"""Tests API — flux complet spaces → tree → upload → download → changes."""

from __future__ import annotations

import hashlib

from app.deps import get_storage
from app.storage import BlobProperties, StubBlobStorage

SHA_A = hashlib.sha256(b"contenu A").hexdigest()
SHA_B = hashlib.sha256(b"contenu B").hexdigest()
SHA_C = hashlib.sha256(b"contenu C").hexdigest()


class TestHealth:
    def test_healthz(self, client):
        resp = client.get("/healthz")
        assert resp.status_code == 200
        body = resp.json()
        assert body["status"] == "ok"
        assert body["service"] == "openpulse-gestion-drive-api"
        assert body["database"] == "memory"
        assert body["blob_storage"] == "stub"
        assert len(body["source_sha"]) == 40
        assert all(char in "0123456789abcdef" for char in body["source_sha"].lower())

    def test_alias_api_drive_health(self, client):
        assert client.get("/api/drive/health").status_code == 200

    def test_readyz_checks_the_real_repository_and_storage_backends(self, client):
        response = client.get("/readyz")
        assert response.status_code == 200
        assert response.json()["database"] == "memory"
        assert response.json()["blob_storage"] == "stub"

    def test_readyz_fails_closed_when_blob_probe_fails(self, client):
        class BrokenStorage(StubBlobStorage):
            def check_ready(self, containers: tuple[str, ...]) -> None:
                raise RuntimeError(f"unavailable: {len(containers)}")

        client.app.dependency_overrides[get_storage] = lambda: BrokenStorage()
        try:
            response = client.get("/readyz")
            assert response.status_code == 503
            assert response.json()["detail"] == "Drive backends unavailable"
        finally:
            client.app.dependency_overrides.pop(get_storage, None)


class TestSpaces:
    def test_create_and_list(self, client):
        resp = client.post(
            "/api/drive/spaces",
            json={"name": "DPO OpenPulse", "slug": "dpo-gsi", "type": "dpo",
                  "sensitivity": "dpo_restricted", "sync_policy": "web_only"},
        )
        assert resp.status_code == 201, resp.text
        created = resp.json()
        assert created["slug"] == "dpo-gsi"
        assert created["sync_policy"] == "web_only"

        listing = client.get("/api/drive/spaces")
        assert listing.status_code == 200
        assert [s["slug"] for s in listing.json()] == ["dpo-gsi"]

    def test_duplicate_slug_409(self, client):
        payload = {"name": "X", "slug": "x", "type": "gsi"}
        assert client.post("/api/drive/spaces", json=payload).status_code == 201
        assert client.post("/api/drive/spaces", json=payload).status_code == 409

    def test_invalid_type_422(self, client):
        resp = client.post("/api/drive/spaces", json={"name": "X", "slug": "x", "type": "nope"})
        assert resp.status_code == 422


class TestTree:
    def test_empty_tree(self, client, space_id):
        resp = client.get("/api/drive/tree", params={"space_id": space_id})
        assert resp.status_code == 200
        body = resp.json()
        assert body["folders"] == [] and body["files"] == []

    def test_unknown_space_404(self, client):
        resp = client.get("/api/drive/tree", params={"space_id": "00000000-0000-0000-0000-000000000000"})
        assert resp.status_code == 404


def _do_upload(client, space_id, path, sha, size=9, base_version=None, base_file_id=None):
    payload = {"space_id": space_id, "path": path, "size_bytes": size, "sha256": sha}
    if base_version is not None:
        payload["base_version"] = base_version
    if base_file_id is not None:
        payload["base_file_id"] = base_file_id
    intent = client.post("/api/drive/upload-intent", json=payload)
    assert intent.status_code == 200, intent.text
    return intent.json()


class TestUploadFlow:
    def test_complete_refuses_missing_blob(self, client, space_id):
        intent = _do_upload(client, space_id, "/missing-blob.txt", SHA_A)

        class MissingBlobStorage(StubBlobStorage):
            def get_blob_properties(self, container, blob_name):
                return None

        client.app.dependency_overrides[get_storage] = lambda: MissingBlobStorage()
        try:
            complete = client.post("/api/drive/upload-complete", json={
                "upload_token": intent["upload_token"],
                "file_id": intent["file_id"],
                "version": 1,
            })
        finally:
            client.app.dependency_overrides.pop(get_storage, None)
        assert complete.status_code == 409

    def test_complete_refuses_server_observed_sha_mismatch(self, client, space_id):
        intent = _do_upload(client, space_id, "/wrong-sha.txt", SHA_A)

        class MismatchedStorage(StubBlobStorage):
            kind = "azure"

            def get_blob_properties(self, container, blob_name):
                return BlobProperties(size_bytes=9, etag='"etag-1"')

            def compute_blob_sha256(self, container, blob_name, expected_etag):
                assert expected_etag == '"etag-1"'
                return SHA_B

        client.app.dependency_overrides[get_storage] = lambda: MismatchedStorage()
        try:
            complete = client.post("/api/drive/upload-complete", json={
                "upload_token": intent["upload_token"],
                "file_id": intent["file_id"],
                "version": 1,
            })
        finally:
            client.app.dependency_overrides.pop(get_storage, None)
        assert complete.status_code == 409
        assert "SHA-256" in complete.json()["detail"]

    def test_new_file_intent_then_complete(self, client, space_id):
        intent = _do_upload(client, space_id, "/DPO/Contrats/contrat-hds.pdf", SHA_A)
        assert intent["action"] == "upload"
        assert intent["version"] == 1
        assert intent["conflict"] is False
        assert intent["upload_url"].startswith("https://stub.blob.local/gestion-drive-files/")
        # Blob nommé par IDs, jamais par le path utilisateur
        assert "/DPO/" not in intent["blob_name"]
        assert intent["blob_name"].startswith(f"spaces/{space_id}/files/{intent['file_id']}/current/")

        # Le fichier est en 'uploading' : pas encore visible dans le tree
        tree = client.get("/api/drive/tree", params={"space_id": space_id}).json()
        assert tree["files"] == []
        # Mais les dossiers intermédiaires existent déjà
        assert [f["path"] for f in tree["folders"]] == ["/DPO", "/DPO/Contrats"]

        complete = client.post("/api/drive/upload-complete", json={
            "upload_token": intent["upload_token"],
            "file_id": intent["file_id"],
            "version": 1,
            "etag": "\"0xETAG\"",
        })
        assert complete.status_code == 200, complete.text
        file = complete.json()["file"]
        assert file["status"] == "active"
        assert file["current_version"] == 1
        assert file["sha256"] == SHA_A

        tree = client.get("/api/drive/tree", params={"space_id": space_id}).json()
        assert [f["path"] for f in tree["files"]] == ["/DPO/Contrats/contrat-hds.pdf"]

    def test_upload_complete_retry_is_idempotent(self, client, space_id):
        intent = _do_upload(client, space_id, "/idempotent.txt", SHA_A)
        payload = {
            "upload_token": intent["upload_token"],
            "file_id": intent["file_id"],
            "version": 1,
        }
        first = client.post("/api/drive/upload-complete", json=payload)
        second = client.post("/api/drive/upload-complete", json=payload)
        assert first.status_code == second.status_code == 200
        assert second.json()["event_id"] == first.json()["event_id"]
        changes = client.get(
            "/api/drive/changes", params={"space_id": space_id, "since_event_id": 0},
        ).json()["events"]
        matching = [
            event for event in changes
            if event["file_id"] == intent["file_id"] and event["event_type"] == "file_created"
        ]
        assert len(matching) == 1

    def test_completed_older_version_retry_keeps_its_original_event_receipt(
        self, client, space_id
    ):
        first = _do_upload(client, space_id, "/idempotent-history.txt", SHA_A)
        client.post("/api/drive/upload-complete", json={
            "upload_token": first["upload_token"],
            "file_id": first["file_id"],
            "version": 1,
        })
        second = _do_upload(
            client, space_id, "/idempotent-history.txt", SHA_B, base_version=1
        )
        second_payload = {
            "upload_token": second["upload_token"],
            "file_id": second["file_id"],
            "version": 2,
        }
        second_complete = client.post("/api/drive/upload-complete", json=second_payload)
        assert second_complete.status_code == 200

        third = _do_upload(
            client, space_id, "/idempotent-history.txt", SHA_C, base_version=2
        )
        third_complete = client.post("/api/drive/upload-complete", json={
            "upload_token": third["upload_token"],
            "file_id": third["file_id"],
            "version": 3,
        })
        assert third_complete.status_code == 200

        retried_second = client.post("/api/drive/upload-complete", json=second_payload)
        assert retried_second.status_code == 200
        assert retried_second.json()["event_id"] == second_complete.json()["event_id"]
        assert retried_second.json()["file"]["current_version"] == 3

    def test_same_sha_noop(self, client, space_id):
        intent = _do_upload(client, space_id, "/a.txt", SHA_A)
        client.post("/api/drive/upload-complete", json={
            "upload_token": intent["upload_token"], "file_id": intent["file_id"], "version": 1,
        })
        again = _do_upload(client, space_id, "/a.txt", SHA_A)
        assert again["action"] == "noop"
        assert again["version"] == 1

    def test_new_version_on_changed_content(self, client, space_id):
        intent = _do_upload(client, space_id, "/b.txt", SHA_A)
        client.post("/api/drive/upload-complete", json={
            "upload_token": intent["upload_token"], "file_id": intent["file_id"], "version": 1,
        })
        v2 = _do_upload(client, space_id, "/b.txt", SHA_B, base_version=1)
        assert v2["action"] == "upload"
        assert v2["version"] == 2
        assert v2["conflict"] is False
        assert "/versions/v2/" in v2["blob_name"]
        complete = client.post("/api/drive/upload-complete", json={
            "upload_token": v2["upload_token"], "file_id": v2["file_id"], "version": 2,
        })
        assert complete.json()["file"]["current_version"] == 2

    def test_late_completion_cannot_roll_back_a_newer_version(self, client, space_id):
        first = _do_upload(client, space_id, "/ordered.txt", SHA_A)
        client.post("/api/drive/upload-complete", json={
            "upload_token": first["upload_token"], "file_id": first["file_id"], "version": 1,
        })
        v2 = _do_upload(client, space_id, "/ordered.txt", SHA_B, base_version=1)
        v3 = _do_upload(client, space_id, "/ordered.txt", SHA_C, base_version=1)
        assert (v2["version"], v3["version"]) == (2, 3)
        newest = client.post("/api/drive/upload-complete", json={
            "upload_token": v3["upload_token"], "file_id": v3["file_id"], "version": 3,
        })
        assert newest.status_code == 200
        late = client.post("/api/drive/upload-complete", json={
            "upload_token": v2["upload_token"], "file_id": v2["file_id"], "version": 2,
        })
        assert late.status_code == 409
        rejected_download = client.post(
            "/api/drive/download-url", json={"file_id": first["file_id"], "version": 2}
        )
        assert rejected_download.status_code == 409
        assert "non finalisée" in rejected_download.json()["detail"]
        tree = client.get("/api/drive/tree", params={"space_id": space_id}).json()
        file = next(item for item in tree["files"] if item["path"] == "/ordered.txt")
        assert file["current_version"] == 3
        assert file["sha256"] == SHA_C

    def test_conflict_flag_on_stale_base_version(self, client, space_id):
        intent = _do_upload(client, space_id, "/c.txt", SHA_A)
        client.post("/api/drive/upload-complete", json={
            "upload_token": intent["upload_token"], "file_id": intent["file_id"], "version": 1,
        })
        v2 = _do_upload(client, space_id, "/c.txt", SHA_B, base_version=1)
        client.post("/api/drive/upload-complete", json={
            "upload_token": v2["upload_token"], "file_id": v2["file_id"], "version": 2,
        })
        version_count = len(client.app.state.repository.versions)
        # Un autre device croit encore être en v1 → conflit sans réserver une
        # version ni émettre un SAS qu'il n'utilisera jamais.
        stale = _do_upload(client, space_id, "/c.txt", SHA_B[::-1], base_version=1)
        assert stale["action"] == "conflict"
        assert stale["version"] == 2
        assert stale["conflict"] is True
        assert stale["conflict_reason"]
        assert stale["upload_url"] is None
        assert stale["upload_token"] is None
        assert len(client.app.state.repository.versions) == version_count

    def test_path_traversal_rejected(self, client, space_id):
        resp = client.post("/api/drive/upload-intent", json={
            "space_id": space_id, "path": "/../etc/passwd", "size_bytes": 1,
        })
        assert resp.status_code == 422

    def test_ignored_temp_file_rejected(self, client, space_id):
        resp = client.post("/api/drive/upload-intent", json={
            "space_id": space_id, "path": "/DPO/~$rapport.docx", "size_bytes": 1,
        })
        assert resp.status_code == 422

    def test_complete_with_bad_token_401(self, client, space_id):
        intent = _do_upload(client, space_id, "/d.txt", SHA_A)
        resp = client.post("/api/drive/upload-complete", json={
            "upload_token": "forged.token", "file_id": intent["file_id"], "version": 1,
        })
        assert resp.status_code == 401

    def test_complete_token_mismatch_401(self, client, space_id):
        i1 = _do_upload(client, space_id, "/e1.txt", SHA_A)
        i2 = _do_upload(client, space_id, "/e2.txt", SHA_B)
        # Token de e1 utilisé pour finaliser e2 → refus
        resp = client.post("/api/drive/upload-complete", json={
            "upload_token": i1["upload_token"], "file_id": i2["file_id"], "version": 1,
        })
        assert resp.status_code == 401


class TestDownload:
    def _upload_active_file(self, client, space_id, path="/dl.txt"):
        intent = _do_upload(client, space_id, path, SHA_A)
        client.post("/api/drive/upload-complete", json={
            "upload_token": intent["upload_token"], "file_id": intent["file_id"], "version": 1,
        })
        return intent["file_id"]

    def test_download_current(self, client, space_id):
        file_id = self._upload_active_file(client, space_id)
        resp = client.post("/api/drive/download-url", json={"file_id": file_id})
        assert resp.status_code == 200
        body = resp.json()
        assert body["version"] == 1
        assert body["download_url"].startswith("https://stub.blob.local/")

    def test_download_specific_version(self, client, space_id):
        file_id = self._upload_active_file(client, space_id, "/dv.txt")
        v2 = _do_upload(client, space_id, "/dv.txt", SHA_B)
        client.post("/api/drive/upload-complete", json={
            "upload_token": v2["upload_token"], "file_id": file_id, "version": 2,
        })
        v1 = client.post("/api/drive/download-url", json={"file_id": file_id, "version": 1}).json()
        assert v1["version"] == 1
        assert "/current/" in v1["download_url"]
        v2r = client.post("/api/drive/download-url", json={"file_id": file_id}).json()
        assert v2r["version"] == 2
        assert "/versions/v2/" in v2r["download_url"]

    def test_download_pending_version_is_rejected(self, client, space_id):
        file_id = self._upload_active_file(client, space_id, "/pending-version.txt")
        pending = _do_upload(client, space_id, "/pending-version.txt", SHA_B, base_version=1)
        response = client.post(
            "/api/drive/download-url", json={"file_id": file_id, "version": pending["version"]}
        )
        assert response.status_code == 409
        assert "non finalisée" in response.json()["detail"]

    def test_download_unknown_404(self, client):
        resp = client.post("/api/drive/download-url",
                           json={"file_id": "00000000-0000-0000-0000-000000000000"})
        assert resp.status_code == 404

    def test_download_uploading_file_409(self, client, space_id):
        intent = _do_upload(client, space_id, "/pending.txt", SHA_A)
        resp = client.post("/api/drive/download-url", json={"file_id": intent["file_id"]})
        assert resp.status_code == 409


class TestChanges:
    def test_changes_feed_and_cursor(self, client, space_id):
        base = client.get("/api/drive/changes",
                          params={"space_id": space_id, "since_event_id": 0}).json()
        assert base["events"] == []
        assert base["last_event_id"] == 0

        intent = _do_upload(client, space_id, "/DPO/x.txt", SHA_A)
        client.post("/api/drive/upload-complete", json={
            "upload_token": intent["upload_token"], "file_id": intent["file_id"], "version": 1,
        })

        feed = client.get("/api/drive/changes",
                          params={"space_id": space_id, "since_event_id": 0}).json()
        types = [e["event_type"] for e in feed["events"]]
        assert types == ["folder_created", "file_created"]
        assert feed["has_more"] is False
        cursor = feed["last_event_id"]

        # Incrémental : plus rien après le curseur
        empty = client.get("/api/drive/changes",
                           params={"space_id": space_id, "since_event_id": cursor}).json()
        assert empty["events"] == []

        # Nouvelle version → nouvel événement seulement
        v2 = _do_upload(client, space_id, "/DPO/x.txt", SHA_B)
        client.post("/api/drive/upload-complete", json={
            "upload_token": v2["upload_token"], "file_id": v2["file_id"], "version": 2,
        })
        delta = client.get("/api/drive/changes",
                           params={"space_id": space_id, "since_event_id": cursor}).json()
        assert [e["event_type"] for e in delta["events"]] == ["file_updated"]
        assert delta["events"][0]["payload"]["version"] == 2

    def test_changes_unknown_space_404(self, client):
        resp = client.get("/api/drive/changes",
                          params={"space_id": "00000000-0000-0000-0000-000000000000"})
        assert resp.status_code == 404


class TestFileLifecycle:
    def _active(self, client, space_id, path="/DPO/original.txt"):
        intent = _do_upload(client, space_id, path, SHA_A)
        client.post("/api/drive/upload-complete", json={
            "upload_token": intent["upload_token"], "file_id": intent["file_id"], "version": 1,
        })
        return intent["file_id"]

    def test_move_delete_restore_emit_events_and_keep_versions(self, client, space_id):
        file_id = self._active(client, space_id)
        moved = client.post(f"/api/drive/files/{file_id}/move", json={"path": "/Archives/renamed.txt"})
        assert moved.status_code == 200, moved.text
        assert moved.json()["path"] == "/Archives/renamed.txt"
        assert moved.json()["name"] == "renamed.txt"

        deleted = client.delete(f"/api/drive/files/{file_id}")
        assert deleted.status_code == 200
        assert deleted.json()["status"] == "deleted"
        assert client.get("/api/drive/tree", params={"space_id": space_id}).json()["files"] == []
        assert client.post("/api/drive/download-url", json={"file_id": file_id}).status_code == 409

        restored = client.post(f"/api/drive/files/{file_id}/restore")
        assert restored.status_code == 200
        assert restored.json()["status"] == "active"
        assert restored.json()["path"] == "/Archives/renamed.txt"

        events = client.get("/api/drive/changes", params={"space_id": space_id, "since_event_id": 0}).json()["events"]
        lifecycle = [e for e in events if e["file_id"] == file_id]
        assert [e["event_type"] for e in lifecycle] == ["file_created", "file_moved", "file_deleted", "file_restored"]
        assert lifecycle[1]["payload"] == {"old_path": "/DPO/original.txt", "path": "/Archives/renamed.txt"}

    def test_move_rejects_active_path_collision_and_restore_is_guarded(self, client, space_id):
        first = self._active(client, space_id, "/one.txt")
        self._active(client, space_id, "/two.txt")
        assert client.post(f"/api/drive/files/{first}/move", json={"path": "/two.txt"}).status_code == 409
        assert client.delete(f"/api/drive/files/{first}").status_code == 200
        assert client.delete(f"/api/drive/files/{first}").status_code == 409
        assert client.post(f"/api/drive/files/{first}/restore").status_code == 200
        assert client.post(f"/api/drive/files/{first}/restore").status_code == 409
