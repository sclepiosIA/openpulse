# Gestion Drive Desktop

Client desktop macOS/Windows du **Gestion Drive** OpenPulse. Squelette Tauri v2 + Rust (sync core) + React (UI), aligné sur le plan `2026-07-07_120031-gestion-drive-custom-architecture.md`.

> ⚠️ Squelette de démarrage : login **mock**, spaces **mock**, pas de vraie sync réseau. L'API réelle (`openpulse-gestion-drive-api`) sera branchée en Milestone 3.

## Architecture

```txt
gestion-drive-desktop/
├── src/                      # UI React (TypeScript)
│   ├── api/                  # Client API (mock aujourd'hui, HTTP demain)
│   ├── pages/                # Login, FolderPicker, Spaces, SyncStatus, Settings
│   ├── components/           # Composants partagés (StatusBadge…)
│   └── state/                # Store Zustand (session, config, spaces)
├── src-tauri/                # Shell Tauri v2 (Rust)
│   ├── src/main.rs           # Entrée binaire
│   ├── src/lib.rs            # Setup app, commandes IPC, tray
│   ├── src/commands.rs       # Commandes exposées au front
│   ├── src/tray.rs           # Menu barre système (concept)
│   ├── tauri.conf.json       # Config Tauri (fenêtre, bundle, updater placeholder)
│   └── capabilities/         # Permissions Tauri v2
├── crates/sync-core/         # Cœur de sync Rust, indépendant de Tauri
│   ├── src/config.rs         # Config client (dossier sync, endpoint, device)
│   ├── src/db.rs             # Index local SQLite (rusqlite) + migrations
│   ├── src/models.rs         # LocalFile, SyncState, Space, QueueOp
│   └── src/lib.rs
├── migrations/local/         # Schéma SQLite versionné (source de vérité)
└── docs/                     # Notes d'architecture desktop
```

### Pourquoi un crate `sync-core` séparé ?

Le moteur de sync (SQLite, hashing, file watcher, queue) doit être testable en pur Rust sans lancer Tauri, et réutilisable par un futur CLI headless. Le shell Tauri ne fait que l'orchestration et l'IPC vers React.

## Prérequis

- Node ≥ 20, npm (ou pnpm)
- Rust stable (`rustup default stable`)
- macOS : Xcode Command Line Tools. Windows : MSVC Build Tools + WebView2.

## Démarrage

```bash
npm install
npm run tauri:dev      # app complète (nécessite Rust)
npm run dev            # UI seule dans le navigateur (mode mock)
```

## Tests

```bash
npm test                               # tests UI/mock API (Vitest)
cargo test -p gestion-drive-sync-core  # tests du cœur de sync (SQLite, config)
cargo test --workspace                 # tout Rust
```

## État local SQLite

Schéma dans `migrations/local/0001_init.sql`, appliqué par `sync-core::db::open_and_migrate`. Tables : `local_files`, `sync_cursors`, `sync_queue`, `schema_migrations` — conformes à la section 8.1 du plan.

La base vit dans le répertoire de données app (`~/Library/Application Support/com.gsi.gestion-drive` sur macOS, `%APPDATA%` sur Windows), **jamais** dans le dossier synchronisé.

## Sécurité (rappels du plan §12)

- Tokens dans Keychain/Credential Manager (module `platform_credentials` à venir — jamais dans SQLite ni dans la config JSON).
- Aucun secret dans ce repo ; l'endpoint API est une valeur de config, pas un secret.
- Espaces `web_only` : jamais synchronisés localement (le mock l'illustre déjà).

## Roadmap locale (extrait Milestone 3)

- [x] Squelette Tauri v2 + React
- [x] Écran login (mock)
- [x] Choix dossier local
- [x] Liste spaces (mock) + sélection sync
- [x] Schéma SQLite local + migrations
- [x] Concept tray/menu bar
- [ ] Branchement API réelle (auth device, spaces, tree)
- [ ] File watcher (notify) + debounce
- [ ] Upload/download workers + queue
- [ ] Copies de conflit
- [ ] Build DMG / MSI signés
