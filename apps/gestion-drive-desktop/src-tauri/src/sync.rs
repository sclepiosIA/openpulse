//! Pull sync — premier lot (plan §2.2) :
//! tree → changes → download-url → écriture disque → index SQLite.
//!
//! Orchestration réseau/disque uniquement ; les décisions pures
//! (télécharger ou non, chemins sûrs) vivent dans `sync_core::pull`.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Manager};

use sync_core::db;
use sync_core::models::{LocalFile, SyncState};
use sync_core::pull::{decide_pull, safe_relative_path, space_dir_name, PullDecision};

use crate::AppState;

const HTTP_TIMEOUT: Duration = Duration::from_secs(30);
const DOWNLOAD_TIMEOUT: Duration = Duration::from_secs(600);
const DRIVE_NETWORK_UNAVAILABLE: &str = "Réseau indisponible : requête Drive impossible";

fn now_epoch() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0)
}

fn should_abort_pull_for_auth(message: &str) -> bool {
    crate::commands::is_auth_rejected(message)
}

// ---------------------------------------------------------------------------
// Progression exposée à l'UI (pollée par la page Statut)
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Default)]
pub struct PullProgress {
    pub running: bool,
    /// idle | listing | downloading | done | error
    pub phase: String,
    pub current_space: Option<String>,
    pub total_files: u64,
    pub processed_files: u64,
    pub downloaded_files: u64,
    pub skipped_files: u64,
    pub failed_files: u64,
    pub current_file: Option<String>,
    pub last_error: Option<String>,
    pub last_event_id: i64,
    pub finished_at: Option<i64>,
}

fn update_progress(app: &AppHandle, f: impl FnOnce(&mut PullProgress)) {
    let state = app.state::<AppState>();
    if let Ok(mut p) = state.pull.lock() {
        f(&mut p);
    };
}

fn drive_notification_for_pull(p: &PullProgress) -> Option<(String, String)> {
    if p.phase == "error" || p.failed_files > 0 {
        return Some((
            "Gestion Drive : réception à vérifier".to_string(),
            format!(
                "{} fichier(s) reçu(s), {} à jour, {} échec(s). Ouvrez le diagnostic sync.",
                p.downloaded_files, p.skipped_files, p.failed_files
            ),
        ));
    }
    if p.downloaded_files > 0 {
        return Some((
            "Gestion Drive : nouveaux fichiers reçus".to_string(),
            format!(
                "{} fichier(s) synchronisé(s) depuis Azure.",
                p.downloaded_files
            ),
        ));
    }
    None
}

// ---------------------------------------------------------------------------
// Réponses API Drive (miroir de app/schemas.py côté serveur)
// ---------------------------------------------------------------------------

#[derive(Debug, Deserialize)]
pub struct ApiSpace {
    pub id: String,
    pub name: String,
    pub slug: String,
    pub sync_policy: String,
}

#[derive(Debug, Deserialize)]
pub struct ApiFileNode {
    pub id: String,
    pub folder_id: Option<String>,
    pub path: String,
    pub size_bytes: i64,
    pub sha256: Option<String>,
    pub etag: Option<String>,
    pub current_version: i64,
    #[serde(default = "default_status")]
    pub status: String,
}

fn default_status() -> String {
    "active".into()
}

#[derive(Debug, Deserialize)]
pub struct ApiTreeResponse {
    pub files: Vec<ApiFileNode>,
}

#[derive(Debug, Deserialize)]
pub struct ApiChangesResponse {
    pub last_event_id: i64,
    #[serde(default)]
    pub events: Vec<ApiSyncEvent>,
    #[serde(default)]
    pub has_more: bool,
}

#[derive(Debug, Deserialize)]
pub struct ApiSyncEvent {
    pub id: i64,
}

#[derive(Debug, Deserialize)]
pub struct ApiDownloadUrlResponse {
    pub download_url: String,
}

// ---------------------------------------------------------------------------
// Commandes IPC
// ---------------------------------------------------------------------------

