//! Scan du dossier local (lot 1 : scan à la demande/périodique ; watcher
//! `notify` au lot suivant).
//!
//! Convention de chemins partagée avec le pull (`pull::space_dir_name`) :
//! chaque espace vit sous `<sync_root>/<space_dir>/…` et
//! `local_files.local_path = "{space_dir}/{rel}"` (séparateur `/`).
//! Le chemin serveur correspondant est `/{rel}` (sans le préfixe espace) ;
//! il est stocké dans `sync_queue.remote_path` au moment de l'enfilage.
//!
//! Détection des fichiers nouveaux/modifiés par rapport à l'index :
//! - fast path : taille + mtime inchangés → aucun hachage ;
//! - sinon SHA-256 streaming ; empreinte identique → simple maj d'index
//!   (pas d'upload) ; sinon état `pending_upload` + enfilage dédupliqué.
//!
//! Hors périmètre lot 1 : propagation des suppressions/renommages.

use rusqlite::Connection;
use serde::Serialize;
use std::path::{Path, PathBuf};

use crate::db;
use crate::hashing;
use crate::models::{is_ignored_filename, LocalFile, SyncState};
use crate::{Result, SyncCoreError};

/// Bilan d'un scan, affichable tel quel dans l'UI.
#[derive(Debug, Default, Clone, Serialize)]
pub struct ScanReport {
    pub scanned: u64,
    pub new_files: u64,
    pub modified: u64,
    pub unchanged: u64,
    pub ignored: u64,
    pub queued: u64,
    pub errors: Vec<String>,
}

impl ScanReport {
    pub fn merge(&mut self, other: ScanReport) {
        self.scanned += other.scanned;
        self.new_files += other.new_files;
        self.modified += other.modified;
        self.unchanged += other.unchanged;
        self.ignored += other.ignored;
        self.queued += other.queued;
        self.errors.extend(other.errors);
    }
}

/// Chemin absolu plateforme du dossier d'un espace sous le sync root.
pub fn space_root_abs(sync_root: &Path, space_dir: &str) -> PathBuf {
    let mut p = sync_root.to_path_buf();
    for seg in space_dir.split('/').filter(|s| !s.is_empty()) {
        p.push(seg);
    }
    p
}

/// Parcourt `<sync_root>/<space_dir>` récursivement et met à jour index +
/// queue pour `space_id`. Le dossier est créé s'il n'existe pas encore
/// (premier lancement avant tout pull).
///
/// Ignorés : fichiers temporaires (cf. `is_ignored_filename`), fichiers et
/// dossiers cachés (préfixe `.`), liens symboliques (pas de suivi → pas de boucle).
pub fn scan_space(
    conn: &Connection,
    sync_root: &Path,
    space_dir: &str,
    space_id: &str,
) -> Result<ScanReport> {
    if !sync_root.is_dir() {
        return Err(SyncCoreError::InvalidConfig(format!(
            "dossier de synchronisation introuvable: {}",
            sync_root.display()
        )));
    }
    let space_root = space_root_abs(sync_root, space_dir);
    std::fs::create_dir_all(&space_root)?;

    let mut report = ScanReport::default();
    let mut stack = vec![space_root.clone()];

    while let Some(dir) = stack.pop() {
        let entries = match std::fs::read_dir(&dir) {
            Ok(e) => e,
            Err(e) => {
                report.errors.push(format!("{}: {e}", dir.display()));
                continue;
            }
        };
        for entry in entries {
            let entry = match entry {
                Ok(e) => e,
                Err(e) => {
                    report.errors.push(e.to_string());
                    continue;
                }
            };
            let path = entry.path();
            let name = entry.file_name().to_string_lossy().into_owned();
            let file_type = match entry.file_type() {
                Ok(t) => t,
                Err(e) => {
                    report.errors.push(format!("{}: {e}", path.display()));
                    continue;
                }
            };

            if file_type.is_symlink() {
                report.ignored += 1;
                continue;
            }
            if file_type.is_dir() {
                if name.starts_with('.') {
                    report.ignored += 1;
                } else {
                    stack.push(path);
                }
                continue;
            }
            if name.starts_with('.') || is_ignored_filename(&name) {
                report.ignored += 1;
                continue;
            }

            report.scanned += 1;
            if let Err(e) = scan_file(conn, &space_root, space_dir, &path, space_id, &mut report) {
                report.errors.push(format!("{}: {e}", path.display()));
            }
        }
    }
    // Fichiers connus du serveur disparus localement : propager une suppression
    // explicite. Les fichiers locaux encore en upload/conflit ne sont jamais supprimés.
    for local in db::list_local_files(conn, 100_000, 0)?
        .into_iter()
        .filter(|file| file.space_id == space_id && file.sync_state == SyncState::Idle)
    {
        let Some(file_id) = local.file_id.as_deref() else {
            continue;
        };
        let abs = sync_root.join(Path::new(&local.local_path));
        if !abs.exists() && !db::has_pending_op(conn, "delete", &local.local_path)? {
            db::enqueue(
                conn,
                "delete",
                Some(&local.local_path),
                None,
                Some(&serde_json::json!({ "space_id": space_id, "file_id": file_id }).to_string()),
            )?;
            report.queued += 1;
        }
    }
    Ok(report)
}

