-- Gestion Drive Desktop — index local SQLite
-- Migration 0001 : schéma initial (plan §8.1)
-- Appliquée par sync-core::db::open_and_migrate. Ne jamais modifier une
-- migration livrée : ajouter 0002_*.sql etc.

CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER PRIMARY KEY,
  applied_at INTEGER NOT NULL
);

-- État connu de chaque fichier local synchronisé.
CREATE TABLE IF NOT EXISTS local_files (
  local_path TEXT PRIMARY KEY,          -- chemin relatif au sync root, séparateur '/'
  space_id   TEXT NOT NULL,
  file_id    TEXT,                      -- uuid serveur (null tant que jamais uploadé)
  folder_id  TEXT,
  sha256     TEXT,
  etag       TEXT,
  version    INTEGER NOT NULL DEFAULT 0,
  size_bytes INTEGER NOT NULL DEFAULT 0,
  mtime      INTEGER NOT NULL DEFAULT 0, -- epoch secondes
  sync_state TEXT NOT NULL DEFAULT 'idle'
             CHECK (sync_state IN ('idle','pending_upload','pending_download','uploading','downloading','conflict','error','ignored')),
  last_error TEXT,
  updated_at INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_local_files_space ON local_files(space_id);
CREATE INDEX IF NOT EXISTS idx_local_files_state ON local_files(sync_state);

-- Curseur de flux d'événements serveur par espace (GET /api/drive/changes).
CREATE TABLE IF NOT EXISTS sync_cursors (
  space_id      TEXT PRIMARY KEY,
  last_event_id INTEGER NOT NULL DEFAULT 0
);

-- File d'attente d'opérations (upload, download, mkdir, move, delete…),
-- avec retry/backoff. Vidée par les workers.
CREATE TABLE IF NOT EXISTS sync_queue (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  op_type         TEXT NOT NULL
                  CHECK (op_type IN ('upload','download','mkdir','move','delete','restore')),
  local_path      TEXT,
  remote_path     TEXT,
  payload         TEXT,                 -- JSON libre (base_version, target…)
  retry_count     INTEGER NOT NULL DEFAULT 0,
  next_attempt_at INTEGER NOT NULL DEFAULT 0,
  created_at      INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_sync_queue_next ON sync_queue(next_attempt_at);
