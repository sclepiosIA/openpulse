//! Push sync — premier lot (plan §2.2 étapes 6-7, mode scan manuel) :
//! scan du dossier local → queue SQLite → upload-intent → PUT Blob SAS →
//! upload-complete. Le watcher `notify` remplacera le scan au lot suivant.
//!
//! Toute la logique testable (scan, hachage, décisions, queue/retry) vit dans
//! `sync_core::{scanner, push}` ; ce module ne fait que l'orchestration HTTP
//! réelle (token Supabase en mémoire) et la progression UI.

use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, HashSet};
use std::path::Path;
use std::time::Duration;
use tauri::{AppHandle, Manager};

use sync_core::db;
use sync_core::pull::space_dir_name;
use sync_core::push::{
    DriveTransport, TransportError, UploadCompleteRequest, UploadIntentRequest,
    UploadIntentResponse,
};
use sync_core::scanner;

use crate::AppState;

const HTTP_TIMEOUT: Duration = Duration::from_secs(30);
const UPLOAD_TIMEOUT: Duration = Duration::from_secs(600);
/// Garde-fou par cycle : évite qu'un drain reste bloqué indéfiniment.
const MAX_OPS_PER_CYCLE: u64 = 500;

fn now_epoch() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0)
}

fn should_force_auth_refresh(message: &str) -> bool {
    crate::commands::is_auth_rejected(message)
}

fn collect_scan_targets(
    known_spaces: &[sync_core::models::Space],
    indexed_space_dirs: &[(String, String)],
    selected_space_ids: &[String],
) -> Vec<(String, String)> {
    let mut targets = BTreeMap::<String, String>::new();
    for (space_id, space_dir) in indexed_space_dirs
        .iter()
        .filter(|(space_id, _)| selected_space_ids.contains(space_id))
    {
        targets.insert(space_id.clone(), space_dir.clone());
    }
    for space in known_spaces.iter().filter(|space| {
        space.is_syncable()
            && (selected_space_ids.is_empty() || selected_space_ids.contains(&space.id))
    }) {
        targets.insert(space.id.clone(), space_dir_name(&space.slug, &space.id));
    }
    targets.into_iter().collect()
}

fn scan_local_changes(app: &AppHandle) -> Result<HashSet<String>, String> {
    let state = app.state::<AppState>();
    let (sync_root, selected_space_ids) = {
        let cfg = state.config.lock().map_err(|error| error.to_string())?;
        (cfg.sync_root.clone(), cfg.selected_space_ids.clone())
    };
    let sync_root =
        sync_root.ok_or_else(|| "Dossier local non défini : choisissez un dossier".to_string())?;
    if !sync_root.is_dir() {
        return Err(format!(
            "Le dossier local n'existe pas : {}",
            sync_root.display()
        ));
    }
    let known_spaces = state
        .known_spaces
        .lock()
        .map_err(|error| error.to_string())?
        .clone();
    let conn = db::open_and_migrate(&state.db_path()).map_err(|error| error.to_string())?;
    let indexed_space_dirs = db::list_space_dirs(&conn).map_err(|error| error.to_string())?;
    let targets = collect_scan_targets(&known_spaces, &indexed_space_dirs, &selected_space_ids);
    let mut scanned_ids = HashSet::new();
    for (space_id, space_dir) in targets {
        match scanner::scan_space(&conn, &sync_root, &space_dir, &space_id) {
            Ok(report) => {
                scanned_ids.insert(space_id);
                update_progress(app, |progress| {
                    progress.scanned_files += report.scanned;
                    progress.queued_files += report.queued;
                    if let Some(error) = report.errors.last() {
                        progress.last_error = Some(crate::sync_log::sanitize_diagnostic(error));
                    }
                });
            }
            Err(error) => update_progress(app, |progress| {
                progress.last_error = Some(crate::sync_log::sanitize_diagnostic(&format!(
                    "[{space_dir}] scan impossible : {error}"
                )));
            }),
        }
    }
    let pending = db::queue_len(&conn).unwrap_or(0);
    update_progress(app, |progress| progress.pending_ops = pending);
    Ok(scanned_ids)
}

