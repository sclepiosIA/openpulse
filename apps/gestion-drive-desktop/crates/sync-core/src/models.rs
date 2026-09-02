//! Types partagés du moteur de sync.

use serde::{Deserialize, Serialize};

/// État de synchronisation d'un fichier local (colonne `local_files.sync_state`).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SyncState {
    Idle,
    PendingUpload,
    PendingDownload,
    Uploading,
    Downloading,
    Conflict,
    Error,
    Ignored,
}

impl SyncState {
    pub fn as_str(&self) -> &'static str {
        match self {
            SyncState::Idle => "idle",
            SyncState::PendingUpload => "pending_upload",
            SyncState::PendingDownload => "pending_download",
            SyncState::Uploading => "uploading",
            SyncState::Downloading => "downloading",
            SyncState::Conflict => "conflict",
            SyncState::Error => "error",
            SyncState::Ignored => "ignored",
        }
    }

    pub fn parse(s: &str) -> Option<Self> {
        Some(match s {
            "idle" => SyncState::Idle,
            "pending_upload" => SyncState::PendingUpload,
            "pending_download" => SyncState::PendingDownload,
            "uploading" => SyncState::Uploading,
            "downloading" => SyncState::Downloading,
            "conflict" => SyncState::Conflict,
            "error" => SyncState::Error,
            "ignored" => SyncState::Ignored,
            _ => return None,
        })
    }
}

/// État d'épinglage local d'un fichier (colonne `local_files.pin_state`),
/// modèle « OneDrive-like » géré par le moteur (voir
/// `docs/macos-file-provider-vs-finder-sync.md` §2.1 pour les limites
/// assumées sans extension File Provider signée).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "snake_case")]
pub enum PinState {
    /// « Toujours garder sur cet appareil » : jamais évincé.
    Pinned,
    /// Défaut : présent localement après pull, évincable.
    #[default]
    Unpinned,
    /// « Libéré de l'espace » : copie locale supprimée, métadonnées
    /// conservées comme placeholder ; re-téléchargement à la demande.
    Evicted,
}

impl PinState {
    pub fn as_str(&self) -> &'static str {
        match self {
            PinState::Pinned => "pinned",
            PinState::Unpinned => "unpinned",
            PinState::Evicted => "evicted",
        }
    }

    pub fn parse(s: &str) -> Option<Self> {
        Some(match s {
            "pinned" => PinState::Pinned,
            "unpinned" => PinState::Unpinned,
            "evicted" => PinState::Evicted,
            _ => return None,
        })
    }
}

/// Ligne de `local_files`.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LocalFile {
    pub local_path: String,
    pub space_id: String,
    pub file_id: Option<String>,
    pub folder_id: Option<String>,
    pub sha256: Option<String>,
    pub etag: Option<String>,
    pub version: i64,
    pub size_bytes: i64,
    pub mtime: i64,
    pub sync_state: SyncState,
    pub pin_state: PinState,
    pub last_error: Option<String>,
    pub updated_at: i64,
}

/// Espace Drive tel que renvoyé par `GET /api/drive/spaces`.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Space {
    pub id: String,
    pub name: String,
    pub slug: String,
    /// gsi | etablissement | project | dpo | template | personal
    pub space_type: String,
    /// allowed | web_only | approval_required
    pub sync_policy: String,
    /// standard | sensitive | hds | dpo_restricted
    pub sensitivity: String,
}

impl Space {
    /// Un espace `web_only` ne doit jamais être synchronisé localement (plan §12).
    pub fn is_syncable(&self) -> bool {
        self.sync_policy == "allowed"
    }
}

/// Opération en file d'attente (`sync_queue`).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QueueOp {
    pub id: i64,
    pub op_type: String,
    pub local_path: Option<String>,
    pub remote_path: Option<String>,
    pub payload: Option<String>,
    pub retry_count: i64,
    pub next_attempt_at: i64,
    pub created_at: i64,
}

/// Fichiers à ignorer par le watcher (plan §15 — fichiers temporaires Office etc.).
pub const IGNORE_PATTERNS: &[&str] = &[
    "~$",
    ".tmp",
    ".DS_Store",
    "Thumbs.db",
    ".crdownload",
    ".part",
];

/// Vrai si le nom de fichier doit être ignoré par la sync.
pub fn is_ignored_filename(name: &str) -> bool {
    if name.starts_with("~$") || name.starts_with('.') && (name == ".DS_Store") {
        return true;
    }
    matches!(name, ".DS_Store" | "Thumbs.db")
        || name.ends_with(".tmp")
        || name.ends_with(".crdownload")
        || name.ends_with(".part")
        || name.starts_with("~$")
}

/// Nom de copie de conflit, jamais d'écrasement silencieux (plan §8.6).
/// Ex : `rapport.docx` → `rapport (conflit - Andréï - 2026-07-07 12h42).docx`
pub fn conflict_copy_name(filename: &str, user: &str, stamp: &str) -> String {
    match filename.rsplit_once('.') {
        Some((stem, ext)) if !stem.is_empty() => {
            format!("{stem} (conflit - {user} - {stamp}).{ext}")
        }
        _ => format!("{filename} (conflit - {user} - {stamp})"),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sync_state_roundtrip() {
        for s in [
            SyncState::Idle,
            SyncState::PendingUpload,
            SyncState::Conflict,
            SyncState::Ignored,
        ] {
            assert_eq!(SyncState::parse(s.as_str()), Some(s));
        }
        assert_eq!(SyncState::parse("bogus"), None);
    }

    #[test]
    fn web_only_space_is_not_syncable() {
        let mut space = Space {
            id: "1".into(),
            name: "DPO".into(),
            slug: "dpo".into(),
            space_type: "dpo".into(),
            sync_policy: "web_only".into(),
            sensitivity: "dpo_restricted".into(),
        };
        assert!(!space.is_syncable());
        space.sync_policy = "allowed".into();
        assert!(space.is_syncable());
    }

    #[test]
    fn ignores_office_temp_files() {
        assert!(is_ignored_filename("~$rapport.docx"));
        assert!(is_ignored_filename("foo.tmp"));
        assert!(is_ignored_filename(".DS_Store"));
        assert!(is_ignored_filename("Thumbs.db"));
        assert!(!is_ignored_filename("rapport.docx"));
    }

    #[test]
    fn conflict_name_keeps_extension() {
        assert_eq!(
            conflict_copy_name("rapport.docx", "Andréï", "2026-07-07 12h42"),
            "rapport (conflit - Andréï - 2026-07-07 12h42).docx"
        );
        assert_eq!(
            conflict_copy_name("LISEZMOI", "A", "x"),
            "LISEZMOI (conflit - A - x)"
        );
    }
}
