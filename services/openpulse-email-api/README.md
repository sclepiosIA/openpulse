# openpulse-email-api — Gestion Emails Azure Smart Inbox

Squelette FastAPI du backend email Azure (plan
`2026-07-07 gestion-emails-azure-smart-inbox`). Lot 2 — première brique
consommable par le front : health + supervision sync + comptes (référence
Key Vault uniquement, jamais de secret).

## Endpoints (contrat aligné sur `src/services/email/emailAzureApi.ts`)

| Méthode | Chemin                    | Description                                            |
| ------- | ------------------------- | ------------------------------------------------------ |
| GET     | `/healthz`                | Probe Container Apps (alias `/api/email/health`).      |
| GET     | `/api/email/sync/status`  | Supervision sync agrégée (`EmailAzureSyncStatusResponse`). |
| GET     | `/api/email/accounts`     | Liste des comptes `email_accounts_azure`.              |
| POST    | `/api/email/accounts`     | Enregistre un compte (secret_ref Key Vault).           |

Invariants exigés par le front : `backend === "azure"`, `accounts` est un
tableau — garantis par les schémas Pydantic.

## Lancer en local

```bash
cd services/openpulse-email-api
python3.13 -m venv .venv && .venv/bin/pip install -r requirements.txt -r requirements-dev.txt
.venv/bin/uvicorn app.main:app --reload --port 8010
curl http://localhost:8010/healthz
```

Sans `DATABASE_URL`, le store est in-memory (dev/tests). Avec `DATABASE_URL`
pointant sur Azure PostgreSQL, les tables `email_*_azure` doivent exister
(`scripts/migration/azure/001_email_smart_inbox_lot1.sql`).

## Tests

```bash
.venv/bin/pytest
```

## Côté front

- Flag : `VITE_EMAIL_BACKEND=hybrid` + `VITE_EMAIL_AZURE_API_URL=<url ACA>`.
- Client : `src/services/email/emailAzureApi.ts` (lecture seule lot 1).

## Prochains lots (voir docs/azure/GESTION-AZURE-BACKENDS-PLAN.md)

1. Workers sync IMAP/Graph (Container Apps Jobs) alimentant
   `email_messages_azure` + `email_sync_cursors`.
2. Classification IA (`job-email-ai`) → `email_ai_insights`.
3. Actions CRM (`email_actions`) + cutover `VITE_EMAIL_BACKEND=azure`.
