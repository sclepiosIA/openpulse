//! Boucle de synchronisation réellement active en arrière-plan.
//!
//! Les versions précédentes persistaient `poll_interval_secs` et la pause sans
//! aucun consommateur runtime : fermer la fenêtre arrêtait donc tout travail
//! automatique. Cette boucle respecte session, dossier, pause et exclusion
//! mutuelle pull/push.

use std::time::Duration;

use tauri::{AppHandle, Manager};

use crate::AppState;

pub fn ready_for_background_sync(
    has_credentials: bool,
    has_sync_root: bool,
    paused: bool,
    pull_running: bool,
    push_running: bool,
) -> bool {
    has_credentials && has_sync_root && !paused && !pull_running && !push_running
}

fn snapshot(app: &AppHandle) -> Result<(bool, u64), String> {
    let state = app.state::<AppState>();
    let has_token = state
        .access_token
        .lock()
        .map_err(|e| e.to_string())?
        .is_some();
    let has_refresh_token = *state
        .refresh_token_available
        .lock()
        .map_err(|e| e.to_string())?;
    let has_sync_root = state
        .config
        .lock()
        .map_err(|e| e.to_string())?
        .sync_root
        .as_ref()
        .is_some_and(|p| p.is_dir());
    let paused = *state.sync_paused.lock().map_err(|e| e.to_string())?;
    let pull_running = state.pull.lock().map_err(|e| e.to_string())?.running;
    let push_running = state.push.lock().map_err(|e| e.to_string())?.running;
    let interval = state
        .preferences
        .lock()
        .map_err(|e| e.to_string())?
        .poll_interval_secs
        .clamp(15, 3600);
    Ok((
        ready_for_background_sync(
            has_token || has_refresh_token,
            has_sync_root,
            paused,
            pull_running,
            push_running,
        ),
        interval,
    ))
}

async fn wait_for_pull(app: &AppHandle) {
    for _ in 0..600 {
        let running = app
            .state::<AppState>()
            .pull
            .lock()
            .map(|p| p.running)
            .unwrap_or(false);
        if !running {
            return;
        }
        tokio::time::sleep(Duration::from_secs(1)).await;
    }
}

pub fn spawn(app: AppHandle) {
    tauri::async_runtime::spawn(async move {
        // Laisse le temps au shell de restaurer la session et les préférences.
        tokio::time::sleep(Duration::from_secs(5)).await;
        loop {
            let (ready, interval) = snapshot(&app).unwrap_or((false, 60));
            if ready {
                if crate::sync::run_pull_sync(app.clone()).await.is_ok() {
                    wait_for_pull(&app).await;
                }
                // Revalide la pause et les préconditions avant le push.
                if snapshot(&app).map(|s| s.0).unwrap_or(false) {
                    let _ = crate::push_sync::run_push_sync(app.clone()).await;
                }
            }
            tokio::time::sleep(Duration::from_secs(interval)).await;
        }
    });
}

#[cfg(test)]
mod tests {
    use super::ready_for_background_sync;

    #[test]
    fn requires_session_root_and_idle_unpaused_workers() {
        assert!(ready_for_background_sync(true, true, false, false, false));
        assert!(!ready_for_background_sync(false, true, false, false, false));
        assert!(!ready_for_background_sync(true, false, false, false, false));
        assert!(!ready_for_background_sync(true, true, true, false, false));
        assert!(!ready_for_background_sync(true, true, false, true, false));
        assert!(!ready_for_background_sync(true, true, false, false, true));
    }
}
