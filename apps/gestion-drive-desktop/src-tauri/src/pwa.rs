//! Fenêtres PWA Gestion embarquées dans le shell Tauri.
//!
//! Objectif produit : ne pas refaire l'UI/UX de Mail/Pulse/Todo/Documents.
//! On réutilise la PWA Gestion dans des fenêtres dédiées, avec le shell desktop
//! autour (tray, notifications, sync Drive en arrière-plan).

use std::path::PathBuf;
use sync_core::config::ClientConfig;
use tauri::{AppHandle, Manager, Runtime, WebviewUrl, WebviewWindowBuilder};

fn sanitize_label(raw: &str) -> String {
    raw.chars()
        .map(|c| {
            if c.is_ascii_alphanumeric() || c == '-' {
                c
            } else {
                '-'
            }
        })
        .collect::<String>()
        .trim_matches('-')
        .to_string()
}

pub fn open_module_window<R: Runtime>(
    app: &AppHandle<R>,
    _config: &ClientConfig,
    module_id: &str,
    title: &str,
    path: &str,
) -> Result<(), String> {
    let clean_path = if path.starts_with('/') {
        path.to_string()
    } else {
        format!("/{path}")
    };
    let shell_url = format!("index.html?pwaPath={}&desktopWindow=1", clean_path);
    open_pwa_window_impl(
        app,
        module_id,
        title,
        WebviewUrl::App(PathBuf::from(shell_url)),
    )
}

/// Labels de webviews Gestion à réinitialiser quand l'utilisateur demande une
/// session neuve. La fenêtre principale contient la PWA plein écran ; les
/// fenêtres `gestion-*` sont les éventuels modules ouverts séparément.
fn is_gestion_webview_label(label: &str) -> bool {
    label == "main" || label.starts_with("gestion-")
}

fn open_pwa_window_impl<R: Runtime>(
    app: &AppHandle<R>,
    module_id: &str,
    title: &str,
    webview_url: WebviewUrl,
) -> Result<(), String> {
    let label = format!("gestion-{}", sanitize_label(module_id));

    if let Some(window) = app.get_webview_window(&label) {
        window.show().map_err(|e| e.to_string())?;
        window.set_focus().map_err(|e| e.to_string())?;
        return Ok(());
    }

    WebviewWindowBuilder::new(app, label, webview_url)
        .title(title)
        .inner_size(1180.0, 820.0)
        .min_inner_size(860.0, 560.0)
        .resizable(true)
        .visible(true)
        .build()
        .map_err(|e| e.to_string())?;

    Ok(())
}

/// Réinitialise les données navigateur de la PWA Gestion embarquée (cookies,
/// localStorage, cache webview) puis recharge les fenêtres concernées. Cette
/// commande ne touche pas aux fichiers Drive locaux ni à la configuration sync.
#[tauri::command]
pub fn reset_pwa_session(app: AppHandle) -> Result<(), String> {
    let mut reset_count = 0usize;

    for window in app.webview_windows().into_values() {
        if is_gestion_webview_label(window.label()) {
            window
                .clear_all_browsing_data()
                .map_err(|e| format!("Réinitialisation de session impossible: {e}"))?;
            let _ = window.eval("window.location.reload()");
            reset_count += 1;
        }
    }

    if reset_count == 0 {
        return Err("Aucune fenêtre Gestion active à réinitialiser".to_string());
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::{is_gestion_webview_label, sanitize_label};

    #[test]
    fn label_is_safe() {
        assert_eq!(sanitize_label("mail"), "mail");
        assert_eq!(sanitize_label("Documents IA"), "Documents-IA");
        assert_eq!(sanitize_label("../../pulse"), "pulse");
    }

    #[test]
    fn pwa_session_reset_targets_only_gestion_webviews() {
        assert!(is_gestion_webview_label("main"));
        assert!(is_gestion_webview_label("gestion-documents"));
        assert!(is_gestion_webview_label("gestion-Mail"));
        assert!(!is_gestion_webview_label("settings"));
        assert!(!is_gestion_webview_label("external"));
    }
}
