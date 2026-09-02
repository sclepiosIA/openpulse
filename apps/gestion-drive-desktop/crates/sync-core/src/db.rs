//! Index local SQLite : ouverture, migrations, opérations de base.
//!
//! Le schéma versionné vit dans `migrations/local/*.sql` (embarqué à la
//! compilation via `include_str!`). La table `schema_migrations` trace les
//! versions appliquées.

use rusqlite::{params, Connection, OptionalExtension};
use std::path::Path;
use std::time::{SystemTime, UNIX_EPOCH};

use crate::models::{LocalFile, PinState, QueueOp, SyncState};
use crate::{Result, SyncCoreError};

/// Seules les corruptions SQLite avérées autorisent la reconstruction de
/// l'index. Une base verrouillée, un refus de permission ou une erreur E/S
/// transitoire doivent remonter sans déplacer les données locales.
pub fn is_database_corruption_error(error: &SyncCoreError) -> bool {
    matches!(
        error,
        SyncCoreError::Db(rusqlite::Error::SqliteFailure(code, _))
            if matches!(
                code.code,
                rusqlite::ErrorCode::DatabaseCorrupt | rusqlite::ErrorCode::NotADatabase
            )
    )
}

/// Migrations embarquées, dans l'ordre. Ajouter les suivantes ici.
const MIGRATIONS: &[(i64, &str)] = &[
    (1, include_str!("../../../migrations/local/0001_init.sql")),
    (
        2,
        include_str!("../../../migrations/local/0002_pin_state.sql"),
    ),
];

/// Epoch secondes courant (partagé par scanner/push worker).
pub fn now_epoch() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0)
}

/// Ouvre (ou crée) la base et applique les migrations manquantes.
pub fn open_and_migrate(db_path: &Path) -> Result<Connection> {
    if let Some(parent) = db_path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let conn = Connection::open(db_path)?;
    // Plusieurs connexions coexistent (pull, push, sync_status) : sans
    // busy_timeout, un write concurrent → SQLITE_BUSY immédiat (« database
    // is locked ») au lieu d'attendre son tour.
    conn.busy_timeout(std::time::Duration::from_secs(5))?;
    conn.pragma_update(None, "journal_mode", "WAL")?;
    conn.pragma_update(None, "foreign_keys", "ON")?;
    apply_migrations(&conn)?;
    Ok(conn)
}

/// Base en mémoire pour les tests.
pub fn open_in_memory() -> Result<Connection> {
    let conn = Connection::open_in_memory()?;
    apply_migrations(&conn)?;
    Ok(conn)
}

fn apply_migrations(conn: &Connection) -> Result<()> {
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS schema_migrations (
           version INTEGER PRIMARY KEY,
           applied_at INTEGER NOT NULL
         );",
    )?;
    for (version, sql) in MIGRATIONS {
        let applied: Option<i64> = conn
            .query_row(
                "SELECT version FROM schema_migrations WHERE version = ?1",
                params![version],
                |r| r.get(0),
            )
            .optional()?;
        if applied.is_none() {
            conn.execute_batch(sql)?;
            conn.execute(
                "INSERT INTO schema_migrations(version, applied_at) VALUES (?1, ?2)",
                params![version, now_epoch()],
            )?;
        }
    }
    Ok(())
}

// ---------------------------------------------------------------------------
// local_files
// ---------------------------------------------------------------------------

/// Insère ou met à jour l'état d'un fichier local.
pub fn upsert_local_file(conn: &Connection, f: &LocalFile) -> Result<()> {
    conn.execute(
        "INSERT INTO local_files
           (local_path, space_id, file_id, folder_id, sha256, etag, version,
            size_bytes, mtime, sync_state, pin_state, last_error, updated_at)
         VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13)
         ON CONFLICT(local_path) DO UPDATE SET
           space_id=excluded.space_id, file_id=excluded.file_id,
           folder_id=excluded.folder_id, sha256=excluded.sha256,
           etag=excluded.etag, version=excluded.version,
           size_bytes=excluded.size_bytes, mtime=excluded.mtime,
           sync_state=excluded.sync_state, pin_state=excluded.pin_state,
           last_error=excluded.last_error, updated_at=excluded.updated_at",
        params![
            f.local_path,
            f.space_id,
            f.file_id,
            f.folder_id,
            f.sha256,
            f.etag,
            f.version,
            f.size_bytes,
            f.mtime,
            f.sync_state.as_str(),
            f.pin_state.as_str(),
            f.last_error,
            f.updated_at,
        ],
    )?;
    Ok(())
}

pub fn get_local_file(conn: &Connection, local_path: &str) -> Result<Option<LocalFile>> {
    let row = conn
        .query_row(
            "SELECT local_path, space_id, file_id, folder_id, sha256, etag, version,
                    size_bytes, mtime, sync_state, last_error, updated_at, pin_state
             FROM local_files WHERE local_path = ?1",
            params![local_path],
            map_local_file,
        )
        .optional()?;
    Ok(row)
}

