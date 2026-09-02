//! E2E simulé du moteur de sync (sans réseau) : un « serveur Drive » factice
//! en mémoire émule l'API Azure (upload-intent / PUT SAS / upload-complete /
//! décisions de pull), et on déroule le cycle complet :
//!
//!   poste A : fichier local → scan → queue → push (intent/SAS/complete)
//!   poste B : décision de pull → écriture disque → index → re-pull no-op
//!   conflit : base_version obsolète → fichier marqué conflict, jamais écrasé
//!   erreurs : 5xx → backoff/replanification ; 4xx → abandon immédiat
//!
//! Le vrai HTTP (reqwest + serveur loopback) est couvert côté src-tauri.

use std::cell::RefCell;
use std::collections::HashMap;
use std::fs;
use std::path::Path;

use tempfile::tempdir;

use sync_core::db::{self, open_in_memory};
use sync_core::hashing;
use sync_core::models::{LocalFile, SyncState};
use sync_core::pull::{decide_pull, safe_relative_path, space_dir_name, PullDecision};
use sync_core::push::{
    run_queue_once, DriveTransport, TransportError, UploadCompleteRequest, UploadIntentRequest,
    UploadIntentResponse,
};
use sync_core::scanner::scan_space;

const SPACE: &str = "11111111-1111-1111-1111-111111111111";
const SLUG: &str = "openpulse-general";

/// Fichier côté « serveur » (métadonnées + contenu du blob).
#[derive(Debug, Clone)]
struct ServerFile {
    id: String,
    version: i64,
    sha256: String,
    size_bytes: i64,
    blob: Vec<u8>,
}

/// Serveur Drive factice : stocke les fichiers par chemin serveur.
#[derive(Default)]
struct FakeDriveServer {
    files: RefCell<HashMap<String, ServerFile>>,
    /// Corps des PUT SAS reçus, indexés par token.
    staged: RefCell<HashMap<String, Vec<u8>>>,
    next_id: RefCell<u64>,
    /// Si Some, upload_intent échoue N fois avec cette erreur (5xx simulé).
    fail_intents_left: RefCell<u32>,
    intent_calls: RefCell<u32>,
}

impl FakeDriveServer {
    fn insert_remote(&self, path: &str, content: &[u8]) -> ServerFile {
        let f = ServerFile {
            id: format!("srv-{}", *self.next_id.borrow_mut() + 1),
            version: 1,
            sha256: hashing::sha256_hex(content),
            size_bytes: content.len() as i64,
            blob: content.to_vec(),
        };
        *self.next_id.borrow_mut() += 1;
        self.files.borrow_mut().insert(path.to_string(), f.clone());
        f
    }

    fn get(&self, path: &str) -> Option<ServerFile> {
        self.files.borrow().get(path).cloned()
    }
}

/// Transport branché sur le serveur factice (émule le triplet HTTP).
struct FakeServerTransport<'a> {
    server: &'a FakeDriveServer,
    /// Chemin local du fichier en cours (pour lire le contenu au PUT).
    puts: RefCell<Vec<(String, Vec<u8>)>>,
}

impl<'a> FakeServerTransport<'a> {
    fn new(server: &'a FakeDriveServer) -> Self {
        Self {
            server,
            puts: RefCell::new(Vec::new()),
        }
    }
}

