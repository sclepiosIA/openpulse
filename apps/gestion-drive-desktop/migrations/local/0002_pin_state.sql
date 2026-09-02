-- Gestion Drive Desktop — index local SQLite
-- Migration 0002 : état d'épinglage local (« OneDrive-like »).
--
-- pin_state :
--   'pinned'   — « Toujours garder sur cet appareil » : jamais évincé.
--   'unpinned' — défaut : présent localement après pull, évincable.
--   'evicted'  — « Libéré de l'espace » : copie locale supprimée, les
--                métadonnées (file_id, version, sha256) restent comme
--                placeholder ; re-téléchargement à la demande.

ALTER TABLE local_files
  ADD COLUMN pin_state TEXT NOT NULL DEFAULT 'unpinned'
  CHECK (pin_state IN ('pinned','unpinned','evicted'));

CREATE INDEX IF NOT EXISTS idx_local_files_pin ON local_files(pin_state);
