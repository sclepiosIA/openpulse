//! Push worker : draine la `sync_queue` et pousse les fichiers locaux vers
//! l'API Drive Azure — `POST /api/drive/upload-intent` → `PUT` Blob (SAS) →
//! `POST /api/drive/upload-complete` (flux validé E2E côté web, plan §2.1).
//!
//! Conventions de chemins (partagées avec le scanner/pull) :
//! - `op.local_path`  : clé d'index = `{space_dir}/{rel}`, aussi chemin disque
//!   relatif au sync root (séparateur `/`) ;
//! - `op.remote_path` : chemin serveur = `/{rel}` (sans le dossier d'espace).
//!
//! Le worker est découplé du HTTP réel via le trait [`DriveTransport`] :
//! l'implémentation reqwest vit dans `src-tauri` (elle a besoin du token
//! Supabase en mémoire), les tests utilisent un transport factice.

use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::path::{Path, PathBuf};

use crate::db;
use crate::hashing;
use crate::models::{QueueOp, SyncState};
use crate::{Result, SyncCoreError};

/// Nombre d'échecs consécutifs avant abandon (état `error`, op retirée).
pub const MAX_RETRIES: i64 = 8;

// ---------------------------------------------------------------------------
// Types API (miroir de src/lib/drive/types.ts côté web)
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize)]
pub struct UploadIntentRequest {
    pub space_id: String,
    /// Chemin serveur (commence par `/`).
    pub path: String,
    pub size_bytes: i64,
    pub sha256: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub content_type: Option<String>,
    /// Base connue par ce poste : permet au serveur de détecter un conflit.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub base_file_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub base_version: Option<i64>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct UploadIntentResponse {
    /// `upload` | `noop` | `conflict`
    pub action: String,
    pub upload_url: Option<String>,
    #[serde(default)]
    pub upload_token: Option<String>,
    pub file_id: String,
    pub version: i64,
    #[serde(default)]
    pub conflict: bool,
    #[serde(default)]
    pub conflict_reason: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct UploadCompleteRequest {
    pub upload_token: String,
    pub file_id: String,
    pub version: i64,
    pub sha256: String,
    pub size_bytes: i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub etag: Option<String>,
}

/// Erreur de transport : `retryable` pilote le backoff (réseau/5xx → retry,
/// 4xx logique → abandon immédiat). `auth_rejected` conserve la queue sans
/// consommer le budget de retry afin qu'un token neuf reprenne le drain.
#[derive(Debug)]
pub struct TransportError {
    pub message: String,
    pub retryable: bool,
    pub auth_rejected: bool,
}

impl TransportError {
    pub fn retryable(message: impl Into<String>) -> Self {
        Self {
            message: message.into(),
            retryable: true,
            auth_rejected: false,
        }
    }
    pub fn fatal(message: impl Into<String>) -> Self {
        Self {
            message: message.into(),
            retryable: false,
            auth_rejected: false,
        }
    }
    pub fn auth_rejected(message: impl Into<String>) -> Self {
        Self {
            message: message.into(),
            retryable: true,
            auth_rejected: true,
        }
    }
}

/// Abstraction du triplet intent / PUT Blob / complete.
pub trait DriveTransport {
    fn upload_intent(
        &self,
        req: &UploadIntentRequest,
    ) -> std::result::Result<UploadIntentResponse, TransportError>;

    /// PUT du fichier vers l'URL SAS Azure (`x-ms-blob-type: BlockBlob`).
    /// Retourne l'ETag Azure si présent.
    fn put_blob(
        &self,
        upload_url: &str,
        content_type: &str,
        file_path: &Path,
    ) -> std::result::Result<Option<String>, TransportError>;

    fn upload_complete(
        &self,
        req: &UploadCompleteRequest,
    ) -> std::result::Result<(), TransportError>;

    fn delete_file(&self, _file_id: &str) -> std::result::Result<(), TransportError> {
        Err(TransportError::fatal("suppression distante non supportée"))
    }

    fn move_file(&self, _file_id: &str, _path: &str) -> std::result::Result<(), TransportError> {
        Err(TransportError::fatal("déplacement distant non supporté"))
    }
}

// ---------------------------------------------------------------------------
// Traitement de la queue
// ---------------------------------------------------------------------------

/// Issue du traitement d'une opération.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum PushOutcome {
    Uploaded,
    Noop,
    Conflict,
    /// Fichier local disparu entre le scan et l'upload → op abandonnée.
    LocalFileGone,
    Deleted,
    Moved,
    /// Échec replanifié (backoff).
    Rescheduled,
    /// JWT Drive rejeté : opération conservée sans consommer le budget de retry.
    AuthRejected,
    /// Échec définitif (max retries ou erreur non-retryable).
    Failed,
}

