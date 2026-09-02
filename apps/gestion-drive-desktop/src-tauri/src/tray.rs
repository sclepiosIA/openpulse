//! Icône de barre système (menu bar macOS / system tray Windows).
//!
//! Cible (plan §9) :
//!   ● Gestion Drive — Synchronisé ✓ | Synchronisation… (n) | Erreurs (n)
//!   ─────────────────────────────
//!   Ouvrir le dossier Gestion Drive
//!   Ouvrir Gestion Drive (fenêtre)
//!   Mettre en pause la synchronisation
//!   ─────────────────────────────
//!   Préférences…
//!   Quitter
//!
//! Câblé dans ce lot : « Ouvrir le dossier Gestion Drive » (révèle le
//! sync_root) et pause/reprise de la synchronisation (AppState.sync_paused,
//! consulté par run_pull_sync/run_push_sync). Les mêmes actions existent aussi
//! dans le menu natif (voir menu.rs) pour l'app installée, sans surcouche UI.
//! L'icône changera d'état (idle/syncing/error) via `set_icon` quand le moteur
//! émettra ses événements.

use sync_core::config::DEFAULT_WEB_BASE_URL;
use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::TrayIconBuilder,
    AppHandle, Emitter, Manager, Runtime,
};

use crate::AppState;

/// Événement émis vers le front pour naviguer vers un module du shell.
pub const EVENT_NAVIGATE: &str = "gestion://navigate";
/// Événement émis vers le front quand la pause sync change (tray ou IPC).
pub const EVENT_SYNC_PAUSED: &str = "gestion://sync-paused";

pub fn setup_tray<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<()> {
    let open_folder = MenuItem::with_id(
        app,
        "open_folder",
        "Ouvrir le dossier Gestion Drive",
        true,
        None::<&str>,
    )?;
    let open_window = MenuItem::with_id(
        app,
        "open_window",
        "Ouvrir Gestion Desktop",
        true,
        None::<&str>,
    )?;
    let reload_gestion = MenuItem::with_id(
        app,
        "reload_gestion",
        "Recharger Gestion",
        true,
        None::<&str>,
    )?;
    let open_browser = MenuItem::with_id(
        app,
        "open_browser",
        "Ouvrir Gestion dans le navigateur",
        true,
        None::<&str>,
    )?;
    let drive_sync = MenuItem::with_id(
        app,
        "drive_sync",
        "Synchronisation Drive…",
        true,
        None::<&str>,
    )?;
    let pause = MenuItem::with_id(
        app,
        "pause_sync",
        "Mettre en pause la synchronisation",
        true,
        None::<&str>,
    )?;
    let prefs = MenuItem::with_id(app, "preferences", "Préférences…", true, None::<&str>)?;
    let notif_center =
        MenuItem::with_id(app, "notifications", "Notifications…", true, None::<&str>)?;
    let jarvis = MenuItem::with_id(app, "jarvis", "Ouvrir Jarvis (⌘⇧J)", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Quitter", true, None::<&str>)?;
    let sep = PredefinedMenuItem::separator(app)?;
    let sep2 = PredefinedMenuItem::separator(app)?;

    let menu = Menu::with_items(
        app,
        &[
            &open_folder,
            &open_window,
            &reload_gestion,
            &open_browser,
            &drive_sync,
            &pause,
            &sep,
            &notif_center,
            &jarvis,
            &prefs,
            &sep2,
            &quit,
        ],
    )?;

    // Poignée conservée pour retitrer l'entrée pause/reprise.
    let pause_item = pause.clone();

    TrayIconBuilder::with_id("gestion-drive-tray")
        .menu(&menu)
        .show_menu_on_left_click(true)
        .icon(
            app.default_window_icon()
                .cloned()
                .expect("icône par défaut manquante"),
        )
        .tooltip("Gestion Desktop — synchronisation inactive")
        .on_menu_event(move |app, event| match event.id.as_ref() {
            "open_window" => {
                if let Some(win) = app.get_webview_window("main") {
                    let _ = win.show();
                    let _ = win.set_focus();
                }
            }
            "reload_gestion" => {
                if let Some(win) = app.get_webview_window("main") {
                    let _ = win.show();
                    let _ = win.set_focus();
                }
                let _ = app.emit("gestion://reload", ());
            }
            "open_browser" => {
                use tauri_plugin_opener::OpenerExt;
                let state = app.state::<AppState>();
                let url = state
                    .config
                    .lock()
                    .ok()
                    .map(|cfg| cfg.web_base_url.clone())
                    .unwrap_or_else(|| DEFAULT_WEB_BASE_URL.to_string());
                let _ = app.opener().open_url(url, None::<&str>);
            }
            "drive_sync" => {
                if let Some(win) = app.get_webview_window("main") {
                    let _ = win.show();
                    let _ = win.set_focus();
                }
                // Ouvre le panneau natif Drive (onboarding/sync) sur la PWA.
                let _ = app.emit(EVENT_NAVIGATE, "drive");
            }
            "preferences" => {
                if let Some(win) = app.get_webview_window("main") {
                    let _ = win.show();
                    let _ = win.set_focus();
                }
                // Demande au shell React d'afficher le panneau Préférences.
                let _ = app.emit(EVENT_NAVIGATE, "preferences");
            }
            "notifications" => {
                if let Some(win) = app.get_webview_window("main") {
                    let _ = win.show();
                    let _ = win.set_focus();
                }
                // Ouvre le centre de notifications dans le panneau natif.
                let _ = app.emit(EVENT_NAVIGATE, "notifications");
            }
            "jarvis" => {
                let _ = crate::jarvis_shortcut::trigger_jarvis(app);
            }
            "open_folder" => {
                // Ouvre le sync_root dans le Finder/Explorateur. Si aucun
                // dossier n'est encore configuré : montre la fenêtre (onboarding).
                let opened = open_sync_root_from_tray(app);
                if !opened {
                    if let Some(win) = app.get_webview_window("main") {
                        let _ = win.show();
                        let _ = win.set_focus();
                    }
                    let _ = app.emit(EVENT_NAVIGATE, "drive");
                }
            }
            "pause_sync" => {
                let state = app.state::<AppState>();
                let now_paused = match state.sync_paused.lock() {
                    Ok(paused) => !*paused,
                    Err(_) => return,
                };
                if crate::preferences::persist_sync_paused(&state, now_paused).is_err() {
                    return;
                }
                let _ = pause_item.set_text(if now_paused {
                    "Reprendre la synchronisation"
                } else {
                    "Mettre en pause la synchronisation"
                });
                let _ = app.emit(EVENT_SYNC_PAUSED, now_paused);
            }
            "quit" => {
                app.exit(0);
            }
            _ => {}
        })
        .build(app)?;

    Ok(())
}

/// Révèle le dossier de synchronisation dans le gestionnaire de fichiers.
/// Retourne `false` si aucun sync_root n'est configuré ou en cas d'erreur.
fn open_sync_root_from_tray<R: Runtime>(app: &AppHandle<R>) -> bool {
    use tauri_plugin_opener::OpenerExt;
    let state = app.state::<AppState>();
    let root = match state.config.lock() {
        Ok(cfg) => cfg.sync_root.clone(),
        Err(_) => None,
    };
    match root {
        Some(root) if root.is_dir() => app
            .opener()
            .open_path(root.to_string_lossy().to_string(), None::<&str>)
            .is_ok(),
        _ => false,
    }
}