// ---------------------------------------------------------------------------
// Progression exposée à l'UI (pollée par la page Statut)
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Default)]
pub struct PushProgress {
    pub running: bool,
    /// idle | scanning | uploading | done | error
    pub phase: String,
    pub scanned_files: u64,
    pub queued_files: u64,
    pub uploaded_files: u64,
    pub noop_files: u64,
    pub conflict_files: u64,
    pub failed_files: u64,
    pub rescheduled_files: u64,
    pub pending_ops: i64,
    pub last_error: Option<String>,
    pub finished_at: Option<i64>,
}

fn update_progress(app: &AppHandle, f: impl FnOnce(&mut PushProgress)) {
    let state = app.state::<AppState>();
    if let Ok(mut p) = state.push.lock() {
        f(&mut p);
    };
}

fn drive_notification_for_push(p: &PushProgress) -> Option<(String, String)> {
    if p.phase == "error" || p.failed_files > 0 || p.conflict_files > 0 {
        return Some((
            "Gestion Drive : envoi à vérifier".to_string(),
            format!(
                "{} fichier(s) envoyé(s), {} conflit(s), {} échec(s), {} en attente.",
                p.uploaded_files, p.conflict_files, p.failed_files, p.pending_ops
            ),
        ));
    }
    if p.uploaded_files > 0 {
        return Some((
            "Gestion Drive : fichiers envoyés".to_string(),
            format!("{} fichier(s) envoyé(s) vers Azure.", p.uploaded_files),
        ));
    }
    None
}

// ---------------------------------------------------------------------------
// Transport HTTP réel (reqwest blocking — exécuté dans spawn_blocking)
// ---------------------------------------------------------------------------

struct ReqwestTransport {
    api_base_url: String,
    token: String,
    client: reqwest::blocking::Client,
    upload_client: reqwest::blocking::Client,
}

impl ReqwestTransport {
    fn new(api_base_url: String, token: String) -> Result<Self, String> {
        let client = reqwest::blocking::Client::builder()
            .timeout(HTTP_TIMEOUT)
            .build()
            .map_err(|e| format!("Client HTTP impossible: {e}"))?;
        let upload_client = reqwest::blocking::Client::builder()
            .timeout(UPLOAD_TIMEOUT)
            .build()
            .map_err(|e| format!("Client HTTP impossible: {e}"))?;
        Ok(Self {
            api_base_url,
            token,
            client,
            upload_client,
        })
    }

    /// Réseau/5xx/429/401 → retryable ; autres 4xx logiques → abandon immédiat.
    fn classify_status(status: reqwest::StatusCode, context: &str) -> TransportError {
        if status == reqwest::StatusCode::UNAUTHORIZED {
            return TransportError::auth_rejected(crate::commands::auth_rejected_error(context));
        }
        let msg = format!("{context} (HTTP {status})");
        if status.is_server_error() || status.as_u16() == 429 {
            TransportError::retryable(msg)
        } else {
            TransportError::fatal(msg)
        }
    }

    fn classify_blob_status(status: reqwest::StatusCode, context: &str) -> TransportError {
        let msg = format!("{context} (HTTP {status})");
        if status == reqwest::StatusCode::UNAUTHORIZED
            || status == reqwest::StatusCode::FORBIDDEN
            || status == reqwest::StatusCode::TOO_MANY_REQUESTS
            || status.is_server_error()
        {
            TransportError::retryable(msg)
        } else {
            TransportError::fatal(msg)
        }
    }
}