/// Bilan d'une passe de drain (affichable dans l'UI).
#[derive(Debug, Default, Clone, Serialize)]
pub struct PushReport {
    pub processed: u64,
    pub uploaded: u64,
    pub noop: u64,
    pub conflicts: u64,
    pub rescheduled: u64,
    pub failed: u64,
    pub deleted: u64,
    pub moved: u64,
    pub errors: Vec<String>,
}

/// Type MIME grossier d'après l'extension (suffisant pour le lot 1).
pub fn guess_content_type(path: &str) -> &'static str {
    let ext = path.rsplit('.').next().unwrap_or("").to_ascii_lowercase();
    match ext.as_str() {
        "pdf" => "application/pdf",
        "doc" => "application/msword",
        "docx" => "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "xls" => "application/vnd.ms-excel",
        "xlsx" => "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "ppt" => "application/vnd.ms-powerpoint",
        "pptx" => "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "gif" => "image/gif",
        "txt" => "text/plain",
        "md" => "text/markdown",
        "csv" => "text/csv",
        "json" => "application/json",
        "zip" => "application/zip",
        _ => "application/octet-stream",
    }
}

/// Chemin absolu plateforme depuis un chemin relatif `/`.
fn to_abs_path(root: &Path, rel: &str) -> PathBuf {
    let mut p = root.to_path_buf();
    for seg in rel.split('/').filter(|s| !s.is_empty()) {
        p.push(seg);
    }
    p
}

/// Draine jusqu'à `max_ops` opérations `upload` éligibles. Les autres types
/// d'op (download…) sont replanifiés sans erreur (workers dédiés à venir).
pub fn run_queue_once(
    conn: &Connection,
    sync_root: &Path,
    transport: &dyn DriveTransport,
    max_ops: u64,
) -> Result<PushReport> {
    run_queue_once_filtered(conn, sync_root, transport, max_ops, None)
}

pub fn run_queue_once_for_spaces(
    conn: &Connection,
    sync_root: &Path,
    transport: &dyn DriveTransport,
    max_ops: u64,
    allowed_space_ids: &HashSet<String>,
) -> Result<PushReport> {
    run_queue_once_filtered(conn, sync_root, transport, max_ops, Some(allowed_space_ids))
}

fn run_queue_once_filtered(
    conn: &Connection,
    sync_root: &Path,
    transport: &dyn DriveTransport,
    max_ops: u64,
    allowed_space_ids: Option<&HashSet<String>>,
) -> Result<PushReport> {
    let mut report = PushReport::default();
    let inspection_budget = db::queue_len(conn)?.max(0) as u64;
    let mut inspected = 0_u64;
    while report.processed < max_ops && inspected < inspection_budget {
        let Some(op) = db::next_op(conn)? else { break };
        inspected += 1;
        if let Some(allowed) = allowed_space_ids {
            let space_id = op.payload.as_deref().and_then(|payload| {
                serde_json::from_str::<serde_json::Value>(payload)
                    .ok()
                    .and_then(|value| value.get("space_id")?.as_str().map(str::to_string))
            });
            if space_id
                .as_ref()
                .is_none_or(|space_id| !allowed.contains(space_id))
            {
                db::defer_op(conn, op.id, 60)?;
                report.rescheduled += 1;
                continue;
            }
        }
        if op.op_type != "upload" && op.op_type != "delete" && op.op_type != "move" {
            db::reschedule_op(conn, op.id)?;
            continue;
        }
        report.processed += 1;
        let outcome = match op.op_type.as_str() {
            "delete" => process_delete_op(conn, &op, transport),
            "move" => process_move_op(conn, &op, transport),
            _ => process_upload_op(conn, sync_root, &op, transport),
        };
        match outcome {
            Ok(PushOutcome::Uploaded) => report.uploaded += 1,
            Ok(PushOutcome::Noop) => report.noop += 1,
            Ok(PushOutcome::Conflict) => {
                report.conflicts += 1;
                push_last_error_into_report(conn, &op, "conflit", &mut report);
            }
            Ok(PushOutcome::LocalFileGone) => {}
            Ok(PushOutcome::Deleted) => report.deleted += 1,
            Ok(PushOutcome::Moved) => report.moved += 1,
            Ok(PushOutcome::AuthRejected) => {
                report.rescheduled += 1;
                report
                    .errors
                    .push("DRIVE_AUTH_REJECTED: drain interrompu".into());
                break;
            }
            Ok(PushOutcome::Rescheduled) => {
                report.rescheduled += 1;
                push_last_error_into_report(conn, &op, "nouvel essai planifié", &mut report);
            }
            Ok(PushOutcome::Failed) => {
                report.failed += 1;
                push_last_error_into_report(conn, &op, "échec", &mut report);
            }
            Err(e) => {
                report.failed += 1;
                report.errors.push(e.to_string());
                // Plafonner aussi les erreurs internes : sans ce garde-fou une
                // op malformée (payload sans space_id…) était replanifiée à
                // l'infini (toutes les 15 min après le cap de backoff).
                if op.retry_count + 1 >= MAX_RETRIES {
                    db::complete_op(conn, op.id)?;
                } else {
                    db::reschedule_op(conn, op.id)?;
                }
            }
        }
    }
    Ok(report)
}

