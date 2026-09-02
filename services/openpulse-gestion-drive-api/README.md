# openpulse-gestion-drive-api

Socle backend **Gestion Drive** (Milestone 1 du plan `2026-07-07_120031-gestion-drive-custom-architecture.md`).

API FastAPI de métadonnées + URLs signées Azure Blob pour le futur Gestion Drive :
la page existante `/documents` de Gestion consommera cette API (pas de nouvelle
page `/drive` concurrente), et le client desktop Tauri s'appuiera sur le feed
`/changes`.

## Périmètre Milestone 1

- ✅ `GET /healthz` + `GET /api/drive/health` — probe Container Apps
- ✅ `GET/POST /api/drive/spaces` — espaces (gsi, etablissement, dpo…)
- ✅ `GET /api/drive/tree?space_id=` — dossiers + fichiers actifs
- ✅ `POST /api/drive/upload-intent` — création/nouvelle version + SAS upload + upload token signé
- ✅ `POST /api/drive/upload-complete` — finalisation (statut `uploading` → `active`) + événement sync
- ✅ `POST /api/drive/download-url` — SAS lecture (version courante ou historique)
- ✅ `GET /api/drive/changes?space_id=&since_event_id=` — feed incrémental curseur
- ✅ `POST /api/drive/desktop/web/token`, `/refresh`, `/logout` — challenge serveur + nouvelle preuve TOTP, puis famille Drive opaque rotative/révocable ; aucun rôle provider n'est prolongé par le refresh
- ✅ Migrations SQL `drive_*` versionnées, sous verrou advisory et registre de checksums
- ✅ Stockage Azure Blob via env ; repli **stub** sans réseau pour dev/tests
- ✅ Repository PostgreSQL (asyncpg) via `DATABASE_URL` ; repli **in-memory** pour dev/tests
- ✅ Auth : mode `disabled` (dev) ou validation JWT HS256 du jeton Drive dédié AAL2
- ⏳ Hors périmètre M1 : RBAC fin, mkdir/move/delete/restore/lock, devices, audit lecture, chunked upload

## Démarrage local

```bash
python3.13 -m venv .venv            # ou: uv venv .venv --python 3.13
./.venv/bin/pip install -r requirements-dev.txt
cp .env.example .env                 # laisser vide DATABASE_URL/AZURE_* => memory + stub
./.venv/bin/uvicorn app.main:app --port 8735
```

## Tests

```bash
./.venv/bin/python -m pytest         # paths, migrations, tokens, auth et API bout-en-bout
```

Smoke test HTTP (serveur lancé) :

```bash
./.venv/bin/python scripts/smoke.py http://127.0.0.1:8735
```

## Configuration (env)

Voir `.env.example`. Points clés :

| Variable                                        | Effet                                                      |
| ----------------------------------------------- | ---------------------------------------------------------- |
| `DATABASE_URL` vide                             | repository in-memory (dev/tests)                           |
| `DATABASE_URL` postgres                         | tables `drive_*` (exécuter `scripts/migrate.py` avant)     |
| `AZURE_STORAGE_*` vides                         | URLs stub `https://stub.blob.local/...`                    |
| `AZURE_STORAGE_CONNECTION_STRING` ou compte+clé | SAS réels, TTL `DRIVE_SAS_TTL_MINUTES`                     |
| `DRIVE_AUTH_MODE=jwt` + `DRIVE_JWT_SECRET`      | exige `Authorization: Bearer *** Gestion>`                 |
| `DRIVE_JWT_TTL_SECONDS`                         | durée du JWT Drive court ; refresh silencieux côté Desktop |
| `DRIVE_APP_SECRET`                              | signe les upload tokens — **obligatoire en prod**          |

## Migration base

```bash
DATABASE_URL=postgresql://... ./.venv/bin/python scripts/migrate.py
```

`migrations/0001_init_drive.sql` : `drive_spaces`, `drive_folders`, `drive_files`,
`drive_file_versions`, `drive_permissions`, `drive_sync_devices`,
`drive_sync_events`, `drive_audit_logs`. Unicité `(space_id, path)` en index
partiel (`status <> 'deleted'`) pour que le soft delete libère les chemins.
Le rollback est fourni **commenté** (`0001_init_drive.rollback.sql`) — règle OpenPulse
non destructive.

`0003_desktop_refresh_sessions.sql` stocke uniquement les hashes des refresh
Drive. `0004_desktop_handoff_challenges.sql` ajoute les challenges d'appairage
à usage unique et les hashes de nonce ; aucun bearer provider ni code MFA n'est
persisté. Voir `docs/architecture/ADR-20260723-DESKTOP-DRIVE-FRESH-MFA-HANDOFF.md`.

## Containers Blob à créer côté Azure (une fois)

```bash
az storage container create --name gestion-drive-files --auth-mode login --account-name <compte>
az storage container create --name gestion-drive-versions --auth-mode login --account-name <compte>
# plus tard: gestion-drive-thumbnails, gestion-drive-exports, gestion-drive-quarantine
```

Activer soft delete + versioning côté compte de stockage (plan §12).

## Déploiement Container Apps (cible)

Déployer et vérifier l'API avec `/api/drive/desktop/refresh` **avant** de publier le
Desktop correspondant. L'ancien Desktop ignore les nouveaux champs de login ; le
nouveau Desktop conserve la session si l'endpoint refresh est temporairement absent,
mais ne peut pas reprendre la synchronisation tant que l'API n'est pas convergée.

```bash
docker build -t openpulse-gestion-drive-api:0.1.0 .
# push ACR puis:
az containerapp create \
  --name openpulse-gestion-drive-api \
  --resource-group rg-openpulse-gestion-prod \
  --image <acr>.azurecr.io/openpulse-gestion-drive-api:0.1.0 \
  --target-port 8000 --ingress external \
  --cpu 0.25 --memory 0.5Gi --min-replicas 0 --max-replicas 2 \
  --env-vars DRIVE_ENV=prod DRIVE_AUTH_MODE=jwt \
  --secrets ...   # DATABASE_URL, AZURE_STORAGE_CONNECTION_STRING, DRIVE_JWT_SECRET, DRIVE_APP_SECRET
```

## Décisions techniques notables

- **Blob keys par IDs** (`spaces/{space_id}/files/{file_id}/…`), jamais le path
  utilisateur → renommage metadata-only, pas de path traversal (plan §6).
- **Upload token HMAC stateless** liant intent → complete : un client ne peut pas
  finaliser un upload qu'il n'a pas initié, sans table supplémentaire.
- **Statut `uploading`** ajouté au check `drive_files.status` : un fichier créé par
  `upload-intent` n'apparaît dans le tree qu'après `upload-complete`.
- **Détection de conflit** par `base_version` (plan §7) : signalée dans la réponse
  d'intent (`conflict: true`), la copie de conflit reste côté client (M3).
- **Noop dédup** : même `sha256` que la version courante → `action: "noop"`.
