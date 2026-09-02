//! Actions contextuelles « OneDrive-like » — logique pure, sans E/S réseau.
//!
//! Ce module décide (de façon testable) ce qu'on a le droit de faire sur un
//! fichier de l'index local : copier un lien, l'ouvrir dans Gestion web,
//! l'épingler (« toujours garder sur cet appareil ») ou libérer sa copie
//! locale (« libérer de l'espace »). L'orchestration disque/presse-papiers
//! vit dans `src-tauri::drive_actions`.
//!
//! ⚠️ Honnêteté périmètre : ces actions sont exposées dans l'app (menu
//! contextuel de l'écran Fichiers + tray). Les équivalents *dans le Finder*
//! (badges, clic droit Finder, placeholders) nécessitent une extension
//! File Provider signée Apple Developer — voir
//! `docs/macos-file-provider-vs-finder-sync.md`.

use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

use rusqlite::Connection;

use crate::models::{LocalFile, PinState, SyncState};
use crate::{db, hashing};

/// Identifiants stables des actions contextuelles (partagés UI ↔ Rust).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum FileAction {
    /// Copier le lien Gestion web du fichier.
    CopyLink,
    /// Ouvrir le fichier dans Gestion web.
    OpenInGestion,
    /// Révéler le fichier dans le Finder / l'Explorateur.
    RevealInFileManager,
    /// Re-matérialiser un fichier « libéré » sans changer la politique de pin
    /// (équivalent OneDrive « Télécharger » : redevient `unpinned`).
    Download,
    /// « Toujours garder sur cet appareil » (télécharge si évincé).
    KeepLocal,
    /// Annuler l'épinglage (redevient évincable).
    Unpin,
    /// « Libérer de l'espace » : supprime la copie locale, garde le placeholder.
    FreeSpace,
}

/// Pourquoi une éviction est refusée.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case", tag = "reason")]
pub enum EvictRefusal {
    /// Fichier épinglé : l'utilisateur a demandé de le garder.
    Pinned,
    /// Modifications locales non envoyées (upload/conflit en attente).
    LocalChangesPending,
    /// Jamais uploadé : la copie locale est la seule existante.
    NeverUploaded,
    /// Déjà évincé.
    AlreadyEvicted,
}

/// Vérifie si un fichier peut être « libéré de l'espace » sans perte de
/// données. Ne touche pas au disque : décision pure sur l'index.
pub fn can_evict(f: &LocalFile) -> Result<(), EvictRefusal> {
    if f.pin_state == PinState::Evicted {
        return Err(EvictRefusal::AlreadyEvicted);
    }
    if f.pin_state == PinState::Pinned {
        return Err(EvictRefusal::Pinned);
    }
    if matches!(
        f.sync_state,
        SyncState::PendingUpload | SyncState::Uploading | SyncState::Conflict
    ) {
        return Err(EvictRefusal::LocalChangesPending);
    }
    if f.file_id.is_none() {
        return Err(EvictRefusal::NeverUploaded);
    }
    Ok(())
}

/// Liste des actions proposables pour un fichier donné, dans l'ordre
/// d'affichage du menu contextuel. Partagée entre l'écran Fichiers et le tray.
pub fn available_actions(f: &LocalFile) -> Vec<FileAction> {
    let mut actions = Vec::with_capacity(6);
    // Lien & web : uniquement si le fichier existe côté serveur.
    if f.file_id.is_some() {
        actions.push(FileAction::CopyLink);
        actions.push(FileAction::OpenInGestion);
    }
    // Révéler : uniquement si une copie locale existe (pas évincé).
    if f.pin_state != PinState::Evicted {
        actions.push(FileAction::RevealInFileManager);
    }
    // Télécharger : re-matérialise un fichier « libéré » sans l'épingler.
    if f.pin_state == PinState::Evicted {
        actions.push(FileAction::Download);
    }
    match f.pin_state {
        PinState::Pinned => actions.push(FileAction::Unpin),
        PinState::Unpinned | PinState::Evicted => actions.push(FileAction::KeepLocal),
    }
    if can_evict(f).is_ok() {
        actions.push(FileAction::FreeSpace);
    }
    actions
}

