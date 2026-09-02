//! Préférences locales de l'application (plan §5 — Phase 2).
//!
//! Persistées dans `preferences.json` (répertoire de données app), séparées de
//! `config.json` (sync-core) pour ne pas toucher au moteur Drive existant.
//! Aucun secret ici : uniquement des réglages UI/notifications.
//!
//! Contenu :
//!   - notifications par module (Pulse / Mail / Todo / Drive) ;
//!   - mode ne pas déranger (manuel + plage horaire optionnelle) ;
//!   - démarrage au login (flag stocké — câblage OS en Phase 4) ;
//!   - intervalle de polling notifications.

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;
use tauri::State;

use crate::AppState;

pub const PREFERENCES_FILE_NAME: &str = "preferences.json";

/// Bornes de l'intervalle de polling (secondes).
pub const MIN_POLL_INTERVAL_SECS: u64 = 5;
pub const MAX_POLL_INTERVAL_SECS: u64 = 3600;

/// Modules émetteurs de notifications dans le shell Gestion Desktop.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum NotificationModule {
    Pulse,
    Mail,
    Todo,
    Drive,
    /// Notifications applicatives (mises à jour, erreurs shell). Toujours
    /// autorisées par module, mais soumises au mode ne pas déranger.
    System,
}

impl NotificationModule {
    pub fn parse(raw: &str) -> Option<Self> {
        match raw.trim().to_ascii_lowercase().as_str() {
            "pulse" => Some(Self::Pulse),
            "mail" | "emails" => Some(Self::Mail),
            "todo" | "todos" => Some(Self::Todo),
            "drive" => Some(Self::Drive),
            "system" | "systeme" | "système" => Some(Self::System),
            _ => None,
        }
    }
}

/// Activation des notifications par module.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(default)]
pub struct ModuleNotificationPrefs {
    pub pulse: bool,
    pub mail: bool,
    pub todo: bool,
    pub drive: bool,
}

impl Default for ModuleNotificationPrefs {
    fn default() -> Self {
        Self {
            pulse: true,
            mail: true,
            todo: true,
            drive: true,
        }
    }
}

/// Mode ne pas déranger : bascule manuelle + plage horaire silencieuse
/// optionnelle (minutes depuis minuit, heure locale ; peut franchir minuit,
/// ex. 22h → 8h = start 1320 / end 480).
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(default)]
pub struct DoNotDisturbPrefs {
    pub enabled: bool,
    pub schedule_enabled: bool,
    pub start_minutes: u16,
    pub end_minutes: u16,
}

impl Default for DoNotDisturbPrefs {
    fn default() -> Self {
        Self {
            enabled: false,
            schedule_enabled: false,
            start_minutes: 22 * 60, // 22:00
            end_minutes: 8 * 60,    // 08:00
        }
    }
}

impl DoNotDisturbPrefs {
    /// Le mode silencieux est-il actif à `local_minutes` (minutes depuis
    /// minuit, heure locale) ? Gère les plages qui franchissent minuit.
    pub fn is_active(&self, local_minutes: u16) -> bool {
        if self.enabled {
            return true;
        }
        if !self.schedule_enabled || self.start_minutes == self.end_minutes {
            return false;
        }
        if self.start_minutes < self.end_minutes {
            local_minutes >= self.start_minutes && local_minutes < self.end_minutes
        } else {
            local_minutes >= self.start_minutes || local_minutes < self.end_minutes
        }
    }
}

/// Préférences locales du shell. `#[serde(default)]` garantit la
/// rétro-compatibilité si de nouveaux champs apparaissent.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(default)]
pub struct AppPreferences {
    pub notifications: ModuleNotificationPrefs,
    pub do_not_disturb: DoNotDisturbPrefs,
    /// Démarrage au login OS. Stocké dès maintenant ; le câblage
    /// (LaunchAgent / registre Windows) arrive en Phase 4.
    pub launch_at_login: bool,
    /// Pause globale persistée entre deux lancements.
    pub sync_paused: bool,
    /// Autorise l'app à réutiliser automatiquement la session Gestion publiée
    /// par la PWA. Un logout Drive explicite désactive ce pont jusqu'à une
    /// reconnexion explicite.
    pub drive_auto_connect: bool,
    /// Intervalle de polling des notifications (secondes).
    pub poll_interval_secs: u64,
}

impl Default for AppPreferences {
    fn default() -> Self {
        Self {
            notifications: ModuleNotificationPrefs::default(),
            do_not_disturb: DoNotDisturbPrefs::default(),
            launch_at_login: false,
            sync_paused: false,
            drive_auto_connect: false,
            poll_interval_secs: 60,
        }
    }
}

