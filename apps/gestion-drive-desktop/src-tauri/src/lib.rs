//! Shell Tauri du client Gestion Drive Desktop.
//!
//! Rôle : fenêtre principale React, commandes IPC (commands.rs), tray (tray.rs),
//! et détention de l'état applicatif (config + connexion SQLite).
//! Le moteur de sync lui-même vit dans le crate `sync-core`.

mod background_sync;
mod commands;
mod drive_actions;
mod jarvis_shortcut;
mod menu;
mod net_state;
mod notifications;
mod preferences;
mod push_sync;
mod pwa;
mod sync;
mod sync_log;
mod tray;

use std::error::Error;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};

use sync_core::config::{migrated_web_base_url, ClientConfig, DB_FILE_NAME};

/// État global de l'app, partagé entre commandes via `tauri::State`.
pub struct AppState {
    /// Répertoire de données app (Application Support / %APPDATA%).
    pub data_dir: PathBuf,
    pub config: Mutex<ClientConfig>,
    /// JWT Drive à courte durée de vie, renouvelé depuis le refresh token du coffre OS.
    pub access_token: Mutex<Option<String>>,
    /// Expiration epoch du JWT Drive ; non secrète et persistée dans session.json.
    pub access_token_expires_at: Mutex<Option<i64>>,
    /// Sérialise les refresh rotatifs entre UI et worker de fond.
    pub auth_refresh: tokio::sync::Mutex<()>,
    /// Lease exclusif détenu pendant tout pull/push et toute mutation de session.
    pub sync_operation: Arc<tokio::sync::Mutex<()>>,
    /// Indique qu'un refresh token récupérable existe dans le coffre OS.
    pub refresh_token_available: Mutex<bool>,
    /// Derniers espaces chargés depuis l'API (source du filtre select_spaces).
    pub known_spaces: Mutex<Vec<sync_core::models::Space>>,
    /// Progression du pull sync en cours (pollée par l'UI).
    pub pull: Mutex<sync::PullProgress>,
    /// Progression du push sync en cours (pollée par l'UI).
    pub push: Mutex<push_sync::PushProgress>,
    /// Préférences locales (notifications par module, DND, polling…).
    pub preferences: Mutex<preferences::AppPreferences>,
    /// Historique in-app du centre de notifications.
    pub notification_center: notifications::NotificationCenterState,
    /// Journal de synchronisation exportable (ring buffer en mémoire).
    pub sync_log: sync_log::SyncLogState,
    /// Pause globale de la synchronisation (tray « Mettre en pause »).
    pub sync_paused: Mutex<bool>,
    /// API Drive injoignable au dernier cycle (état offline minimal, plan §5).
    pub network_offline: Mutex<bool>,
    /// Epoch secondes du dernier cycle de sync terminé sans erreur.
    pub last_sync_at: Mutex<Option<i64>>,
}

impl AppState {
    pub fn db_path(&self) -> PathBuf {
        self.data_dir.join(DB_FILE_NAME)
    }
}