impl DriveTransport for ReqwestTransport {
    fn upload_intent(
        &self,
        req: &UploadIntentRequest,
    ) -> Result<UploadIntentResponse, TransportError> {
        let res = self
            .client
            .post(format!("{}/api/drive/upload-intent", self.api_base_url))
            .bearer_auth(&self.token)
            .json(req)
            .send()
            .map_err(|_| TransportError::retryable("upload-intent injoignable"))?;
        if !res.status().is_success() {
            return Err(Self::classify_status(res.status(), "upload-intent refusé"));
        }
        res.json::<UploadIntentResponse>()
            .map_err(|e| TransportError::fatal(format!("réponse upload-intent invalide : {e}")))
    }

    fn put_blob(
        &self,
        upload_url: &str,
        content_type: &str,
        file_path: &Path,
    ) -> Result<Option<String>, TransportError> {
        let file = std::fs::File::open(file_path)
            .map_err(|e| TransportError::retryable(format!("lecture fichier impossible : {e}")))?;
        let res = self
            .upload_client
            .put(upload_url)
            .header("x-ms-blob-type", "BlockBlob")
            .header("Content-Type", content_type)
            .body(file)
            .send()
            .map_err(|_| TransportError::retryable("PUT Blob impossible"))?;
        if !res.status().is_success() {
            return Err(Self::classify_blob_status(
                res.status(),
                "Azure Blob a refusé l'upload",
            ));
        }
        let etag = res
            .headers()
            .get(reqwest::header::ETAG)
            .and_then(|v| v.to_str().ok())
            .map(str::to_string);
        Ok(etag)
    }

    fn upload_complete(&self, req: &UploadCompleteRequest) -> Result<(), TransportError> {
        let res = self
            .client
            .post(format!("{}/api/drive/upload-complete", self.api_base_url))
            .bearer_auth(&self.token)
            .json(req)
            .send()
            .map_err(|_| TransportError::retryable("upload-complete injoignable"))?;
        if !res.status().is_success() {
            return Err(Self::classify_status(
                res.status(),
                "upload-complete refusé",
            ));
        }
        Ok(())
    }

    fn delete_file(&self, file_id: &str) -> Result<(), TransportError> {
        let res = self
            .client
            .delete(format!("{}/api/drive/files/{file_id}", self.api_base_url))
            .bearer_auth(&self.token)
            .send()
            .map_err(|_| TransportError::retryable("suppression distante injoignable"))?;
        if !res.status().is_success() {
            return Err(Self::classify_status(
                res.status(),
                "suppression distante refusée",
            ));
        }
        Ok(())
    }

    fn move_file(&self, file_id: &str, path: &str) -> Result<(), TransportError> {
        let res = self
            .client
            .post(format!(
                "{}/api/drive/files/{file_id}/move",
                self.api_base_url
            ))
            .bearer_auth(&self.token)
            .json(&serde_json::json!({ "path": path }))
            .send()
            .map_err(|_| TransportError::retryable("déplacement distant injoignable"))?;
        if !res.status().is_success() {
            return Err(Self::classify_status(
                res.status(),
                "déplacement distant refusé",
            ));
        }
        Ok(())
    }
}

#[derive(Debug, Deserialize)]
struct ApiSpaceLite {
    id: String,
    slug: String,
    sync_policy: String,
}

// ---------------------------------------------------------------------------
// Commandes IPC
// ---------------------------------------------------------------------------

