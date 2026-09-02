//! Menu natif macOS/Windows/Linux pour le shell PWA plein écran.
//!
//! La PWA occupe toute la fenêtre : les actions desktop (recharger, ouvrir
//! dans le navigateur, Drive, préférences, notifications, pause sync) doivent
//! donc exister dans le menu natif en plus du tray, sans bouton flottant dans
//! l'UI web embarquée.

use sync_core::config::DEFAULT_WEB_BASE_URL;
use tauri::{
    menu::{MenuBuilder, SubmenuBuilder},
    AppHandle, Emitter, Manager, Runtime,
};

use crate::tray::{EVENT_NAVIGATE, EVENT_SYNC_PAUSED};
use crate::AppState;

pub const MENU_OPEN_WINDOW: &str = "gestion.open_window";
pub const MENU_RELOAD: &str = "gestion.reload";
pub const MENU_OPEN_BROWSER: &str = "gestion.open_browser";
pub const MENU_DRIVE: &str = "gestion.drive";
pub const MENU_PREFERENCES: &str = "gestion.preferences";
pub const MENU_NOTIFICATIONS: &str = "gestion.notifications";
pub const MENU_JARVIS: &str = "gestion.jarvis";
pub const MENU_OPEN_MAIL_WINDOW: &str = "gestion.window.mail";
pub const MENU_OPEN_PULSE_WINDOW: &str = "gestion.window.pulse";
pub const MENU_OPEN_TODO_WINDOW: &str = "gestion.window.todo";
pub const MENU_OPEN_CALENDAR_WINDOW: &str = "gestion.window.calendar";
pub const MENU_OPEN_DOCUMENTS_WINDOW: &str = "gestion.window.documents";
pub const MENU_TOGGLE_PAUSE: &str = "gestion.toggle_pause";
pub const MENU_RESET_PWA_SESSION: &str = "gestion.reset_pwa_session";
pub const MENU_QUIT: &str = "gestion.quit";

/// Entrées attendues dans le menu applicatif (test pur + documentation).
#[cfg(test)]
pub const EXPECTED_NATIVE_MENU_ITEMS: &[(&str, &str)] = &[
    (MENU_OPEN_WINDOW, "Afficher Gestion Desktop"),
    (MENU_RELOAD, "Recharger Gestion"),
    (MENU_OPEN_BROWSER, "Ouvrir Gestion dans le navigateur"),
    (MENU_DRIVE, "Drive / diagnostic sync"),
    (MENU_NOTIFICATIONS, "Notifications"),
    (MENU_JARVIS, "Ouvrir Jarvis"),
    (MENU_PREFERENCES, "Préférences"),
    (MENU_TOGGLE_PAUSE, "Mettre en pause / reprendre la sync"),
    (MENU_RESET_PWA_SESSION, "Réinitialiser la session PWA"),
    (MENU_QUIT, "Quitter"),
];

pub fn setup_menu<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<()> {
    let gestion = SubmenuBuilder::with_id(app, "gestion", "Gestion Desktop")
        .text(MENU_OPEN_WINDOW, "Afficher Gestion Desktop")
        .text(MENU_RELOAD, "Recharger Gestion")
        .text(MENU_OPEN_BROWSER, "Ouvrir Gestion dans le navigateur")
        .separator()
        .text(MENU_DRIVE, "Drive / diagnostic sync")
        .text(MENU_NOTIFICATIONS, "Notifications")
        .text(MENU_JARVIS, "Ouvrir Jarvis    ⌘⇧J")
        .text(MENU_PREFERENCES, "Préférences")
        .separator()
        .text(MENU_TOGGLE_PAUSE, "Mettre en pause / reprendre la sync")
        .text(MENU_RESET_PWA_SESSION, "Réinitialiser la session PWA")
        .separator()
        .text(MENU_QUIT, "Quitter")
        .build()?;

    let modules = SubmenuBuilder::with_id(app, "modules", "Fenêtres modules")
        .text(MENU_OPEN_MAIL_WINDOW, "Mail    ⌘⇧M")
        .text(MENU_OPEN_PULSE_WINDOW, "Pulse    ⌘⇧P")
        .text(MENU_OPEN_TODO_WINDOW, "Todo    ⌘⇧T")
        .text(MENU_OPEN_CALENDAR_WINDOW, "Calendrier    ⌘⇧C")
        .text(MENU_OPEN_DOCUMENTS_WINDOW, "Documents    ⌘⇧D")
        .build()?;

    let edit = SubmenuBuilder::with_id(app, "edit", "Édition")
        .undo()
        .redo()
        .separator()
        .cut()
        .copy()
        .paste()
        .select_all()
        .build()?;

    let window = SubmenuBuilder::with_id(app, "window", "Fenêtre")
        .minimize()
        .maximize()
        .fullscreen()
        .close_window()
        .build()?;

    let menu = MenuBuilder::new(app)
        .item(&gestion)
        .item(&modules)
        .item(&edit)
        .item(&window)
        .build()?;
    app.set_menu(menu)?;
    app.on_menu_event(handle_menu_event);
    Ok(())
}