impl DriveTransport for FakeServerTransport<'_> {
    fn upload_intent(
        &self,
        req: &UploadIntentRequest,
    ) -> std::result::Result<UploadIntentResponse, TransportError> {
        *self.server.intent_calls.borrow_mut() += 1;
        {
            let mut left = self.server.fail_intents_left.borrow_mut();
            if *left > 0 {
                *left -= 1;
                return Err(TransportError::retryable(
                    "upload-intent refusé (HTTP 503)".to_string(),
                ));
            }
        }
        let mut files = self.server.files.borrow_mut();
        if let Some(existing) = files.get_mut(&req.path) {
            // noop : contenu déjà connu.
            if existing.sha256 == req.sha256 {
                return Ok(UploadIntentResponse {
                    action: "noop".into(),
                    upload_url: None,
                    upload_token: None,
                    file_id: existing.id.clone(),
                    version: existing.version,
                    conflict: false,
                    conflict_reason: None,
                });
            }
            // conflit : base_version ne correspond plus (modif web entre-temps).
            let conflict = req.base_version.is_some() && req.base_version != Some(existing.version);
            if conflict {
                return Ok(UploadIntentResponse {
                    action: "conflict".into(),
                    upload_url: None,
                    upload_token: None,
                    file_id: existing.id.clone(),
                    version: existing.version,
                    conflict: true,
                    conflict_reason: Some(format!(
                        "version de base {:?} != version courante {}",
                        req.base_version, existing.version
                    )),
                });
            }
            let token = format!("tok-{}-v{}", existing.id, existing.version + 1);
            existing.version += 1;
            return Ok(UploadIntentResponse {
                action: "upload".into(),
                upload_url: Some(format!("https://sas.local/{token}")),
                upload_token: Some(token),
                file_id: existing.id.clone(),
                version: existing.version,
                conflict: false,
                conflict_reason: None,
            });
        }
        // Nouveau fichier.
        *self.server.next_id.borrow_mut() += 1;
        let id = format!("srv-{}", self.server.next_id.borrow());
        let token = format!("tok-{id}-v1");
        files.insert(
            req.path.clone(),
            ServerFile {
                id: id.clone(),
                version: 1,
                sha256: String::new(), // finalisé au complete
                size_bytes: 0,
                blob: Vec::new(),
            },
        );
        Ok(UploadIntentResponse {
            action: "upload".into(),
            upload_url: Some(format!("https://sas.local/{token}")),
            upload_token: Some(token),
            file_id: id,
            version: 1,
            conflict: false,
            conflict_reason: None,
        })
    }

    fn put_blob(
        &self,
        upload_url: &str,
        _content_type: &str,
        file_path: &Path,
    ) -> std::result::Result<Option<String>, TransportError> {
        let bytes = fs::read(file_path)
            .map_err(|e| TransportError::retryable(format!("lecture impossible : {e}")))?;
        let token = upload_url.rsplit('/').next().unwrap_or("").to_string();
        self.server.staged.borrow_mut().insert(token, bytes.clone());
        self.puts.borrow_mut().push((upload_url.into(), bytes));
        Ok(Some("\"0xE2E\"".into()))
    }

    fn upload_complete(
        &self,
        req: &UploadCompleteRequest,
    ) -> std::result::Result<(), TransportError> {
        let staged = self
            .server
            .staged
            .borrow_mut()
            .remove(&req.upload_token)
            .ok_or_else(|| TransportError::fatal("token inconnu : PUT SAS manquant"))?;
        // Vérification d'intégrité comme le vrai serveur.
        if hashing::sha256_hex(&staged) != req.sha256 {
            return Err(TransportError::fatal("sha256 ne correspond pas au blob"));
        }
        let mut files = self.server.files.borrow_mut();
        let f = files
            .values_mut()
            .find(|f| f.id == req.file_id)
            .ok_or_else(|| TransportError::fatal("file_id inconnu"))?;
        f.sha256 = req.sha256.clone();
        f.size_bytes = req.size_bytes;
        f.blob = staged;
        Ok(())
    }
}

/// Émule le pull côté client : décision + « téléchargement » (copie du blob
/// serveur) + mise à jour de l'index — même séquence que src-tauri::sync.
fn pull_from_server(
    conn: &rusqlite::Connection,
    server: &FakeDriveServer,
    sync_root: &Path,
    server_path: &str,
) -> PullDecision {
    let file = server.get(server_path).expect("fichier serveur inconnu");
    let space_dir = space_dir_name(SLUG, SPACE);
    let rel = safe_relative_path(server_path).expect("chemin serveur invalide");
    let local_rel = format!("{space_dir}/{rel}");
    let abs = sync_root.join(&local_rel);

    let existing = db::get_local_file(conn, &local_rel).unwrap();
    let decision = decide_pull(
        existing.as_ref(),
        abs.exists(),
        file.version,
        Some(file.sha256.as_str()),
    );
    if matches!(decision, PullDecision::Download) {
        fs::create_dir_all(abs.parent().unwrap()).unwrap();
        fs::write(&abs, &file.blob).unwrap();
        let mtime = fs::metadata(&abs)
            .and_then(|m| m.modified())
            .ok()
            .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
            .map(|d| d.as_secs() as i64)
            .unwrap_or(0);
        let record = LocalFile {
            local_path: local_rel,
            space_id: SPACE.into(),
            file_id: Some(file.id.clone()),
            folder_id: None,
            sha256: Some(file.sha256.clone()),
            etag: None,
            version: file.version,
            size_bytes: file.size_bytes,
            mtime,
            sync_state: SyncState::Idle,
            pin_state: Default::default(),
            last_error: None,
            updated_at: db::now_epoch(),
        };
        db::upsert_local_file(conn, &record).unwrap();
    }
    decision
}