fn open_database_with_recovery(db_path: &Path) -> Result<(), Box<dyn Error>> {
    match sync_core::db::open_and_migrate(db_path) {
        Ok(_) => Ok(()),
        Err(initial_error)
            if db_path.exists() && sync_core::db::is_database_corruption_error(&initial_error) =>
        {
            let timestamp = chrono::Utc::now().format("%Y%m%dT%H%M%SZ");
            let recovery_id = uuid::Uuid::new_v4().simple();
            let backup = db_path.with_file_name(format!(
                "{}.corrupt-{timestamp}-{recovery_id}",
                db_path
                    .file_name()
                    .and_then(|name| name.to_str())
                    .unwrap_or(DB_FILE_NAME)
            ));
            log::error!(
                "SQLite initialization failed; preserving the index at {}: {}",
                backup.display(),
                initial_error
            );
            let mut archived_companions = Vec::new();
            for suffix in ["-wal", "-shm"] {
                let companion = PathBuf::from(format!("{}{}", db_path.display(), suffix));
                if companion.exists() {
                    let companion_backup = PathBuf::from(format!("{}{}", backup.display(), suffix));
                    if let Err(error) = std::fs::rename(&companion, &companion_backup) {
                        for (original, archived) in archived_companions.iter().rev() {
                            let _ = std::fs::rename(archived, original);
                        }
                        return Err(Box::new(error));
                    }
                    archived_companions.push((companion, companion_backup));
                }
            }
            if let Err(error) = std::fs::rename(db_path, &backup) {
                for (original, archived) in archived_companions.iter().rev() {
                    let _ = std::fs::rename(archived, original);
                }
                return Err(Box::new(error));
            }
            if let Err(rebuild_error) = sync_core::db::open_and_migrate(db_path) {
                if db_path.exists() {
                    let failed_rebuild = db_path.with_file_name(format!(
                        "{}.recovery-failed-{recovery_id}",
                        db_path
                            .file_name()
                            .and_then(|name| name.to_str())
                            .unwrap_or(DB_FILE_NAME)
                    ));
                    let _ = std::fs::rename(db_path, failed_rebuild);
                }
                let _ = std::fs::rename(&backup, db_path);
                for (original, archived) in archived_companions.iter().rev() {
                    let _ = std::fs::rename(archived, original);
                }
                return Err(Box::new(rebuild_error));
            }
            log::warn!("A fresh local Drive index was created after SQLite recovery");
            Ok(())
        }
        Err(error) => Err(Box::new(error)),
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(
            tauri_plugin_autostart::Builder::new()
                .args(["--minimized"])
                .build(),
        )
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_log::Builder::new().build())
        .setup(|app| {
            use tauri::Manager;

            let data_dir = app.path().app_data_dir()?;
            std::fs::create_dir_all(&data_dir)?;

            // Config : charge ou initialise (machine_id généré une fois).
            let mut config = ClientConfig::load_or_default(&data_dir).unwrap_or_default();
            if let Some(migrated) = migrated_web_base_url(&config.web_base_url) {
                config.web_base_url = migrated.to_string();
            }
            if config.machine_id.is_empty() {
                config.machine_id = uuid::Uuid::new_v4().to_string();
                let _ = config.save(&data_dir);
            } else {
                let _ = config.save(&data_dir);
            }

            // Ouvre l'index SQLite (applique les migrations au passage).
            let db_path = data_dir.join(DB_FILE_NAME);
            open_database_with_recovery(&db_path)?;

            // Préférences locales (notifications, DND…) — fichier séparé de la
            // config sync pour ne pas impacter le moteur Drive.
            let prefs = preferences::AppPreferences::load_or_default(&data_dir).normalized();
            let initial_sync_paused = prefs.sync_paused;
            let launch_at_login = prefs.launch_at_login;

            let app_state = AppState {
                data_dir,
                config: Mutex::new(config),
                access_token: Mutex::new(None),
                access_token_expires_at: Mutex::new(None),
                auth_refresh: tokio::sync::Mutex::new(()),
                sync_operation: Arc::new(tokio::sync::Mutex::new(())),
                refresh_token_available: Mutex::new(false),
                known_spaces: Mutex::new(Vec::new()),
                pull: Mutex::new(sync::PullProgress::default()),
                push: Mutex::new(push_sync::PushProgress::default()),
                preferences: Mutex::new(prefs),
                notification_center: notifications::NotificationCenterState::default(),
                sync_log: sync_log::SyncLogState::default(),
                sync_paused: Mutex::new(initial_sync_paused),
                network_offline: Mutex::new(false),
                last_sync_at: Mutex::new(None),
            };
            // La restauration native précède le worker : un lancement minimisé
            // conserve la synchronisation même sans interaction avec le webview.
            let _ = commands::restore_saved_session_state(&app_state);
            app.manage(app_state);

            use tauri_plugin_autostart::ManagerExt;
            let autostart = app.autolaunch();
            if launch_at_login {
                let _ = autostart.enable();
            } else {
                let _ = autostart.disable();
            }

            // Menu natif + icône de barre système : aucune surcouche visible
            // n'est injectée au-dessus de la PWA.
            menu::setup_menu(app.handle())?;
            tray::setup_tray(app.handle())?;
            if let Err(e) = jarvis_shortcut::setup_global_shortcut(app.handle()) {
                eprintln!("[Gestion Desktop] {e}");
            }

            background_sync::spawn(app.handle().clone());

            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                // OneDrive-like behavior: clicking the window close button only
                // hides the UI. The app stays alive in the menu bar/system tray
                // so the sync engine can continue running in background.
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .invoke_handler(tauri::generate_handler![
            commands::login_with_drive_session,
            commands::get_saved_session,
            commands::logout,
            commands::set_drive_auto_connect,
            commands::get_config,
            commands::set_sync_root,
            commands::list_spaces_real,
            commands::select_spaces,
            commands::sync_status,
            preferences::get_preferences,
            preferences::set_preferences,
            preferences::set_do_not_disturb,
            notifications::notify,
            notifications::list_notifications,
            notifications::mark_notifications_read,
            notifications::clear_notifications,
            jarvis_shortcut::open_jarvis,
            pwa::reset_pwa_session,
            sync::run_pull_sync,
            sync::pull_progress,
            push_sync::run_push_sync,
            push_sync::push_progress,
            sync_log::get_sync_logs,
            sync_log::export_sync_logs,
            sync_log::clear_sync_logs,
            drive_actions::list_local_files,
            drive_actions::drive_file_actions,
            drive_actions::copy_drive_link,
            drive_actions::open_in_gestion,
            drive_actions::reveal_in_file_manager,
            drive_actions::open_sync_root,
            drive_actions::pin_file,
            drive_actions::unpin_file,
            drive_actions::evict_file,
            drive_actions::download_file,
            drive_actions::set_sync_paused,
            drive_actions::get_sync_paused,
        ])
        .run(tauri::generate_context!())
        .unwrap_or_else(|error| log::error!("Gestion Desktop runtime stopped: {error}"));
}

#[cfg(test)]
mod startup_tests {
    use super::open_database_with_recovery;
    use std::sync::Arc;

    #[test]
    fn sync_operation_lease_has_single_owner() {
        let lease = Arc::new(tokio::sync::Mutex::new(()));
        let first = lease.clone().try_lock_owned().expect("first owner");
        assert!(lease.clone().try_lock_owned().is_err());
        drop(first);
        assert!(lease.try_lock_owned().is_ok());
    }

    #[test]
    fn corrupt_sqlite_index_is_preserved_and_rebuilt() {
        let temp = tempfile::tempdir().expect("tempdir");
        let db_path = temp.path().join("gestion-drive.sqlite3");
        std::fs::write(&db_path, b"not-a-sqlite-database").expect("corrupt fixture");
        std::fs::write(format!("{}-wal", db_path.display()), b"wal").expect("wal fixture");
        std::fs::write(format!("{}-shm", db_path.display()), b"shm").expect("shm fixture");

        open_database_with_recovery(&db_path).expect("database recovery");

        assert!(db_path.exists());
        let backups: Vec<_> = std::fs::read_dir(temp.path())
            .expect("read tempdir")
            .filter_map(Result::ok)
            .filter(|entry| entry.file_name().to_string_lossy().contains(".corrupt-"))
            .collect();
        assert!(
            backups.iter().any(|entry| {
                entry
                    .file_name()
                    .to_string_lossy()
                    .starts_with("gestion-drive.sqlite3.corrupt-")
            }),
            "the original corrupt database must be archived"
        );
    }
}