pub fn delete_local_file(conn: &Connection, local_path: &str) -> Result<bool> {
    Ok(conn.execute(
        "DELETE FROM local_files WHERE local_path = ?1",
        [local_path],
    )? > 0)
}

/// Liste paginée de l'index local (UI « Fichiers » : tri stable par chemin).
pub fn list_local_files(conn: &Connection, limit: i64, offset: i64) -> Result<Vec<LocalFile>> {
    let mut stmt = conn.prepare(
        "SELECT local_path, space_id, file_id, folder_id, sha256, etag, version,
                size_bytes, mtime, sync_state, last_error, updated_at, pin_state
         FROM local_files
         ORDER BY local_path ASC LIMIT ?1 OFFSET ?2",
    )?;
    let rows = stmt.query_map(params![limit, offset], map_local_file)?;
    let mut out = Vec::new();
    for row in rows {
        out.push(row?);
    }
    Ok(out)
}

/// Couples distincts espace/dossier déjà connus, sans limite de pagination.
pub fn list_space_dirs(conn: &Connection) -> Result<Vec<(String, String)>> {
    let mut stmt = conn.prepare(
        "SELECT DISTINCT space_id,
                CASE WHEN instr(local_path, '/') > 0
                     THEN substr(local_path, 1, instr(local_path, '/') - 1)
                     ELSE local_path END AS space_dir
         FROM local_files
         WHERE space_id <> '' AND local_path <> ''
         ORDER BY space_id, space_dir",
    )?;
    let rows = stmt.query_map([], |row| Ok((row.get(0)?, row.get(1)?)))?;
    let mut out = Vec::new();
    for row in rows {
        out.push(row?);
    }
    Ok(out)
}

/// Change uniquement l'état d'épinglage d'un fichier connu de l'index.
/// Retourne `false` si le chemin est inconnu.
pub fn set_pin_state(conn: &Connection, local_path: &str, pin: PinState) -> Result<bool> {
    let n = conn.execute(
        "UPDATE local_files SET pin_state = ?2, updated_at = ?3 WHERE local_path = ?1",
        params![local_path, pin.as_str(), now_epoch()],
    )?;
    Ok(n > 0)
}

/// Compte les fichiers par état de sync (pour l'UI statut/tray).
pub fn count_by_state(conn: &Connection, state: SyncState) -> Result<i64> {
    let n = conn.query_row(
        "SELECT COUNT(*) FROM local_files WHERE sync_state = ?1",
        params![state.as_str()],
        |r| r.get(0),
    )?;
    Ok(n)
}

fn map_local_file(r: &rusqlite::Row<'_>) -> rusqlite::Result<LocalFile> {
    let state: String = r.get(9)?;
    let pin: String = r.get(12)?;
    Ok(LocalFile {
        local_path: r.get(0)?,
        space_id: r.get(1)?,
        file_id: r.get(2)?,
        folder_id: r.get(3)?,
        sha256: r.get(4)?,
        etag: r.get(5)?,
        version: r.get(6)?,
        size_bytes: r.get(7)?,
        mtime: r.get(8)?,
        sync_state: SyncState::parse(&state).unwrap_or(SyncState::Error),
        pin_state: PinState::parse(&pin).unwrap_or_default(),
        last_error: r.get(10)?,
        updated_at: r.get(11)?,
    })
}

// ---------------------------------------------------------------------------
// sync_cursors
// ---------------------------------------------------------------------------

pub fn get_cursor(conn: &Connection, space_id: &str) -> Result<i64> {
    let v: Option<i64> = conn
        .query_row(
            "SELECT last_event_id FROM sync_cursors WHERE space_id = ?1",
            params![space_id],
            |r| r.get(0),
        )
        .optional()?;
    Ok(v.unwrap_or(0))
}

pub fn set_cursor(conn: &Connection, space_id: &str, last_event_id: i64) -> Result<()> {
    conn.execute(
        "INSERT INTO sync_cursors(space_id, last_event_id) VALUES (?1, ?2)
         ON CONFLICT(space_id) DO UPDATE SET last_event_id = excluded.last_event_id",
        params![space_id, last_event_id],
    )?;
    Ok(())
}

// ---------------------------------------------------------------------------
// sync_queue
// ---------------------------------------------------------------------------

pub fn enqueue(
    conn: &Connection,
    op_type: &str,
    local_path: Option<&str>,
    remote_path: Option<&str>,
    payload: Option<&str>,
) -> Result<i64> {
    conn.execute(
        "INSERT INTO sync_queue(op_type, local_path, remote_path, payload, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5)",
        params![op_type, local_path, remote_path, payload, now_epoch()],
    )?;
    Ok(conn.last_insert_rowid())
}