/// Chemin relatif à `root`, normalisé avec des séparateurs `/`.
pub fn relative_slash_path(root: &Path, abs: &Path) -> Result<String> {
    let rel = abs.strip_prefix(root).map_err(|_| {
        SyncCoreError::InvalidConfig(format!(
            "{} n'est pas sous {}",
            abs.display(),
            root.display()
        ))
    })?;
    let parts: Vec<String> = rel
        .components()
        .map(|c| c.as_os_str().to_string_lossy().into_owned())
        .collect();
    Ok(parts.join("/"))
}

fn mtime_epoch(meta: &std::fs::Metadata) -> i64 {
    meta.modified()
        .ok()
        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0)
}

fn scan_file(
    conn: &Connection,
    space_root: &Path,
    space_dir: &str,
    abs: &Path,
    space_id: &str,
    report: &mut ScanReport,
) -> Result<()> {
    // `rel` : chemin serveur (sans préfixe espace). `local_rel` : clé d'index.
    let rel = relative_slash_path(space_root, abs)?;
    let local_rel = format!("{space_dir}/{rel}");
    let meta = std::fs::metadata(abs)?;
    let size = meta.len() as i64;
    let mtime = mtime_epoch(&meta);

    let existing = db::get_local_file(conn, &local_rel)?;

    // Fast path : mêmes taille + mtime + empreinte connue → rien à faire.
    if let Some(f) = &existing {
        if f.size_bytes == size && f.mtime == mtime && f.sha256.is_some() {
            report.unchanged += 1;
            return Ok(());
        }
    }

    let (sha, hashed_size) = hashing::sha256_file(abs)?;
    let now = db::now_epoch();

    // Renommage/déplacement local : si un unique fichier distant indexé a le
    // même contenu et que son ancien chemin a disparu, conserver son identité
    // et son historique au lieu de créer puis supprimer deux objets distants.
    if existing.is_none() {
        let prefix = format!("{space_dir}/");
        let candidates: Vec<LocalFile> = db::list_local_files(conn, 100_000, 0)?
            .into_iter()
            .filter(|candidate| {
                candidate.space_id == space_id
                    && candidate.sync_state == SyncState::Idle
                    && candidate.file_id.is_some()
                    && candidate.sha256.as_deref() == Some(sha.as_str())
                    && candidate.local_path.starts_with(&prefix)
                    && !space_root
                        .join(candidate.local_path.trim_start_matches(&prefix))
                        .exists()
            })
            .collect();
        if let [candidate] = candidates.as_slice() {
            let old_path = candidate.local_path.clone();
            let mut moved = candidate.clone();
            moved.local_path = local_rel.clone();
            moved.sha256 = Some(sha);
            moved.size_bytes = hashed_size as i64;
            moved.mtime = mtime;
            moved.sync_state = SyncState::PendingUpload;
            moved.last_error = None;
            moved.updated_at = now;
            db::delete_local_file(conn, &old_path)?;
            db::upsert_local_file(conn, &moved)?;
            let payload = serde_json::json!({
                "space_id": space_id,
                "file_id": moved.file_id,
                "old_local_path": old_path,
            })
            .to_string();
            let remote_path = format!("/{rel}");
            db::enqueue(
                conn,
                "move",
                Some(&local_rel),
                Some(&remote_path),
                Some(&payload),
            )?;
            report.modified += 1;
            report.queued += 1;
            return Ok(());
        }
    }

    if let Some(f) = &existing {
        if f.sha256.as_deref() == Some(sha.as_str()) {
            // Contenu identique, seules les métadonnées ont bougé → maj index sans upload.
            let mut f2 = f.clone();
            f2.size_bytes = hashed_size as i64;
            f2.mtime = mtime;
            f2.updated_at = now;
            db::upsert_local_file(conn, &f2)?;
            report.unchanged += 1;
            return Ok(());
        }
    }

    let is_new = existing.is_none();
    let base = existing;
    let f = LocalFile {
        local_path: local_rel.clone(),
        space_id: space_id.to_string(),
        // Conserver file_id/version connus : ils servent de base au serveur
        // pour détecter un conflit (base_file_id / base_version de l'intent).
        file_id: base.as_ref().and_then(|b| b.file_id.clone()),
        folder_id: base.as_ref().and_then(|b| b.folder_id.clone()),
        sha256: Some(sha),
        etag: base.as_ref().and_then(|b| b.etag.clone()),
        version: base.as_ref().map(|b| b.version).unwrap_or(0),
        size_bytes: hashed_size as i64,
        mtime,
        sync_state: SyncState::PendingUpload,
        // Un fichier réapparu sur disque n'est plus « évincé » ; l'épinglage
        // éventuel est conservé.
        pin_state: match base.as_ref().map(|b| b.pin_state) {
            Some(crate::models::PinState::Pinned) => crate::models::PinState::Pinned,
            _ => crate::models::PinState::Unpinned,
        },
        last_error: None,
        updated_at: now,
    };
    db::upsert_local_file(conn, &f)?;
    if is_new {
        report.new_files += 1;
    } else {
        report.modified += 1;
    }

    if !db::has_pending_op(conn, "upload", &local_rel)? {
        let payload = serde_json::json!({ "space_id": space_id }).to_string();
        let remote_path = format!("/{rel}");
        db::enqueue(
            conn,
            "upload",
            Some(&local_rel),
            Some(&remote_path),
            Some(&payload),
        )?;
        report.queued += 1;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::{get_local_file, next_op, open_in_memory};
    use std::fs;
    use tempfile::tempdir;

    const SPACE: &str = "11111111-1111-1111-1111-111111111111";
    const DIR: &str = "openpulse-general";

    #[test]
    fn new_file_is_indexed_and_queued_with_remote_path() {
        let root = tempdir().unwrap();
        fs::create_dir_all(root.path().join(DIR).join("Contrats")).unwrap();
        fs::write(
            root.path().join(DIR).join("Contrats/contrat.pdf"),
            b"pdf-bytes",
        )
        .unwrap();
        let conn = open_in_memory().unwrap();

        let report = scan_space(&conn, root.path(), DIR, SPACE).unwrap();
        assert_eq!(report.scanned, 1);
        assert_eq!(report.new_files, 1);
        assert_eq!(report.queued, 1);

        let f = get_local_file(&conn, "openpulse-general/Contrats/contrat.pdf")
            .unwrap()
            .unwrap();
        assert_eq!(f.sync_state, SyncState::PendingUpload);
        assert_eq!(f.space_id, SPACE);
        assert!(f.sha256.is_some());
        assert!(f.file_id.is_none());

        let op = next_op(&conn).unwrap().unwrap();
        assert_eq!(op.op_type, "upload");
        assert_eq!(
            op.local_path.as_deref(),
            Some("openpulse-general/Contrats/contrat.pdf")
        );
        assert_eq!(op.remote_path.as_deref(), Some("/Contrats/contrat.pdf"));
        let payload: serde_json::Value =
            serde_json::from_str(op.payload.as_deref().unwrap()).unwrap();
        assert_eq!(payload["space_id"], SPACE);
    }

    #[test]
    fn missing_space_dir_is_created_and_scan_is_empty() {
        let root = tempdir().unwrap();
        let conn = open_in_memory().unwrap();
        let report = scan_space(&conn, root.path(), DIR, SPACE).unwrap();
        assert_eq!(report.scanned, 0);
        assert!(root.path().join(DIR).is_dir());
    }

    #[test]
    fn unchanged_file_is_not_requeued() {
        let root = tempdir().unwrap();
        fs::create_dir_all(root.path().join(DIR)).unwrap();
        fs::write(root.path().join(DIR).join("a.txt"), b"hello").unwrap();
        let conn = open_in_memory().unwrap();

        scan_space(&conn, root.path(), DIR, SPACE).unwrap();
        let report2 = scan_space(&conn, root.path(), DIR, SPACE).unwrap();
        assert_eq!(report2.unchanged, 1);
        assert_eq!(report2.queued, 0);

        // Une seule op au total dans la queue.
        assert_eq!(db::queue_len(&conn).unwrap(), 1);
    }

    #[test]
    fn modified_file_is_detected_without_duplicate_op() {
        let root = tempdir().unwrap();
        fs::create_dir_all(root.path().join(DIR)).unwrap();
        let path = root.path().join(DIR).join("doc.txt");
        fs::write(&path, b"v1").unwrap();
        let conn = open_in_memory().unwrap();
        scan_space(&conn, root.path(), DIR, SPACE).unwrap();

        fs::write(&path, b"v2-contenu-different").unwrap();
        let report = scan_space(&conn, root.path(), DIR, SPACE).unwrap();
        assert_eq!(report.modified, 1);
        // L'op d'upload initiale est toujours en attente → pas de doublon.
        assert_eq!(report.queued, 0);

        let f = get_local_file(&conn, "openpulse-general/doc.txt")
            .unwrap()
            .unwrap();
        assert_eq!(f.sync_state, SyncState::PendingUpload);
        assert_eq!(f.size_bytes, 20);
    }

    #[test]
    fn touch_without_content_change_does_not_queue() {
        let root = tempdir().unwrap();
        fs::create_dir_all(root.path().join(DIR)).unwrap();
        let path = root.path().join(DIR).join("stable.txt");
        fs::write(&path, b"same-content").unwrap();
        let conn = open_in_memory().unwrap();
        scan_space(&conn, root.path(), DIR, SPACE).unwrap();
        // Simule un upload terminé : état idle + queue vidée.
        let mut f = get_local_file(&conn, "openpulse-general/stable.txt")
            .unwrap()
            .unwrap();
        f.sync_state = SyncState::Idle;
        // mtime décalé en base pour forcer la sortie du fast path.
        f.mtime -= 10;
        db::upsert_local_file(&conn, &f).unwrap();
        conn.execute("DELETE FROM sync_queue", []).unwrap();

        let report = scan_space(&conn, root.path(), DIR, SPACE).unwrap();
        assert_eq!(report.unchanged, 1);
        assert_eq!(report.queued, 0);
        let f2 = get_local_file(&conn, "openpulse-general/stable.txt")
            .unwrap()
            .unwrap();
        assert_eq!(f2.sync_state, SyncState::Idle); // pas repassé pending
    }

    #[test]
    fn ignores_temp_hidden_and_symlinks() {
        let root = tempdir().unwrap();
        let d = root.path().join(DIR);
        fs::create_dir_all(&d).unwrap();
        fs::write(d.join("~$rapport.docx"), b"x").unwrap();
        fs::write(d.join(".DS_Store"), b"x").unwrap();
        fs::write(d.join(".cache-file"), b"x").unwrap();
        fs::create_dir(d.join(".git")).unwrap();
        fs::write(d.join(".git/config"), b"x").unwrap();
        fs::write(d.join("ok.txt"), b"x").unwrap();
        #[cfg(unix)]
        std::os::unix::fs::symlink(d.join("ok.txt"), d.join("lien.txt")).unwrap();

        let conn = open_in_memory().unwrap();
        let report = scan_space(&conn, root.path(), DIR, SPACE).unwrap();
        assert_eq!(report.scanned, 1);
        assert_eq!(report.new_files, 1);
        assert!(report.ignored >= 4);
    }

    #[test]
    fn relative_path_uses_slashes() {
        let dir = tempdir().unwrap();
        let abs = dir.path().join("a").join("b").join("c.txt");
        assert_eq!(relative_slash_path(dir.path(), &abs).unwrap(), "a/b/c.txt");
    }

    #[test]
    fn missing_synced_file_enqueues_remote_delete() {
        let root = tempdir().unwrap();
        fs::create_dir_all(root.path().join(DIR)).unwrap();
        let conn = open_in_memory().unwrap();
        let record = LocalFile {
            local_path: "openpulse-general/supprime.txt".into(),
            space_id: SPACE.into(),
            file_id: Some("f-delete".into()),
            folder_id: None,
            sha256: Some("sha".into()),
            etag: None,
            version: 1,
            size_bytes: 1,
            mtime: 0,
            sync_state: SyncState::Idle,
            pin_state: crate::models::PinState::Unpinned,
            last_error: None,
            updated_at: db::now_epoch(),
        };
        db::upsert_local_file(&conn, &record).unwrap();
        let report = scan_space(&conn, root.path(), DIR, SPACE).unwrap();
        assert_eq!(report.queued, 1);
        let op = db::next_op(&conn).unwrap().unwrap();
        assert_eq!(op.op_type, "delete");
        assert!(op.payload.unwrap().contains("f-delete"));
    }

    #[test]
    fn pull_written_file_is_seen_unchanged_by_scanner() {
        // Interop pull → push : un fichier téléchargé (index idle, sha connu)
        // ne doit pas être re-poussé.
        let root = tempdir().unwrap();
        let d = root.path().join(DIR);
        fs::create_dir_all(&d).unwrap();
        let abs = d.join("recu.txt");
        fs::write(&abs, b"contenu-distant").unwrap();
        let meta = fs::metadata(&abs).unwrap();

        let conn = open_in_memory().unwrap();
        let record = LocalFile {
            local_path: "openpulse-general/recu.txt".into(),
            space_id: SPACE.into(),
            file_id: Some("f-remote".into()),
            folder_id: None,
            sha256: Some(crate::hashing::sha256_hex(b"contenu-distant")),
            etag: Some("\"e1\"".into()),
            version: 4,
            size_bytes: meta.len() as i64,
            mtime: super::mtime_epoch(&meta),
            sync_state: SyncState::Idle,
            pin_state: crate::models::PinState::Unpinned,
            last_error: None,
            updated_at: db::now_epoch(),
        };
        db::upsert_local_file(&conn, &record).unwrap();

        let report = scan_space(&conn, root.path(), DIR, SPACE).unwrap();
        assert_eq!(report.unchanged, 1);
        assert_eq!(report.queued, 0);
    }
}
