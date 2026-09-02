//! Commandes IPC exposées au front React.
//!
//! Auth et espaces réels via l'API Drive Azure. Les access/refresh tokens restent
//! dans Keychain/Credential Manager — jamais dans la config, session.json ou SQLite.

use serde::{Deserialize, Serialize};
use std::fs;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tauri::State;

use sync_core::models::Space;

const SESSION_FILE_NAME: &str = "session.json";
const KEYRING_SERVICE: &str = "com.marqueia.gestion-drive";
const KEYRING_ACCESS_ACCOUNT: &str = "drive-access-token";
const KEYRING_REFRESH_ACCOUNT: &str = "drive-refresh-token";
const ACCESS_TOKEN_REFRESH_WINDOW_SECS: i64 = 5 * 60;

pub(crate) fn access_token_needs_refresh(now: i64, expires_at: Option<i64>) -> bool {
    expires_at
        .map(|expiry| expiry.saturating_sub(now) <= ACCESS_TOKEN_REFRESH_WINDOW_SECS)
        .unwrap_or(true)
}

fn should_refresh_access_token(
    current_token: Option<&str>,
    rejected_token: Option<&str>,
    now: i64,
    expires_at: Option<i64>,
) -> bool {
    match rejected_token {
        Some(rejected) => current_token.is_none_or(|current| current == rejected),
        None => current_token.is_none() || access_token_needs_refresh(now, expires_at),
    }
}

pub(crate) fn refresh_failure_revokes_session(status: u16, code: Option<&str>) -> bool {
    status == 401 && code == Some("refresh_revoked")
}

fn has_usable_refresh_token(token: Option<&str>) -> bool {
    token.is_some_and(|value| !value.is_empty())
}

fn web_auth_is_enabled(preferences: &crate::preferences::AppPreferences) -> bool {
    preferences.drive_auto_connect
}

use crate::AppState;

pub(crate) const DRIVE_AUTH_REJECTED: &str = "DRIVE_AUTH_REJECTED";

pub(crate) fn auth_rejected_error(context: &str) -> String {
    format!("{DRIVE_AUTH_REJECTED}: {context}")
}

pub(crate) fn is_auth_rejected(message: &str) -> bool {
    message.contains(DRIVE_AUTH_REJECTED)
}

pub(crate) fn mark_access_token_for_refresh(state: &AppState) {
    if let Ok(mut expires_at) = state.access_token_expires_at.lock() {
        *expires_at = None;
    }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
struct PersistedSession {
    #[serde(default, skip_serializing)]
    access_token: Option<String>,
    #[serde(default)]
    access_token_expires_at: Option<i64>,
    user_email: String,
    display_name: String,
}

fn now_epoch() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_secs() as i64)
        .unwrap_or(0)
}

fn keyring_entry(account: &str) -> Result<keyring::Entry, String> {
    keyring::Entry::new(KEYRING_SERVICE, account)
        .map_err(|e| format!("Coffre système indisponible: {e}"))
}

fn store_access_token(token: &str) -> Result<(), String> {
    keyring_entry(KEYRING_ACCESS_ACCOUNT)?
        .set_password(token)
        .map_err(|e| format!("Token non enregistré dans le coffre système: {e}"))
}

fn load_access_token() -> Result<String, String> {
    keyring_entry(KEYRING_ACCESS_ACCOUNT)?
        .get_password()
        .map_err(|_| "Session Drive absente du coffre système".to_string())
}

fn store_refresh_token(token: &str) -> Result<(), String> {
    keyring_entry(KEYRING_REFRESH_ACCOUNT)?
        .set_password(token)
        .map_err(|e| format!("Refresh token non enregistré dans le coffre système: {e}"))
}

fn load_refresh_token() -> Result<String, String> {
    keyring_entry(KEYRING_REFRESH_ACCOUNT)?
        .get_password()
        .map_err(|_| "Refresh token Drive absent du coffre système".to_string())
}

fn delete_keyring_entry(account: &str) {
    if let Ok(entry) = keyring_entry(account) {
        let _ = entry.delete_credential();
    }
}

#[cfg(not(test))]
fn delete_credentials() {
    delete_keyring_entry(KEYRING_ACCESS_ACCOUNT);
    delete_keyring_entry(KEYRING_REFRESH_ACCOUNT);
}

