//! Logique pure du pull sync (plan §2.2 — premier lot Desktop).
//!
//! Aucune E/S ici : uniquement des décisions testables sans réseau ni disque.
//! L'orchestration HTTP/fichiers vit dans `src-tauri::sync`.

use crate::models::{LocalFile, PinState, SyncState};

/// Décision de pull pour un fichier distant donné (plan §8 : jamais
/// d'écrasement silencieux d'un état local inconnu ou en attente d'envoi).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PullDecision {
    /// Télécharger (nouveau fichier ou version distante plus récente).
    Download,
    /// Déjà à jour localement.
    SkipUpToDate,
    /// Un fichier existe sur le disque sans trace dans l'index local :
    /// on ne l'écrase pas (il sera réconcilié par le watcher/upload, lot 2).
    SkipLocalUnknown,
    /// Modifications locales en attente (upload/conflit) : le pull ne touche pas.
    SkipLocalPending,
    /// Fichier « libéré de l'espace » (pin_state = evicted) : les métadonnées
    /// servent de placeholder, on ne re-télécharge qu'à la demande explicite
    /// (pin_file / téléchargement manuel), jamais au pull automatique.
    SkipEvicted,
}

/// Décide quoi faire d'un fichier distant `remote_version`/`remote_sha256`
/// au regard de l'index local (`local`) et de la présence réelle sur disque.
pub fn decide_pull(
    local: Option<&LocalFile>,
    file_on_disk: bool,
    remote_version: i64,
    remote_sha256: Option<&str>,
) -> PullDecision {
    match local {
        None => {
            if file_on_disk {
                PullDecision::SkipLocalUnknown
            } else {
                PullDecision::Download
            }
        }
        Some(l) => {
            if matches!(
                l.sync_state,
                SyncState::PendingUpload | SyncState::Uploading | SyncState::Conflict
            ) {
                return PullDecision::SkipLocalPending;
            }
            if !file_on_disk {
                // Fichier libéré volontairement : rester un placeholder.
                if l.pin_state == PinState::Evicted {
                    return PullDecision::SkipEvicted;
                }
                // Connu de l'index mais absent du disque → re-télécharger.
                return PullDecision::Download;
            }
            if l.version < remote_version {
                return PullDecision::Download;
            }
            if l.version == remote_version {
                if let (Some(remote), Some(local_sha)) = (remote_sha256, l.sha256.as_deref()) {
                    if remote != local_sha {
                        return PullDecision::Download;
                    }
                }
                return PullDecision::SkipUpToDate;
            }
            // Version locale > distante : anormal, on n'écrase pas.
            PullDecision::SkipUpToDate
        }
    }
}

/// Normalise un chemin Drive serveur en chemin relatif sûr (séparateur `/`,
/// sans composant vide, `.` ni `..`). Retourne `None` si le chemin est
/// vide ou tente une traversée.
pub fn safe_relative_path(path: &str) -> Option<String> {
    let normalized = path.replace('\\', "/");
    let mut parts: Vec<&str> = Vec::new();
    for part in normalized.split('/') {
        match part {
            "" | "." => continue,
            ".." => return None,
            p => parts.push(p),
        }
    }
    if parts.is_empty() {
        None
    } else {
        Some(parts.join("/"))
    }
}