// ---------------------------------------------------------------------------
// Scénarios E2E
// ---------------------------------------------------------------------------

/// Azure → local : nouveau fichier distant téléchargé, puis re-pull no-op,
/// puis nouvelle version distante re-téléchargée.
#[test]
fn e2e_pull_remote_file_to_local_then_noop_then_new_version() {
    let root = tempdir().unwrap();
    let conn = open_in_memory().unwrap();
    let server = FakeDriveServer::default();
    server.insert_remote("/Contrats/contrat-hds.pdf", b"%PDF v1 serveur");

    // 1er pull : téléchargé.
    let d1 = pull_from_server(&conn, &server, root.path(), "/Contrats/contrat-hds.pdf");
    assert_eq!(d1, PullDecision::Download);
    let abs = root.path().join("openpulse-general/Contrats/contrat-hds.pdf");
    assert_eq!(fs::read(&abs).unwrap(), b"%PDF v1 serveur");

    // 2e pull : déjà à jour.
    let d2 = pull_from_server(&conn, &server, root.path(), "/Contrats/contrat-hds.pdf");
    assert_eq!(d2, PullDecision::SkipUpToDate);

    // Modif côté web : version 2 → re-téléchargé.
    {
        let mut files = server.files.borrow_mut();
        let f = files.get_mut("/Contrats/contrat-hds.pdf").unwrap();
        f.version = 2;
        f.blob = b"%PDF v2 serveur".to_vec();
        f.sha256 = hashing::sha256_hex(b"%PDF v2 serveur");
        f.size_bytes = f.blob.len() as i64;
    }
    let d3 = pull_from_server(&conn, &server, root.path(), "/Contrats/contrat-hds.pdf");
    assert_eq!(d3, PullDecision::Download);
    assert_eq!(fs::read(&abs).unwrap(), b"%PDF v2 serveur");
    let idx = db::get_local_file(&conn, "openpulse-general/Contrats/contrat-hds.pdf")
        .unwrap()
        .unwrap();
    assert_eq!(idx.version, 2);
    assert_eq!(idx.sync_state, SyncState::Idle);
}

/// Local → Azure : scan → queue → intent/PUT SAS/complete ; le serveur
/// détient bien les octets ; l'index passe idle avec file_id/version serveur.
#[test]
fn e2e_push_local_file_to_azure() {
    let root = tempdir().unwrap();
    let space_dir = space_dir_name(SLUG, SPACE);
    fs::create_dir_all(root.path().join(&space_dir).join("Rapports")).unwrap();
    fs::write(
        root.path().join(&space_dir).join("Rapports/hebdo.md"),
        b"# Rapport hebdo",
    )
    .unwrap();
    let conn = open_in_memory().unwrap();
    let server = FakeDriveServer::default();
    let transport = FakeServerTransport::new(&server);

    let scan = scan_space(&conn, root.path(), &space_dir, SPACE).unwrap();
    assert_eq!(scan.queued, 1);

    let report = run_queue_once(&conn, root.path(), &transport, 10).unwrap();
    assert_eq!(report.uploaded, 1);
    assert_eq!(report.failed, 0);

    // Le serveur détient le contenu, au bon chemin serveur (sans le préfixe espace).
    let remote = server
        .get("/Rapports/hebdo.md")
        .expect("fichier absent du serveur");
    assert_eq!(remote.blob, b"# Rapport hebdo");
    assert_eq!(remote.sha256, hashing::sha256_hex(b"# Rapport hebdo"));
    assert_eq!(remote.version, 1);

    // Index local : idle, file_id serveur, queue vide.
    let idx = db::get_local_file(&conn, &format!("{space_dir}/Rapports/hebdo.md"))
        .unwrap()
        .unwrap();
    assert_eq!(idx.sync_state, SyncState::Idle);
    assert_eq!(idx.file_id.as_deref(), Some(remote.id.as_str()));
    assert_eq!(db::queue_len(&conn).unwrap(), 0);
}