#[cfg(test)]
static TEST_CREDENTIAL_PURGE_COUNT: std::sync::atomic::AtomicUsize =
    std::sync::atomic::AtomicUsize::new(0);

#[cfg(test)]
fn delete_credentials() {
    // Les tests ne doivent jamais toucher le trousseau réel du développeur/runner.
    TEST_CREDENTIAL_PURGE_COUNT.fetch_add(1, std::sync::atomic::Ordering::SeqCst);
}

#[cfg(not(test))]
async fn revoke_remote_refresh(state: &AppState) -> Result<(), String> {
    let refresh_token = match load_refresh_token() {
        Ok(token) => token,
        Err(_) => return Ok(()),
    };
    let api_base_url = state
        .config
        .lock()
        .map_err(|e| e.to_string())?
        .api_base_url
        .trim_end_matches('/')
        .to_string();
    let response = reqwest::Client::builder()
        .timeout(Duration::from_secs(3))
        .build()
        .map_err(|e| format!("Client de révocation impossible: {e}"))?
        .post(format!("{api_base_url}/api/drive/desktop/logout"))
        .json(&serde_json::json!({ "refresh_token": refresh_token }))
        .send()
        .await
        .map_err(|e| format!("Révocation distante indisponible: {e}"))?;
    if response.status().is_success() {
        Ok(())
    } else {
        Err(format!(
            "Révocation distante refusée (HTTP {})",
            response.status()
        ))
    }
}

#[cfg(test)]
async fn revoke_remote_refresh(_state: &AppState) -> Result<(), String> {
    Ok(())
}

fn session_path(state: &AppState) -> std::path::PathBuf {
    state.data_dir.join(SESSION_FILE_NAME)
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SessionInfo {
    pub user_email: String,
    pub display_name: String,
    pub device_registered: bool,
}

#[derive(Debug, Serialize)]
pub struct SyncStatus {
    pub state: String, // idle | syncing | paused | error | offline
    pub pending_uploads: i64,
    pub pending_downloads: i64,
    pub conflicts: i64,
    pub errors: i64,
    pub last_sync_at: Option<i64>,
}

#[derive(Deserialize)]
struct DesktopLoginResponse {
    access_token: String,
    #[serde(default)]
    refresh_token: Option<String>,
    expires_at: i64,
    user_email: String,
    display_name: String,
}

fn write_session_metadata(state: &AppState, session: &PersistedSession) -> Result<(), String> {
    let raw = serde_json::to_vec_pretty(session).map_err(|e| e.to_string())?;
    let path = session_path(state);
    fs::write(&path, raw).map_err(|e| format!("Session non persistée: {e}"))?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(&path, fs::Permissions::from_mode(0o600))
            .map_err(|e| format!("Permissions de session non sécurisées: {e}"))?;
    }
    Ok(())
}

fn store_desktop_session(
    state: &AppState,
    payload: &DesktopLoginResponse,
) -> Result<SessionInfo, String> {
    let has_refresh_token = has_usable_refresh_token(payload.refresh_token.as_deref());
    if let Some(refresh_token) = payload
        .refresh_token
        .as_deref()
        .filter(|token| !token.is_empty())
    {
        store_refresh_token(refresh_token)?;
    } else {
        delete_keyring_entry(KEYRING_REFRESH_ACCOUNT);
    }
    if let Err(error) = store_access_token(&payload.access_token) {
        if has_refresh_token {
            delete_keyring_entry(KEYRING_REFRESH_ACCOUNT);
        }
        return Err(error);
    }
    let persisted = PersistedSession {
        access_token: None,
        access_token_expires_at: Some(payload.expires_at),
        user_email: payload.user_email.clone(),
        display_name: payload.display_name.clone(),
    };
    if let Err(error) = write_session_metadata(state, &persisted) {
        delete_credentials();
        return Err(error);
    }
    *state.access_token.lock().map_err(|e| e.to_string())? = Some(payload.access_token.clone());
    *state
        .access_token_expires_at
        .lock()
        .map_err(|e| e.to_string())? = Some(payload.expires_at);
    *state
        .refresh_token_available
        .lock()
        .map_err(|e| e.to_string())? = has_refresh_token;
    Ok(SessionInfo {
        user_email: payload.user_email.clone(),
        display_name: payload.display_name.clone(),
        device_registered: true,
    })
}

