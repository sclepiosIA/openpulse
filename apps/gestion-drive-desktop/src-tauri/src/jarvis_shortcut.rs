//! Raccourcis globaux Gestion Desktop.
//!
//! Objectif : appeler Jarvis et ouvrir les modules clés depuis n'importe où
//! sur le Mac, façon assistant global. Jarvis réveille la fenêtre principale et
//! déclenche le vrai modal/command bar dans la PWA ; les modules ouvrent des
//! fenêtres PWA dédiées.
//!
//! Limite macOS : selon les versions/sécurité, l'utilisateur peut devoir
//! autoriser Gestion Desktop dans Réglages Système > Confidentialité et sécurité
//! > Accessibilité / Surveillance de l'entrée.

use tauri::{AppHandle, Emitter, Manager, Runtime};

pub const JARVIS_EVENT: &str = "gestion://open-jarvis";

pub fn trigger_jarvis<R: Runtime>(app: &AppHandle<R>) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("main") {
        window.show().map_err(|e| e.to_string())?;
        window.set_focus().map_err(|e| e.to_string())?;
    }
    app.emit(JARVIS_EVENT, ())
        .map_err(|e| format!("Ouverture Jarvis impossible: {e}"))
}

fn open_module<R: Runtime>(
    app: &AppHandle<R>,
    module_id: &str,
    title: &str,
    path: &str,
) -> Result<(), String> {
    let state = app.state::<crate::AppState>();
    let cfg = state.config.lock().map_err(|e| e.to_string())?.clone();
    crate::pwa::open_module_window(app, &cfg, module_id, title, path)
}

#[tauri::command]
pub fn open_jarvis(app: AppHandle) -> Result<(), String> {
    trigger_jarvis(&app)
}

pub fn setup_global_shortcut(app: &AppHandle) -> Result<(), String> {
    use tauri_plugin_global_shortcut::{
        Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState,
    };

    let super_or_ctrl = if cfg!(target_os = "macos") {
        Modifiers::SUPER | Modifiers::SHIFT
    } else {
        Modifiers::CONTROL | Modifiers::SHIFT
    };

    let registrations = [
        (Shortcut::new(Some(super_or_ctrl), Code::KeyJ), "jarvis"),
        (Shortcut::new(Some(super_or_ctrl), Code::KeyM), "mail"),
        (Shortcut::new(Some(super_or_ctrl), Code::KeyP), "pulse"),
        (Shortcut::new(Some(super_or_ctrl), Code::KeyT), "todo"),
        (Shortcut::new(Some(super_or_ctrl), Code::KeyC), "calendar"),
        (Shortcut::new(Some(super_or_ctrl), Code::KeyD), "documents"),
    ];

    for (shortcut, action) in registrations {
        let app_handle = app.clone();
        app.global_shortcut()
            .on_shortcut(shortcut, move |_app, _shortcut, event| {
                if event.state() != ShortcutState::Pressed {
                    return;
                }
                match action {
                    "jarvis" => {
                        let _ = trigger_jarvis(&app_handle);
                    }
                    "mail" => {
                        let _ = open_module(&app_handle, "mail", "Mail — Gestion", "/emails");
                    }
                    "pulse" => {
                        let _ = open_module(&app_handle, "pulse", "Pulse — Gestion", "/pulse");
                    }
                    "todo" => {
                        let _ = open_module(&app_handle, "todo", "Todo — Gestion", "/todos");
                    }
                    "calendar" => {
                        let _ = open_module(
                            &app_handle,
                            "calendar",
                            "Calendrier — Gestion",
                            "/calendrier",
                        );
                    }
                    "documents" => {
                        let _ = open_module(
                            &app_handle,
                            "documents",
                            "Documents — Gestion",
                            "/documents",
                        );
                    }
                    _ => {}
                }
            })
            .map_err(|e| format!("Enregistrement du raccourci global impossible: {e}"))?;
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::JARVIS_EVENT;

    #[test]
    fn jarvis_event_is_stable() {
        assert_eq!(JARVIS_EVENT, "gestion://open-jarvis");
    }
}
