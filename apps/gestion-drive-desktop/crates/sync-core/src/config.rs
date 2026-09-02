//! Configuration client persistée (JSON dans le répertoire de données app).
//!
//! ⚠️ Aucun secret ici : les tokens vont dans Keychain/Credential Manager
//! (module `platform_credentials` à venir). Ce fichier ne contient que des
//! préférences et identifiants non sensibles.

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};

use crate::{Result, SyncCoreError};

pub const CONFIG_FILE_NAME: &str = "config.json";
pub const DB_FILE_NAME: &str = "gestion-drive.sqlite3";

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ClientConfig {
    /// URL de l'API Gestion Drive (ex. https://drive-api.gestion.gsi.fr). Pas un secret.
    pub api_base_url: String,
    /// URL de Gestion web (liens de partage, « ouvrir dans Gestion »).
    #[serde(default = "default_web_base_url")]
    pub web_base_url: String,
    /// Dossier racine synchronisé choisi par l'utilisateur.
    pub sync_root: Option<PathBuf>,
    /// Identifiant machine stable (généré au premier lancement).
    pub machine_id: String,
    /// Nom d'appareil affiché dans Gestion (« MacBook Andréï »).
    pub device_name: String,
    /// IDs des espaces sélectionnés pour la sync locale.
    pub selected_space_ids: Vec<String>,
    /// Intervalle de poll du flux /changes, en secondes.
    pub poll_interval_secs: u64,
    /// Debounce watcher avant upload, en millisecondes (plan §8.3 : 1–3 s).
    pub debounce_ms: u64,
}

/// Gabarits neutres : ils ne resolvent pas, et c'est voulu.
///
/// La distribution ne doit designer aucune instance en particulier. Un
/// exploitant qui empaquette pour la sienne renseigne les deux variables
/// ci-dessous AU MOMENT DE LA CONSTRUCTION — `option_env!` les fige alors dans
/// le binaire, ce qui evite de demander a l'utilisateur final de saisir deux
/// URL au premier lancement :
///
/// ```sh
/// OPENPULSE_WEB_BASE_URL=https://mon-instance.example \
/// OPENPULSE_API_BASE_URL=https://mon-instance.example/drive \
///   npm run tauri build
/// ```
///
/// Sans ces variables, les gabarits restent en place et l'utilisateur configure
/// ses URL depuis l'application. Auparavant elles etaient ecrites en dur : il
/// fallait modifier du Rust pour viser une autre instance.
const GABARIT_WEB_BASE_URL: &str = "https://espace.exploitant.example.org";
const GABARIT_API_BASE_URL: &str = "https://openpulse-gestion-drive-api.openpulse.example.org";

pub const DEFAULT_WEB_BASE_URL: &str = match option_env!("OPENPULSE_WEB_BASE_URL") {
    Some(url) => url,
    None => GABARIT_WEB_BASE_URL,
};

pub const DEFAULT_API_BASE_URL: &str = match option_env!("OPENPULSE_API_BASE_URL") {
    Some(url) => url,
    None => GABARIT_API_BASE_URL,
};
const LEGACY_WEB_BASE_URLS: [&str; 3] = [
    "https://gestion.exploitant.example.org",
    "https://openpulse-gestion-web.openpulse.example.org",
    "https://espace.openpulse.example.org",
];

fn default_web_base_url() -> String {
    DEFAULT_WEB_BASE_URL.to_string()
}

pub fn migrated_web_base_url(current: &str) -> Option<&'static str> {
    let normalized = current.trim_end_matches('/');
    LEGACY_WEB_BASE_URLS
        .contains(&normalized)
        .then_some(DEFAULT_WEB_BASE_URL)
}

impl Default for ClientConfig {
    fn default() -> Self {
        Self {
            api_base_url: DEFAULT_API_BASE_URL.to_string(),
            web_base_url: default_web_base_url(),
            sync_root: None,
            machine_id: String::new(),
            device_name: default_device_name(),
            selected_space_ids: Vec::new(),
            poll_interval_secs: 30,
            debounce_ms: 2000,
        }
    }
}

fn default_device_name() -> String {
    let host = std::env::var("HOSTNAME")
        .or_else(|_| std::env::var("COMPUTERNAME"))
        .unwrap_or_else(|_| "poste".to_string());
    let platform = if cfg!(target_os = "macos") {
        "macOS"
    } else if cfg!(target_os = "windows") {
        "Windows"
    } else {
        "desktop"
    };
    format!("{host} ({platform})")
}

impl ClientConfig {
    /// Charge la config depuis `dir/config.json`, ou crée la config par défaut.
    pub fn load_or_default(dir: &Path) -> Result<Self> {
        let path = dir.join(CONFIG_FILE_NAME);
        if path.exists() {
            let raw = fs::read_to_string(&path)?;
            Ok(serde_json::from_str(&raw)?)
        } else {
            Ok(Self::default())
        }
    }