fn purge_session(state: &AppState) -> Result<(), String> {
    let mut errors = Vec::new();
    match state.access_token.lock() {
        Ok(mut token) => *token = None,
        Err(error) => errors.push(error.to_string()),
    }
    match state.access_token_expires_at.lock() {
        Ok(mut expires_at) => *expires_at = None,
        Err(error) => errors.push(error.to_string()),
    }
    match state.refresh_token_available.lock() {
        Ok(mut available) => *available = false,
        Err(error) => errors.push(error.to_string()),
    }
    // Ces opérations sont toujours tentées, même si un mutex mémoire est empoisonné.
    delete_credentials();
    let path = session_path(state);
    if path.exists() {
        if let Err(error) = fs::remove_file(path) {
            errors.push(format!("Suppression session.json impossible: {error}"));
        }
    }
    if errors.is_empty() {
        Ok(())
    } else {
        Err(errors.join("; "))
    }
}

pub(crate) async fn ensure_access_token(
    state: &AppState,
    rejected_token: Option<&str>,
) -> Result<String, String> {
    let _refresh_guard = state.auth_refresh.lock().await;
    let current_token = state
        .access_token
        .lock()
        .map_err(|e| e.to_string())?
        .clone();
    let expires_at = *state
        .access_token_expires_at
        .lock()
        .map_err(|e| e.to_string())?;
    if !should_refresh_access_token(
        current_token.as_deref(),
        rejected_token,
        now_epoch(),
        expires_at,
    ) {
        return current_token
            .ok_or_else(|| "SESSION_REAUTH_REQUIRED: Session Drive absente".into());
    }

    let refresh_token = load_refresh_token().map_err(|_| {
        "SESSION_REAUTH_REQUIRED: reconnectez-vous une fois pour activer la session persistante"
            .to_string()
    })?;
    let api_base_url = state
        .config
        .lock()
        .map_err(|e| e.to_string())?
        .api_base_url
        .trim_end_matches('/')
        .to_string();
    let response = reqwest::Client::builder()
        .timeout(Duration::from_secs(20))
        .build()
        .map_err(|e| format!("SESSION_REFRESH_UNAVAILABLE: Client HTTP impossible: {e}"))?
        .post(format!("{api_base_url}/api/drive/desktop/refresh"))
        .json(&serde_json::json!({ "refresh_token": refresh_token }))
        .send()
        .await
        .map_err(|e| format!("SESSION_REFRESH_UNAVAILABLE: API Drive inaccessible: {e}"))?;

    let status = response.status();
    if status == reqwest::StatusCode::UNAUTHORIZED {
        let payload = response
            .json::<serde_json::Value>()
            .await
            .unwrap_or_default();
        let code = payload
            .get("detail")
            .and_then(|detail| detail.get("code"))
            .and_then(serde_json::Value::as_str);
        if refresh_failure_revokes_session(status.as_u16(), code) {
            purge_session(state)?;
            return Err("SESSION_REVOKED: Session Desktop révoquée".into());
        }
        return Err(
            "SESSION_REFRESH_UNAVAILABLE: Réponse 401 non confirmée par l'API Drive".into(),
        );
    }
    if !status.is_success() {
        return Err(format!(
            "SESSION_REFRESH_UNAVAILABLE: Renouvellement refusé temporairement (HTTP {status})"
        ));
    }
    let payload: DesktopLoginResponse = response
        .json()
        .await
        .map_err(|e| format!("SESSION_REFRESH_UNAVAILABLE: Réponse refresh invalide: {e}"))?;
    if !has_usable_refresh_token(payload.refresh_token.as_deref()) {
        return Err("SESSION_REFRESH_UNAVAILABLE: Réponse refresh sans jeton rotatif".into());
    }
    let token = payload.access_token.clone();
    store_desktop_session(state, &payload)?;
    Ok(token)
}

#[derive(Debug, Deserialize)]
struct DriveSpaceResponse {
    id: String,
    name: String,
    slug: String,
    #[serde(rename = "type")]
    space_type: String,
    sensitivity: String,
    sync_policy: String,
}