/// Prochaine opération éligible (next_attempt_at <= maintenant), FIFO.
pub fn next_op(conn: &Connection) -> Result<Option<QueueOp>> {
    let row = conn
        .query_row(
            "SELECT id, op_type, local_path, remote_path, payload, retry_count,
                    next_attempt_at, created_at
             FROM sync_queue
             WHERE next_attempt_at <= ?1
             ORDER BY id ASC LIMIT 1",
            params![now_epoch()],
            |r| {
                Ok(QueueOp {
                    id: r.get(0)?,
                    op_type: r.get(1)?,
                    local_path: r.get(2)?,
                    remote_path: r.get(3)?,
                    payload: r.get(4)?,
                    retry_count: r.get(5)?,
                    next_attempt_at: r.get(6)?,
                    created_at: r.get(7)?,
                })
            },
        )
        .optional()?;
    Ok(row)
}

/// Vrai si une opération du même type est déjà en attente pour ce chemin
/// (déduplication : un scan répété ne doit pas empiler N uploads).
pub fn has_pending_op(conn: &Connection, op_type: &str, local_path: &str) -> Result<bool> {
    let n: i64 = conn.query_row(
        "SELECT COUNT(*) FROM sync_queue WHERE op_type = ?1 AND local_path = ?2",
        params![op_type, local_path],
        |r| r.get(0),
    )?;
    Ok(n > 0)
}

/// Nombre d'opérations en attente (pour l'UI).
pub fn queue_len(conn: &Connection) -> Result<i64> {
    let n: i64 = conn.query_row("SELECT COUNT(*) FROM sync_queue", [], |r| r.get(0))?;
    Ok(n)
}

pub fn complete_op(conn: &Connection, id: i64) -> Result<()> {
    conn.execute("DELETE FROM sync_queue WHERE id = ?1", params![id])?;
    Ok(())
}

/// Replanifie une opération échouée avec backoff exponentiel plafonné (plan §2).
pub fn reschedule_op(conn: &Connection, id: i64) -> Result<()> {
    let retry: i64 = conn.query_row(
        "SELECT retry_count FROM sync_queue WHERE id = ?1",
        params![id],
        |r| r.get(0),
    )?;
    let delay = backoff_secs(retry + 1);
    conn.execute(
        "UPDATE sync_queue
         SET retry_count = retry_count + 1, next_attempt_at = ?2
         WHERE id = ?1",
        params![id, now_epoch() + delay],
    )?;
    Ok(())
}

/// Diffère une opération sans consommer son budget de retry (ex. token auth rejeté).
pub fn defer_op(conn: &Connection, id: i64, delay_secs: i64) -> Result<()> {
    conn.execute(
        "UPDATE sync_queue SET next_attempt_at = ?2 WHERE id = ?1",
        params![id, now_epoch() + delay_secs.max(1)],
    )?;
    Ok(())
}

