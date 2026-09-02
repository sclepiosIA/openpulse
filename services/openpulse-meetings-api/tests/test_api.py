"""Tests API — health, upload-intent/complete, sessions (contrat azureMeetingsApi.ts)."""

from __future__ import annotations


def test_meetings_health_contract(client):
    """Le front lit status/services (AzureMeetingsHealth) via /api/meetings/health."""
    resp = client.get("/api/meetings/health")
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "ok"
    assert body["service"] == "openpulse-meetings-api"
    assert body["services"]["database"] == "ok"
    assert body["services"]["blob_storage"] == "ok"


def test_healthz_alias(client):
    assert client.get("/healthz").status_code == 200


def test_upload_intent_then_complete_flow(client):
    intent = client.post(
        "/api/transcriptions/upload-intent",
        json={
            "file_name": "réunion du 07/07 (finale).m4a",
            "content_type": "audio/mp4",
            "size_bytes": 12_000_000,
            "title": "Réunion pilotage 07/07",
            "language": "fr",
            "diarization_enabled": True,
        },
    )
    assert intent.status_code == 201, intent.text
    body = intent.json()
    assert body["upload_url"].startswith("stub://blob/")
    assert body["blob_name"].startswith(f"sessions/{body['session_id']}/")
    # blob name assaini : pas d'espaces ni parenthèses du nom original
    assert " " not in body["blob_name"] and "(" not in body["blob_name"]
    assert body["blob_container"] == "gestion-meetings-recordings"

    complete = client.post(
        "/api/transcriptions/upload-complete",
        json={"session_id": body["session_id"], "size_bytes": 12_000_000},
    )
    assert complete.status_code == 200, complete.text
    assert complete.json() == {"session_id": body["session_id"], "status": "queued"}

    sessions = client.get("/api/transcriptions/sessions")
    assert sessions.status_code == 200
    page = sessions.json()
    assert page["total"] == 1
    assert page["items"][0]["id"] == body["session_id"]
    assert page["items"][0]["status"] == "queued"

    details = client.get(f"/api/transcriptions/sessions/{body['session_id']}")
    assert details.status_code == 200
    detail = details.json()
    assert detail["segments"] == []
    assert detail["ai_outputs"] == []
    assert detail["title"] == "Réunion pilotage 07/07"


def test_upload_complete_unknown_session_404(client):
    resp = client.post(
        "/api/transcriptions/upload-complete",
        json={"session_id": "00000000-0000-0000-0000-000000000000"},
    )
    assert resp.status_code == 404


def test_upload_intent_validation(client):
    resp = client.post(
        "/api/transcriptions/upload-intent",
        json={"file_name": "a.mp3", "content_type": "audio/mpeg", "size_bytes": 0, "title": "x"},
    )
    assert resp.status_code == 422