    /// Sauvegarde atomique (écriture temp + rename) dans `dir/config.json`.
    pub fn save(&self, dir: &Path) -> Result<()> {
        fs::create_dir_all(dir)?;
        let path = dir.join(CONFIG_FILE_NAME);
        let tmp = dir.join(format!("{CONFIG_FILE_NAME}.tmp"));
        fs::write(&tmp, serde_json::to_vec_pretty(self)?)?;
        fs::rename(&tmp, &path)?;
        Ok(())
    }

    /// Valide la config avant démarrage de la sync.
    pub fn validate_for_sync(&self) -> Result<()> {
        let root = self
            .sync_root
            .as_ref()
            .ok_or_else(|| SyncCoreError::InvalidConfig("sync_root non défini".into()))?;
        if !root.is_dir() {
            return Err(SyncCoreError::InvalidConfig(format!(
                "sync_root n'existe pas: {}",
                root.display()
            )));
        }
        if self.selected_space_ids.is_empty() {
            return Err(SyncCoreError::InvalidConfig(
                "aucun espace sélectionné".into(),
            ));
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn save_then_load_roundtrip() {
        let dir = tempdir().unwrap();
        let cfg = ClientConfig {
            machine_id: "mach-123".into(),
            selected_space_ids: vec!["space-a".into()],
            sync_root: Some(dir.path().to_path_buf()),
            ..Default::default()
        };
        cfg.save(dir.path()).unwrap();

        let loaded = ClientConfig::load_or_default(dir.path()).unwrap();
        assert_eq!(loaded, cfg);
    }

    #[test]
    fn missing_config_yields_default() {
        let dir = tempdir().unwrap();
        let cfg = ClientConfig::load_or_default(dir.path()).unwrap();
        assert_eq!(cfg.poll_interval_secs, 30);
        assert!(cfg.sync_root.is_none());
        assert_eq!(cfg.web_base_url, DEFAULT_WEB_BASE_URL);
    }

    #[test]
    fn legacy_config_without_web_base_url_still_loads() {
        // config.json écrit par une version antérieure (pas de web_base_url).
        let dir = tempdir().unwrap();
        let legacy = serde_json::json!({
            "api_base_url": "https://api.example",
            "sync_root": null,
            "machine_id": "m1",
            "device_name": "poste",
            "selected_space_ids": [],
            "poll_interval_secs": 30,
            "debounce_ms": 2000
        });
        std::fs::write(
            dir.path().join(CONFIG_FILE_NAME),
            serde_json::to_vec(&legacy).unwrap(),
        )
        .unwrap();
        let cfg = ClientConfig::load_or_default(dir.path()).unwrap();
        assert_eq!(cfg.machine_id, "m1");
        assert_eq!(cfg.web_base_url, DEFAULT_WEB_BASE_URL);
    }

    #[test]
    fn legacy_web_origins_migrate_once_to_the_same_site_desktop_origin() {
        for legacy in [
            "https://gestion.exploitant.example.org",
            "https://openpulse-gestion-web.openpulse.example.org",
            "https://espace.openpulse.example.org",
        ] {
            assert_eq!(migrated_web_base_url(legacy), Some(DEFAULT_WEB_BASE_URL));
        }
        assert_eq!(migrated_web_base_url(DEFAULT_WEB_BASE_URL), None);
        assert_eq!(migrated_web_base_url("https://custom.example"), None);
    }

    #[test]
    fn validate_rejects_missing_root_and_spaces() {
        let dir = tempdir().unwrap();
        let mut cfg = ClientConfig::default();
        assert!(cfg.validate_for_sync().is_err());

        cfg.sync_root = Some(dir.path().to_path_buf());
        assert!(cfg.validate_for_sync().is_err()); // pas d'espace

        cfg.selected_space_ids = vec!["s1".into()];
        assert!(cfg.validate_for_sync().is_ok());
    }
}

#[cfg(test)]
mod tests_cible_instance {
    use super::*;

    /// Les gabarits ne doivent designer aucune instance reelle.
    ///
    /// Une distribution qui pointerait par defaut sur l'infrastructure de son
    /// editeur enverrait les fichiers de tout adoptant chez lui — c'est le pire
    /// defaut possible pour un client de synchronisation.
    #[test]
    fn les_gabarits_ne_designent_aucune_instance_reelle() {
        for gabarit in [GABARIT_WEB_BASE_URL, GABARIT_API_BASE_URL] {
            assert!(
                gabarit.contains(".example.org") || gabarit.contains(".example."),
                "gabarit non neutre : {gabarit}"
            );
            assert!(!gabarit.contains("azure"), "gabarit vise Azure : {gabarit}");
            assert!(!gabarit.contains("gsi"), "gabarit vise l'editeur : {gabarit}");
        }
    }

    /// La configuration par defaut emploie bien les constantes, et non des
    /// chaines recopiees : c'est ce qui rend la surcharge de construction
    /// effective jusque dans le fichier ecrit au premier lancement.
    #[test]
    fn la_config_par_defaut_suit_les_constantes() {
        let config = ClientConfig::default();
        assert_eq!(config.web_base_url, DEFAULT_WEB_BASE_URL);
        assert_eq!(config.api_base_url, DEFAULT_API_BASE_URL);
    }
}