/// Accepte uniquement un JWT Drive déjà échangé par la PWA. Le bearer du
/// fournisseur d'identité ne traverse jamais le shell Tauri.
#[tauri::command]
pub async fn login_with_drive_session(
    state: State<'_, AppState>,
    access_token: String,
    refresh_token: String,
    expires_at: i64,
    user_email: String,
    display_name: String,
) -> Result<SessionInfo, String> {
    let access_token = access_token.trim();
    let refresh_token = refresh_token.trim();
    let now = now_epoch();
    if access_token.len() < 20 || access_token.len() > 16_384 {
        return Err("Jeton Drive invalide".into());
    }
    if refresh_token.len() < 32 || refresh_token.len() > 1024 {
        return Err("Jeton de renouvellement Drive invalide".into());
    }
    if expires_at <= now + 30 || expires_at > now + 86_400 {
        return Err("Expiration du jeton Drive invalide".into());
    }
    if !user_email.contains('@') || user_email.len() > 320 || display_name.len() > 256 {
        return Err("Identité Drive invalide".into());
    }

    let _sync_guard = state.sync_operation.clone().lock_owned().await;
    let _auth_guard = state.auth_refresh.lock().await;
    let web_auth_enabled = {
        let preferences = state.preferences.lock().map_err(|e| e.to_string())?;
        web_auth_is_enabled(&preferences)
    };
    if !web_auth_enabled {
        return Err("WEB_AUTH_DISABLED: reconnexion Drive automatique désactivée".into());
    }
    let payload = DesktopLoginResponse {
        access_token: access_token.to_string(),
        refresh_token: Some(refresh_token.to_string()),
        expires_at,
        user_email,
        display_name,
    };
    store_desktop_session(&state, &payload)
}

pub(crate) fn restore_saved_session_state(state: &AppState) -> Result<Option<SessionInfo>, String> {
    let path = session_path(state);
    if !path.exists() {
        return Ok(None);
    }
    let raw = fs::read(&path).map_err(|e| format!("Session illisible: {e}"))?;
    let persisted: PersistedSession =
        serde_json::from_slice(&raw).map_err(|e| format!("Session locale invalide: {e}"))?;
    if let Some(legacy_token) = persisted.access_token.as_deref() {
        store_access_token(legacy_token)?;
        let migrated = PersistedSession {
            access_token: None,
            access_token_expires_at: persisted.access_token_expires_at,
            user_email: persisted.user_email.clone(),
            display_name: persisted.display_name.clone(),
        };
        fs::write(
            &path,
            serde_json::to_vec_pretty(&migrated).map_err(|e| e.to_string())?,
        )
        .map_err(|e| format!("Migration session impossible: {e}"))?;
    }
    let token = load_access_token().ok();
    let has_refresh_token = load_refresh_token().is_ok();
    if token.is_none() && !has_refresh_token {
        return Err("Session Drive absente du coffre système".into());
    }
    *state.access_token.lock().map_err(|e| e.to_string())? = token;
    *state
        .access_token_expires_at
        .lock()
        .map_err(|e| e.to_string())? = persisted.access_token_expires_at;
    *state
        .refresh_token_available
        .lock()
        .map_err(|e| e.to_string())? = has_refresh_token;
    Ok(Some(SessionInfo {
        user_email: persisted.user_email,
        display_name: persisted.display_name,
        device_registered: true,
    }))
}

#[tauri::command]
pub async fn get_saved_session(state: State<'_, AppState>) -> Result<Option<SessionInfo>, String> {
    let _sync_guard = state.sync_operation.clone().lock_owned().await;
    let _auth_guard = state.auth_refresh.lock().await;
    restore_saved_session_state(&state)
}

async fn logout_state(state: &AppState) -> Result<(), String> {
    // L'échec disque des préférences ne doit jamais court-circuiter la purge.
    // persist_drive_auto_connect pose d'abord le tombstone en mémoire.
    let mut errors = Vec::new();
    if let Err(error) = crate::preferences::persist_drive_auto_connect(state, false) {
        errors.push(error);
    }
    let _sync_guard = state.sync_operation.clone().lock_owned().await;
    let _auth_guard = state.auth_refresh.lock().await;
    if let Err(error) = crate::preferences::persist_drive_auto_connect(state, false) {
        errors.push(error);
    }
    // La révocation serveur est best-effort : une coupure réseau ne doit jamais
    // empêcher la purge locale fail-closed du coffre et du tombstone.
    let _ = revoke_remote_refresh(state).await;
    if let Err(error) = purge_session(state) {
        errors.push(error);
    }
    if errors.is_empty() {
        Ok(())
    } else {
        Err(errors.join("; "))
    }
}

