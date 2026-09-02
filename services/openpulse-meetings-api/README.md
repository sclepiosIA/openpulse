# openpulse-meetings-api — Gestion Visio / Transcription Azure

Squelette FastAPI du backend Meetings Azure (plan
`2026-07-07_120603-gestion-visio-transcription-azure-meetings.md`, §10).
Première brique consommable par le front : health + pipeline
upload-intent → upload-complete → sessions.

## Endpoints (contrat aligné sur `src/services/meetings/azureMeetingsApi.ts`)

| Méthode | Chemin                                  | Description                                          |
| ------- | ---------------------------------------- | ---------------------------------------------------- |
| GET     | `/api/meetings/health`                   | Santé (`AzureMeetingsHealth`), alias `/healthz`.     |
| POST    | `/api/transcriptions/upload-intent`      | Session pré-créée + URL SAS Blob d'upload.           |
| POST    | `/api/transcriptions/upload-complete`    | Confirme l'upload → session `queued`.                |
| GET     | `/api/transcriptions/sessions`           | Liste paginée (`AzureMeetingsPage`).                 |
| GET     | `/api/transcriptions/sessions/{id}`      | Détails : segments + sorties IA.                     |

Le worker de transcription (Container Apps Job consommant les sessions
`queued` : Azure AI Speech + diarisation, puis sorties IA) est le lot suivant.

## Lancer en local

```bash
cd services/openpulse-meetings-api
python3.13 -m venv .venv && .venv/bin/pip install -r requirements.txt -r requirements-dev.txt
.venv/bin/uvicorn app.main:app --reload --port 8012
curl http://localhost:8012/api/meetings/health
```

Sans credentials Azure, les URLs SAS sont des stubs (`stub://blob/...`) —
le flux complet reste testable hors ligne. Avec `DATABASE_URL`, appliquer
d'abord `azure/meetings/migrations/0001_meetings_azure.sql`.

## Tests

```bash
.venv/bin/pytest
```

## Côté front

- Flags : `VITE_TRANSCRIPTION_BACKEND=hybrid` + `VITE_MEETINGS_API_BASE_URL=<url ACA>`
  (`src/config/meetingsBackend.ts`).
- Client : `src/services/meetings/azureMeetingsApi.ts`, types `src/types/meetingsAzure.ts`.