/// Lance un cycle de pull sync en tâche de fond. L'UI suit via `pull_progress`.
#[tauri::command]
pub async fn run_pull_sync(app: AppHandle) -> Result<(), String> {
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
        let mut p = state.pull.lock().map_err(|e| e.to_string())?;
        *p = PullProgress {
            running: true,
            phase: "listing".into(),
            ..Default::default()
        };
    }

    let handle = app.clone();
    tauri::async_runtime::spawn(async move {
        let _sync_guard = sync_guard;
        crate::sync_log::info(&handle, "pull", "Cycle de réception démarré");
        let outcome = do_pull(&handle).await;
        // Copie de l'erreur de cycle pour le suivi offline (le match ci-dessous
        // consomme `outcome`).
        let cycle_error = outcome
            .as_ref()
            .err()
            .map(|error| crate::sync_log::sanitize_diagnostic(error));
        update_progress(&handle, |p| {
            p.running = false;
            p.current_file = None;
            p.current_space = None;
            p.finished_at = Some(now_epoch());
            match outcome {
                Ok(()) => {
                    p.phase = if p.failed_files > 0 { "error" } else { "done" }.into();
                }
                Err(e) => {
                    p.phase = "error".into();
                    p.last_error = Some(crate::sync_log::sanitize_diagnostic(&e));
                }
            }
        });
        // Bilan du cycle dans le journal exportable + notification Drive minimale.
        let (summary, last_error, notification) = {
            let state = handle.state::<AppState>();
            let guard = state.pull.lock();
            match guard {
                Ok(p) => (
                    Some(format!(
                        "Cycle de réception terminé ({}) : {} téléchargé(s), {} à jour, {} échec(s)",
                        p.phase, p.downloaded_files, p.skipped_files, p.failed_files
                    )),
                    p.last_error.clone(),
                    drive_notification_for_pull(&p),
                ),
                Err(_) => (None, None, None),
            }
        };
        if let Some(s) = summary {
            crate::sync_log::info(&handle, "pull", s);
        }
        if let Some(err) = last_error {
            crate::sync_log::error(&handle, "pull", err);
        }
        if let Some((title, body)) = notification {
            let state = handle.state::<AppState>();
            let _ = crate::notifications::dispatch(&handle, &state, "drive", &title, &body);
        }
        // Suivi offline : transition online/offline + last_sync_at + notification.
        crate::net_state::record_cycle_end(&handle, "pull", cycle_error.as_deref());
    });
    Ok(())
}

/// État courant du pull sync (pollé par la page Statut).
#[tauri::command]
pub fn pull_progress(state: tauri::State<'_, AppState>) -> Result<PullProgress, String> {
    Ok(state.pull.lock().map_err(|e| e.to_string())?.clone())
}

// ---------------------------------------------------------------------------
// Cœur du pull
// ---------------------------------------------------------------------------

async fn do_pull(app: &AppHandle) -> Result<(), String> {
    let state = app.state::<AppState>();
    let token = crate::commands::ensure_access_token(&state, None).await?;
    match do_pull_with_token(app, &token).await {
        Err(error) if should_abort_pull_for_auth(&error) => {
            let refreshed = crate::commands::ensure_access_token(&state, Some(&token)).await?;
            do_pull_with_token(app, &refreshed).await
        }
        outcome => outcome,
    }
}

async fn do_pull_with_token(app: &AppHandle, token: &str) -> Result<(), String> {
    let state = app.state::<AppState>();

    // Instantané de config + token (aucun verrou tenu pendant les awaits).
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

    let client = reqwest::Client::builder()
        .timeout(HTTP_TIMEOUT)
        .build()
        .map_err(|e| format!("Client HTTP impossible: {e}"))?;
    // Client séparé sans timeout global court pour les téléchargements de blobs.
    let dl_client = reqwest::Client::builder()
        .timeout(DOWNLOAD_TIMEOUT)
        .build()
        .map_err(|e| format!("Client HTTP impossible: {e}"))?;

    // Espaces : re-fetch pour obtenir slug + sync_policy à jour.
    let spaces: Vec<ApiSpace> =
        get_json(&client, &format!("{api_base_url}/api/drive/spaces"), token)
            .await
            .map_err(|e| format!("Chargement des espaces impossible : {e}"))?;

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

    let targets: Vec<&ApiSpace> = spaces
        .iter()
        .filter(|s| effective_selected_ids.contains(&s.id) && s.sync_policy == "allowed")
        .collect();
    if targets.is_empty() {
        return Err("Aucun espace synchronisable parmi la sélection".into());
    }

    let conn = db::open_and_migrate(&state.db_path()).map_err(|e| e.to_string())?;
    // `Connection` est Send mais pas Sync : on la passe en &mut pour que la
    // future reste Send (exigence de tauri::async_runtime::spawn).
    let mut conn = conn;

    let mut first_error: Option<String> = None;
    for space in targets {
        update_progress(app, |p| {
            p.phase = "downloading".into();
            p.current_space = Some(space.name.clone());
        });
        if let Err(e) = pull_space(
            app,
            &client,
            &dl_client,
            &mut conn,
            &api_base_url,
            token,
            space,
            &sync_root,
        )
        .await
        {
            let auth_rejected = should_abort_pull_for_auth(&e);
            let safe_error = crate::sync_log::sanitize_diagnostic(&e);
            update_progress(app, |p| {
                p.failed_files += 1;
                p.last_error = Some(safe_error);
            });
            if auth_rejected {
                return Err(e);
            }
            first_error.get_or_insert(e);
        }
    }

    // Un échec d'espace complet remonte comme erreur de cycle ; les échecs
    // par fichier sont déjà comptés dans failed_files.
    match first_error {
        Some(e) => Err(e),
        None => Ok(()),
    }
}

