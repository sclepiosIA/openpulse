//! Suivi minimal de l'état réseau Drive (plan §5 — offline).
//!
//! Les moteurs pull/push signalent la fin de chaque cycle ; on en déduit
//! l'état hors ligne (API injoignable) et l'horodatage du dernier cycle
//! réussi (exposés via `sync_status`). Les transitions online → offline et
//! offline → online émettent UNE notification Drive (module `drive`, donc
//! filtrable par les préférences + DND) — jamais de spam à chaque cycle raté.

use tauri::{AppHandle, Emitter, Manager};

use crate::AppState;

/// Événement émis vers le front quand l'état offline change (payload: bool).
pub const EVENT_OFFLINE_CHANGED: &str = "gestion://offline";

fn now_epoch() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0)
}

/// Heuristique : l'erreur de cycle ressemble-t-elle à une coupure réseau/API ?
/// (Messages FR de nos moteurs + messages EN bruts de reqwest/hyper.)
pub fn looks_like_network_error(message: &str) -> bool {
    let m = message.to_lowercase();
    [
        "injoignable",
        "réseau",
        "connexion",
        "connection",
        "connect",
        "timed out",
        "timeout",
        "unreachable",
        "dns",
        "error sending request",
        "interrompue",
        "http 502",
        "http 503",
        "http 504",
    ]
    .iter()
    .any(|k| m.contains(k))
}

/// Décision pure (testable sans Tauri) : nouvel état offline après un cycle.
/// - Cycle réussi → en ligne.
/// - Échec réseau → hors ligne.
/// - Échec non réseau (config, permission…) → état inchangé.
pub fn next_offline_state(was_offline: bool, cycle_error: Option<&str>) -> bool {
    match cycle_error {
        None => false,
        Some(e) if looks_like_network_error(e) => true,
        Some(_) => was_offline,
    }
}

/// Signale la fin d'un cycle de sync (`cycle_error = None` si réussi).
/// Met à jour `AppState.network_offline` / `last_sync_at`, émet l'événement
/// front et notifie les transitions via le centre de notifications.
pub fn record_cycle_end(app: &AppHandle, scope: &str, cycle_error: Option<&str>) {
    let state = app.state::<AppState>();

    let transition = {
        let mut offline = match state.network_offline.lock() {
            Ok(o) => o,
            Err(_) => return,
        };
        let was = *offline;
        let now = next_offline_state(was, cycle_error);
        *offline = now;
        if was != now {
            Some(now)
        } else {
            None
        }
    };

    if cycle_error.is_none() {
        if let Ok(mut last) = state.last_sync_at.lock() {
            *last = Some(now_epoch());
        }
    }

    match transition {
        Some(true) => {
            crate::sync_log::warn(
                app,
                scope,
                "API Drive injoignable — passage en mode hors ligne",
            );
            let _ = app.emit(EVENT_OFFLINE_CHANGED, true);
            let _ = crate::notifications::dispatch(
                app,
                &state,
                "drive",
                "Gestion Drive hors ligne",
                "Le serveur Drive est injoignable. Vos fichiers locaux restent \
                 disponibles ; la synchronisation reprendra au retour du réseau.",
            );
        }
        Some(false) => {
            crate::sync_log::info(app, scope, "API Drive de nouveau joignable — reprise");
            let _ = app.emit(EVENT_OFFLINE_CHANGED, false);
            let _ = crate::notifications::dispatch(
                app,
                &state,
                "drive",
                "Gestion Drive de nouveau en ligne",
                "La synchronisation a repris.",
            );
        }
        None => {}
    }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn network_errors_are_detected_fr_and_en() {
        assert!(looks_like_network_error("upload-intent injoignable : oops"));
        assert!(looks_like_network_error(
            "requête impossible : error sending request for url"
        ));
        assert!(looks_like_network_error("lecture réseau interrompue : eof"));
        assert!(looks_like_network_error(
            "Réseau indisponible : chargement des espaces impossible"
        ));
        assert!(looks_like_network_error("Connection refused (os error 61)"));
        assert!(looks_like_network_error("operation timed out"));
        assert!(looks_like_network_error("blob refusé (HTTP 503)"));
    }

    #[test]
    fn non_network_errors_are_not_offline() {
        assert!(!looks_like_network_error("Aucun espace sélectionné"));
        assert!(!looks_like_network_error(
            "Dossier local non défini : choisissez un dossier"
        ));
        assert!(!looks_like_network_error("upload-intent refusé (HTTP 403)"));
        assert!(!looks_like_network_error(
            "empreinte SHA-256 invalide après téléchargement"
        ));
    }

    #[test]
    fn success_always_returns_online() {
        assert!(!next_offline_state(true, None));
        assert!(!next_offline_state(false, None));
    }

    #[test]
    fn network_failure_goes_offline() {
        assert!(next_offline_state(
            false,
            Some("tree inaccessible : connect")
        ));
        assert!(next_offline_state(true, Some("timeout")));
    }

    #[test]
    fn non_network_failure_keeps_previous_state() {
        assert!(!next_offline_state(false, Some("Aucun espace sélectionné")));
        assert!(next_offline_state(true, Some("Aucun espace sélectionné")));
    }
}
