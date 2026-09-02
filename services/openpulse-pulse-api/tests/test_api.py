"""Tests API — health, conversations, messages (contrat PulseAzureApiClient)."""

from __future__ import annotations


def test_healthz_contract(client):
    """Le front lit status/version/timestamp/dependencies (AzurePulseHealth)."""
    resp = client.get("/healthz")
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "ok"
    assert body["service"] == "openpulse-pulse-api"
    assert body["dependencies"] == {"database": "ok"}
    assert "timestamp" in body and "version" in body


def test_conversations_empty(client):
    resp = client.get("/api/pulse/conversations")
    assert resp.status_code == 200
    assert resp.json() == []


def test_create_conversation_and_messages_flow(client):
    created = client.post(
        "/api/pulse/conversations",
        json={
            "name": "Incident DPO — test",
            "type": "incident",
            "is_private": True,
            "member_profile_ids": ["p1", "p2"],
        },
    )
    assert created.status_code == 201, created.text
    conv = created.json()
    assert conv["type"] == "incident"
    assert conv["status"] == "active"
    conv_id = conv["id"]

    # Messages : vide au départ
    empty = client.get(f"/api/pulse/conversations/{conv_id}/messages")
    assert empty.status_code == 200
    assert empty.json() == []

    sent = client.post(
        f"/api/pulse/conversations/{conv_id}/messages",
        json={"body": "Premier message **markdown**"},
    )
    assert sent.status_code == 201, sent.text
    message = sent.json()
    assert message["conversation_id"] == conv_id
    assert message["body_format"] == "markdown"
    assert message["status"] == "active"

    listed = client.get(f"/api/pulse/conversations/{conv_id}/messages")
    assert [m["id"] for m in listed.json()] == [message["id"]]

    # La conversation expose le dernier message (champ dérivé du contrat front)
    conversations = client.get("/api/pulse/conversations").json()
    assert conversations[0]["last_message"]["id"] == message["id"]


def test_messages_unknown_conversation_404(client):
    resp = client.get("/api/pulse/conversations/00000000-0000-0000-0000-000000000000/messages")
    assert resp.status_code == 404

    resp = client.post(
        "/api/pulse/conversations/00000000-0000-0000-0000-000000000000/messages",
        json={"body": "x"},
    )
    assert resp.status_code == 404


def test_conversation_type_validation(client):
    resp = client.post(
        "/api/pulse/conversations",
        json={"name": "Bad", "type": "carrier_pigeon"},
    )
    assert resp.status_code == 422