#[allow(clippy::too_many_arguments)]
async fn pull_space(
    app: &AppHandle,
    client: &reqwest::Client,
    dl_client: &reqwest::Client,
    conn: &mut rusqlite::Connection,
    api_base_url: &str,
    token: &str,
    space: &ApiSpace,
    sync_root: &Path,
) -> Result<(), String> {
    // 1. Arborescence complète de l'espace (source de vérité).
    let tree: ApiTreeResponse = get_json(
        client,
        &format!("{api_base_url}/api/drive/tree?space_id={}", space.id),
        token,
    )
    .await
    .map_err(|e| format!("[{}] tree inaccessible : {e}", space.name))?;

    let active_files: Vec<&ApiFileNode> =
        tree.files.iter().filter(|f| f.status == "active").collect();
    update_progress(app, |p| p.total_files += active_files.len() as u64);

    let space_dir = space_dir_name(&space.slug, &space.id);
    reconcile_remote_paths(conn, sync_root, &space_dir, &space.id, &active_files)?;

    // 2. Réconciliation fichier par fichier.
    for file in active_files {
        let outcome = pull_one_file(
            app,
            client,
            dl_client,
            conn,
            api_base_url,
            token,
            space,
            &space_dir,
            sync_root,
            file,
        )
        .await;
        match outcome {
            Ok(true) => update_progress(app, |p| {
                p.processed_files += 1;
                p.downloaded_files += 1;
            }),
            Ok(false) => update_progress(app, |p| {
                p.processed_files += 1;
                p.skipped_files += 1;
            }),
            Err(error) => {
                let safe_error = crate::sync_log::sanitize_diagnostic(&error);
                update_progress(app, |p| {
                    p.processed_files += 1;
                    p.failed_files += 1;
                    p.last_error = Some(safe_error);
                });
                if should_abort_pull_for_auth(&error) {
                    return Err(error);
                }
            }
        }
    }

    // 3. Avance le curseur d'événements (le tree vient d'être réconcilié,
    //    tout événement ≤ last_event_id est couvert).
    let mut since = db::get_cursor(conn, &space.id).map_err(|e| e.to_string())?;
    loop {
        let previous = since;
        let changes: ApiChangesResponse = get_json(
            client,
            &format!(
                "{api_base_url}/api/drive/changes?space_id={}&since_event_id={since}",
                space.id
            ),
            token,
        )
        .await
        .map_err(|e| format!("[{}] changes inaccessible : {e}", space.name))?;
        let page_max = changes
            .events
            .iter()
            .map(|event| event.id)
            .max()
            .unwrap_or(previous);
        since = if changes.has_more {
            page_max
        } else {
            changes.last_event_id.max(page_max)
        };
        if since > previous {
            db::set_cursor(conn, &space.id, since).map_err(|e| e.to_string())?;
        }
        if !changes.has_more {
            break;
        }
        if page_max <= previous {
            return Err(format!(
                "[{}] pagination changes sans progression",
                space.name
            ));
        }
    }
    update_progress(app, |p| p.last_event_id = since.max(p.last_event_id));

    Ok(())
}

