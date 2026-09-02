# openpulse-pulse-api — Gestion Pulse Azure Collaboration Hub

Squelette FastAPI du backend Pulse Azure (plan
`2026-07-07 gestion-pulse-azure-collaboration-hub`, §12). Première brique
consommable par le front : health + conversations + messages.

## Endpoints (contrat aligné sur `src/lib/pulse/azureApiClient.ts`)

| Méthode | Chemin                                   | Description                                            |
| ------- | ---------------------------------------- | ------------------------------------------------------ |
| GET     | `/healthz`                               | Santé (`AzurePulseHealth`), alias `/api/pulse/health`. |
| GET     | `/api/pulse/conversations`               | Liste des conversations actives.                       |
| POST    | `/api/pulse/conversations`               | Crée une conversation.                                 |
| GET     | `/api/pulse/conversations/{id}/messages` | Messages (`?before=&limit=`).                          |
| POST    | `/api/pulse/conversations/{id}/messages` | Envoie un message.                                     |

Restent à venir (plan §12, chemins déjà réservés côté client) : read receipts,
PATCH/DELETE message, réactions, recherche, IA (summarize / action-items),
présence, WebSocket temps réel.

## Lancer en local

```bash
cd services/openpulse-pulse-api
python3.13 -m venv .venv && .venv/bin/pip install -r requirements.txt -r requirements-dev.txt
.venv/bin/uvicorn app.main:app --reload --port 8011
curl http://localhost:8011/healthz
```

Sans `DATABASE_URL`, store in-memory (dev/tests). Avec `DATABASE_URL`
Azure PostgreSQL, appliquer d'abord
`azure/pulse/migrations/001_pulse_azure_schema.sql`.

En production (`PULSE_ENV=prod` ou `production`), le démarrage refuse toute
configuration ouverte : `PULSE_AUTH_MODE=jwt`, `DATABASE_URL`, un secret JWT
non-placeholder et `PULSE_JWT_AUDIENCE=openpulse-pulse-api` sont requis. Les listes,
lectures et écritures de conversations sont limitées aux membres ; le créateur
est toujours ajouté comme `owner`.

## Tests

```bash
.venv/bin/pytest
```

## Côté front

- Flags : `VITE_PULSE_BACKEND=hybrid` + `VITE_PULSE_AZURE_API_URL=<url ACA>`.
- Client : `src/lib/pulse/azureApiClient.ts`, types `src/types/pulse-azure.ts`.