fn process_move_op(
    conn: &Connection,
    op: &QueueOp,
    transport: &dyn DriveTransport,
) -> Result<PushOutcome> {
    let payload = op
        .payload
        .as_deref()
        .and_then(|raw| serde_json::from_str::<serde_json::Value>(raw).ok())
        .ok_or_else(|| SyncCoreError::InvalidConfig("op move sans payload".into()))?;
    let file_id = payload
        .get("file_id")
        .and_then(|value| value.as_str())
        .ok_or_else(|| SyncCoreError::InvalidConfig("op move sans file_id".into()))?;
    let remote_path = op
        .remote_path
        .as_deref()
        .ok_or_else(|| SyncCoreError::InvalidConfig("op move sans remote_path".into()))?;
    match transport.move_file(file_id, remote_path) {
        Ok(()) => {
            if let Some(path) = op.local_path.as_deref() {
                if let Some(mut local) = db::get_local_file(conn, path)? {
                    local.sync_state = SyncState::Idle;
                    local.last_error = None;
                    local.updated_at = db::now_epoch();
                    db::upsert_local_file(conn, &local)?;
                }
            }
            db::complete_op(conn, op.id)?;
            Ok(PushOutcome::Moved)
        }
        Err(error) if error.auth_rejected => {
            db::defer_op(conn, op.id, 1)?;
            Ok(PushOutcome::AuthRejected)
        }
        Err(error) if !error.retryable || op.retry_count + 1 >= MAX_RETRIES => {
            db::complete_op(conn, op.id)?;
            Ok(PushOutcome::Failed)
        }
        Err(_) => {
            db::reschedule_op(conn, op.id)?;
            Ok(PushOutcome::Rescheduled)
        }
    }
}

fn process_delete_op(
    conn: &Connection,
    op: &QueueOp,
    transport: &dyn DriveTransport,
) -> Result<PushOutcome> {
    let payload = op
        .payload
        .as_deref()
        .and_then(|raw| serde_json::from_str::<serde_json::Value>(raw).ok())
        .ok_or_else(|| SyncCoreError::InvalidConfig("op delete sans payload".into()))?;
    let file_id = payload
        .get("file_id")
        .and_then(|v| v.as_str())
        .ok_or_else(|| SyncCoreError::InvalidConfig("op delete sans file_id".into()))?;
    match transport.delete_file(file_id) {
        Ok(()) => {
            if let Some(path) = op.local_path.as_deref() {
                db::delete_local_file(conn, path)?;
            }
            db::complete_op(conn, op.id)?;
            Ok(PushOutcome::Deleted)
        }
        Err(error) if error.auth_rejected => {
            db::defer_op(conn, op.id, 1)?;
            Ok(PushOutcome::AuthRejected)
        }
        Err(error) if !error.retryable || op.retry_count + 1 >= MAX_RETRIES => {
            db::complete_op(conn, op.id)?;
            Ok(PushOutcome::Failed)
        }
        Err(_) => {
            db::reschedule_op(conn, op.id)?;
            Ok(PushOutcome::Rescheduled)
        }
    }
}

/// Remonte le `last_error` du fichier dans le bilan (affiché par l'UI Statut).
/// Sans cela, un cycle avec uniquement des échecs/conflits laissait
/// `report.errors` vide → aucune explication visible côté utilisateur.
fn push_last_error_into_report(
    conn: &Connection,
    op: &QueueOp,
    kind: &str,
    report: &mut PushReport,
) {
    let Some(local_rel) = op.local_path.as_deref() else {
        return;
    };
    if let Ok(Some(f)) = db::get_local_file(conn, local_rel) {
        if let Some(err) = f.last_error {
            report.errors.push(format!("[{kind}] {local_rel} : {err}"));
        }
    }
}