fn reconcile_remote_paths(
    conn: &rusqlite::Connection,
    sync_root: &Path,
    space_dir: &str,
    space_id: &str,
    active_files: &[&ApiFileNode],
) -> Result<(), String> {
    let remote: HashMap<&str, &ApiFileNode> = active_files
        .iter()
        .map(|file| (file.id.as_str(), *file))
        .collect();
    let locals = db::list_local_files(conn, 100_000, 0).map_err(|e| e.to_string())?;
    for mut local in locals.into_iter().filter(|file| file.space_id == space_id) {
        let Some(file_id) = local.file_id.as_deref() else {
            continue;
        };
        match remote.get(file_id) {
            None if local.sync_state == SyncState::Idle => {
                let old_abs = to_abs_path(sync_root, &local.local_path);
                if old_abs.is_file() {
                    let unchanged = match local.sha256.as_deref() {
                        Some(expected) => sync_core::hashing::sha256_file(&old_abs)
                            .map(|(actual, _)| actual == expected)
                            .unwrap_or(false),
                        None => false,
                    };
                    if !unchanged {
                        local.sync_state = SyncState::Conflict;
                        local.last_error = Some(
                            "Suppression distante reçue alors que la copie locale a été modifiée; fichier local conservé"
                                .into(),
                        );
                        local.updated_at = now_epoch();
                        db::upsert_local_file(conn, &local).map_err(|e| e.to_string())?;
                        continue;
                    }
                    std::fs::remove_file(&old_abs)
                        .map_err(|e| format!("suppression locale impossible : {e}"))?;
                }
                db::delete_local_file(conn, &local.local_path).map_err(|e| e.to_string())?;
            }
            Some(remote_file) => {
                let rel = safe_relative_path(&remote_file.path)
                    .ok_or_else(|| format!("chemin distant invalide : {}", remote_file.path))?;
                let desired = format!("{space_dir}/{rel}");
                if desired == local.local_path || local.sync_state != SyncState::Idle {
                    continue;
                }
                let old_path = local.local_path.clone();
                let old_abs = to_abs_path(sync_root, &old_path);
                let new_abs = to_abs_path(sync_root, &desired);
                ensure_safe_destination(sync_root, &new_abs)?;
                if new_abs.exists() && new_abs != old_abs {
                    return Err(format!(
                        "destination locale déjà occupée : {}",
                        new_abs.display()
                    ));
                }
                if old_abs.is_file() {
                    std::fs::rename(&old_abs, &new_abs)
                        .map_err(|e| format!("déplacement local impossible : {e}"))?;
                }
                db::delete_local_file(conn, &old_path).map_err(|e| e.to_string())?;
                local.local_path = desired;
                local.folder_id = remote_file.folder_id.clone();
                local.updated_at = now_epoch();
                db::upsert_local_file(conn, &local).map_err(|e| e.to_string())?;
            }
            _ => {}
        }
    }
    Ok(())
}

/// Retourne Ok(true) si téléchargé, Ok(false) si sauté.
#[allow(clippy::too_many_arguments)]
async fn pull_one_file(
    app: &AppHandle,
    client: &reqwest::Client,
    dl_client: &reqwest::Client,
    conn: &mut rusqlite::Connection,
    api_base_url: &str,
    token: &str,
    space: &ApiSpace,
    space_dir: &str,
    sync_root: &Path,
    file: &ApiFileNode,
) -> Result<bool, String> {
    let rel = safe_relative_path(&file.path)
        .ok_or_else(|| format!("chemin distant invalide : {}", file.path))?;
    let local_rel = format!("{space_dir}/{rel}");
    let abs = to_abs_path(sync_root, &local_rel);

    let existing = db::get_local_file(conn, &local_rel).map_err(|e| e.to_string())?;
    let decision = decide_pull(
        existing.as_ref(),
        abs.exists(),
        file.current_version,
        file.sha256.as_deref(),
    );
    if !matches!(decision, PullDecision::Download) {
        return Ok(false);
    }

    update_progress(app, |p| p.current_file = Some(local_rel.clone()));

    let write_result = download_and_write(
        client,
        dl_client,
        api_base_url,
        token,
        file,
        sync_root,
        &abs,
    )
    .await;

    match write_result {
        Ok(written_mtime) => {
            crate::sync_log::info(
                app,
                "pull",
                format!("Téléchargé : {local_rel} (v{})", file.current_version),
            );
            let record = LocalFile {
                local_path: local_rel,
                space_id: space.id.clone(),
                file_id: Some(file.id.clone()),
                folder_id: file.folder_id.clone(),
                sha256: file.sha256.clone(),
                etag: file.etag.clone(),
                version: file.current_version,
                size_bytes: file.size_bytes,
                mtime: written_mtime,
                sync_state: SyncState::Idle,
                // Re-matérialisé : n'est plus « évincé » ; conserve l'épinglage.
                pin_state: match existing.as_ref().map(|l| l.pin_state) {
                    Some(sync_core::models::PinState::Pinned) => {
                        sync_core::models::PinState::Pinned
                    }
                    _ => sync_core::models::PinState::Unpinned,
                },
                last_error: None,
                updated_at: now_epoch(),
            };
            db::upsert_local_file(conn, &record).map_err(|e| e.to_string())?;
            Ok(true)
        }
        Err(e) => {
            let safe_error = crate::sync_log::sanitize_diagnostic(&e);
            crate::sync_log::error(
                app,
                "pull",
                format!("Échec téléchargement {local_rel} : {safe_error}"),
            );
            // Ne pas corrompre l'index : on conserve les métadonnées connues
            // (sha/etag/version/taille) du fichier déjà présent sur disque —
            // seule la tentative de téléchargement a échoué. L'ancien code
            // écrasait tout (sha=None, size=0) : après un échec réseau,
            // l'index ne reflétait plus le fichier réel.
            let record = match existing {
                Some(mut prev) => {
                    prev.sync_state = SyncState::Error;
                    prev.last_error = Some(safe_error.clone());
                    prev.updated_at = now_epoch();
                    prev
                }
                None => LocalFile {
                    local_path: local_rel,
                    space_id: space.id.clone(),
                    file_id: Some(file.id.clone()),
                    folder_id: file.folder_id.clone(),
                    sha256: None,
                    etag: None,
                    version: 0,
                    size_bytes: 0,
                    mtime: 0,
                    sync_state: SyncState::Error,
                    pin_state: Default::default(),
                    last_error: Some(safe_error.clone()),
                    updated_at: now_epoch(),
                },
            };
            let _ = db::upsert_local_file(conn, &record);
            Err(safe_error)
        }
    }
}