/// Construit l'URL Gestion web d'un fichier Drive (deep-link module
/// Documents : `/documents?space=<space_id>&file=<file_id>`).
/// Retourne `None` si le fichier n'a jamais été uploadé (pas de file_id).
pub fn share_link(web_base_url: &str, f: &LocalFile) -> Option<String> {
    let file_id = f.file_id.as_deref()?;
    let base = web_base_url.trim_end_matches('/');
    Some(format!(
        "{base}/documents?space={}&file={}",
        urlencode(&f.space_id),
        urlencode(file_id)
    ))
}

/// URL Gestion web d'un espace Drive (`/documents?space=<space_id>`).
pub fn space_link(web_base_url: &str, space_id: &str) -> String {
    let base = web_base_url.trim_end_matches('/');
    format!("{base}/documents?space={}", urlencode(space_id))
}

/// Encodage percent minimal pour un composant de query string (RFC 3986,
/// unreserved conservés). Suffisant pour des UUIDs et slugs ; évite une
/// dépendance `url`/`percent-encoding` pour deux paramètres.
fn urlencode(raw: &str) -> String {
    let mut out = String::with_capacity(raw.len());
    for b in raw.bytes() {
        match b {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                out.push(b as char)
            }
            _ => out.push_str(&format!("%{b:02X}")),
        }
    }
    out
}

// ---------------------------------------------------------------------------
// Éviction : « libérer de l'espace » (index + disque)
// ---------------------------------------------------------------------------

/// Échec d'éviction (au-delà des refus de politique `EvictRefusal`).
#[derive(Debug, thiserror::Error)]
pub enum EvictError {
    #[error("éviction refusée")]
    Refused(EvictRefusal),
    #[error("fichier inconnu de l'index : {0}")]
    NotIndexed(String),
    #[error(
        "le contenu sur disque ne correspond pas à la version synchronisée (modification non détectée ?)"
    )]
    ContentMismatch,
    #[error("erreur moteur : {0}")]
    Core(#[from] crate::SyncCoreError),
}

/// Bilan d'une éviction réussie.
#[derive(Debug, Clone, Serialize)]
pub struct EvictReport {
    pub local_path: String,
    /// Octets libérés (0 si la copie locale avait déjà disparu).
    pub freed_bytes: i64,
}

/// Chemin absolu plateforme d'un `local_path` (relatif `/`) sous le sync root.
pub fn abs_path(sync_root: &Path, local_rel: &str) -> PathBuf {
    let mut p = sync_root.to_path_buf();
    for seg in local_rel.split('/').filter(|s| !s.is_empty()) {
        p.push(seg);
    }
    p
}

/// « Libérer de l'espace » : supprime la copie locale d'un fichier synchronisé
/// et marque l'index `pin_state = evicted` (placeholder métadonnées).
///
/// Garde-fous :
/// - politique `can_evict` (pin, modifications en attente, jamais uploadé) ;
/// - le SHA-256 sur disque doit correspondre à l'index — sinon la copie
///   locale contient une modification non encore détectée et on refuse.
pub fn perform_evict(
    conn: &Connection,
    sync_root: &Path,
    local_rel: &str,
) -> Result<EvictReport, EvictError> {
    let file = db::get_local_file(conn, local_rel)
        .map_err(EvictError::Core)?
        .ok_or_else(|| EvictError::NotIndexed(local_rel.to_string()))?;
    can_evict(&file).map_err(EvictError::Refused)?;

    let abs = abs_path(sync_root, local_rel);
    let mut freed = 0_i64;
    if abs.exists() {
        // Vérifie que la copie locale est bien celle que le serveur connaît.
        let (disk_sha, disk_size) = hashing::sha256_file(&abs).map_err(EvictError::Core)?;
        match file.sha256.as_deref() {
            Some(indexed) if indexed == disk_sha => {}
            _ => return Err(EvictError::ContentMismatch),
        }
        std::fs::remove_file(&abs).map_err(|e| EvictError::Core(e.into()))?;
        freed = disk_size as i64;
    }

    let mut updated = file;
    updated.pin_state = PinState::Evicted;
    updated.sync_state = SyncState::Idle;
    updated.last_error = None;
    updated.updated_at = db::now_epoch();
    db::upsert_local_file(conn, &updated).map_err(EvictError::Core)?;

    Ok(EvictReport {
        local_path: local_rel.to_string(),
        freed_bytes: freed,
    })
}

// ---------------------------------------------------------------------------
// Téléchargement : re-matérialiser un fichier « libéré » (sans l'épingler)
// ---------------------------------------------------------------------------