/// Traite une opération `upload` : re-hash → intent → PUT Blob → complete →
/// maj index. Toute erreur de transport passe par le backoff de la queue.
pub fn process_upload_op(
    conn: &Connection,
    sync_root: &Path,
    op: &QueueOp,
    transport: &dyn DriveTransport,
) -> Result<PushOutcome> {
    let local_rel = op
        .local_path
        .as_deref()
        .ok_or_else(|| SyncCoreError::InvalidConfig("op upload sans local_path".into()))?;
    // `local_rel` = "{space_dir}/{rel}" ; le chemin serveur est "/{rel}"
    // (sans le dossier d'espace). L'ancien fallback "/{local_rel}" envoyait
    // le préfixe d'espace au serveur → fichier créé au mauvais chemin.
    let remote_path = match op.remote_path.clone() {
        Some(p) => p,
        None => match local_rel.split_once('/') {
            Some((_space_dir, rel)) if !rel.is_empty() => format!("/{rel}"),
            _ => {
                return Err(SyncCoreError::InvalidConfig(format!(
                    "op upload sans remote_path dérivable : {local_rel}"
                )))
            }
        },
    };
    let space_id = op
        .payload
        .as_deref()
        .and_then(|p| serde_json::from_str::<serde_json::Value>(p).ok())
        .and_then(|v| {
            v.get("space_id")
                .and_then(|s| s.as_str().map(str::to_string))
        })
        .ok_or_else(|| SyncCoreError::InvalidConfig("op upload sans space_id".into()))?;

    let abs = to_abs_path(sync_root, local_rel);
    if !abs.is_file() {
        // Fichier supprimé/déplacé entre le scan et l'upload : on abandonne
        // l'op et on retire l'entrée d'index (la propagation des suppressions
        // est hors périmètre du lot 1).
        conn.execute(
            "DELETE FROM local_files WHERE local_path = ?1",
            rusqlite::params![local_rel],
        )?;
        db::complete_op(conn, op.id)?;
        return Ok(PushOutcome::LocalFileGone);
    }

    // Re-hash au moment de l'upload : le contenu peut avoir changé depuis le scan.
    let (sha, size) = hashing::sha256_file(&abs)?;
    let mut local = db::get_local_file(conn, local_rel)?.unwrap_or(crate::models::LocalFile {
        local_path: local_rel.to_string(),
        space_id: space_id.clone(),
        file_id: None,
        folder_id: None,
        sha256: None,
        etag: None,
        version: 0,
        size_bytes: 0,
        mtime: 0,
        sync_state: SyncState::PendingUpload,
        pin_state: crate::models::PinState::Unpinned,
        last_error: None,
        updated_at: 0,
    });

    local.sync_state = SyncState::Uploading;
    local.sha256 = Some(sha.clone());
    local.size_bytes = size as i64;
    local.updated_at = db::now_epoch();
    db::upsert_local_file(conn, &local)?;

    let content_type = guess_content_type(local_rel).to_string();
    let intent_req = UploadIntentRequest {
        space_id,
        path: remote_path,
        size_bytes: size as i64,
        sha256: sha.clone(),
        content_type: Some(content_type.clone()),
        base_file_id: local.file_id.clone(),
        base_version: if local.file_id.is_some() {
            Some(local.version)
        } else {
            None
        },
    };

    let intent = match transport.upload_intent(&intent_req) {
        Ok(r) => r,
        Err(e) => return handle_transport_failure(conn, op, &mut local, e),
    };

    if intent.action == "conflict" || intent.conflict {
        // Lot 1 : jamais d'écrasement silencieux — on marque le conflit et on
        // retire l'op ; la résolution (copie de conflit) arrive au lot suivant.
        local.sync_state = SyncState::Conflict;
        local.last_error = intent.conflict_reason.clone();
        local.updated_at = db::now_epoch();
        db::upsert_local_file(conn, &local)?;
        db::complete_op(conn, op.id)?;
        return Ok(PushOutcome::Conflict);
    }

    if intent.action == "noop" {
        // Le serveur connaît déjà ce contenu.
        local.file_id = Some(intent.file_id);
        local.version = intent.version;
        local.sync_state = SyncState::Idle;
        local.last_error = None;
        local.updated_at = db::now_epoch();
        db::upsert_local_file(conn, &local)?;
        db::complete_op(conn, op.id)?;
        return Ok(PushOutcome::Noop);
    }

    let (Some(upload_url), Some(upload_token)) =
        (intent.upload_url.clone(), intent.upload_token.clone())
    else {
        return handle_transport_failure(
            conn,
            op,
            &mut local,
            TransportError::fatal(
                "intention d'upload incomplète (upload_url/upload_token manquant)",
            ),
        );
    };

    let etag = match transport.put_blob(&upload_url, &content_type, &abs) {
        Ok(etag) => etag,
        Err(e) => return handle_transport_failure(conn, op, &mut local, e),
    };

    let complete_req = UploadCompleteRequest {
        upload_token,
        file_id: intent.file_id.clone(),
        version: intent.version,
        sha256: sha,
        size_bytes: size as i64,
        etag: etag.clone(),
    };
    if let Err(e) = transport.upload_complete(&complete_req) {
        return handle_transport_failure(conn, op, &mut local, e);
    }

    local.file_id = Some(intent.file_id);
    local.version = intent.version;
    local.etag = etag;
    local.sync_state = SyncState::Idle;
    local.last_error = None;
    local.updated_at = db::now_epoch();
    db::upsert_local_file(conn, &local)?;
    db::complete_op(conn, op.id)?;
    Ok(PushOutcome::Uploaded)
}