/// Aller-retour complet : pull d'un fichier, modification locale, push de la
/// nouvelle version — le serveur passe en v2 avec le nouveau contenu.
#[test]
fn e2e_roundtrip_pull_edit_push() {
    let root = tempdir().unwrap();
    let conn = open_in_memory().unwrap();
    let server = FakeDriveServer::default();
    server.insert_remote("/notes.txt", b"contenu initial serveur");

    // Pull.
    assert_eq!(
        pull_from_server(&conn, &server, root.path(), "/notes.txt"),
        PullDecision::Download
    );
    let space_dir = space_dir_name(SLUG, SPACE);
    let abs = root.path().join(&space_dir).join("notes.txt");

    // Édition locale.
    fs::write(&abs, b"contenu modifie localement").unwrap();
    // mtime différent pour sortir du fast path du scanner.
    let idx = db::get_local_file(&conn, &format!("{space_dir}/notes.txt"))
        .unwrap()
        .unwrap();
    let mut idx2 = idx.clone();
    idx2.mtime -= 10;
    db::upsert_local_file(&conn, &idx2).unwrap();

    let scan = scan_space(&conn, root.path(), &space_dir, SPACE).unwrap();
    assert_eq!(scan.modified, 1);
    assert_eq!(scan.queued, 1);

    // Push : base_version = 1 correspond → upload accepté, serveur en v2.
    let transport = FakeServerTransport::new(&server);
    let report = run_queue_once(&conn, root.path(), &transport, 10).unwrap();
    assert_eq!(report.uploaded, 1, "erreurs: {:?}", report.errors);
    let remote = server.get("/notes.txt").unwrap();
    assert_eq!(remote.version, 2);
    assert_eq!(remote.blob, b"contenu modifie localement");

    // L'index local suit la version serveur.
    let idx3 = db::get_local_file(&conn, &format!("{space_dir}/notes.txt"))
        .unwrap()
        .unwrap();
    assert_eq!(idx3.version, 2);
    assert_eq!(idx3.sync_state, SyncState::Idle);
}

/// Conflit : le fichier a été modifié côté web (v2) pendant une édition
/// locale basée sur v1 → marqué conflict, jamais d'écrasement, et le pull
/// suivant ne touche pas au fichier local.
#[test]
fn e2e_conflict_web_edit_beats_local_edit() {
    let root = tempdir().unwrap();
    let conn = open_in_memory().unwrap();
    let server = FakeDriveServer::default();
    server.insert_remote("/plan.docx", b"v1 commun");

    assert_eq!(
        pull_from_server(&conn, &server, root.path(), "/plan.docx"),
        PullDecision::Download
    );
    let space_dir = space_dir_name(SLUG, SPACE);
    let abs = root.path().join(&space_dir).join("plan.docx");

    // Modif web : v2.
    {
        let mut files = server.files.borrow_mut();
        let f = files.get_mut("/plan.docx").unwrap();
        f.version = 2;
        f.blob = b"v2 web".to_vec();
        f.sha256 = hashing::sha256_hex(b"v2 web");
    }

    // Modif locale concurrente (base = v1).
    fs::write(&abs, b"v2 locale divergente").unwrap();
    let local_rel = format!("{space_dir}/plan.docx");
    let mut idx = db::get_local_file(&conn, &local_rel).unwrap().unwrap();
    idx.mtime -= 10;
    db::upsert_local_file(&conn, &idx).unwrap();
    scan_space(&conn, root.path(), &space_dir, SPACE).unwrap();

    // Push → conflit détecté par le serveur (base_version 1 != 2).
    let transport = FakeServerTransport::new(&server);
    let report = run_queue_once(&conn, root.path(), &transport, 10).unwrap();
    assert_eq!(report.conflicts, 1);
    assert!(
        !report.errors.is_empty(),
        "le motif du conflit doit remonter dans le bilan"
    );
    assert!(report.errors[0].contains("version de base"));

    let idx = db::get_local_file(&conn, &local_rel).unwrap().unwrap();
    assert_eq!(idx.sync_state, SyncState::Conflict);

    // Le pull suivant NE DOIT PAS écraser le fichier local en conflit.
    let d = pull_from_server(&conn, &server, root.path(), "/plan.docx");
    assert_eq!(d, PullDecision::SkipLocalPending);
    assert_eq!(fs::read(&abs).unwrap(), b"v2 locale divergente");

    // Le serveur garde sa version web intacte (rien n'a été poussé).
    assert_eq!(server.get("/plan.docx").unwrap().blob, b"v2 web");
}