/// Nom du dossier local d'un espace sous le sync root : slug lisible si
/// disponible, sinon l'id (stable).
pub fn space_dir_name(slug: &str, space_id: &str) -> String {
    let slug = slug.trim();
    let candidate = if slug.is_empty() { space_id } else { slug };
    // Le slug serveur est déjà contraint ([a-z0-9-]) mais on re-sécurise.
    safe_relative_path(candidate).unwrap_or_else(|| space_id.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::{LocalFile, SyncState};

    fn local(version: i64, sha: Option<&str>, state: SyncState) -> LocalFile {
        LocalFile {
            local_path: "openpulse-general/doc.pdf".into(),
            space_id: "s1".into(),
            file_id: Some("f1".into()),
            folder_id: None,
            sha256: sha.map(str::to_string),
            etag: None,
            version,
            size_bytes: 10,
            mtime: 0,
            sync_state: state,
            pin_state: crate::models::PinState::Unpinned,
            last_error: None,
            updated_at: 0,
        }
    }

    #[test]
    fn evicted_file_is_not_redownloaded_by_pull() {
        let mut l = local(2, Some("abc"), SyncState::Idle);
        l.pin_state = crate::models::PinState::Evicted;
        // Absent du disque (libéré) → placeholder, pas de re-téléchargement auto.
        assert_eq!(
            decide_pull(Some(&l), false, 5, Some("zzz")),
            PullDecision::SkipEvicted
        );
    }

    #[test]
    fn pinned_missing_file_is_downloaded() {
        // pin_file sur un fichier évincé remet pin_state=pinned → le pull
        // suivant le rematérialise.
        let mut l = local(2, Some("abc"), SyncState::Idle);
        l.pin_state = crate::models::PinState::Pinned;
        assert_eq!(
            decide_pull(Some(&l), false, 2, Some("abc")),
            PullDecision::Download
        );
    }

    #[test]
    fn new_remote_file_is_downloaded() {
        assert_eq!(
            decide_pull(None, false, 1, Some("abc")),
            PullDecision::Download
        );
    }

    #[test]
    fn unknown_local_file_is_never_overwritten() {
        assert_eq!(
            decide_pull(None, true, 1, Some("abc")),
            PullDecision::SkipLocalUnknown
        );
    }

    #[test]
    fn missing_on_disk_is_redownloaded() {
        let l = local(1, Some("abc"), SyncState::Idle);
        assert_eq!(
            decide_pull(Some(&l), false, 1, Some("abc")),
            PullDecision::Download
        );
    }

    #[test]
    fn newer_remote_version_is_downloaded() {
        let l = local(1, Some("abc"), SyncState::Idle);
        assert_eq!(
            decide_pull(Some(&l), true, 2, Some("def")),
            PullDecision::Download
        );
    }

    #[test]
    fn same_version_same_sha_is_up_to_date() {
        let l = local(2, Some("abc"), SyncState::Idle);
        assert_eq!(
            decide_pull(Some(&l), true, 2, Some("abc")),
            PullDecision::SkipUpToDate
        );
    }

    #[test]
    fn same_version_different_sha_is_downloaded() {
        let l = local(2, Some("abc"), SyncState::Idle);
        assert_eq!(
            decide_pull(Some(&l), true, 2, Some("zzz")),
            PullDecision::Download
        );
    }

    #[test]
    fn pending_upload_or_conflict_is_left_alone() {
        for state in [
            SyncState::PendingUpload,
            SyncState::Uploading,
            SyncState::Conflict,
        ] {
            let l = local(1, Some("abc"), state);
            assert_eq!(
                decide_pull(Some(&l), true, 5, Some("zzz")),
                PullDecision::SkipLocalPending
            );
        }
    }

    #[test]
    fn local_version_ahead_is_not_downgraded() {
        let l = local(3, Some("abc"), SyncState::Idle);
        assert_eq!(
            decide_pull(Some(&l), true, 2, Some("zzz")),
            PullDecision::SkipUpToDate
        );
    }

    #[test]
    fn safe_relative_path_normalizes_and_rejects_traversal() {
        assert_eq!(
            safe_relative_path("/Contrats//2026/doc.pdf").as_deref(),
            Some("Contrats/2026/doc.pdf")
        );
        assert_eq!(
            safe_relative_path("a\\b\\c.txt").as_deref(),
            Some("a/b/c.txt")
        );
        assert_eq!(safe_relative_path("./a/./b").as_deref(), Some("a/b"));
        assert_eq!(safe_relative_path("../etc/passwd"), None);
        assert_eq!(safe_relative_path("a/../../b"), None);
        assert_eq!(safe_relative_path(""), None);
        assert_eq!(safe_relative_path("///"), None);
    }

    #[test]
    fn space_dir_prefers_slug_falls_back_to_id() {
        assert_eq!(space_dir_name("openpulse-general", "id-1"), "openpulse-general");
        assert_eq!(space_dir_name("  ", "id-1"), "id-1");
        // Slug hostile (traversal) → repli sur l'id, jamais de sortie du root.
        assert_eq!(space_dir_name("../evil", "id-1"), "id-1");
    }
}
