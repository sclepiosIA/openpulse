//! Centre de notifications + notifications natives OS (plan §5 — Phase 2).
//!
//! Deux responsabilités :
//!   1. Historique en mémoire des notifications reçues (pollé/écouté par le
//!      NotificationCenter React) — capé pour éviter la dérive mémoire.
//!   2. Affichage natif (macOS Notification Center / Windows toast) via
//!      `tauri-plugin-notification`, filtré par les préférences module
//!      (Pulse/Mail/Todo/Drive) et le mode ne pas déranger.
//!
//! Le centre in-app enregistre TOUJOURS la notification ; seules les alertes
//! natives sont supprimées par les préférences ou le DND.

use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Emitter, Runtime, State};
use tauri_plugin_notification::NotificationExt;

use crate::preferences::{AppPreferences, NotificationModule};
use crate::AppState;

/// Taille max de l'historique in-app (FIFO au-delà).
pub const MAX_HISTORY: usize = 200;

/// Événement émis vers le front à chaque nouvelle notification.
pub const EVENT_NEW_NOTIFICATION: &str = "gestion://notification";

fn now_epoch() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0)
}

/// Minutes locales depuis minuit (heure locale OS), pour évaluer la plage
/// horaire du mode ne pas déranger.
fn local_minutes_now() -> u16 {
    use chrono::Timelike;
    let now = chrono::Local::now();
    (now.hour() * 60 + now.minute()) as u16
}

/// Une entrée du centre de notifications.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NotificationRecord {
    pub id: String,
    /// pulse | mail | todo | drive | system
    pub module: String,
    pub title: String,
    pub body: String,
    /// Epoch secondes.
    pub created_at: i64,
    pub read: bool,
    /// La notification a-t-elle été affichée nativement (false si module
    /// désactivé, DND actif, ou échec plugin) ?
    pub delivered_natively: bool,
}

/// État du centre (détenu par AppState).
#[derive(Debug, Default)]
pub struct NotificationCenterState {
    pub items: Mutex<Vec<NotificationRecord>>,
}

