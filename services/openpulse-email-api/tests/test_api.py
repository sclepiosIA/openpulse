"""Tests API — health, sync/status, comptes (contrat front emailAzureApi.ts)."""

from __future__ import annotations


def test_healthz(client):
    resp = client.get("/healthz")
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "ok"
    assert body["service"] == "openpulse-email-api"
    assert body["database"] == "memory"


def test_health_alias(client):
    resp = client.get("/api/email/health")
    assert resp.status_code == 200
    assert resp.json()["service"] == "openpulse-email-api"


def test_sync_status_contract_empty(client):
    """Le front exige backend === 'azure' et accounts: array."""
    resp = client.get("/api/email/sync/status")
    assert resp.status_code == 200
    body = resp.json()
    assert body["backend"] == "azure"
    assert isinstance(body["accounts"], list)
    assert body["accounts"] == []
    assert body["queue"] == {"ai_pending": 0, "unclassified": 0}
    assert "generated_at" in body


def test_create_account_then_sync_status(client):
    created = client.post(
        "/api/email/accounts",
        json={
            "email_address": "contact@exploitant.example.org",
            "display_name": "Contact OpenPulse",
            "provider": "imap_smtp",
            "is_shared": True,
            "secret_ref": "kv://openpulse-gestion/email-contact",
        },
    )
    assert created.status_code == 201, created.text
    account = created.json()
    assert account["provider"] == "imap_smtp"
    assert account["status"] == "active"
    # Jamais de secret : uniquement la référence Key Vault.
    assert account["secret_ref"].startswith("kv://")

    listed = client.get("/api/email/accounts")
    assert listed.status_code == 200
    assert len(listed.json()) == 1

    status = client.get("/api/email/sync/status")
    body = status.json()
    assert len(body["accounts"]) == 1
    acc = body["accounts"][0]
    assert acc["account_id"] == account["id"]
    assert acc["health"] == "unknown"  # jamais synchronisé
    assert acc["sync_enabled"] is True


def test_create_account_validation(client):
    resp = client.post(
        "/api/email/accounts",
        json={"email_address": "x", "provider": "carrier_pigeon", "secret_ref": "kv://x"},
    )
    assert resp.status_code == 422