/// Échec d'une demande de re-téléchargement.
#[derive(Debug, thiserror::Error)]
pub enum DownloadRequestError {
    #[error("fichier inconnu de l'index : {0}")]
    NotIndexed(String),
    #[error("le fichier n'est pas « libéré » : rien à re-télécharger")]
    NotEvicted,
    #[error("erreur moteur : {0}")]
    Core(#[from] crate::SyncCoreError),
}

/// « Télécharger » : sort un fichier de l'état `evicted` sans l'épingler
/// (`pin_state = unpinned`). Le pull suivant le re-matérialise car il est
/// connu de l'index mais absent du disque (`PullDecision::Download`).
/// Contrairement à `pin_file`, la politique reste évictable ensuite.
pub fn request_download(
    conn: &Connection,
    local_rel: &str,
) -> Result<LocalFile, DownloadRequestError> {
    let file = db::get_local_file(conn, local_rel)
        .map_err(DownloadRequestError::Core)?
        .ok_or_else(|| DownloadRequestError::NotIndexed(local_rel.to_string()))?;
    if file.pin_state != PinState::Evicted {
        return Err(DownloadRequestError::NotEvicted);
    }
    if !db::set_pin_state(conn, local_rel, PinState::Unpinned)
        .map_err(DownloadRequestError::Core)?
    {
        return Err(DownloadRequestError::NotIndexed(local_rel.to_string()));
    }
    let mut updated = file;
    updated.pin_state = PinState::Unpinned;
    Ok(updated)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::{LocalFile, PinState, SyncState};

    fn file(pin: PinState, state: SyncState, file_id: Option<&str>) -> LocalFile {
        LocalFile {
            local_path: "openpulse-general/Contrats/doc.pdf".into(),
            space_id: "22222222-2222-2222-2222-222222222222".into(),
            file_id: file_id.map(str::to_string),
            folder_id: None,
            sha256: Some("abc".into()),
            etag: None,
            version: 3,
            size_bytes: 100,
            mtime: 0,
            sync_state: state,
            pin_state: pin,
            last_error: None,
            updated_at: 0,
        }
    }

    #[test]
    fn evict_allowed_for_synced_unpinned_file() {
        let f = file(PinState::Unpinned, SyncState::Idle, Some("f1"));
        assert!(can_evict(&f).is_ok());
    }

    #[test]
    fn evict_refused_when_pinned() {
        let f = file(PinState::Pinned, SyncState::Idle, Some("f1"));
        assert_eq!(can_evict(&f), Err(EvictRefusal::Pinned));
    }

    #[test]
    fn evict_refused_with_pending_local_changes() {
        for state in [
            SyncState::PendingUpload,
            SyncState::Uploading,
            SyncState::Conflict,
        ] {
            let f = file(PinState::Unpinned, state, Some("f1"));
            assert_eq!(can_evict(&f), Err(EvictRefusal::LocalChangesPending));
        }
    }

    #[test]
    fn evict_refused_when_never_uploaded() {
        // Seule copie existante : ne jamais la détruire.
        let f = file(PinState::Unpinned, SyncState::PendingUpload, None);
        // pending prime, mais même idle sans file_id doit refuser :
        let f2 = file(PinState::Unpinned, SyncState::Idle, None);
        assert!(can_evict(&f).is_err());
        assert_eq!(can_evict(&f2), Err(EvictRefusal::NeverUploaded));
    }

    #[test]
    fn evict_refused_when_already_evicted() {
        let f = file(PinState::Evicted, SyncState::Idle, Some("f1"));
        assert_eq!(can_evict(&f), Err(EvictRefusal::AlreadyEvicted));
    }

    #[test]
    fn actions_for_synced_file_include_all() {
        let f = file(PinState::Unpinned, SyncState::Idle, Some("f1"));
        let a = available_actions(&f);
        assert_eq!(
            a,
            vec![
                FileAction::CopyLink,
                FileAction::OpenInGestion,
                FileAction::RevealInFileManager,
                FileAction::KeepLocal,
                FileAction::FreeSpace,
            ]
        );
    }

    #[test]
    fn actions_for_evicted_file_omit_reveal_and_free() {
        let f = file(PinState::Evicted, SyncState::Idle, Some("f1"));
        let a = available_actions(&f);
        assert!(!a.contains(&FileAction::RevealInFileManager));
        assert!(!a.contains(&FileAction::FreeSpace));
        assert!(a.contains(&FileAction::Download)); // re-matérialiser sans épingler
        assert!(a.contains(&FileAction::KeepLocal)); // = re-télécharger + épingler
        assert!(a.contains(&FileAction::CopyLink));
    }

    #[test]
    fn download_action_only_offered_for_evicted_files() {
        for (pin, state) in [
            (PinState::Unpinned, SyncState::Idle),
            (PinState::Pinned, SyncState::Idle),
            (PinState::Unpinned, SyncState::PendingUpload),
        ] {
            let f = file(pin, state, Some("f1"));
            assert!(
                !available_actions(&f).contains(&FileAction::Download),
                "Download ne doit pas être proposé pour pin={pin:?} state={state:?}"
            );
        }
    }

    #[test]
    fn actions_for_local_only_file_omit_link_and_free() {
        let f = file(PinState::Unpinned, SyncState::PendingUpload, None);
        let a = available_actions(&f);
        assert!(!a.contains(&FileAction::CopyLink));
        assert!(!a.contains(&FileAction::OpenInGestion));
        assert!(!a.contains(&FileAction::FreeSpace));
        assert!(a.contains(&FileAction::RevealInFileManager));
    }

    #[test]
    fn pinned_file_offers_unpin() {
        let f = file(PinState::Pinned, SyncState::Idle, Some("f1"));
        let a = available_actions(&f);
        assert!(a.contains(&FileAction::Unpin));
        assert!(!a.contains(&FileAction::KeepLocal));
        assert!(!a.contains(&FileAction::FreeSpace));
    }

    #[test]
    fn share_link_builds_documents_deep_link() {
        let f = file(PinState::Unpinned, SyncState::Idle, Some("f-42"));
        assert_eq!(
            share_link("https://gestion.exploitant.example.org/", &f).as_deref(),
            Some(
                "https://gestion.exploitant.example.org/documents?space=22222222-2222-2222-2222-222222222222&file=f-42"
            )
        );
    }

    #[test]
    fn share_link_requires_file_id() {
        let f = file(PinState::Unpinned, SyncState::Idle, None);
        assert!(share_link("https://gestion.exploitant.example.org", &f).is_none());
    }

    #[test]
    fn share_link_percent_encodes_unsafe_chars() {
        let mut f = file(
            PinState::Unpinned,
            SyncState::Idle,
            Some("id avec espace&x"),
        );
        f.space_id = "espace/é".into();
        let url = share_link("https://g.example", &f).unwrap();
        assert_eq!(
            url,
            "https://g.example/documents?space=espace%2F%C3%A9&file=id%20avec%20espace%26x"
        );
    }

    #[test]
    fn space_link_is_stable() {
        assert_eq!(
            space_link("https://g.example/", "s-1"),
            "https://g.example/documents?space=s-1"
        );
    }

    // -- perform_evict : intégration index + disque -------------------------

    use tempfile::tempdir;

    fn indexed_on_disk(
        conn: &Connection,
        root: &Path,
        rel: &str,
        content: &[u8],
        pin: PinState,
        state: SyncState,
        file_id: Option<&str>,
    ) -> LocalFile {
        let abs = abs_path(root, rel);
        std::fs::create_dir_all(abs.parent().unwrap()).unwrap();
        std::fs::write(&abs, content).unwrap();
        let f = LocalFile {
            local_path: rel.into(),
            space_id: "s1".into(),
            file_id: file_id.map(str::to_string),
            folder_id: None,
            sha256: Some(crate::hashing::sha256_hex(content)),
            etag: None,
            version: 2,
            size_bytes: content.len() as i64,
            mtime: 0,
            sync_state: state,
            pin_state: pin,
            last_error: None,
            updated_at: 0,
        };
        db::upsert_local_file(conn, &f).unwrap();
        f
    }

    #[test]
    fn evict_removes_local_copy_and_marks_placeholder() {
        let root = tempdir().unwrap();
        let conn = db::open_in_memory().unwrap();
        indexed_on_disk(
            &conn,
            root.path(),
            "openpulse-general/doc.pdf",
            b"contenu-synchronise",
            PinState::Unpinned,
            SyncState::Idle,
            Some("f1"),
        );

        let report = perform_evict(&conn, root.path(), "openpulse-general/doc.pdf").unwrap();
        assert_eq!(report.freed_bytes, 19);
        assert!(!abs_path(root.path(), "openpulse-general/doc.pdf").exists());

        let f = db::get_local_file(&conn, "openpulse-general/doc.pdf")
            .unwrap()
            .unwrap();
        assert_eq!(f.pin_state, PinState::Evicted);
        assert_eq!(f.sync_state, SyncState::Idle);
        // Métadonnées placeholder conservées pour re-téléchargement.
        assert_eq!(f.file_id.as_deref(), Some("f1"));
        assert!(f.sha256.is_some());
    }

    #[test]
    fn evict_refuses_when_disk_content_differs_from_index() {
        // Modification locale pas encore détectée par le scanner → refus,
        // le fichier reste intact sur disque.
        let root = tempdir().unwrap();
        let conn = db::open_in_memory().unwrap();
        indexed_on_disk(
            &conn,
            root.path(),
            "openpulse-general/doc.txt",
            b"v1",
            PinState::Unpinned,
            SyncState::Idle,
            Some("f1"),
        );
        std::fs::write(abs_path(root.path(), "openpulse-general/doc.txt"), b"v2-local").unwrap();

        let err = perform_evict(&conn, root.path(), "openpulse-general/doc.txt").unwrap_err();
        assert!(matches!(err, EvictError::ContentMismatch));
        assert!(abs_path(root.path(), "openpulse-general/doc.txt").exists());
        let f = db::get_local_file(&conn, "openpulse-general/doc.txt")
            .unwrap()
            .unwrap();
        assert_eq!(f.pin_state, PinState::Unpinned); // index inchangé
    }

    #[test]
    fn evict_refuses_pinned_and_pending_files() {
        let root = tempdir().unwrap();
        let conn = db::open_in_memory().unwrap();
        indexed_on_disk(
            &conn,
            root.path(),
            "openpulse-general/pin.txt",
            b"x",
            PinState::Pinned,
            SyncState::Idle,
            Some("f1"),
        );
        indexed_on_disk(
            &conn,
            root.path(),
            "openpulse-general/pending.txt",
            b"y",
            PinState::Unpinned,
            SyncState::PendingUpload,
            Some("f2"),
        );

        assert!(matches!(
            perform_evict(&conn, root.path(), "openpulse-general/pin.txt").unwrap_err(),
            EvictError::Refused(EvictRefusal::Pinned)
        ));
        assert!(matches!(
            perform_evict(&conn, root.path(), "openpulse-general/pending.txt").unwrap_err(),
            EvictError::Refused(EvictRefusal::LocalChangesPending)
        ));
        assert!(abs_path(root.path(), "openpulse-general/pin.txt").exists());
        assert!(abs_path(root.path(), "openpulse-general/pending.txt").exists());
    }

    #[test]
    fn evict_unknown_path_is_reported() {
        let root = tempdir().unwrap();
        let conn = db::open_in_memory().unwrap();
        assert!(matches!(
            perform_evict(&conn, root.path(), "nulle/part.txt").unwrap_err(),
            EvictError::NotIndexed(_)
        ));
    }

    // -- request_download : re-matérialisation sans épinglage ---------------

    #[test]
    fn request_download_unpins_evicted_file() {
        let conn = db::open_in_memory().unwrap();
        let mut f = file(PinState::Evicted, SyncState::Idle, Some("f1"));
        f.local_path = "openpulse-general/cloud.txt".into();
        db::upsert_local_file(&conn, &f).unwrap();

        let updated = request_download(&conn, "openpulse-general/cloud.txt").unwrap();
        assert_eq!(updated.pin_state, PinState::Unpinned);

        let stored = db::get_local_file(&conn, "openpulse-general/cloud.txt")
            .unwrap()
            .unwrap();
        assert_eq!(stored.pin_state, PinState::Unpinned);
        // Absent du disque + unpinned → le pull suivant re-télécharge.
        assert_eq!(
            crate::pull::decide_pull(Some(&stored), false, stored.version, None),
            crate::pull::PullDecision::Download
        );
    }

    #[test]
    fn request_download_refuses_non_evicted_files() {
        let conn = db::open_in_memory().unwrap();
        let mut f = file(PinState::Unpinned, SyncState::Idle, Some("f1"));
        f.local_path = "openpulse-general/local.txt".into();
        db::upsert_local_file(&conn, &f).unwrap();

        assert!(matches!(
            request_download(&conn, "openpulse-general/local.txt").unwrap_err(),
            DownloadRequestError::NotEvicted
        ));
        assert!(matches!(
            request_download(&conn, "nulle/part.txt").unwrap_err(),
            DownloadRequestError::NotIndexed(_)
        ));
    }
}