/// Lance un cycle de push sync (scan + drain de la queue) en tâche de fond.
/// L'UI suit via `push_progress`.
#[tauri::command]
pub async fn run_push_sync(app: AppHandle) -> Result<(), String> {
    let sync_guard =
        {
            let state = app.state::<AppState>();
            state.sync_operation.clone().try_lock_owned().map_err(|_| {
                "Une synchronisation est déjà en cours : réessayez ensuite".to_string()
            })?
        };
    {
        let state = app.state::<AppState>();
        if *state.sync_paused.lock().map_err(|e| e.to_string())? {
            return Err("Synchronisation en pause".into());
        }
        let mut p = state.push.lock().map_err(|e| e.to_string())?;
        *p = PushProgress {
            running: true,
            phase: "scanning".into(),
            ..Default::default()
        };
    }

    let scan_handle = app.clone();
    let scanned_ids = match tauri::async_runtime::spawn_blocking(move || {
        scan_local_changes(&scan_handle)
    })
    .await
    {
        Ok(Ok(scanned_ids)) => scanned_ids,
        Ok(Err(error)) => {
            finish_push_start_error(&app, &error);
            return Err(error);
        }
        Err(error) => {
            let error = format!("Scan local interrompu : {error}");
            finish_push_start_error(&app, &error);
            return Err(error);
        }
    };

    let token = {
        let state = app.state::<AppState>();
        match crate::commands::ensure_access_token(&state, None).await {
            Ok(token) => token,
            Err(error) => {
                finish_push_start_error(&app, &error);
                return Err(error);
            }
        }
    };

    let handle = app.clone();
    // Cycle entièrement bloquant (reqwest blocking + SQLite) → hors du réacteur async.
    tauri::async_runtime::spawn_blocking(move || {
        let _sync_guard = sync_guard;
        crate::sync_log::info(&handle, "push", "Cycle d'envoi démarré");
        let outcome = do_push(&handle, token, &scanned_ids);
        // Copie de l'erreur de cycle pour le suivi offline (le match ci-dessous
        // consomme `outcome`).
        let cycle_error = outcome
            .as_ref()
            .err()
            .map(|error| crate::sync_log::sanitize_diagnostic(error));
        update_progress(&handle, |p| {
            p.running = false;
            p.finished_at = Some(now_epoch());
            match outcome {
                Ok(()) => {
                    p.phase = if p.failed_files > 0 || p.conflict_files > 0 {
                        "error"
                    } else {
                        "done"
                    }
                    .into();
                }
                Err(e) => {
                    p.phase = "error".into();
                    p.last_error = Some(crate::sync_log::sanitize_diagnostic(&e));
                }
            }
        });
        // Bilan du cycle dans le journal exportable + notification Drive minimale.
        let state = handle.state::<AppState>();
        let (summary, last_error, notification) = match state.push.lock() {
            Ok(p) => (
                format!(
                    "Cycle d'envoi terminé ({}) : {} envoyé(s), {} déjà connu(s), {} conflit(s), {} échec(s), {} replanifié(s), {} en attente",
                    p.phase,
                    p.uploaded_files,
                    p.noop_files,
                    p.conflict_files,
                    p.failed_files,
                    p.rescheduled_files,
                    p.pending_ops
                ),
                p.last_error.clone(),
                drive_notification_for_push(&p),
            ),
            Err(_) => ("Cycle d'envoi terminé".to_string(), None, None),
        };
        crate::sync_log::info(&handle, "push", summary);
        if let Some(err) = last_error {
            crate::sync_log::error(&handle, "push", err);
        }
        if let Some((title, body)) = notification {
            let _ = crate::notifications::dispatch(&handle, &state, "drive", &title, &body);
        }
        // Suivi offline : transition online/offline + last_sync_at + notification.
        crate::net_state::record_cycle_end(&handle, "push", cycle_error.as_deref());
    });
    Ok(())
}

fn finish_push_start_error(app: &AppHandle, error: &str) {
    let safe_error = crate::sync_log::sanitize_diagnostic(error);
    update_progress(app, |progress| {
        progress.running = false;
        progress.phase = "error".into();
        progress.finished_at = Some(now_epoch());
        progress.last_error = Some(safe_error.clone());
    });
    crate::sync_log::error(app, "push", safe_error);
    crate::net_state::record_cycle_end(app, "push", Some(error));
}

/// État courant du push sync (pollé par la page Statut).
#[tauri::command]
pub fn push_progress(state: tauri::State<'_, AppState>) -> Result<PushProgress, String> {
    Ok(state.push.lock().map_err(|e| e.to_string())?.clone())
}

