//! Actions contextuelles Drive (« OneDrive-like ») — commandes IPC.
//!
//! Copier le lien, ouvrir dans Gestion web, révéler dans le Finder,
//! « toujours garder sur cet appareil » (pin), « libérer de l'espace »
//! (éviction). Les décisions pures (actions disponibles, garde-fous
//! d'éviction, construction d'URL) vivent dans `sync_core::actions` ;
//! ce module ne fait que l'orchestration presse-papiers / opener / SQLite.
//!
//! ⚠️ Périmètre honnête : ces actions sont accessibles depuis l'app
//! (écran Fichiers + tray), PAS depuis le menu clic-droit du Finder.
//! L'intégration Finder native exige une extension File Provider signée
//! Apple Developer — voir `docs/macos-file-provider-vs-finder-sync.md`.

use serde::Serialize;
use tauri::{AppHandle, State};
use tauri_plugin_opener::OpenerExt;

#[cfg(any(target_os = "macos", target_os = "windows"))]
use std::io::Write;
#[cfg(any(target_os = "macos", target_os = "windows"))]
use std::process::{Command, Stdio};

use sync_core::actions::{
    abs_path, available_actions, perform_evict, request_download, share_link, space_link,
    DownloadRequestError, EvictError, EvictReport, FileAction,
};
use sync_core::db;
use sync_core::models::{LocalFile, PinState};

use crate::AppState;

/// Entrée de l'écran « Fichiers » : état du fichier + actions proposables.
#[derive(Debug, Serialize)]
pub struct FileEntry {
    #[serde(flatten)]
    pub file: LocalFile,
    pub actions: Vec<FileAction>,
}

fn open_db(state: &AppState) -> Result<rusqlite::Connection, String> {
    db::open_and_migrate(&state.db_path()).map_err(|e| e.to_string())
}

fn require_sync_root(state: &AppState) -> Result<std::path::PathBuf, String> {
    state
        .config
        .lock()
        .map_err(|e| e.to_string())?
        .sync_root
        .clone()
        .ok_or_else(|| "Dossier local non défini : choisissez un dossier".to_string())
}

fn web_base_url(state: &AppState) -> Result<String, String> {
    Ok(state
        .config
        .lock()
        .map_err(|e| e.to_string())?
        .web_base_url
        .clone())
}

#[cfg(target_os = "macos")]
fn write_clipboard_text(value: &str) -> Result<(), String> {
    let mut child = Command::new("/usr/bin/pbcopy")
        .stdin(Stdio::piped())
        .spawn()
        .map_err(|error| format!("Presse-papiers indisponible : {error}"))?;
    child
        .stdin
        .as_mut()
        .ok_or_else(|| "Entrée presse-papiers indisponible".to_string())?
        .write_all(value.as_bytes())
        .map_err(|error| format!("Presse-papiers indisponible : {error}"))?;
    let status = child
        .wait()
        .map_err(|error| format!("Presse-papiers indisponible : {error}"))?;
    if status.success() {
        Ok(())
    } else {
        Err("La copie vers le presse-papiers a échoué".to_string())
    }
}

#[cfg(target_os = "windows")]
fn write_clipboard_text(value: &str) -> Result<(), String> {
    let mut child = Command::new("powershell.exe")
        .args([
            "-NoLogo",
            "-NoProfile",
            "-NonInteractive",
            "-Command",
            "$input | Set-Clipboard",
        ])
        .stdin(Stdio::piped())
        .spawn()
        .map_err(|error| format!("Presse-papiers indisponible : {error}"))?;
    child
        .stdin
        .as_mut()
        .ok_or_else(|| "Entrée presse-papiers indisponible".to_string())?
        .write_all(value.as_bytes())
        .map_err(|error| format!("Presse-papiers indisponible : {error}"))?;
    let status = child
        .wait()
        .map_err(|error| format!("Presse-papiers indisponible : {error}"))?;
    if status.success() {
        Ok(())
    } else {
        Err("La copie vers le presse-papiers a échoué".to_string())
    }
}