#[tauri::command]
pub async fn logout(state: State<'_, AppState>) -> Result<(), String> {
    logout_state(state.inner()).await
}

#[tauri::command]
pub fn set_drive_auto_connect(state: State<'_, AppState>, enabled: bool) -> Result<(), String> {
    crate::preferences::persist_drive_auto_connect(&state, enabled)
}

#[tauri::command]
pub fn get_config(state: State<'_, AppState>) -> Result<sync_core::config::ClientConfig, String> {
    Ok(state.config.lock().map_err(|e| e.to_string())?.clone())
}

/// Enregistre le dossier local de synchronisation choisi par l'utilisateur.
#[tauri::command]
pub fn set_sync_root(state: State<'_, AppState>, path: String) -> Result<(), String> {
    let p = std::path::PathBuf::from(&path);
    if !p.is_dir() {
        return Err(format!("Le dossier n'existe pas : {path}"));
    }
    let mut cfg = state.config.lock().map_err(|e| e.to_string())?;
    cfg.sync_root = Some(p);
    cfg.save(&state.data_dir).map_err(|e| e.to_string())
}

/// Liste réelle des espaces depuis l'API Drive Azure.
#[tauri::command]
pub async fn list_spaces_real(state: State<'_, AppState>) -> Result<Vec<Space>, String> {
    let _sync_guard = state.sync_operation.clone().lock_owned().await;
    let mut token = ensure_access_token(&state, None).await?;
    let api_base_url = state
        .config
        .lock()
        .map_err(|e| e.to_string())?
        .api_base_url
        .trim_end_matches('/')
        .to_string();
    let url = format!("{api_base_url}/api/drive/spaces");
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(20))
        .build()
        .map_err(|e| format!("Client HTTP impossible: {e}"))?;
    let mut response = client
        .get(&url)
        .bearer_auth(&token)
        .send()
        .await
        .map_err(|e| format!("API Drive inaccessible: {e}"))?;
    if response.status() == reqwest::StatusCode::UNAUTHORIZED {
        token = ensure_access_token(&state, Some(&token)).await?;
        response = client
            .get(&url)
            .bearer_auth(&token)
            .send()
            .await
            .map_err(|e| format!("API Drive inaccessible après renouvellement: {e}"))?;
    }
    if !response.status().is_success() {
        return Err(format!(
            "API Drive a refusé la requête (HTTP {})",
            response.status()
        ));
    }
    let spaces: Vec<DriveSpaceResponse> = response
        .json()
        .await
        .map_err(|e| format!("Réponse API Drive invalide: {e}"))?;
    let spaces: Vec<Space> = spaces
        .into_iter()
        .map(|s| Space {
            id: s.id,
            name: s.name,
            slug: s.slug,
            space_type: s.space_type,
            sync_policy: s.sync_policy,
            sensitivity: s.sensitivity,
        })
        .collect();
    // Mémorise pour que select_spaces filtre contre les vrais espaces
    // (et plus contre les mocks — bug : les UUIDs réels étaient rejetés).
    *state.known_spaces.lock().map_err(|e| e.to_string())? = spaces.clone();
    Ok(spaces)
}

/// Sélectionne les espaces à synchroniser (filtre les `web_only` côté serveur ET client).
/// Le filtre s'appuie sur les derniers espaces chargés depuis l'API ;
/// repli sur les mocks si aucun chargement réel n'a eu lieu (mode démo).
#[tauri::command]
pub fn select_spaces(
    state: State<'_, AppState>,
    space_ids: Vec<String>,
) -> Result<Vec<String>, String> {
    let known = {
        let k = state.known_spaces.lock().map_err(|e| e.to_string())?;
        if k.is_empty() {
            return Err("Chargez d'abord les espaces autorisés depuis l'API Drive".into());
        }
        k.clone()
    };
    let allowed: Vec<String> = known
        .into_iter()
        .filter(|s| s.is_syncable() && space_ids.contains(&s.id))
        .map(|s| s.id)
        .collect();
    let mut cfg = state.config.lock().map_err(|e| e.to_string())?;
    cfg.selected_space_ids = allowed.clone();
    cfg.save(&state.data_dir).map_err(|e| e.to_string())?;
    Ok(allowed)
}