// ---------------------------------------------------------------------------
// Cœur du push
// ---------------------------------------------------------------------------

fn do_push(app: &AppHandle, token: String, scanned_ids: &HashSet<String>) -> Result<(), String> {
    let state = app.state::<AppState>();

    // Instantané de config (aucun verrou tenu pendant le réseau).
    let (api_base_url, sync_root, selected_ids) = {
        let cfg = state.config.lock().map_err(|e| e.to_string())?;
        (
            cfg.api_base_url.trim_end_matches('/').to_string(),
            cfg.sync_root.clone(),
            cfg.selected_space_ids.clone(),
        )
    };

    let sync_root =
        sync_root.ok_or_else(|| "Dossier local non défini : choisissez un dossier".to_string())?;
    if !sync_root.is_dir() {
        return Err(format!(
            "Le dossier local n'existe pas : {}",
            sync_root.display()
        ));
    }

    let transport = ReqwestTransport::new(api_base_url.clone(), token.clone())?;

    // Espaces : slug (nom du dossier local) + sync_policy à jour.
    let spaces_response = transport
        .client
        .get(format!("{api_base_url}/api/drive/spaces"))
        .bearer_auth(&token)
        .send()
        .map_err(|_| "Réseau indisponible : chargement des espaces impossible".to_string())?;
    if spaces_response.status() == reqwest::StatusCode::UNAUTHORIZED {
        crate::commands::mark_access_token_for_refresh(&state);
        return Err(crate::commands::auth_rejected_error(
            "chargement des espaces refusé",
        ));
    }
    if !spaces_response.status().is_success() {
        return Err(format!(
            "Chargement des espaces refusé (HTTP {})",
            spaces_response.status()
        ));
    }
    let spaces: Vec<ApiSpaceLite> = spaces_response
        .json()
        .map_err(|e| format!("Réponse espaces invalide : {e}"))?;

    let allowed_ids: Vec<String> = spaces
        .iter()
        .filter(|s| s.sync_policy == "allowed")
        .map(|s| s.id.clone())
        .collect();
    let effective_selected_ids = if selected_ids.is_empty() {
        allowed_ids.clone()
    } else {
        selected_ids.clone()
    };
    if selected_ids.is_empty() && !effective_selected_ids.is_empty() {
        if let Ok(mut cfg) = state.config.lock() {
            cfg.selected_space_ids = effective_selected_ids.clone();
            let _ = cfg.save(&state.data_dir);
        }
    }

    let targets: Vec<&ApiSpaceLite> = spaces
        .iter()
        .filter(|s| effective_selected_ids.contains(&s.id) && s.sync_policy == "allowed")
        .collect();
    if targets.is_empty() {
        return Err("Aucun espace synchronisable parmi la sélection".into());
    }

    let conn = db::open_and_migrate(&state.db_path()).map_err(|e| e.to_string())?;

    // 1. Complète le scan pour les espaces découverts seulement après l'appel API.
    let mut scan_errors: Vec<String> = Vec::new();
    for space in targets
        .iter()
        .filter(|space| !scanned_ids.contains(&space.id))
    {
        let space_dir = space_dir_name(&space.slug, &space.id);
        match scanner::scan_space(&conn, &sync_root, &space_dir, &space.id) {
            Ok(report) => {
                scan_errors.extend(report.errors.iter().cloned());
                update_progress(app, |p| {
                    p.scanned_files += report.scanned;
                    p.queued_files += report.queued;
                });
            }
            Err(e) => scan_errors.push(format!("[{}] scan impossible : {e}", space.slug)),
        }
    }

    // 2. Drain limité aux espaces encore autorisés par la réponse API courante.
    update_progress(app, |p| p.phase = "uploading".into());
    let allowed_for_drain: HashSet<String> = targets.iter().map(|space| space.id.clone()).collect();
    let report = sync_core::push::run_queue_once_for_spaces(
        &conn,
        &sync_root,
        &transport,
        MAX_OPS_PER_CYCLE,
        &allowed_for_drain,
    )
    .map_err(|e| e.to_string())?;

    let pending = db::queue_len(&conn).unwrap_or(0);
    let auth_rejected = report
        .errors
        .iter()
        .any(|error| should_force_auth_refresh(error));
    if auth_rejected {
        crate::commands::mark_access_token_for_refresh(&state);
    }
    for e in &report.errors {
        crate::sync_log::error(app, "push", e.clone());
    }
    for e in &scan_errors {
        crate::sync_log::warn(app, "push", format!("scan : {e}"));
    }
    if report.conflicts > 0 {
        crate::sync_log::warn(
            app,
            "push",
            format!(
                "{} conflit(s) détecté(s) — fichiers marqués « conflict », aucun écrasement",
                report.conflicts
            ),
        );
    }
    update_progress(app, |p| {
        p.uploaded_files = report.uploaded;
        p.noop_files = report.noop;
        p.conflict_files = report.conflicts;
        p.failed_files = report.failed;
        p.rescheduled_files = report.rescheduled;
        p.pending_ops = pending;
        if let Some(e) = report.errors.last() {
            p.last_error = Some(crate::sync_log::sanitize_diagnostic(e));
        } else if let Some(e) = scan_errors.last() {
            p.last_error = Some(crate::sync_log::sanitize_diagnostic(e));
        }
    });

    if auth_rejected {
        return Err(crate::commands::auth_rejected_error(
            "envoi interrompu avant renouvellement",
        ));
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn offline_scan_targets_require_selection_for_index_and_cover_known_allowed_spaces() {
        let indexed = ("space-medical".to_string(), "medical".to_string());
        let empty_known = sync_core::models::Space {
            id: "space-empty".into(),
            name: "Vide".into(),
            slug: "empty".into(),
            space_type: "service".into(),
            sync_policy: "allowed".into(),
            sensitivity: "internal".into(),
        };

        assert!(collect_scan_targets(&[], std::slice::from_ref(&indexed), &[]).is_empty());

        let targets = collect_scan_targets(
            &[empty_known],
            &[indexed],
            &["space-medical".into(), "space-empty".into()],
        );
        assert_eq!(
            targets,
            vec![
                ("space-empty".into(), "empty".into()),
                ("space-medical".into(), "medical".into()),
            ]
        );
    }

    #[test]
    fn auth_rejection_is_retryable_to_preserve_the_queue() {
        let error = ReqwestTransport::classify_status(
            reqwest::StatusCode::UNAUTHORIZED,
            "upload-complete refusé",
        );
        assert!(error.retryable);
        assert!(should_force_auth_refresh(&error.message));
        assert!(error.message.contains("DRIVE_AUTH_REJECTED"));

        let blob_error = ReqwestTransport::classify_blob_status(
            reqwest::StatusCode::UNAUTHORIZED,
            "Azure Blob a refusé l'upload",
        );
        assert!(blob_error.retryable);
        assert!(!should_force_auth_refresh(&blob_error.message));
    }

    #[test]
    fn push_notification_only_when_actionable() {
        let mut p = PushProgress {
            phase: "done".into(),
            ..Default::default()
        };
        assert!(drive_notification_for_push(&p).is_none());

        p.uploaded_files = 3;
        let (title, body) = drive_notification_for_push(&p).expect("upload notification");
        assert!(title.contains("fichiers envoyés"));
        assert!(body.contains("3 fichier"));

        p.phase = "error".into();
        p.conflict_files = 1;
        let (title, body) = drive_notification_for_push(&p).expect("conflict notification");
        assert!(title.contains("à vérifier"));
        assert!(body.contains("1 conflit"));
    }
}