#[cfg(not(any(target_os = "macos", target_os = "windows")))]
fn write_clipboard_text(_value: &str) -> Result<(), String> {
    Err("La copie de lien n'est prise en charge que sur macOS et Windows".to_string())
}

fn get_indexed_file(state: &AppState, local_path: &str) -> Result<LocalFile, String> {
    let conn = open_db(state)?;
    db::get_local_file(&conn, local_path)
        .map_err(|e| e.to_string())?
        .ok_or_else(|| format!("Fichier inconnu de l'index : {local_path}"))
}

// ---------------------------------------------------------------------------
// Listing + actions disponibles
// ---------------------------------------------------------------------------

/// Liste paginée de l'index local pour l'écran « Fichiers ».
#[tauri::command]
pub fn list_local_files(
    state: State<'_, AppState>,
    limit: Option<i64>,
    offset: Option<i64>,
) -> Result<Vec<FileEntry>, String> {
    let conn = open_db(&state)?;
    let limit = limit.unwrap_or(500).clamp(1, 2000);
    let offset = offset.unwrap_or(0).max(0);
    let files = db::list_local_files(&conn, limit, offset).map_err(|e| e.to_string())?;
    Ok(files
        .into_iter()
        .map(|f| FileEntry {
            actions: available_actions(&f),
            file: f,
        })
        .collect())
}

/// Actions contextuelles proposables pour un fichier (menu clic droit UI).
#[tauri::command]
pub fn drive_file_actions(
    state: State<'_, AppState>,
    local_path: String,
) -> Result<Vec<FileAction>, String> {
    let file = get_indexed_file(&state, &local_path)?;
    Ok(available_actions(&file))
}

// ---------------------------------------------------------------------------
// Lien & ouverture web
// ---------------------------------------------------------------------------

/// « Copier le lien » : construit l'URL Gestion web du fichier et la met au
/// presse-papiers. Retourne l'URL copiée (affichage toast côté UI).
#[tauri::command]
pub fn copy_drive_link(state: State<'_, AppState>, local_path: String) -> Result<String, String> {
    let file = get_indexed_file(&state, &local_path)?;
    let url = share_link(&web_base_url(&state)?, &file)
        .ok_or_else(|| "Ce fichier n'a pas encore été envoyé vers Gestion Drive".to_string())?;
    write_clipboard_text(&url)?;
    Ok(url)
}

/// « Ouvrir dans Gestion » : ouvre le fichier (ou son espace) dans Gestion web
/// via le navigateur par défaut.
#[tauri::command]
pub fn open_in_gestion(
    app: AppHandle,
    state: State<'_, AppState>,
    local_path: String,
) -> Result<String, String> {
    let file = get_indexed_file(&state, &local_path)?;
    let base = web_base_url(&state)?;
    // Repli espace : fichier local jamais uploadé → on ouvre l'espace.
    let url = share_link(&base, &file).unwrap_or_else(|| space_link(&base, &file.space_id));
    app.opener()
        .open_url(url.clone(), None::<&str>)
        .map_err(|e| format!("Ouverture impossible : {e}"))?;
    Ok(url)
}

/// « Afficher dans le Finder » (macOS) / l'Explorateur (Windows).
#[tauri::command]
pub fn reveal_in_file_manager(
    app: AppHandle,
    state: State<'_, AppState>,
    local_path: String,
) -> Result<(), String> {
    let root = require_sync_root(&state)?;
    let abs = abs_path(&root, &local_path);
    if !abs.exists() {
        return Err("Le fichier n'a pas de copie locale (libéré de l'espace)".to_string());
    }
    app.opener()
        .reveal_item_in_dir(&abs)
        .map_err(|e| format!("Révélation impossible : {e}"))
}

