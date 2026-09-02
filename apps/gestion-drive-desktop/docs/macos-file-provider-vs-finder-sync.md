# Intégration macOS « OneDrive-like » — File Provider vs Finder Sync

> Statut : document de conception + état réel de l'implémentation.
> Dernière mise à jour : 2026-07-07 (lot « socle actions contextuelles »).

## 0. TL;DR honnête

| Capacité | OneDrive/Nextcloud l'obtiennent via | Faisable dans ce repo aujourd'hui (sans compte Apple Developer) | Implémenté dans ce lot |
|---|---|---|---|
| Dossier virtuel « fichiers à la demande » (nuage ⇢ téléchargement au premier accès par **n'importe quelle app**) | **File Provider extension** (`NSFileProviderReplicatedExtension`) | ❌ Non — exige extension signée + entitlements Apple | Non (documenté §2) |
| Badges de statut Finder (✓ / nuage / sync) sur les fichiers | File Provider (badges natifs) ou Finder Sync ext. | ❌ Non — mêmes contraintes | Non (documenté §3) |
| Menu clic-droit **dans le Finder** | File Provider `NSFileProviderUserInteraction` / Finder Sync `menu(for:)` | ❌ Non — extension signée requise | Non ; équivalent fourni **dans l'app** (§5) |
| Copier un lien de partage | Commande app (pas besoin d'extension) | ✅ | ✅ `copy_drive_link` |
| Ouvrir le fichier/dossier dans Gestion web | Commande app | ✅ | ✅ `open_in_gestion` |
| Révéler dans le Finder / Explorateur | Commande app (`reveal_item_in_dir`) | ✅ | ✅ `reveal_in_file_manager` |
| « Toujours garder sur cet appareil » | File Provider (pin natif) — sinon politique interne du moteur | ✅ version moteur (pin dans l'index SQLite) | ✅ `pin_file` (`PinState::Pinned`) |
| « Libérer de l'espace » | File Provider (éviction native + placeholder) | ⚠️ Partiel — on peut supprimer la copie locale et la re-télécharger à la demande *depuis l'app*, mais **pas** de placeholder visible par les autres apps | ✅ `evict_file` (éviction moteur, honnêtement documentée) |
| Icône barre de menus avec état de sync | App normale (Tauri tray) | ✅ | ✅ (déjà présent, enrichi pause/reprise + ouverture dossier) |

**En une phrase** : tout ce qui vit *à l'intérieur du Finder* (badges, clic droit Finder,
fichiers-placeholder) demande une **extension macOS signée avec un compte Apple
Developer payant + entitlements approuvés**. Tout le reste (menus contextuels dans
l'app, pin/éviction gérés par le moteur, liens de partage, tray) est faisable en pur
Tauri/Rust et c'est ce que ce lot livre.

---

## 1. Les deux API Apple, et pourquoi on ne peut pas « juste le coder »

### 1.1 File Provider (`NSFileProviderReplicatedExtension`) — la voie moderne

C'est l'API qu'utilisent OneDrive, Nextcloud Desktop (client macOS ≥ 3.x),
Dropbox et Google Drive depuis macOS 12.

- Le contenu apparaît sous `~/Library/CloudStorage/<Provider>-<Compte>/` avec
  un vrai montage géré par `fileproviderd` (le système, pas notre process).
- Le système matérialise/évince les fichiers : **placeholders** (`dataless files`)
  visibles par toutes les apps ; l'ouverture par n'importe quel programme déclenche
  `fetchContents(for:)` dans notre extension.
- Badges de statut, colonne « État » du Finder, actions « Télécharger maintenant » /
  « Supprimer le téléchargement » : fournis gratuitement par le Finder.
- Actions personnalisées de clic droit : déclarées dans l'Info.plist de l'extension
  (`NSFileProviderActions`), routées vers l'app conteneur.

**Exigences non négociables :**

1. L'extension est un *app extension* (`.appex`) embarqué dans une app **signée
   Developer ID** (distribution hors App Store) ou signée App Store.
   Un binaire ad-hoc (`codesign -s -`) **n'est pas chargé** par `fileproviderd`.
2. Entitlement `com.apple.developer.fileprovider.testing-mode` pour le dev,
   `NSExtensionPointIdentifier = com.apple.fileprovider-nonui` en prod — les deux
   nécessitent un **profil de provisionnement Apple Developer** (99 $/an, compte
   d'organisation recommandé pour OpenPulse).
3. L'extension est du code **Swift/Objective-C compilé par Xcode** : Tauri ne
   génère pas d'`.appex`. Il faut un sous-projet Xcode (`macos/FileProviderExt/`)
   ajouté au bundle produit par `tauri build` via script de post-bundling, puis
   re-signature de l'ensemble.
4. Notarisation obligatoire pour distribuer hors App Store (sinon Gatekeeper bloque).

### 1.2 Finder Sync (`FIFinderSyncController`) — la voie historique

API de l'époque Dropbox « dossier réel + badges » (macOS 10.10+).

- Fonctionne sur un **dossier réel** (notre `sync_root` actuel) : pas de
  placeholders, le fichier est toujours physiquement présent.
- Fournit : badges d'état, menus contextuels Finder, barre d'outils.
- Ne fournit PAS : fichiers à la demande, éviction, colonne d'état.

**Exigences :** identiques sur le fond — c'est aussi un `.appex` signé
(compte Apple Developer, sandbox App obligatoire pour l'extension), compilé via
Xcode. Apple la considère en voie de sortie (soft-deprecated) au profit de
File Provider ; Nextcloud garde les deux (`FinderSyncExt` pour le mode
« dossier classique », File Provider pour le mode « fichiers virtuels »).

### 1.3 Ce que ça implique pour Gestion Drive

| Critère | File Provider | Finder Sync |
|---|---|---|
| Fichiers à la demande / libérer l'espace visibles partout | ✅ natif | ❌ |
| Badges | ✅ natif | ✅ |
| Clic droit Finder | ✅ (`NSFileProviderActions`) | ✅ (`menu(for:)`) |
| Dossier réel choisi par l'utilisateur | ❌ (imposé sous `~/Library/CloudStorage`) | ✅ |
| Moteur de sync | Le nôtre devient *backend* de l'extension (upload/download pilotés par `fileproviderd`) | Le nôtre reste inchangé, l'extension ne fait que décorer |
| Effort | Élevé (réécrire l'orchestration autour des énumérateurs) | Moyen (extension mince + IPC état) |
| Pérennité | ✅ voie officielle | ⚠️ héritage |

**Recommandation** : viser **File Provider** en cible (phase « signature Apple »),
car c'est la seule voie vers le comportement OneDrive complet. Garder Finder Sync
comme option de repli uniquement si le mode « dossier classique choisi par
l'utilisateur » doit survivre. En attendant le compte Developer ID :
tout le lot actuel (pin/éviction moteur, actions dans l'app, tray) est conçu pour
que la bascule soit un *changement de frontend* : l'index SQLite (`pin_state`,
`sync_state`) et les décisions pures de `sync-core` sont réutilisables tels quels
comme source de vérité de l'extension.

### 1.4 Checklist du jour où OpenPulse a le compte Apple Developer

1. Créer l'App ID + capability File Provider sur developer.apple.com ;
   certificat **Developer ID Application** + profil de provisionnement.
2. Sous-projet Xcode `macos/GestionDriveFileProvider/` (Swift,
   `NSFileProviderReplicatedExtension`) ; l'extension parle au moteur Rust via
   XPC ou via l'index SQLite partagé (App Group `group.com.gsi.gestion-drive`).
3. Script de post-bundling : copier l'`.appex` dans
   `Gestion Drive.app/Contents/PlugIns/`, re-signer (`codesign --deep` interdit :
   signer de l'intérieur vers l'extérieur), notariser (`xcrun notarytool`).
4. `tauri.conf.json > bundle > macOS > entitlements` : App Groups + (dev)
   `com.apple.developer.fileprovider.testing-mode`.
5. Migration utilisateur : proposer de déplacer le contenu du `sync_root`
   classique vers le domaine File Provider (`NSFileProviderManager.add(_:)`).

---

## 2. Ce que ce lot implémente réellement (sans signature Apple)

### 2.1 Modèle : épinglage et éviction gérés par le moteur

Nouveau champ `pin_state` sur `local_files` (migration `0002_pin_state.sql`) :

- `pinned` — « Toujours garder sur cet appareil » : le pull télécharge toujours,
  l'éviction est refusée.
- `unpinned` (défaut) — comportement actuel : présent localement après pull.
- `evicted` — « Libéré » : la copie locale a été supprimée par `evict_file`.
  L'index garde `file_id`/`version`/`sha256` (métadonnées placeholder) ;
  le pull **ne re-télécharge pas** tant que l'état reste `evicted`
  (décision `SkipEvicted` dans `decide_pull`) ; `pin_file` ou « Télécharger »
  re-matérialise à la demande.

**Limite honnête** : contrairement à File Provider, un fichier `evicted`
*disparaît du Finder* (il n'y a pas de placeholder visible). Il reste visible
dans l'app Gestion Desktop (liste des fichiers, badge « nuage »), qui devient
le point d'accès pour re-télécharger. C'est le meilleur compromis possible
sans extension signée.

Garde-fous implémentés dans `sync_core::actions` :

- éviction refusée si `pinned`, si modifications locales non envoyées
  (`pending_upload`/`uploading`/`conflict`), ou si le fichier n'a jamais été
  uploadé (`file_id` absent) — on ne détruit jamais la seule copie existante ;
- suppression du fichier local uniquement si le SHA-256 sur disque correspond
  à l'index (pas d'écrasement silencieux d'une modification non détectée).

### 2.2 Actions contextuelles (IPC Tauri)

| Commande | Rôle | Équivalent OneDrive |
|---|---|---|
| `list_local_files` | Liste paginée de l'index local (chemin, état, pin, taille) pour l'UI Fichiers | — |
| `copy_drive_link` | Construit l'URL web du fichier (`/documents?space=<id>&file=<id>`) et la copie au presse-papiers (arboard) | « Copier le lien » |
| `open_in_gestion` | Ouvre le fichier/l'espace dans Gestion web (navigateur ou fenêtre PWA) | « Afficher en ligne » |
| `reveal_in_file_manager` | Révèle le fichier dans le Finder/Explorateur (`opener::reveal_item_in_dir`) | « Afficher dans le Finder » |
| `pin_file` | `pin_state = pinned` (+ re-téléchargement si évincé, via pull existant) | « Toujours conserver sur cet appareil » |
| `unpin_file` | `pin_state = unpinned` | décocher |
| `evict_file` | Vérifs sécurité → suppression copie locale → `pin_state = evicted`, `sync_state = idle` | « Libérer de l'espace » |
| `drive_file_actions` | Liste des actions disponibles pour un fichier (logique pure `sync_core::actions::available_actions`, partagée UI/tray) | menu contextuel |

Le presse-papiers utilise la crate `arboard` (pas de plugin Tauri
supplémentaire ni de permission frontend : la copie se fait côté Rust).

### 2.3 UI

- Module Drive : nouvel écran **Fichiers** (`FilesPage.tsx`) listant l'index
  local avec badge d'état (✓ synchronisé, ☁ libéré, 📌 épinglé, ⟳ en attente)
  et menu contextuel (clic droit + bouton ⋯) portant les actions ci-dessus.
- Tray : « Ouvrir le dossier Gestion Drive » branché (révèle le `sync_root`),
  pause/reprise de la synchronisation (`sync_paused` dans l'AppState ;
  `run_pull_sync`/`run_push_sync` refusent quand pausé).

### 2.4 Hors périmètre de ce lot (assumé)

- Badges/menus **dans le Finder** : voir §1 (extension signée requise).
- Placeholders visibles par d'autres apps : idem.
- `.appex` Finder Sync « best effort » non signé : testé nulle part de façon
  fiable (macOS le désactive silencieusement) → pas de code mort dans le repo.
- Re-téléchargement automatique à l'ouverture : impossible sans File Provider ;
  le re-téléchargement passe par l'app (bouton « Télécharger » / `pin_file`).

## 3. Correspondance des états (préparation File Provider)

| Index local (`sync_state`, `pin_state`) | Badge app (ce lot) | Badge Finder (futur FP) |
|---|---|---|
| `idle` + `unpinned` | ✓ vert | ✓ (téléchargé) |
| `idle` + `pinned` | 📌 | ✓ cerclé plein |
| `idle` + `evicted` | ☁ | ☁ (en ligne seulement) |
| `pending_upload`/`uploading`/`downloading`/`pending_download` | ⟳ | flèches sync |
| `conflict` | ⚠ | ⚠ |
| `error` | ✕ | ✕ |

Cette table est le contrat : l'extension File Provider future lira les mêmes
colonnes SQLite pour produire `NSFileProviderItemCapabilities` et les badges.