fn show_main_window<R: Runtime>(app: &AppHandle<R>) {
    if let Some(win) = app.get_webview_window("main") {
        let _ = win.show();
        let _ = win.set_focus();
    }
}

fn open_gestion_in_browser<R: Runtime>(app: &AppHandle<R>) {
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

fn open_panel<R: Runtime>(app: &AppHandle<R>, target: &'static str) {
    show_main_window(app);
    let _ = app.emit(EVENT_NAVIGATE, target);
}

fn toggle_pause<R: Runtime>(app: &AppHandle<R>) {
    let state = app.state::<AppState>();
    let now_paused = match state.sync_paused.lock() {
        Ok(paused) => !*paused,
        Err(_) => return,
    };
    if crate::preferences::persist_sync_paused(&state, now_paused).is_err() {
        return;
    }
    let _ = app.emit(EVENT_SYNC_PAUSED, now_paused);
}

fn open_module_window<R: Runtime>(app: &AppHandle<R>, module_id: &str, title: &str, path: &str) {
    let config = {
        let state = app.state::<AppState>();
        state.config.lock().ok().map(|cfg| cfg.clone())
    };
    if let Some(cfg) = config {
        let _ = crate::pwa::open_module_window(app, &cfg, module_id, title, path);
    }
}

pub fn handle_menu_event<R: Runtime>(app: &AppHandle<R>, event: tauri::menu::MenuEvent) {
    match event.id.as_ref() {
        MENU_OPEN_WINDOW => show_main_window(app),
        MENU_RELOAD => {
            show_main_window(app);
            let _ = app.emit("gestion://reload", ());
        }
        MENU_OPEN_BROWSER => open_gestion_in_browser(app),
        MENU_DRIVE => open_panel(app, "drive"),
        MENU_NOTIFICATIONS => open_panel(app, "notifications"),
        MENU_JARVIS => {
            let _ = crate::jarvis_shortcut::trigger_jarvis(app);
        }
        MENU_PREFERENCES => open_panel(app, "preferences"),
        MENU_OPEN_MAIL_WINDOW => open_module_window(app, "mail", "Mail — Gestion", "/emails"),
        MENU_OPEN_PULSE_WINDOW => open_module_window(app, "pulse", "Pulse — Gestion", "/pulse"),
        MENU_OPEN_TODO_WINDOW => open_module_window(app, "todo", "Todo — Gestion", "/todos"),
        MENU_OPEN_CALENDAR_WINDOW => {
            open_module_window(app, "calendar", "Calendrier — Gestion", "/calendrier")
        }
        MENU_OPEN_DOCUMENTS_WINDOW => {
            open_module_window(app, "documents", "Documents — Gestion", "/documents")
        }
        MENU_TOGGLE_PAUSE => toggle_pause(app),
        MENU_RESET_PWA_SESSION => {
            show_main_window(app);
            let _ = app.emit(EVENT_NAVIGATE, "preferences");
            let _ = app.emit("gestion://reset-pwa-session-requested", ());
        }
        MENU_QUIT => app.exit(0),
        _ => {}
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn native_menu_covers_all_shell_actions() {
        let ids: Vec<&str> = EXPECTED_NATIVE_MENU_ITEMS
            .iter()
            .map(|(id, _)| *id)
            .collect();
        assert!(ids.contains(&MENU_RELOAD));
        assert!(ids.contains(&MENU_OPEN_BROWSER));
        assert!(ids.contains(&MENU_DRIVE));
        assert!(ids.contains(&MENU_PREFERENCES));
        assert!(ids.contains(&MENU_NOTIFICATIONS));
        assert!(ids.contains(&MENU_JARVIS));
        assert!(ids.contains(&MENU_TOGGLE_PAUSE));
        assert!(ids.contains(&MENU_RESET_PWA_SESSION));
        assert_eq!(ids.len(), EXPECTED_NATIVE_MENU_ITEMS.len());
    }
}