/// Ouvre le dossier racine Gestion Drive dans le Finder/Explorateur
/// (utilisé par le tray et l'UI).
#[tauri::command]
pub fn open_sync_root(app: AppHandle, state: State<'_, AppState>) -> Result<(), String> {
    let root = require_sync_root(&state)?;
    app.opener()
        .open_path(root.to_string_lossy().to_string(), None::<&str>)
        .map_err(|e| format!("Ouverture du dossier impossible : {e}"))
}

// ---------------------------------------------------------------------------
// Pin / éviction
// ---------------------------------------------------------------------------

/// Résultat d'un épinglage : si le fichier était évincé, un téléchargement
/// est nécessaire pour le re-matérialiser (l'UI déclenche `run_pull_sync`).
#[derive(Debug, Serialize)]
pub struct PinResult {
    pub local_path: String,
    pub pin_state: PinState,
    pub needs_download: bool,
}

/// « Toujours garder sur cet appareil ».
#[tauri::command]
pub fn pin_file(state: State<'_, AppState>, local_path: String) -> Result<PinResult, String> {
    let file = get_indexed_file(&state, &local_path)?;
    let was_evicted = file.pin_state == PinState::Evicted;
    let conn = open_db(&state)?;
    if !db::set_pin_state(&conn, &local_path, PinState::Pinned).map_err(|e| e.to_string())? {
        return Err(format!("Fichier inconnu de l'index : {local_path}"));
    }
    Ok(PinResult {
        local_path,
        pin_state: PinState::Pinned,
        needs_download: was_evicted,
    })
}

/// Retire l'épinglage (le fichier redevient évincable).
#[tauri::command]
pub fn unpin_file(state: State<'_, AppState>, local_path: String) -> Result<PinResult, String> {
    let conn = open_db(&state)?;
    if !db::set_pin_state(&conn, &local_path, PinState::Unpinned).map_err(|e| e.to_string())? {
        return Err(format!("Fichier inconnu de l'index : {local_path}"));
    }
    Ok(PinResult {
        local_path,
        pin_state: PinState::Unpinned,
        needs_download: false,
    })
}

/// « Libérer de l'espace » : supprime la copie locale (garde-fous dans
/// `sync_core::actions::perform_evict` — pin, modifs en attente, sha).
#[tauri::command]
pub fn evict_file(state: State<'_, AppState>, local_path: String) -> Result<EvictReport, String> {
    let root = require_sync_root(&state)?;
    let conn = open_db(&state)?;
    perform_evict(&conn, &root, &local_path).map_err(|e| match e {
        EvictError::Refused(r) => format!("Libération refusée : {r:?}"),
        other => other.to_string(),
    })
}

/// « Télécharger » : re-matérialise un fichier « libéré » sans l'épingler
/// (`pin_state` repasse à `unpinned` ; l'UI déclenche `run_pull_sync`).
#[tauri::command]
pub fn download_file(state: State<'_, AppState>, local_path: String) -> Result<PinResult, String> {
    let conn = open_db(&state)?;
    let updated = request_download(&conn, &local_path).map_err(|e| match e {
        DownloadRequestError::NotEvicted => {
            "Ce fichier a déjà une copie locale : rien à télécharger".to_string()
        }
        other => other.to_string(),
    })?;
    Ok(PinResult {
        local_path,
        pin_state: updated.pin_state,
        needs_download: true,
    })
}

// ---------------------------------------------------------------------------
// Pause / reprise de la synchronisation (tray + préférences)
// ---------------------------------------------------------------------------

#[derive(Debug, Serialize)]
pub struct PauseState {
    pub paused: bool,
}

#[tauri::command]
pub fn set_sync_paused(state: State<'_, AppState>, paused: bool) -> Result<PauseState, String> {
    crate::preferences::persist_sync_paused(&state, paused)?;
    Ok(PauseState { paused })
}

#[tauri::command]
pub fn get_sync_paused(state: State<'_, AppState>) -> Result<PauseState, String> {
    Ok(PauseState {
        paused: *state.sync_paused.lock().map_err(|e| e.to_string())?,
    })
}
