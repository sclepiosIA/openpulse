//! Cœur de synchronisation Gestion Drive, indépendant de Tauri.
//!
//! Modules (plan §9) :
//! - `config`   : configuration client persistée (dossier sync, endpoint, device)
//! - `db`       : index local SQLite + migrations (`local_files`, `sync_cursors`, `sync_queue`)
//! - `models`   : types partagés (Space, LocalFile, SyncState…)
//! - `hashing`  : SHA-256 streaming des fichiers locaux
//! - `scanner`  : scan du dossier local → détection nouveaux/modifiés → queue
//! - `push`     : drain de la queue → upload-intent → PUT Blob SAS → upload-complete
//!
//! Modules à venir : `file_watcher` (notify), `pull` (download /changes),
//! `conflict_resolver`, `platform_credentials`.

pub mod actions;
pub mod config;
pub mod db;
pub mod hashing;
pub mod models;
pub mod pull;
pub mod push;
pub mod scanner;

use thiserror::Error;

#[derive(Debug, Error)]
pub enum SyncCoreError {
    #[error("erreur SQLite: {0}")]
    Db(#[from] rusqlite::Error),
    #[error("erreur E/S: {0}")]
    Io(#[from] std::io::Error),
    #[error("erreur JSON: {0}")]
    Json(#[from] serde_json::Error),
    #[error("configuration invalide: {0}")]
    InvalidConfig(String),
}

pub type Result<T> = std::result::Result<T, SyncCoreError>;