/// Erreur 5xx transitoire : replanifiée avec backoff, puis succès au cycle
/// suivant quand le serveur répond — le retry ne duplique rien.
#[test]
fn e2e_transient_5xx_then_success_on_retry() {
    let root = tempdir().unwrap();
    let space_dir = space_dir_name(SLUG, SPACE);
    fs::create_dir_all(root.path().join(&space_dir)).unwrap();
    fs::write(root.path().join(&space_dir).join("retry.txt"), b"contenu").unwrap();
    let conn = open_in_memory().unwrap();
    let server = FakeDriveServer::default();
    *server.fail_intents_left.borrow_mut() = 1; // 1er intent → 503

    let transport = FakeServerTransport::new(&server);
    scan_space(&conn, root.path(), &space_dir, SPACE).unwrap();

    let r1 = run_queue_once(&conn, root.path(), &transport, 10).unwrap();
    assert_eq!(r1.rescheduled, 1);
    assert!(
        !r1.errors.is_empty(),
        "l'erreur 503 doit remonter dans le bilan"
    );
    assert_eq!(db::queue_len(&conn).unwrap(), 1); // toujours en file

    // L'op est dans le futur (backoff) : on la rend éligible immédiatement.
    conn.execute("UPDATE sync_queue SET next_attempt_at = 0", [])
        .unwrap();
    let r2 = run_queue_once(&conn, root.path(), &transport, 10).unwrap();
    assert_eq!(r2.uploaded, 1, "erreurs: {:?}", r2.errors);
    assert_eq!(db::queue_len(&conn).unwrap(), 0);
    assert_eq!(server.get("/retry.txt").unwrap().blob, b"contenu");
}

/// Fallback remote_path : une op sans remote_path (anciennes versions de la
/// queue) doit dériver "/{rel}" en retirant le dossier d'espace — jamais
/// envoyer le préfixe local au serveur.
#[test]
fn e2e_missing_remote_path_derives_server_path_without_space_prefix() {
    let root = tempdir().unwrap();
    let space_dir = space_dir_name(SLUG, SPACE);
    fs::create_dir_all(root.path().join(&space_dir).join("Sub")).unwrap();
    fs::write(root.path().join(&space_dir).join("Sub/f.txt"), b"x").unwrap();
    let conn = open_in_memory().unwrap();

    // Enfile une op "legacy" sans remote_path.
    let local_rel = format!("{space_dir}/Sub/f.txt");
    let payload = serde_json::json!({ "space_id": SPACE }).to_string();
    db::enqueue(&conn, "upload", Some(&local_rel), None, Some(&payload)).unwrap();

    let server = FakeDriveServer::default();
    let transport = FakeServerTransport::new(&server);
    let report = run_queue_once(&conn, root.path(), &transport, 10).unwrap();
    assert_eq!(report.uploaded, 1, "erreurs: {:?}", report.errors);
    // Le serveur voit /Sub/f.txt, PAS /openpulse-general/Sub/f.txt.
    assert!(server.get("/Sub/f.txt").is_some());
    assert!(server.get(&format!("/{local_rel}")).is_none());
}

/// Op interne malformée (payload sans space_id) : replanifiée avec backoff
/// mais ABANDONNÉE après MAX_RETRIES — plus de boucle infinie.
#[test]
fn e2e_malformed_op_is_dropped_after_max_retries() {
    let root = tempdir().unwrap();
    let space_dir = space_dir_name(SLUG, SPACE);
    fs::create_dir_all(root.path().join(&space_dir)).unwrap();
    fs::write(root.path().join(&space_dir).join("orphan.txt"), b"x").unwrap();
    let conn = open_in_memory().unwrap();

    let local_rel = format!("{space_dir}/orphan.txt");
    // payload sans space_id → SyncCoreError à chaque passage.
    db::enqueue(
        &conn,
        "upload",
        Some(&local_rel),
        Some("/orphan.txt"),
        Some("{}"),
    )
    .unwrap();

    let server = FakeDriveServer::default();
    let transport = FakeServerTransport::new(&server);

    for _ in 0..sync_core::push::MAX_RETRIES {
        conn.execute("UPDATE sync_queue SET next_attempt_at = 0", [])
            .unwrap();
        run_queue_once(&conn, root.path(), &transport, 10).unwrap();
    }
    assert_eq!(
        db::queue_len(&conn).unwrap(),
        0,
        "l'op malformée doit être abandonnée après MAX_RETRIES"
    );
    // Le serveur n'a jamais été sollicité.
    assert_eq!(*server.intent_calls.borrow(), 0);
}