impl AppPreferences {
    /// Charge `dir/preferences.json`. Une première installation sans fichier
    /// utilise les valeurs par défaut ; un fichier présent mais illisible garde
    /// l'application utilisable tout en désactivant la reconnexion Drive.
    pub fn load_or_default(dir: &Path) -> Self {
        let path = dir.join(PREFERENCES_FILE_NAME);
        if !path.exists() {
            return Self::default();
        }
        match fs::read_to_string(&path)
            .ok()
            .and_then(|raw| serde_json::from_str(&raw).ok())
        {
            Some(preferences) => preferences,
            None => Self {
                drive_auto_connect: false,
                ..Self::default()
            },
        }
    }

    /// Sauvegarde atomique (temp + rename), même stratégie que ClientConfig.
    pub fn save(&self, dir: &Path) -> std::io::Result<()> {
        fs::create_dir_all(dir)?;
        let path = dir.join(PREFERENCES_FILE_NAME);
        let tmp = dir.join(format!("{PREFERENCES_FILE_NAME}.tmp"));
        let payload = serde_json::to_vec_pretty(self)
            .map_err(|e| std::io::Error::new(std::io::ErrorKind::InvalidData, e))?;
        fs::write(&tmp, payload)?;
        fs::rename(&tmp, &path)?;
        Ok(())
    }

    /// Ramène les valeurs hors bornes dans des plages sûres.
    pub fn normalized(mut self) -> Self {
        self.poll_interval_secs = self
            .poll_interval_secs
            .clamp(MIN_POLL_INTERVAL_SECS, MAX_POLL_INTERVAL_SECS);
        self.do_not_disturb.start_minutes = self.do_not_disturb.start_minutes.min(24 * 60 - 1);
        self.do_not_disturb.end_minutes = self.do_not_disturb.end_minutes.min(24 * 60 - 1);
        self
    }

    /// Les notifications de ce module sont-elles activées ?
    pub fn module_enabled(&self, module: NotificationModule) -> bool {
        match module {
            NotificationModule::Pulse => self.notifications.pulse,
            NotificationModule::Mail => self.notifications.mail,
            NotificationModule::Todo => self.notifications.todo,
            NotificationModule::Drive => self.notifications.drive,
            NotificationModule::System => true,
        }
    }

    /// Décision finale d'affichage natif : module activé ET pas en DND.
    pub fn should_deliver_natively(&self, module: NotificationModule, local_minutes: u16) -> bool {
        if matches!(module, NotificationModule::System) {
            return true;
        }
        self.module_enabled(module) && !self.do_not_disturb.is_active(local_minutes)
    }
}

pub fn persist_sync_paused(state: &AppState, paused: bool) -> Result<(), String> {
    *state.sync_paused.lock().map_err(|e| e.to_string())? = paused;
    let updated = {
        let mut prefs = state.preferences.lock().map_err(|e| e.to_string())?;
        prefs.sync_paused = paused;
        prefs.clone()
    };
    updated
        .save(&state.data_dir)
        .map_err(|e| format!("Impossible de persister la pause : {e}"))
}

pub fn persist_drive_auto_connect(state: &AppState, enabled: bool) -> Result<(), String> {
    let updated = {
        let mut prefs = state.preferences.lock().map_err(|e| e.to_string())?;
        prefs.drive_auto_connect = enabled;
        prefs.clone()
    };
    updated
        .save(&state.data_dir)
        .map_err(|e| format!("Impossible de persister la connexion Drive automatique : {e}"))
}

// ---------------------------------------------------------------------------
// Commandes IPC
// ---------------------------------------------------------------------------

#[tauri::command]
pub fn get_preferences(state: State<'_, AppState>) -> Result<AppPreferences, String> {
    Ok(state.preferences.lock().map_err(|e| e.to_string())?.clone())
}

/// Remplace les préférences (normalisées) et les persiste.
#[tauri::command]
pub fn set_preferences(
    state: State<'_, AppState>,
    preferences: AppPreferences,
) -> Result<AppPreferences, String> {
    let normalized = preferences.normalized();
    {
        let mut prefs = state.preferences.lock().map_err(|e| e.to_string())?;
        *prefs = normalized.clone();
    }
    normalized
        .save(&state.data_dir)
        .map_err(|e| format!("Impossible d'enregistrer les préférences : {e}"))?;
    Ok(normalized)
}