/// Payload de la commande `notify`.
#[derive(Debug, Deserialize)]
pub struct NotifyRequest {
    pub module: String,
    pub title: String,
    pub body: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct NotificationCenterSnapshot {
    pub items: Vec<NotificationRecord>,
    pub unread_count: usize,
    pub do_not_disturb_active: bool,
}

/// Décide + fabrique l'enregistrement (pur, testable sans runtime Tauri).
pub fn build_record(
    prefs: &AppPreferences,
    module: NotificationModule,
    module_raw: &str,
    title: &str,
    body: &str,
    local_minutes: u16,
) -> NotificationRecord {
    NotificationRecord {
        id: uuid::Uuid::new_v4().to_string(),
        module: module_raw.to_string(),
        title: title.to_string(),
        body: body.to_string(),
        created_at: now_epoch(),
        read: false,
        delivered_natively: prefs.should_deliver_natively(module, local_minutes),
    }
}

/// Insère en tête et tronque l'historique.
pub fn push_record(items: &mut Vec<NotificationRecord>, record: NotificationRecord) {
    items.insert(0, record);
    items.truncate(MAX_HISTORY);
}

/// Point d'entrée interne réutilisable (tray, moteur de sync, commandes).
/// Enregistre la notification, tente l'affichage natif si autorisé, puis
/// notifie le front via un événement.
pub fn dispatch<R: Runtime>(
    app: &AppHandle<R>,
    state: &AppState,
    module_raw: &str,
    title: &str,
    body: &str,
) -> Result<NotificationRecord, String> {
    let module = NotificationModule::parse(module_raw)
        .ok_or_else(|| format!("Module de notification inconnu : {module_raw}"))?;

    let prefs = state.preferences.lock().map_err(|e| e.to_string())?.clone();

    let mut record = build_record(&prefs, module, module_raw, title, body, local_minutes_now());

    if record.delivered_natively {
        let shown = app.notification().builder().title(title).body(body).show();
        if shown.is_err() {
            // Échec OS (permissions, etc.) : on garde la trace in-app.
            record.delivered_natively = false;
        }
    }

    {
        let mut items = state
            .notification_center
            .items
            .lock()
            .map_err(|e| e.to_string())?;
        push_record(&mut items, record.clone());
    }

    let _ = app.emit(EVENT_NEW_NOTIFICATION, &record);
    Ok(record)
}

// ---------------------------------------------------------------------------
// Commandes IPC
// ---------------------------------------------------------------------------

/// Envoie une notification (module Pulse/Mail/Todo/Drive/System).
#[tauri::command]
pub fn notify(
    app: AppHandle,
    state: State<'_, AppState>,
    request: NotifyRequest,
) -> Result<NotificationRecord, String> {
    dispatch(
        &app,
        &state,
        &request.module,
        request.title.trim(),
        request.body.as_deref().unwrap_or("").trim(),
    )
}

/// Snapshot du centre de notifications pour l'UI.
#[tauri::command]
pub fn list_notifications(
    state: State<'_, AppState>,
) -> Result<NotificationCenterSnapshot, String> {
    let items = state
        .notification_center
        .items
        .lock()
        .map_err(|e| e.to_string())?
        .clone();
    let unread_count = items.iter().filter(|n| !n.read).count();
    let dnd = state
        .preferences
        .lock()
        .map_err(|e| e.to_string())?
        .do_not_disturb
        .is_active(local_minutes_now());
    Ok(NotificationCenterSnapshot {
        items,
        unread_count,
        do_not_disturb_active: dnd,
    })
}

/// Marque une notification (ou toutes si `id` est None) comme lue(s).
#[tauri::command]
pub fn mark_notifications_read(
    state: State<'_, AppState>,
    id: Option<String>,
) -> Result<usize, String> {
    let mut items = state
        .notification_center
        .items
        .lock()
        .map_err(|e| e.to_string())?;
    let mut updated = 0;
    for item in items.iter_mut() {
        let target = id.as_ref().map(|i| i == &item.id).unwrap_or(true);
        if target && !item.read {
            item.read = true;
            updated += 1;
        }
    }
    Ok(updated)
}

/// Vide l'historique du centre de notifications.
#[tauri::command]
pub fn clear_notifications(state: State<'_, AppState>) -> Result<(), String> {
    state
        .notification_center
        .items
        .lock()
        .map_err(|e| e.to_string())?
        .clear();
    Ok(())
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;
    use crate::preferences::AppPreferences;

    #[test]
    fn build_record_respects_module_toggle() {
        let mut prefs = AppPreferences::default();
        prefs.notifications.todo = false;
        let rec = build_record(
            &prefs,
            NotificationModule::Todo,
            "todo",
            "Tâche due",
            "Relire le contrat",
            12 * 60,
        );
        assert!(!rec.delivered_natively);
        assert!(!rec.read);
        assert_eq!(rec.module, "todo");
    }

    #[test]
    fn build_record_respects_dnd() {
        let mut prefs = AppPreferences::default();
        prefs.do_not_disturb.enabled = true;
        let rec = build_record(
            &prefs,
            NotificationModule::Pulse,
            "pulse",
            "Nouveau message",
            "",
            12 * 60,
        );
        assert!(!rec.delivered_natively);
    }

    #[test]
    fn build_record_delivers_when_allowed() {
        let prefs = AppPreferences::default();
        let rec = build_record(
            &prefs,
            NotificationModule::Mail,
            "mail",
            "Email prioritaire",
            "De direction@gsi.fr",
            10 * 60,
        );
        assert!(rec.delivered_natively);
    }

    #[test]
    fn push_record_caps_history_fifo() {
        let prefs = AppPreferences::default();
        let mut items = Vec::new();
        for i in 0..(MAX_HISTORY + 25) {
            let rec = build_record(
                &prefs,
                NotificationModule::Drive,
                "drive",
                &format!("n{i}"),
                "",
                600,
            );
            push_record(&mut items, rec);
        }
        assert_eq!(items.len(), MAX_HISTORY);
        // La plus récente est en tête.
        assert_eq!(items[0].title, format!("n{}", MAX_HISTORY + 24));
    }
}