/// Télécharge le blob (URL SAS courte) vers `abs` via fichier temporaire +
/// rename atomique. Retourne le mtime du fichier écrit.
async fn download_and_write(
    client: &reqwest::Client,
    dl_client: &reqwest::Client,
    api_base_url: &str,
    token: &str,
    file: &ApiFileNode,
    sync_root: &Path,
    abs: &Path,
) -> Result<i64, String> {
    // URL de téléchargement signée.
    let res = client
        .post(format!("{api_base_url}/api/drive/download-url"))
        .bearer_auth(token)
        .json(&serde_json::json!({ "file_id": file.id }))
        .send()
        .await
        .map_err(|_| "download-url injoignable".to_string())?;
    if res.status() == reqwest::StatusCode::UNAUTHORIZED {
        return Err(crate::commands::auth_rejected_error("download-url refusé"));
    }
    if !res.status().is_success() {
        return Err(format!("download-url refusé (HTTP {})", res.status()));
    }
    let signed: ApiDownloadUrlResponse = res
        .json()
        .await
        .map_err(|e| format!("réponse download-url invalide : {e}"))?;

    // Téléchargement streamé vers un fichier temporaire voisin.
    ensure_safe_destination(sync_root, abs)?;
    // Suffixe `.part` : ignoré par la sync (models::is_ignored_filename),
    // donc invisible pour le futur watcher local (lot 2).
    let tmp = abs.with_extension(format!(
        "{}.gd.part",
        abs.extension().and_then(|e| e.to_str()).unwrap_or("bin")
    ));

    let mut res = dl_client
        .get(&signed.download_url)
        .send()
        .await
        .map_err(|_| "téléchargement blob impossible".to_string())?;
    if !res.status().is_success() {
        return Err(format!("blob refusé (HTTP {})", res.status()));
    }

    {
        use std::io::Write;
        let mut out = std::fs::File::create(&tmp)
            .map_err(|e| format!("écriture temporaire impossible : {e}"))?;
        loop {
            let chunk = match res.chunk().await {
                Ok(Some(c)) => c,
                Ok(None) => break,
                Err(_) => {
                    // Nettoyage : ne pas laisser traîner un .part orphelin.
                    drop(out);
                    let _ = std::fs::remove_file(&tmp);
                    return Err("lecture réseau interrompue".into());
                }
            };
            if let Err(e) = out.write_all(&chunk) {
                drop(out);
                let _ = std::fs::remove_file(&tmp);
                return Err(format!("écriture disque impossible : {e}"));
            }
        }
        if let Err(e) = out.flush() {
            drop(out);
            let _ = std::fs::remove_file(&tmp);
            return Err(format!("flush impossible : {e}"));
        }
    }

    // Intégrité : taille et empreinte doivent correspondre aux métadonnées
    // serveur (blob tronqué / corrompu → on jette le .part, jamais le fichier).
    if file.size_bytes > 0 {
        let written = std::fs::metadata(&tmp)
            .map(|m| m.len() as i64)
            .unwrap_or(-1);
        if written != file.size_bytes {
            let _ = std::fs::remove_file(&tmp);
            return Err(format!(
                "téléchargement incomplet : {written} octets au lieu de {}",
                file.size_bytes
            ));
        }
    }
    if let Some(expected_sha) = file.sha256.as_deref() {
        match sync_core::hashing::sha256_file(&tmp) {
            Ok((actual, _)) if actual == expected_sha => {}
            Ok((actual, _)) => {
                let _ = std::fs::remove_file(&tmp);
                return Err(format!(
                    "empreinte SHA-256 invalide après téléchargement (attendu {expected_sha}, obtenu {actual})"
                ));
            }
            Err(e) => {
                let _ = std::fs::remove_file(&tmp);
                return Err(format!("vérification d'empreinte impossible : {e}"));
            }
        }
    }

    if let Err(e) = std::fs::rename(&tmp, abs) {
        let _ = std::fs::remove_file(&tmp);
        return Err(format!("finalisation du fichier impossible : {e}"));
    }

    let mtime = std::fs::metadata(abs)
        .and_then(|m| m.modified())
        .ok()
        .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
        .map(|d| d.as_secs() as i64)
        .unwrap_or_else(now_epoch);
    Ok(mtime)
}