/// Statut de sync agrégé pour l'UI et le tray (lit l'index SQLite).
#[tauri::command]
pub fn sync_status(state: State<'_, AppState>) -> Result<SyncStatus, String> {
    use sync_core::models::SyncState as S;
    let conn = sync_core::db::open_and_migrate(&state.db_path()).map_err(|e| e.to_string())?;
    let count = |s| sync_core::db::count_by_state(&conn, s).unwrap_or(0);
    let pending_uploads = count(S::PendingUpload) + count(S::Uploading);
    let pending_downloads = count(S::PendingDownload) + count(S::Downloading);
    let conflicts = count(S::Conflict);
    let errors = count(S::Error);
    let paused = *state.sync_paused.lock().map_err(|e| e.to_string())?;
    let offline = *state.network_offline.lock().map_err(|e| e.to_string())?;
    let last_sync_at = *state.last_sync_at.lock().map_err(|e| e.to_string())?;
    Ok(SyncStatus {
        state: aggregate_sync_state(
            paused,
            offline,
            pending_uploads + pending_downloads,
            errors + conflicts,
        )
        .into(),
        pending_uploads,
        pending_downloads,
        conflicts,
        errors,
        last_sync_at,
    })
}

/// Agrégation pure de l'état de sync affiché (testable sans Tauri).
/// Priorités : pause (choix utilisateur) > hors ligne > activité > erreurs.
pub fn aggregate_sync_state(
    paused: bool,
    offline: bool,
    pending: i64,
    errors_and_conflicts: i64,
) -> &'static str {
    if paused {
        "paused"
    } else if offline {
        "offline"
    } else if pending > 0 {
        "syncing"
    } else if errors_and_conflicts > 0 {
        "error"
    } else {
        "idle"
    }
}

#[cfg(test)]
mod tests {
    use super::{
        access_token_needs_refresh, aggregate_sync_state, has_usable_refresh_token, logout_state,
        refresh_failure_revokes_session, should_refresh_access_token, web_auth_is_enabled,
        DesktopLoginResponse, PersistedSession, SESSION_FILE_NAME, TEST_CREDENTIAL_PURGE_COUNT,
    };
    use crate::preferences::{AppPreferences, PREFERENCES_FILE_NAME};
    use crate::{notifications, push_sync, sync, sync_log, AppState};
    use std::sync::{Arc, Mutex};
    use sync_core::config::ClientConfig;

    #[test]
    fn access_token_refreshes_before_expiry_but_not_when_fresh() {
        assert!(access_token_needs_refresh(1_000, None));
        assert!(access_token_needs_refresh(1_000, Some(1_299)));
        assert!(!access_token_needs_refresh(1_000, Some(1_301)));
    }

    #[test]
    fn explicit_logout_tombstone_blocks_web_bridge_login() {
        let mut preferences = AppPreferences {
            drive_auto_connect: true,
            ..AppPreferences::default()
        };
        assert!(web_auth_is_enabled(&preferences));
        preferences.drive_auto_connect = false;
        assert!(!web_auth_is_enabled(&preferences));
    }

