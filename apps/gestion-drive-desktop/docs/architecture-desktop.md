# Notes d'architecture — client desktop

## Découpage

- **`crates/sync-core`** : logique pure Rust (config, index SQLite, modèles, bientôt watcher/hash/API/transfert). Zéro dépendance Tauri → testable en CI sans display, réutilisable pour un CLI headless de debug.
- **`src-tauri`** : shell applicatif. Commandes IPC fines, tray, cycle de vie. Ne contient pas de logique métier de sync.
- **`src/`** : React. Le client `driveClient.ts` détecte Tauri : `invoke()` si présent, mock TS sinon, ce qui permet de développer l'UI dans un simple navigateur (`npm run dev`).

## Choix assumés du squelette

1. **Auth Desktop persistante** : `POST /api/drive/desktop/login` émet un JWT Drive court et un refresh token rotatif. Les deux secrets restent dans Keychain/Credential Manager ; `session.json` ne contient que l’identité affichée et l’expiration. Login, restauration, refresh et logout partagent le même verrou de cycle de vie. Un lease exclusif couvre chaque cycle pull/push ; le logout attend sa libération avant de purger, donc aucun worker ne conserve de bearer token après son retour. Le client renouvelle via `/api/drive/desktop/refresh` avant pull/push et après un 401, sans purger la session sur une coupure réseau ou un 5xx. Seul un refresh explicitement rejeté en 401 déclenche la purge et la reconnexion. Le push scanne et met d’abord en queue les modifications locales des espaces sélectionnés, puis tente le refresh ; le drain réseau reste filtré par les espaces autorisés dans la réponse API courante, afin qu’un espace révoqué ou `web_only` ne soit jamais envoyé.
2. **Spaces mock** dupliqués Rust + TS volontairement (même data) pour que les deux modes de dev restent cohérents. Un test pourrait comparer les deux si ça dérive.
3. **SQLite via rusqlite bundled** : pas de dépendance système, même version SQLite sur macOS/Windows. WAL activé.
4. **Migrations embarquées** (`include_str!`) : le binaire est autoportant, le SQL versionné reste lisible dans `migrations/local/`.
5. **Pas de react-router** : l'onboarding est linéaire (login → dossier → espaces → statut). On introduira un router si l'app grossit (conflits, logs, multi-fenêtres).
6. **Zustand** plutôt que Redux/Context : état minuscule, zéro boilerplate.

## Prochaines briques (ordre conseillé, Milestone 3)

> Fait (premier lot pull sync) : `sync-core::pull` (décisions pures download/skip,
> chemins sûrs) + `src-tauri::sync` (tree → changes → download-url → écriture
> atomique → `local_files`/`sync_cursors`), commandes `run_pull_sync`/`pull_progress`,
> déclenchement après sélection des espaces, progression sur l'écran Statut.

1. `sync-core::hashing` — SHA-256 streaming (crate `sha2`), test sur gros fichier.
2. `sync-core::api_client` — reqwest + types des endpoints §7 du plan, mockable par trait.
3. `platform_credentials` — crate `keyring` (Keychain/Credential Manager).
4. `file_watcher` — crate `notify` + debounce 2 s + scan périodique de rattrapage (les FSEvents macOS et ReadDirectoryChangesW ne remontent pas la même chose).
5. Workers upload/download consommant `sync_queue` (tokio tasks), retry via `backoff_secs`.
6. `conflict_resolver` — utilise `models::conflict_copy_name`, jamais d'écrasement silencieux.
7. Événements Tauri (`emit`) moteur → UI pour le statut temps réel + icône tray dynamique.

## Icônes

`src-tauri/icons/` doit contenir les icônes réelles avant un build bundle :

```bash
npm run tauri icon chemin/vers/icone-1024.png
```

(le squelette embarque un placeholder généré ; `tauri icon` produira icns/ico/png corrects).

## Pièges connus (plan §15)

- Fichiers temporaires Office : filtrés par `models::is_ignored_filename` (~$*.docx, *.tmp, .DS_Store, Thumbs.db…).
- Renames vus comme delete+create : détection par (sha256, size, mtime) à implémenter dans le watcher.
- Chemins : toujours stocker en relatif au sync root avec `/`, normaliser NFC/NFD sur macOS et casse sur Windows avant comparaison.
- La base SQLite ne doit jamais vivre dans le dossier synchronisé (elle serait synchronisée elle-même).