/// Refuse toute écriture dont un composant existant est un lien symbolique,
/// puis vérifie que le parent canonique reste sous la racine.
fn ensure_safe_destination(root: &Path, abs: &Path) -> Result<(), String> {
    let rel = abs
        .strip_prefix(root)
        .map_err(|_| "destination hors du dossier de synchronisation".to_string())?;
    let parent_rel = rel.parent().unwrap_or_else(|| Path::new(""));
    let mut cursor = root.to_path_buf();
    for component in parent_rel.components() {
        cursor.push(component.as_os_str());
        if cursor.exists()
            && std::fs::symlink_metadata(&cursor)
                .map_err(|e| format!("inspection chemin impossible : {e}"))?
                .file_type()
                .is_symlink()
        {
            return Err(format!(
                "lien symbolique interdit dans le chemin : {}",
                cursor.display()
            ));
        }
    }
    if abs.exists()
        && std::fs::symlink_metadata(abs)
            .map_err(|e| format!("inspection destination impossible : {e}"))?
            .file_type()
            .is_symlink()
    {
        return Err("destination symbolique interdite".into());
    }
    let parent = abs
        .parent()
        .ok_or_else(|| "destination sans parent".to_string())?;
    std::fs::create_dir_all(parent).map_err(|e| format!("mkdir impossible : {e}"))?;
    let canonical_root = root
        .canonicalize()
        .map_err(|e| format!("racine sync invalide : {e}"))?;
    let canonical_parent = parent
        .canonicalize()
        .map_err(|e| format!("parent sync invalide : {e}"))?;
    if !canonical_parent.starts_with(&canonical_root) {
        return Err("destination résolue hors du dossier de synchronisation".into());
    }
    Ok(())
}

/// Construit un chemin absolu plateforme depuis un chemin relatif `/`.
fn to_abs_path(root: &Path, rel: &str) -> PathBuf {
    let mut p = root.to_path_buf();
    for seg in rel.split('/').filter(|s| !s.is_empty()) {
        p.push(seg);
    }
    p
}