/// Bascule rapide du mode ne pas déranger (utilisée par le tray et l'UI).
#[tauri::command]
pub fn set_do_not_disturb(
    state: State<'_, AppState>,
    enabled: bool,
) -> Result<AppPreferences, String> {
    let updated = {
        let mut prefs = state.preferences.lock().map_err(|e| e.to_string())?;
        prefs.do_not_disturb.enabled = enabled;
        prefs.clone()
    };
    updated
        .save(&state.data_dir)
        .map_err(|e| format!("Impossible d'enregistrer les préférences : {e}"))?;
    Ok(updated)
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn save_then_load_roundtrip() {
        let dir = std::env::temp_dir().join(format!("gd-prefs-{}", uuid::Uuid::new_v4()));
        let mut prefs = AppPreferences::default();
        prefs.notifications.mail = false;
        prefs.do_not_disturb.enabled = true;
        prefs.launch_at_login = true;
        prefs.poll_interval_secs = 120;
        prefs.save(&dir).unwrap();

        let loaded = AppPreferences::load_or_default(&dir);
        assert_eq!(loaded, prefs);
        std::fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn drive_auto_connect_is_disabled_by_default() {
        assert!(!AppPreferences::default().drive_auto_connect);
    }

    #[test]
    fn missing_file_yields_first_install_defaults() {
        let dir = std::env::temp_dir().join(format!("gd-prefs-{}", uuid::Uuid::new_v4()));
        assert_eq!(
            AppPreferences::load_or_default(&dir),
            AppPreferences::default()
        );
        std::fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn corrupt_file_disables_drive_auto_connect() {
        let dir = std::env::temp_dir().join(format!("gd-prefs-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&dir).unwrap();
        std::fs::write(dir.join(PREFERENCES_FILE_NAME), b"{ pas du json").unwrap();

        let loaded = AppPreferences::load_or_default(&dir);
        assert!(!loaded.drive_auto_connect);
        assert_eq!(
            loaded.notifications,
            AppPreferences::default().notifications
        );
        std::fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn normalized_clamps_poll_interval_and_minutes() {
        let prefs = AppPreferences {
            poll_interval_secs: 1,
            do_not_disturb: DoNotDisturbPrefs {
                start_minutes: 5000,
                ..Default::default()
            },
            ..Default::default()
        };
        let n = prefs.normalized();
        assert_eq!(n.poll_interval_secs, MIN_POLL_INTERVAL_SECS);
        assert_eq!(n.do_not_disturb.start_minutes, 24 * 60 - 1);

        let prefs = AppPreferences {
            poll_interval_secs: 999_999,
            ..Default::default()
        };
        assert_eq!(
            prefs.normalized().poll_interval_secs,
            MAX_POLL_INTERVAL_SECS
        );
    }

    #[test]
    fn dnd_manual_toggle_wins() {
        let dnd = DoNotDisturbPrefs {
            enabled: true,
            schedule_enabled: false,
            ..Default::default()
        };
        assert!(dnd.is_active(12 * 60));
    }

    #[test]
    fn dnd_schedule_same_day() {
        let dnd = DoNotDisturbPrefs {
            enabled: false,
            schedule_enabled: true,
            start_minutes: 9 * 60,
            end_minutes: 17 * 60,
        };
        assert!(!dnd.is_active(8 * 60));
        assert!(dnd.is_active(9 * 60));
        assert!(dnd.is_active(12 * 60));
        assert!(!dnd.is_active(17 * 60));
    }

    #[test]
    fn dnd_schedule_crosses_midnight() {
        let dnd = DoNotDisturbPrefs {
            enabled: false,
            schedule_enabled: true,
            start_minutes: 22 * 60,
            end_minutes: 8 * 60,
        };
        assert!(dnd.is_active(23 * 60));
        assert!(dnd.is_active(3 * 60));
        assert!(!dnd.is_active(8 * 60));
        assert!(!dnd.is_active(12 * 60));
    }

    #[test]
    fn dnd_empty_schedule_is_inactive() {
        let dnd = DoNotDisturbPrefs {
            enabled: false,
            schedule_enabled: true,
            start_minutes: 600,
            end_minutes: 600,
        };
        assert!(!dnd.is_active(600));
    }

    #[test]
    fn module_toggles_filter_native_delivery() {
        let mut prefs = AppPreferences::default();
        prefs.notifications.pulse = false;
        assert!(!prefs.should_deliver_natively(NotificationModule::Pulse, 12 * 60));
        assert!(prefs.should_deliver_natively(NotificationModule::Mail, 12 * 60));
        // System ignore les toggles module et le DND : utilisé pour les tests/alertes techniques.
        assert!(prefs.should_deliver_natively(NotificationModule::System, 12 * 60));
        prefs.do_not_disturb.enabled = true;
        assert!(prefs.should_deliver_natively(NotificationModule::System, 12 * 60));
    }

    #[test]
    fn module_parse_accepts_aliases() {
        assert_eq!(
            NotificationModule::parse("Pulse"),
            Some(NotificationModule::Pulse)
        );
        assert_eq!(
            NotificationModule::parse("emails"),
            Some(NotificationModule::Mail)
        );
        assert_eq!(
            NotificationModule::parse("todos"),
            Some(NotificationModule::Todo)
        );
        assert_eq!(
            NotificationModule::parse("DRIVE"),
            Some(NotificationModule::Drive)
        );
        assert_eq!(
            NotificationModule::parse("système"),
            Some(NotificationModule::System)
        );
        assert_eq!(NotificationModule::parse("inconnu"), None);
    }
}