    #[test]
    fn logout_purges_session_even_when_preference_persistence_fails() {
        let data_dir = std::env::temp_dir().join(format!("gd-logout-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&data_dir).unwrap();
        std::fs::write(data_dir.join(SESSION_FILE_NAME), b"persisted-session").unwrap();
        // AppPreferences::save écrit d'abord ce chemin temporaire : un répertoire
        // force une erreur I/O sans empêcher la suppression de session.json.
        std::fs::create_dir(data_dir.join(format!("{PREFERENCES_FILE_NAME}.tmp"))).unwrap();
        let state = AppState {
            data_dir: data_dir.clone(),
            config: Mutex::new(ClientConfig::default()),
            access_token: Mutex::new(Some("drive-token".into())),
            access_token_expires_at: Mutex::new(Some(4_000_000_000)),
            auth_refresh: tokio::sync::Mutex::new(()),
            sync_operation: Arc::new(tokio::sync::Mutex::new(())),
            refresh_token_available: Mutex::new(true),
            known_spaces: Mutex::new(Vec::new()),
            pull: Mutex::new(sync::PullProgress::default()),
            push: Mutex::new(push_sync::PushProgress::default()),
            preferences: Mutex::new(AppPreferences::default()),
            notification_center: notifications::NotificationCenterState::default(),
            sync_log: sync_log::SyncLogState::default(),
            sync_paused: Mutex::new(false),
            network_offline: Mutex::new(false),
            last_sync_at: Mutex::new(None),
        };

        TEST_CREDENTIAL_PURGE_COUNT.store(0, std::sync::atomic::Ordering::SeqCst);
        let result = tauri::async_runtime::block_on(logout_state(&state));
        assert!(
            result.is_err(),
            "l'erreur de persistance doit rester visible"
        );
        assert!(state.access_token.lock().unwrap().is_none());
        assert!(state.access_token_expires_at.lock().unwrap().is_none());
        assert!(!*state.refresh_token_available.lock().unwrap());
        assert!(!state.data_dir.join(SESSION_FILE_NAME).exists());
        assert_eq!(
            TEST_CREDENTIAL_PURGE_COUNT.load(std::sync::atomic::Ordering::SeqCst),
            1
        );
        assert!(!state.preferences.lock().unwrap().drive_auto_connect);
        std::fs::remove_dir_all(data_dir).ok();
    }

    #[test]
    fn concurrent_rejection_reuses_token_already_rotated_by_first_waiter() {
        assert!(!should_refresh_access_token(
            Some("new-token"),
            Some("old-token"),
            1_000,
            Some(10_000),
        ));
        assert!(should_refresh_access_token(
            Some("old-token"),
            Some("old-token"),
            1_000,
            Some(10_000),
        ));
    }

    #[test]
    fn only_refresh_unauthorized_revokes_session() {
        assert!(refresh_failure_revokes_session(
            401,
            Some("refresh_revoked")
        ));
        assert!(!refresh_failure_revokes_session(401, None));
        assert!(!refresh_failure_revokes_session(401, Some("proxy_denied")));
        assert!(!refresh_failure_revokes_session(
            400,
            Some("refresh_revoked")
        ));
        assert!(!refresh_failure_revokes_session(429, None));
        assert!(!refresh_failure_revokes_session(500, None));
        assert!(!refresh_failure_revokes_session(502, None));
    }

    #[test]
    fn persisted_session_never_serializes_access_token() {
        let session = PersistedSession {
            access_token: Some("secret-token".into()),
            access_token_expires_at: Some(1_234_567),
            user_email: "user@example.test".into(),
            display_name: "User".into(),
        };
        let json = serde_json::to_string(&session).unwrap();
        let value: serde_json::Value = serde_json::from_str(&json).unwrap();
        assert!(!json.contains("secret-token"));
        assert!(value.get("access_token").is_none());
        assert_eq!(value["access_token_expires_at"], 1_234_567);
    }

    #[test]
    fn web_bridge_login_response_requires_drive_scoped_refresh_token() {
        let payload: DesktopLoginResponse = serde_json::from_value(serde_json::json!({
            "access_token": "drive-token",
            "refresh_token": "drive-refresh-token-opaque",
            "expires_at": 1_234_567,
            "user_email": "user@example.test",
            "display_name": "User"
        }))
        .expect("web token response must include a Drive-scoped refresh token");
        assert_eq!(
            payload.refresh_token.as_deref(),
            Some("drive-refresh-token-opaque")
        );
    }

    #[test]
    fn only_non_empty_drive_refresh_tokens_are_usable() {
        assert!(has_usable_refresh_token(Some("drive-refresh")));
        assert!(!has_usable_refresh_token(Some("")));
        assert!(!has_usable_refresh_token(None));
    }

    #[test]
    fn paused_wins_over_everything() {
        assert_eq!(aggregate_sync_state(true, true, 5, 5), "paused");
    }

    #[test]
    fn offline_wins_over_activity_and_errors() {
        assert_eq!(aggregate_sync_state(false, true, 5, 5), "offline");
    }

    #[test]
    fn pending_work_reports_syncing() {
        assert_eq!(aggregate_sync_state(false, false, 2, 0), "syncing");
    }

    #[test]
    fn errors_or_conflicts_report_error() {
        assert_eq!(aggregate_sync_state(false, false, 0, 1), "error");
    }

    #[test]
    fn quiet_state_is_idle() {
        assert_eq!(aggregate_sync_state(false, false, 0, 0), "idle");
    }
}