async fn get_json<T: serde::de::DeserializeOwned>(
    client: &reqwest::Client,
    url: &str,
    token: &str,
) -> Result<T, String> {
    let res = client
        .get(url)
        .bearer_auth(token)
        .send()
        .await
        .map_err(|_| DRIVE_NETWORK_UNAVAILABLE.to_string())?;
    if res.status() == reqwest::StatusCode::UNAUTHORIZED {
        return Err(crate::commands::auth_rejected_error(
            "requête Drive refusée",
        ));
    }
    if !res.status().is_success() {
        return Err(format!("HTTP {}", res.status()));
    }
    let body = res
        .bytes()
        .await
        .map_err(|_| DRIVE_NETWORK_UNAVAILABLE.to_string())?;
    serde_json::from_slice::<T>(&body).map_err(|error| format!("réponse invalide : {error}"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn auth_rejection_aborts_file_reconciliation_before_cursor_advance() {
        assert!(should_abort_pull_for_auth(
            "DRIVE_AUTH_REJECTED: download-url refusé"
        ));
        assert!(!should_abort_pull_for_auth(
            "blob refusé (HTTP 401 Unauthorized)"
        ));
        assert!(!should_abort_pull_for_auth("réseau indisponible"));
    }

    #[test]
    fn pull_transport_failure_is_classified_offline() {
        assert!(crate::net_state::looks_like_network_error(
            DRIVE_NETWORK_UNAVAILABLE
        ));
    }

    #[test]
    fn truncated_json_body_is_classified_offline() {
        use std::io::{Read, Write};
        use std::net::TcpListener;

        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let address = listener.local_addr().unwrap();
        let server = std::thread::spawn(move || {
            let (mut socket, _) = listener.accept().unwrap();
            let mut request = [0_u8; 4096];
            let _ = socket.read(&mut request);
            socket
                .write_all(
                    b"HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: 64\r\nConnection: close\r\n\r\n{\"partial\":true",
                )
                .unwrap();
        });

        let error = tauri::async_runtime::block_on(async {
            let client = reqwest::Client::builder()
                .timeout(Duration::from_secs(2))
                .build()
                .unwrap();
            get_json::<serde_json::Value>(&client, &format!("http://{address}/"), "token")
                .await
                .unwrap_err()
        });
        server.join().unwrap();

        assert_eq!(error, DRIVE_NETWORK_UNAVAILABLE);
        assert!(crate::net_state::looks_like_network_error(&error));
    }

    #[test]
    fn complete_malformed_json_is_not_classified_offline() {
        use std::io::{Read, Write};
        use std::net::TcpListener;

        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let address = listener.local_addr().unwrap();
        let body = b"{not-json}";
        let server = std::thread::spawn(move || {
            let (mut socket, _) = listener.accept().unwrap();
            let mut request = [0_u8; 4096];
            let _ = socket.read(&mut request);
            write!(
                socket,
                "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n",
                body.len()
            )
            .unwrap();
            socket.write_all(body).unwrap();
        });

        let error = tauri::async_runtime::block_on(async {
            let client = reqwest::Client::builder()
                .timeout(Duration::from_secs(2))
                .build()
                .unwrap();
            get_json::<serde_json::Value>(&client, &format!("http://{address}/"), "token")
                .await
                .unwrap_err()
        });
        server.join().unwrap();

        assert!(error.starts_with("réponse invalide :"));
        assert!(!crate::net_state::looks_like_network_error(&error));
    }

    #[test]
    fn tree_response_deserializes_from_api_shape() {
        // Forme réelle renvoyée par openpulse-gestion-drive-api (schemas.py).
        let raw = r#"{
          "space_id": "a67ab1a1-0000-0000-0000-000000000000",
          "folders": [{
            "id": "b1", "space_id": "a67ab1a1", "parent_id": null,
            "name": "tests", "path": "tests", "status": "active",
            "updated_at": "2026-07-07T18:00:00Z"
          }],
          "files": [{
            "id": "f1", "space_id": "a67ab1a1", "folder_id": "b1",
            "name": "upload.txt", "path": "tests/upload.txt",
            "content_type": "text/plain", "size_bytes": 12,
            "sha256": null, "etag": "\"0x8DD\"", "current_version": 2,
            "status": "active", "updated_at": "2026-07-07T18:00:00Z"
          }]
        }"#;
        let tree: ApiTreeResponse = serde_json::from_str(raw).unwrap();
        assert_eq!(tree.files.len(), 1);
        let f = &tree.files[0];
        assert_eq!(f.path, "tests/upload.txt");
        assert_eq!(f.current_version, 2);
        assert_eq!(f.folder_id.as_deref(), Some("b1"));
    }

    #[test]
    fn changes_response_deserializes() {
        let raw = r#"{
          "space_id": "s", "since_event_id": 0, "last_event_id": 7,
          "events": [{"id": 7, "space_id": "s", "file_id": "f",
                      "folder_id": null, "event_type": "file_created",
                      "payload": {"path": "a.txt", "version": 1},
                      "created_at": "2026-07-07T18:00:00Z"}],
          "has_more": false
        }"#;
        let ch: ApiChangesResponse = serde_json::from_str(raw).unwrap();
        assert_eq!(ch.last_event_id, 7);
    }

    #[test]
    fn abs_path_is_built_per_segment() {
        let p = to_abs_path(Path::new("/root"), "openpulse-general/Contrats/doc.pdf");
        let expected: PathBuf = ["/root", "openpulse-general", "Contrats", "doc.pdf"]
            .iter()
            .collect();
        assert_eq!(p, expected);
    }

    #[test]
    fn safe_destination_accepts_regular_parent_under_root() {
        let root = tempfile::tempdir().unwrap();
        let target = root.path().join("space").join("folder").join("file.txt");
        ensure_safe_destination(root.path(), &target).unwrap();
        assert!(target.parent().unwrap().is_dir());
    }

    #[cfg(unix)]
    #[test]
    fn safe_destination_rejects_intermediate_symlink() {
        use std::os::unix::fs::symlink;
        let root = tempfile::tempdir().unwrap();
        let outside = tempfile::tempdir().unwrap();
        std::fs::create_dir_all(root.path().join("space")).unwrap();
        symlink(outside.path(), root.path().join("space").join("escape")).unwrap();
        let target = root.path().join("space").join("escape").join("file.txt");
        let error = ensure_safe_destination(root.path(), &target).unwrap_err();
        assert!(error.contains("lien symbolique interdit"));
        assert!(!outside.path().join("file.txt").exists());
    }

    #[test]
    fn remote_move_relocates_idle_local_file_by_file_id() {
        let root = tempfile::tempdir().unwrap();
        let conn = sync_core::db::open_in_memory().unwrap();
        std::fs::create_dir_all(root.path().join("space/old")).unwrap();
        std::fs::write(root.path().join("space/old/a.txt"), b"x").unwrap();
        let local = LocalFile {
            local_path: "space/old/a.txt".into(),
            space_id: "s1".into(),
            file_id: Some("f1".into()),
            folder_id: None,
            sha256: None,
            etag: None,
            version: 1,
            size_bytes: 1,
            mtime: 0,
            sync_state: SyncState::Idle,
            pin_state: Default::default(),
            last_error: None,
            updated_at: 0,
        };
        db::upsert_local_file(&conn, &local).unwrap();
        let remote = ApiFileNode {
            id: "f1".into(),
            folder_id: None,
            path: "/new/a.txt".into(),
            size_bytes: 1,
            sha256: None,
            etag: None,
            current_version: 1,
            status: "active".into(),
        };
        reconcile_remote_paths(&conn, root.path(), "space", "s1", &[&remote]).unwrap();
        assert!(!root.path().join("space/old/a.txt").exists());
        assert!(root.path().join("space/new/a.txt").exists());
        assert!(db::get_local_file(&conn, "space/old/a.txt")
            .unwrap()
            .is_none());
        assert!(db::get_local_file(&conn, "space/new/a.txt")
            .unwrap()
            .is_some());
    }

    #[test]
    fn remote_delete_removes_only_idle_known_local_file() {
        let root = tempfile::tempdir().unwrap();
        let conn = sync_core::db::open_in_memory().unwrap();
        std::fs::create_dir_all(root.path().join("space")).unwrap();
        std::fs::write(root.path().join("space/a.txt"), b"x").unwrap();
        let local = LocalFile {
            local_path: "space/a.txt".into(),
            space_id: "s1".into(),
            file_id: Some("f1".into()),
            folder_id: None,
            sha256: Some(sync_core::hashing::sha256_hex(b"x")),
            etag: None,
            version: 1,
            size_bytes: 1,
            mtime: 0,
            sync_state: SyncState::Idle,
            pin_state: Default::default(),
            last_error: None,
            updated_at: 0,
        };
        db::upsert_local_file(&conn, &local).unwrap();
        reconcile_remote_paths(&conn, root.path(), "space", "s1", &[]).unwrap();
        assert!(!root.path().join("space/a.txt").exists());
        assert!(db::get_local_file(&conn, "space/a.txt").unwrap().is_none());
    }

    #[test]
    fn remote_delete_preserves_unscanned_local_modification_as_conflict() {
        let root = tempfile::tempdir().unwrap();
        let conn = sync_core::db::open_in_memory().unwrap();
        std::fs::create_dir_all(root.path().join("space")).unwrap();
        std::fs::write(root.path().join("space/a.txt"), b"local-change").unwrap();
        let local = LocalFile {
            local_path: "space/a.txt".into(),
            space_id: "s1".into(),
            file_id: Some("f1".into()),
            folder_id: None,
            sha256: Some(sync_core::hashing::sha256_hex(b"old-remote")),
            etag: None,
            version: 1,
            size_bytes: 10,
            mtime: 0,
            sync_state: SyncState::Idle,
            pin_state: Default::default(),
            last_error: None,
            updated_at: 0,
        };
        db::upsert_local_file(&conn, &local).unwrap();
        reconcile_remote_paths(&conn, root.path(), "space", "s1", &[]).unwrap();
        assert!(root.path().join("space/a.txt").exists());
        let preserved = db::get_local_file(&conn, "space/a.txt").unwrap().unwrap();
        assert_eq!(preserved.sync_state, SyncState::Conflict);
        assert!(preserved.last_error.unwrap().contains("conservé"));
    }

    #[test]
    fn pull_notification_only_when_actionable() {
        let mut p = PullProgress {
            phase: "done".into(),
            ..Default::default()
        };
        assert!(drive_notification_for_pull(&p).is_none());

        p.downloaded_files = 2;
        let (title, body) = drive_notification_for_pull(&p).expect("download notification");
        assert!(title.contains("nouveaux fichiers"));
        assert!(body.contains("2 fichier"));

        p.phase = "error".into();
        p.failed_files = 1;
        let (title, body) = drive_notification_for_pull(&p).expect("error notification");
        assert!(title.contains("à vérifier"));
        assert!(body.contains("1 échec"));
    }
}