/// Échec transport : replanifie (backoff) ou abandonne selon `retryable`
/// et le nombre de tentatives déjà effectuées.
fn handle_transport_failure(
    conn: &Connection,
    op: &QueueOp,
    local: &mut crate::models::LocalFile,
    err: TransportError,
) -> Result<PushOutcome> {
    if err.auth_rejected {
        local.sync_state = SyncState::PendingUpload;
        local.last_error = Some(err.message);
        local.updated_at = db::now_epoch();
        db::upsert_local_file(conn, local)?;
        db::defer_op(conn, op.id, 1)?;
        return Ok(PushOutcome::AuthRejected);
    }
    let give_up = !err.retryable || op.retry_count + 1 >= MAX_RETRIES;
    if give_up {
        local.sync_state = SyncState::Error;
        local.last_error = Some(err.message);
        local.updated_at = db::now_epoch();
        db::upsert_local_file(conn, local)?;
        db::complete_op(conn, op.id)?;
        Ok(PushOutcome::Failed)
    } else {
        local.sync_state = SyncState::PendingUpload;
        local.last_error = Some(err.message);
        local.updated_at = db::now_epoch();
        db::upsert_local_file(conn, local)?;
        db::reschedule_op(conn, op.id)?;
        Ok(PushOutcome::Rescheduled)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::open_in_memory;
    use crate::scanner::scan_space;
    use std::cell::RefCell;
    use std::fs;
    use tempfile::tempdir;

    const SPACE: &str = "11111111-1111-1111-1111-111111111111";
    const DIR: &str = "openpulse-general";

    /// Transport factice scriptable : émule l'API Drive + Azure Blob.
    #[derive(Default)]
    struct FakeTransport {
        intents: RefCell<Vec<UploadIntentRequest>>,
        puts: RefCell<Vec<(String, String)>>, // (url, content_type)
        completes: RefCell<Vec<UploadCompleteRequest>>,
        deletes: RefCell<Vec<String>>,
        moves: RefCell<Vec<(String, String)>>,
        intent_action: RefCell<String>,
        fail_intent: RefCell<Option<TransportError>>,
        fail_put: RefCell<bool>,
    }

    impl FakeTransport {
        fn new() -> Self {
            let t = Self::default();
            *t.intent_action.borrow_mut() = "upload".to_string();
            t
        }
    }

    impl DriveTransport for FakeTransport {
        fn upload_intent(
            &self,
            req: &UploadIntentRequest,
        ) -> std::result::Result<UploadIntentResponse, TransportError> {
            if let Some(e) = self.fail_intent.borrow_mut().take() {
                return Err(e);
            }
            self.intents.borrow_mut().push(req.clone());
            let action = self.intent_action.borrow().clone();
            Ok(UploadIntentResponse {
                conflict: action == "conflict",
                conflict_reason: (action == "conflict")
                    .then(|| "version distante plus récente".to_string()),
                upload_url: (action == "upload").then(|| "https://blob.local/sas".to_string()),
                upload_token: (action == "upload").then(|| "tok-123".to_string()),
                file_id: "file-uuid-1".to_string(),
                version: 2,
                action,
            })
        }

        fn put_blob(
            &self,
            upload_url: &str,
            content_type: &str,
            file_path: &Path,
        ) -> std::result::Result<Option<String>, TransportError> {
            if *self.fail_put.borrow() {
                return Err(TransportError::retryable("réseau indisponible"));
            }
            assert!(file_path.is_file());
            self.puts
                .borrow_mut()
                .push((upload_url.to_string(), content_type.to_string()));
            Ok(Some("\"0xETAG\"".to_string()))
        }

        fn upload_complete(
            &self,
            req: &UploadCompleteRequest,
        ) -> std::result::Result<(), TransportError> {
            self.completes.borrow_mut().push(req.clone());
            Ok(())
        }

        fn delete_file(&self, file_id: &str) -> std::result::Result<(), TransportError> {
            self.deletes.borrow_mut().push(file_id.to_string());
            Ok(())
        }

        fn move_file(&self, file_id: &str, path: &str) -> std::result::Result<(), TransportError> {
            self.moves
                .borrow_mut()
                .push((file_id.to_string(), path.to_string()));
            Ok(())
        }
    }

    fn setup_one_file(content: &[u8]) -> (tempfile::TempDir, Connection) {
        let root = tempdir().unwrap();
        fs::create_dir_all(root.path().join(DIR)).unwrap();
        fs::write(root.path().join(DIR).join("rapport.pdf"), content).unwrap();
        let conn = open_in_memory().unwrap();
        scan_space(&conn, root.path(), DIR, SPACE).unwrap();
        (root, conn)
    }

    #[test]
    fn happy_path_intent_put_complete_updates_index() {
        let (root, conn) = setup_one_file(b"%PDF-fake");
        let t = FakeTransport::new();

        let report = run_queue_once(&conn, root.path(), &t, 10).unwrap();
        assert_eq!(report.uploaded, 1);
        assert_eq!(report.failed, 0);

        // Intent : chemin serveur sans le dossier d'espace, sha/type corrects.
        let intents = t.intents.borrow();
        assert_eq!(intents.len(), 1);
        assert_eq!(intents[0].path, "/rapport.pdf");
        assert_eq!(intents[0].space_id, SPACE);
        assert_eq!(intents[0].content_type.as_deref(), Some("application/pdf"));
        assert_eq!(intents[0].sha256, crate::hashing::sha256_hex(b"%PDF-fake"));
        assert!(intents[0].base_file_id.is_none()); // premier upload

        // PUT SAS effectué, complete envoyé avec le token.
        assert_eq!(t.puts.borrow().len(), 1);
        let completes = t.completes.borrow();
        assert_eq!(completes[0].upload_token, "tok-123");
        assert_eq!(completes[0].file_id, "file-uuid-1");

        // Index : idle, file_id/version/etag serveur, queue vide.
        let f = db::get_local_file(&conn, "openpulse-general/rapport.pdf")
            .unwrap()
            .unwrap();
        assert_eq!(f.sync_state, SyncState::Idle);
        assert_eq!(f.file_id.as_deref(), Some("file-uuid-1"));
        assert_eq!(f.version, 2);
        assert_eq!(f.etag.as_deref(), Some("\"0xETAG\""));
        assert_eq!(db::queue_len(&conn).unwrap(), 0);
    }

    #[test]
    fn missing_synced_file_is_deleted_remotely_and_removed_from_index() {
        let (root, conn) = setup_one_file(b"v1");
        let t = FakeTransport::new();
        run_queue_once(&conn, root.path(), &t, 10).unwrap();
        fs::remove_file(root.path().join(DIR).join("rapport.pdf")).unwrap();
        scan_space(&conn, root.path(), DIR, SPACE).unwrap();
        let report = run_queue_once(&conn, root.path(), &t, 10).unwrap();
        assert_eq!(report.deleted, 1);
        assert_eq!(t.deletes.borrow().as_slice(), ["file-uuid-1"]);
        assert!(db::get_local_file(&conn, "openpulse-general/rapport.pdf")
            .unwrap()
            .is_none());
    }

    #[test]
    fn local_rename_preserves_remote_identity_and_calls_move_endpoint() {
        let (root, conn) = setup_one_file(b"same-content");
        let transport = FakeTransport::new();
        run_queue_once(&conn, root.path(), &transport, 10).unwrap();
        fs::rename(
            root.path().join(DIR).join("rapport.pdf"),
            root.path().join(DIR).join("archive.pdf"),
        )
        .unwrap();

        let scan = scan_space(&conn, root.path(), DIR, SPACE).unwrap();
        assert_eq!(scan.queued, 1);
        let report = run_queue_once(&conn, root.path(), &transport, 10).unwrap();
        assert_eq!(report.moved, 1);
        assert_eq!(
            transport.moves.borrow().as_slice(),
            &[("file-uuid-1".to_string(), "/archive.pdf".to_string())]
        );
        assert!(db::get_local_file(&conn, "openpulse-general/rapport.pdf")
            .unwrap()
            .is_none());
        let moved = db::get_local_file(&conn, "openpulse-general/archive.pdf")
            .unwrap()
            .unwrap();
        assert_eq!(moved.file_id.as_deref(), Some("file-uuid-1"));
        assert_eq!(moved.sync_state, SyncState::Idle);
    }

    #[test]
    fn second_upload_sends_base_version_for_conflict_detection() {
        let (root, conn) = setup_one_file(b"v1");
        let t = FakeTransport::new();
        run_queue_once(&conn, root.path(), &t, 10).unwrap();

        // Modification locale → re-scan → nouvelle op.
        fs::write(
            root.path().join(DIR).join("rapport.pdf"),
            b"v2-nouveau-contenu",
        )
        .unwrap();
        scan_space(&conn, root.path(), DIR, SPACE).unwrap();
        run_queue_once(&conn, root.path(), &t, 10).unwrap();

        let intents = t.intents.borrow();
        assert_eq!(intents.len(), 2);
        assert_eq!(intents[1].base_file_id.as_deref(), Some("file-uuid-1"));
        assert_eq!(intents[1].base_version, Some(2));
    }

    #[test]
    fn conflict_marks_file_and_drops_op() {
        let (root, conn) = setup_one_file(b"contenu");
        let t = FakeTransport::new();
        *t.intent_action.borrow_mut() = "conflict".to_string();

        let report = run_queue_once(&conn, root.path(), &t, 10).unwrap();
        assert_eq!(report.conflicts, 1);
        let f = db::get_local_file(&conn, "openpulse-general/rapport.pdf")
            .unwrap()
            .unwrap();
        assert_eq!(f.sync_state, SyncState::Conflict);
        assert!(f
            .last_error
            .as_deref()
            .unwrap()
            .contains("version distante"));
        assert_eq!(db::queue_len(&conn).unwrap(), 0);
        assert!(t.puts.borrow().is_empty()); // pas de PUT en cas de conflit
    }

    #[test]
    fn noop_completes_without_put() {
        let (root, conn) = setup_one_file(b"deja-connu");
        let t = FakeTransport::new();
        *t.intent_action.borrow_mut() = "noop".to_string();

        let report = run_queue_once(&conn, root.path(), &t, 10).unwrap();
        assert_eq!(report.noop, 1);
        let f = db::get_local_file(&conn, "openpulse-general/rapport.pdf")
            .unwrap()
            .unwrap();
        assert_eq!(f.sync_state, SyncState::Idle);
        assert_eq!(f.file_id.as_deref(), Some("file-uuid-1"));
        assert!(t.puts.borrow().is_empty());
        assert!(t.completes.borrow().is_empty());
    }

    #[test]
    fn filtered_drain_never_submits_an_unauthorized_space() {
        let (root, conn) = setup_one_file(b"x");
        let transport = FakeTransport::new();
        let report =
            run_queue_once_for_spaces(&conn, root.path(), &transport, 10, &HashSet::new()).unwrap();

        assert_eq!(report.rescheduled, 1);
        assert_eq!(db::queue_len(&conn).unwrap(), 1);
        assert!(transport.intents.borrow().is_empty());
        let retry_count: i64 = conn
            .query_row("SELECT retry_count FROM sync_queue LIMIT 1", [], |row| {
                row.get(0)
            })
            .unwrap();
        assert_eq!(retry_count, 0);
    }

    #[test]
    fn unauthorized_entries_do_not_starve_later_authorized_work() {
        let root = tempdir().unwrap();
        fs::create_dir_all(root.path().join(DIR)).unwrap();
        fs::write(root.path().join(DIR).join("rapport.pdf"), b"x").unwrap();
        let conn = open_in_memory().unwrap();
        for index in 0..500 {
            db::enqueue(
                &conn,
                "upload",
                Some(&format!("revoked/{index}.pdf")),
                Some(&format!("/{index}.pdf")),
                Some(&serde_json::json!({ "space_id": "revoked" }).to_string()),
            )
            .unwrap();
        }
        scan_space(&conn, root.path(), DIR, SPACE).unwrap();
        let transport = FakeTransport::new();
        let allowed = HashSet::from([SPACE.to_string()]);

        let report =
            run_queue_once_for_spaces(&conn, root.path(), &transport, 500, &allowed).unwrap();

        assert_eq!(report.uploaded, 1);
        assert_eq!(report.rescheduled, 500);
        assert_eq!(transport.intents.borrow().len(), 1);
        assert_eq!(db::queue_len(&conn).unwrap(), 500);
    }

    #[test]
    fn unsupported_unauthorized_op_does_not_consume_retry_budget() {
        let conn = open_in_memory().unwrap();
        db::enqueue(
            &conn,
            "download",
            None,
            None,
            Some(&serde_json::json!({ "space_id": "revoked" }).to_string()),
        )
        .unwrap();
        let root = tempdir().unwrap();
        let transport = FakeTransport::new();

        let report =
            run_queue_once_for_spaces(&conn, root.path(), &transport, 10, &HashSet::new()).unwrap();

        assert_eq!(report.rescheduled, 1);
        let retry_count: i64 = conn
            .query_row("SELECT retry_count FROM sync_queue", [], |row| row.get(0))
            .unwrap();
        assert_eq!(retry_count, 0);
    }

    #[test]
    fn retryable_failure_reschedules_with_backoff() {
        let (root, conn) = setup_one_file(b"x");
        let t = FakeTransport::new();
        *t.fail_put.borrow_mut() = true;

        let report = run_queue_once(&conn, root.path(), &t, 10).unwrap();
        assert_eq!(report.rescheduled, 1);

        // Op toujours en queue, replanifiée dans le futur, retry_count = 1.
        assert_eq!(db::queue_len(&conn).unwrap(), 1);
        assert!(db::next_op(&conn).unwrap().is_none()); // pas éligible tout de suite
        let f = db::get_local_file(&conn, "openpulse-general/rapport.pdf")
            .unwrap()
            .unwrap();
        assert_eq!(f.sync_state, SyncState::PendingUpload);
        assert!(f.last_error.as_deref().unwrap().contains("réseau"));
    }

    #[test]
    fn auth_rejection_never_consumes_retry_budget_or_drops_queue_item() {
        let (root, conn) = setup_one_file(b"x");
        conn.execute(
            "UPDATE sync_queue SET retry_count = ?1",
            rusqlite::params![MAX_RETRIES - 1],
        )
        .unwrap();
        let t = FakeTransport::new();
        *t.fail_intent.borrow_mut() = Some(TransportError::auth_rejected(
            "DRIVE_AUTH_REJECTED: upload-intent refusé",
        ));

        let report = run_queue_once(&conn, root.path(), &t, 10).unwrap();
        assert_eq!(report.rescheduled, 1);
        assert_eq!(report.failed, 0);
        assert!(report
            .errors
            .iter()
            .any(|error| error.contains("DRIVE_AUTH_REJECTED")));
        assert_eq!(db::queue_len(&conn).unwrap(), 1);
        let retry_count: i64 = conn
            .query_row("SELECT retry_count FROM sync_queue LIMIT 1", [], |row| {
                row.get(0)
            })
            .unwrap();
        assert_eq!(retry_count, MAX_RETRIES - 1);
    }

    #[test]
    fn fatal_failure_gives_up_immediately() {
        let (root, conn) = setup_one_file(b"x");
        let t = FakeTransport::new();
        *t.fail_intent.borrow_mut() = Some(TransportError::fatal("HTTP 403 : espace non autorisé"));

        let report = run_queue_once(&conn, root.path(), &t, 10).unwrap();
        assert_eq!(report.failed, 1);
        assert_eq!(db::queue_len(&conn).unwrap(), 0);
        let f = db::get_local_file(&conn, "openpulse-general/rapport.pdf")
            .unwrap()
            .unwrap();
        assert_eq!(f.sync_state, SyncState::Error);
        assert!(f.last_error.as_deref().unwrap().contains("403"));
    }

    #[test]
    fn local_file_gone_drops_op_and_index_row() {
        let (root, conn) = setup_one_file(b"x");
        fs::remove_file(root.path().join(DIR).join("rapport.pdf")).unwrap();
        let t = FakeTransport::new();

        let report = run_queue_once(&conn, root.path(), &t, 10).unwrap();
        assert_eq!(report.uploaded, 0);
        assert_eq!(db::queue_len(&conn).unwrap(), 0);
        assert!(db::get_local_file(&conn, "openpulse-general/rapport.pdf")
            .unwrap()
            .is_none());
        assert!(t.intents.borrow().is_empty());
    }

    #[test]
    fn content_type_guessing() {
        assert_eq!(guess_content_type("a/b/rapport.PDF"), "application/pdf");
        assert_eq!(
            guess_content_type("liasse.docx"),
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        );
        assert_eq!(
            guess_content_type("sans-extension"),
            "application/octet-stream"
        );
    }
}