/// Backoff exponentiel : 2^n secondes, plafonné à 15 minutes.
pub fn backoff_secs(retry_count: i64) -> i64 {
    let base = 2_i64.saturating_pow(retry_count.min(20) as u32);
    base.min(900)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn classifies_only_confirmed_sqlite_corruption_for_recovery() {
        let corrupt = SyncCoreError::Db(rusqlite::Error::SqliteFailure(
            rusqlite::ffi::Error::new(rusqlite::ffi::SQLITE_CORRUPT),
            None,
        ));
        let locked = SyncCoreError::Db(rusqlite::Error::SqliteFailure(
            rusqlite::ffi::Error::new(rusqlite::ffi::SQLITE_BUSY),
            None,
        ));

        assert!(is_database_corruption_error(&corrupt));
        assert!(!is_database_corruption_error(&locked));
    }

    fn sample_file(path: &str) -> LocalFile {
        LocalFile {
            local_path: path.into(),
            space_id: "space-gsi".into(),
            file_id: None,
            folder_id: None,
            sha256: Some("abc".into()),
            etag: None,
            version: 0,
            size_bytes: 42,
            mtime: 1_700_000_000,
            sync_state: SyncState::PendingUpload,
            pin_state: PinState::Unpinned,
            last_error: None,
            updated_at: 1_700_000_000,
        }
    }

    #[test]
    fn migrations_apply_once() {
        let conn = open_in_memory().unwrap();
        // Ré-appliquer ne doit pas échouer.
        apply_migrations(&conn).unwrap();
        let n: i64 = conn
            .query_row("SELECT COUNT(*) FROM schema_migrations", [], |r| r.get(0))
            .unwrap();
        assert_eq!(n as usize, MIGRATIONS.len());
    }

    #[test]
    fn pin_state_roundtrip_and_listing() {
        let conn = open_in_memory().unwrap();
        let f = sample_file("Contrats/a.pdf");
        upsert_local_file(&conn, &f).unwrap();
        let g = sample_file("Contrats/b.pdf");
        upsert_local_file(&conn, &g).unwrap();

        // Défaut : unpinned.
        let got = get_local_file(&conn, "Contrats/a.pdf").unwrap().unwrap();
        assert_eq!(got.pin_state, PinState::Unpinned);

        // set_pin_state cible un seul chemin.
        assert!(set_pin_state(&conn, "Contrats/a.pdf", PinState::Pinned).unwrap());
        assert!(!set_pin_state(&conn, "inconnu.txt", PinState::Pinned).unwrap());
        let got = get_local_file(&conn, "Contrats/a.pdf").unwrap().unwrap();
        assert_eq!(got.pin_state, PinState::Pinned);
        let other = get_local_file(&conn, "Contrats/b.pdf").unwrap().unwrap();
        assert_eq!(other.pin_state, PinState::Unpinned);

        // Éviction persistée + listing trié/paginé.
        assert!(set_pin_state(&conn, "Contrats/b.pdf", PinState::Evicted).unwrap());
        let all = list_local_files(&conn, 10, 0).unwrap();
        assert_eq!(all.len(), 2);
        assert_eq!(all[0].local_path, "Contrats/a.pdf");
        assert_eq!(all[1].pin_state, PinState::Evicted);
        let page2 = list_local_files(&conn, 1, 1).unwrap();
        assert_eq!(page2.len(), 1);
        assert_eq!(page2[0].local_path, "Contrats/b.pdf");
    }

    #[test]
    fn space_dirs_are_distinct_and_unpaginated() {
        let conn = open_in_memory().unwrap();
        upsert_local_file(&conn, &sample_file("medical/a.pdf")).unwrap();
        upsert_local_file(&conn, &sample_file("medical/b.pdf")).unwrap();
        let mut other = sample_file("admin/c.pdf");
        other.space_id = "space-admin".into();
        upsert_local_file(&conn, &other).unwrap();

        assert_eq!(
            list_space_dirs(&conn).unwrap(),
            vec![
                ("space-admin".into(), "admin".into()),
                ("space-gsi".into(), "medical".into()),
            ]
        );
    }

    #[test]
    fn upsert_and_get_local_file() {
        let conn = open_in_memory().unwrap();
        let f = sample_file("Contrats/contrat-hds.pdf");
        upsert_local_file(&conn, &f).unwrap();

        let got = get_local_file(&conn, "Contrats/contrat-hds.pdf")
            .unwrap()
            .unwrap();
        assert_eq!(got.space_id, "space-gsi");
        assert_eq!(got.sync_state, SyncState::PendingUpload);

        // Update via upsert
        let mut f2 = f.clone();
        f2.sync_state = SyncState::Idle;
        f2.version = 3;
        upsert_local_file(&conn, &f2).unwrap();
        let got2 = get_local_file(&conn, "Contrats/contrat-hds.pdf")
            .unwrap()
            .unwrap();
        assert_eq!(got2.version, 3);
        assert_eq!(got2.sync_state, SyncState::Idle);
        assert_eq!(count_by_state(&conn, SyncState::Idle).unwrap(), 1);
    }

    #[test]
    fn cursor_defaults_to_zero_then_updates() {
        let conn = open_in_memory().unwrap();
        assert_eq!(get_cursor(&conn, "s1").unwrap(), 0);
        set_cursor(&conn, "s1", 42).unwrap();
        assert_eq!(get_cursor(&conn, "s1").unwrap(), 42);
        set_cursor(&conn, "s1", 43).unwrap();
        assert_eq!(get_cursor(&conn, "s1").unwrap(), 43);
    }

    #[test]
    fn queue_fifo_and_retry() {
        let conn = open_in_memory().unwrap();
        let id1 = enqueue(&conn, "upload", Some("a.txt"), None, None).unwrap();
        let _id2 = enqueue(&conn, "upload", Some("b.txt"), None, None).unwrap();

        let op = next_op(&conn).unwrap().unwrap();
        assert_eq!(op.id, id1);
        assert_eq!(op.local_path.as_deref(), Some("a.txt"));

        // Échec → replanifiée dans le futur, b.txt passe devant.
        reschedule_op(&conn, id1).unwrap();
        let op2 = next_op(&conn).unwrap().unwrap();
        assert_eq!(op2.local_path.as_deref(), Some("b.txt"));

        complete_op(&conn, op2.id).unwrap();
        // a.txt est dans le futur → plus rien d'éligible immédiatement.
        assert!(next_op(&conn).unwrap().is_none());
    }

    #[test]
    fn backoff_is_capped() {
        assert_eq!(backoff_secs(1), 2);
        assert_eq!(backoff_secs(3), 8);
        assert_eq!(backoff_secs(30), 900);
    }
}
