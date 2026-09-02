# Architecture réelle d'OpenPulse

Ce document décrit ce qui **est** dans l'arbre, avec le chemin de la preuve. Méthode : inventaire de l'arbre au commit d'origine. Aucune instance n'a été exécutée pour le rédiger ; ce qui n'est pas mesurable est marqué « ⚠ non prouvé ».

## 1. Vue d'ensemble

```
──────────────────────────── CLIENTS ────────────────────────────
 navigateur (React 18 + TypeScript + Vite)
 application de bureau (Tauri/Rust)   coque mobile (Capacitor, iOS + Android)
─────────────────────────────┬───────────────────────────────────
                             │ HTTPS
 serveur web (dist/ statique) ──▶ passerelle d'API
                                  /auth /rest /realtime /storage /functions
                             ┌────┼────┬────────┬──────────────┐
              authentification  API REST  temps réel  stockage   exécution
                             └────┴────┴────────┴──────────────┘ des fonctions (Deno, 272)
                                        │                    │
                                  PostgreSQL            stockage objet
                            public / auth / storage      compatible S3

─────── SERVICES HTTP AUTONOMES (Python/FastAPI) ───────
 messagerie · communication interne · réunions · fichiers
 chacun avec sa propre authentification et son propre accès à la base
```

**Ce que la documentation héritée décrit et qui n'existe pas :** une API applicative Express.js sur le port 4000 (`docs/SELF_HOSTING_GUIDE.md:32`, `:89`). `docker/Dockerfile.backend:22,28` copie un répertoire `server/` **absent de l'arbre**. Il n'y a pas de couche applicative intermédiaire : le navigateur parle directement à l'API REST sur la base, aux fonctions de bord et aux quatre services autonomes.

## 2. Frontal

| Élément                       | Mesure                     | Preuve                                              |
| ----------------------------- | -------------------------- | --------------------------------------------------- |
| Cadre logiciel                | React 18, TypeScript, Vite | `package.json`, `vite.config.ts`                    |
| Fichiers sous `src/`          | 10 012                     | `find src -type f`                                  |
| Répertoires de composants     | 120                        | `ls -d src/components/*/`                           |
| Composants de page hors tests | 165                        | `find src/pages -name '*.tsx' ! -name '*.test.tsx'` |
| Chemins de route distincts    | 170                        | `path="…"` uniques dans `src/routes/`               |
| Déclarations `<Route>`        | 286                        | `src/routes/`                                       |
| Hooks hors tests              | 483                        | `find src/hooks`                                    |
| Fichiers de contexte          | 54                         | `src/contexts/`                                     |

**Divergence.** `ARCHITECTURE.md:123` (documentation héritée, racine) annonce « 86 pages (77 desktop + 9 mobile) ». La mesure donne 165 composants de page hors tests, dont 9 pour le mobile, et 170 chemins de route.

Découpage des routes en trois ensembles (`src/routes/PublicRoutes.tsx`, `UnauthenticatedRoutes.tsx`, `AuthenticatedRoutes.tsx`), chargement paresseux centralisé dans `src/routes/lazyPages.ts`.

### Configuration

| Variable                        | Comportement si absente                                                                                       |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | exception à l'amorçage (`src/lib/supabaseBrowser.ts:13-15`)                                                   |
| `VITE_SUPABASE_URL`             | **repli silencieux** vers une origine codée en dur qui n'est pas la vôtre (`src/lib/supabaseBrowser.ts:8-10`) |

Le second point est un piège structurel : le défaut n'est pas une erreur visible mais un appel vers un serveur tiers. 36 fichiers de l'arbre contiennent ce nom d'hôte. La session utilise le flux PKCE (`src/lib/supabaseBrowser.ts:50`), ce qui impose HTTPS.

Quatorze variables optionnelles, toutes inertes si vides : `VITE_EMAIL_BACKEND`, `VITE_EMAIL_AZURE_API_URL`, `VITE_DOCUMENTS_UPLOAD_BACKEND`, `VITE_DOCUMENTS_AI_PANEL`, `VITE_DRIVE_API_URL`, `VITE_GESTION_WEB_URL`, `VITE_AUTHENTIK_SSO_ENABLED`, `VITE_INTERNAL_TOOL_EMBED_RUNTIME_ENABLED`, `VITE_SENTRY_DSN`, `VITE_OTEL_ENDPOINT`, `VITE_PLAUSIBLE_DOMAIN`, `VITE_PLAUSIBLE_API_HOST`, `VITE_MATOMO_SITE_ID`, `VITE_MATOMO_TRACKER_URL`.

### Livraison

Le frontal est **statique**. `Dockerfile.azure` : image nginx épinglée par empreinte, copie de `dist/`, copie d'une configuration. `nginx.azure.conf` : repli sur `index.html` (ligne 52), points de contrôle `/healthz` et `/readyz` (lignes 19-29).

**Point dur.** La politique de sécurité de contenu est déclarée **deux fois** et **figée** sur les origines de l'auteur d'origine : `nginx.azure.conf:17` (en-tête HTTP) et `index.html:12` (balise `<meta>`). Le navigateur applique l'intersection des deux ; laisser l'une en place suffit à bloquer les appels de l'instance vers son propre serveur d'API. Les deux emplacements doivent devenir des modèles paramétrés par le domaine.

`docker/Dockerfile.frontend` construit aussi le frontal, avec `RUN rm -rf server supabase docs` et un tas Node de 8 Go (ligne 16) — origine de la contrainte de mémoire à la construction.

## 3. Base de données

| Élément                                    | Mesure                                                                          | Méthode                                   |
| ------------------------------------------ | ------------------------------------------------------------------------------- | ----------------------------------------- |
| Fichiers de migration                      | 1 — le schéma consolidé remplace les 942 migrations d'origine                   | `ls supabase/migrations`                  |
| Première / dernière                        | `20250705085623-…` / `20260724190000_internal_tools_same_site_oidc_pending.sql` | ordre lexicographique                     |
| Noms de table créés                        | 363 distincts                                                                   | `CREATE TABLE`                            |
| Tables avec `ENABLE ROW LEVEL SECURITY`    | 355 distinctes                                                                  | `ALTER TABLE … ENABLE ROW LEVEL SECURITY` |
| Fichiers utilisant `auth.uid()`            | 362                                                                             | recherche                                 |
| Fichiers déclarant `REFERENCES auth.users` | 70                                                                              | recherche                                 |
| Compartiments de stockage                  | 11                                                                              | `INSERT INTO storage.buckets`             |
| Version PostgreSQL de référence            | 15                                                                              | `supabase/config.toml`                    |

**Divergence.** `ARCHITECTURE.md:65` et `:485` affirment « 436+ tables » et « toutes les 436+ tables ont RLS activé ». Mesure : 363 noms créés, 355 protégés, donc **10 tables créées sans qu'aucune migration n'active la protection**. Neuf appartiennent à la famille `drive_*` (`drive_files`, `drive_folders`, `drive_spaces`, `drive_permissions`, `drive_file_versions`, `drive_audit_logs`, `drive_sync_devices`, `drive_sync_events`), gouvernées par le service de fichiers autonome qui applique ses contrôles dans son code (`services/openpulse-gestion-drive-api/app/authorization.py`). Ce n'est pas un défaut en soi, mais **couper le service ne coupe pas l'accès** : quiconque atteint la base atteint ces tables sans filtre.

### Le point d'accroche de l'authentification

```sql
-- supabase/migrations/20250705085623-…sql:21
user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE
```

Un déclencheur `on_auth_user_created` sur `auth.users` crée la ligne de profil (`…:270-272`).

**Défaut structurel du schéma d'amorçage `supabase/schema-00-bootstrap.sql`.** Il définit `profiles` **sans cette colonne** (`01-init.sql:45-55`, `00-full-schema.sql:84-97`) : aucun lien entre un compte et un profil, donc authentification et sécurité au niveau ligne inopérantes par construction. Ce fichier ne contient aucune occurrence de `ENABLE ROW LEVEL SECURITY`, aucune `CREATE POLICY`, aucune référence au schéma `auth`. Il annonce « 501 fichiers de migration » consolidés et « Tables: 151 » (`00-full-schema.sql:7,11`) alors qu'il contient 28 instructions `CREATE TABLE`. Il définit en outre `has_role(check_user_id, check_role)` (`01-init.sql:91`) tandis que les fonctions de bord appellent `has_role(_user_id, _role)` — signature de `supabase/migrations/20251102191248_*.sql:26` : un appel de procédure distante échouerait.

**La source de vérité du schéma est `supabase/migrations/`.**

### Une seule base, pas deux

Aucune migration ne crée le schéma `auth` ni `auth.users` : elles présupposent que le fournisseur d'authentification les a créés **dans la même base**. Le fichier de déploiement de référence pointe pourtant l'authentification vers une base distincte suffixée `_auth` (`docker/docker-compose.openpulse.yml`), ce qui, sur une installation neuve, rend les 70 clés étrangères impossibles à créer. C'est la correction la plus importante à apporter au fichier de référence.

### Rôles PostgreSQL requis

`supabase/schema-00-bootstrap.sql` crée `anon`, `authenticated`, `service_role` (avec `BYPASSRLS`), `postgres`, et le rôle de connexion `authenticator` qui endosse les trois premiers, puis accorde l'usage des schémas `public`, `extensions`, `auth`, `storage` et pose des droits par défaut sur `public`.

Deux réserves : les droits par défaut ne s'appliquent qu'aux objets créés **ensuite** et **par le rôle qui les a déclarés** ; et la seconde moitié du fichier applique deux réparations propres à une base migrée depuis un hébergeur (ajout conditionnel d'une colonne au schéma d'authentification, remise à zéro de marqueurs de double authentification sans facteur correspondant, sous `session_replication_role = 'replica'`). Ces réparations n'ont rien à faire dans une installation neuve.

## 4. Fonctions de bord

272 répertoires dans `supabase/functions/`, exécutés par un service Deno qui les monte en lecture seule (`docker/docker-compose.openpulse.yml`). Pas d'étape de publication.

**Divergence.** `ARCHITECTURE.md:65,131,628,802` annonce « 254 Edge Functions ». Mesure : 272.

**Contrôle d'accès.** `supabase/config.toml` déclare fonction par fonction si la passerelle vérifie le jeton. Un nombre significatif sont déclarées `verify_jwt = false` : certaines à bon droit (page de rendez-vous publique, flux d'agenda authentifié par jeton d'URL, retours d'appel de fournisseurs externes), d'autres avec un commentaire indiquant que la vérification est faite dans le code. ⚠ non prouvé : cette seconde catégorie n'est pas auditée ici. Le service d'exécution est désormais configuré `VERIFY_JWT: ${VERIFY_JWT:-true}` dans `docker/docker-compose.openpulse.yml` : le moteur vérifie par défaut, et l'exploitant doit poser explicitement `VERIFY_JWT=false` pour revenir au comportement hérité. Ce paragraphe décrivait l'inverse — une sécurité plus faible que celle réellement livrée.

**Origines autorisées.** `supabase/functions/_shared/cors.ts:7-18` lit `OPENPULSE_ORIGINES_AUTORISEES` (et `CORS_ALLOWED_ORIGINS` en second recours) et retombe à défaut sur les seules origines de développement, jamais sur une liste de l'auteur d'origine ; lignes 23-25, quand l'origine n'est pas dans la liste, la fonction renvoie la **première origine de la liste**, ce qui rend le diagnostic difficile. Seules **11 des 272 fonctions** utilisent ce mécanisme ; les autres importent l'export historique `corsHeaders`, figé sur `Access-Control-Allow-Origin: *` (lignes 37-40), que le fichier qualifie lui-même d'héritage à remplacer. Dette de sécurité à traiter, pas un réglage.

**Tâches planifiées.** Une trentaine de déclarations `[[edge_runtime.cron_jobs]]` dans `supabase/config.toml`, dont une à la minute et plusieurs toutes les 2 à 5 minutes. Non optionnelles pour plusieurs modules, et première cause de saturation des journaux quand l'instance est mal configurée.

## 5. Services HTTP autonomes

**Absents de la documentation héritée.** `ARCHITECTURE.md` (racine) ne mentionne ni ces services, ni l'application de bureau, ni la coque mobile ; son unique occurrence de `services/` (ligne 701) désigne `src/services/`, du code frontal.

| Service               | Répertoire                              | Rôle                                                 | Dépendances notables                         |
| --------------------- | --------------------------------------- | ---------------------------------------------------- | -------------------------------------------- |
| Messagerie            | `services/openpulse-email-api/`         | interface de messagerie alternative                  | `asyncpg`                                    |
| Communication interne | `services/openpulse-pulse-api/`         | messagerie interne                                   | `asyncpg`                                    |
| Réunions              | `services/openpulse-meetings-api/`      | réunions, pièces jointes                             | `asyncpg`, client de stockage objet          |
| Fichiers              | `services/openpulse-gestion-drive-api/` | espace de fichiers, versions, synchronisation bureau | `asyncpg`, client de stockage objet, `httpx` |

Le service de fichiers est le plus complet : autorisation applicative (`app/authorization.py`), jetons (`app/tokens.py`), état de migration (`app/migration_state.py`), et **son propre jeu de 5 migrations SQL** (`services/openpulse-gestion-drive-api/migrations/`), dont le seul fichier de retour arrière du dépôt (`0001_init_drive.rollback.sql`).

Sa configuration mérite attention (`app/config.py`) : `database_url` vide ⇒ dépôt en mémoire, pour le développement ; **`drive_auth_mode` vaut `"disabled"` par défaut**, donc une instance qui oublie de le passer à `"jwt"` n'authentifie pas les accès aux fichiers ; `drive_require_mfa` vaut `true` par défaut, avec un commentaire indiquant qu'il a été mis à `false` sur l'instance interne de l'auteur d'origine faute de double authentification sur les comptes ; et une méthode `validate_runtime()` refuse le démarrage en mode production si un réglage critique manque — seul garde-fou de ce type dans l'arbre.

Deux jeux de migrations supplémentaires existent : `azure/pulse/migrations/`, `azure/meetings/migrations/`.

Un cinquième répertoire, `services/openpulse-gestion-db-sync/`, n'est **pas** un service : c'est un script ponctuel de recopie d'une base vers une autre, dont les valeurs par défaut désignent l'infrastructure de l'auteur d'origine. Aucun usage pour une instance tierce ; ne devrait pas figurer dans la distribution.

## 6. Clients hors navigateur

**Application de bureau** — `apps/gestion-drive-desktop/` : Tauri (Rust) et un frontal Vite dédié. `crates/sync-core` porte la logique de synchronisation, `migrations/local/` un schéma local, `src-tauri/capabilities/` les capacités déclarées. Deux notes d'architecture y étaient annoncées, mais elles n'ont jamais existé dans ce dépôt : le renvoi est retiré plutôt que promis. ⚠ non prouvé : rien n'atteste qu'un binaire signé et distribuable puisse être produit par un tiers.

**Coque mobile** — `capacitor.config.ts`, `android/`, `ios/`. Le paquet embarque le frontal construit (`webDir: 'dist'`), avec possibilité de pointer un serveur distant par variable d'environnement pour le développement. Un mécanisme de mise à jour du contenu web est déclaré via une extension tierce dont l'activation demande des identifiants d'intégration continue. ⚠ non prouvé : aucune chaîne de publication vers les magasins d'applications n'est utilisable par un tiers, puisqu'elle suppose des comptes d'éditeur.

## 7. Pile d'exécution de référence

`docker/docker-compose.openpulse.yml` décrit la pile installée par
`scripts/installer.sh`. C'est la seule composition de l'arbre qui monte tous les
services dont l'application dépend ; les autres fichiers `docker-compose.*.yml`
sont hérités et ne sont pas maintenus.

| Rôle                    | Image                                           | Notes                                                                                                                                                      |
| ----------------------- | ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Base de données         | `postgres:15`                                   | `wal_level=logical` requis par le temps réel ; l'amorçage pose des substituts inertes pour `pg_net`, `pg_cron` et `supabase_vault`, absents de cette image |
| API REST sur la base    | `postgrest/postgrest:v12.2.3`                   | applique la sécurité au niveau ligne ; se connecte via le rôle `authenticator`, sans privilège d'élévation                                                 |
| Authentification        | `supabase/gotrue:v2.170.0`                      | applique ses propres migrations dans `auth` ; inscription libre désactivée par défaut                                                                      |
| Temps réel              | `supabase/realtime:v2.34.47`                    | applique ses migrations dans `_realtime` ; sans lui, les 91 abonnements `postgres_changes` de l'interface restent muets sans erreur                        |
| Stockage de fichiers    | `supabase/storage-api:v1.14.5`                  | applique ses migrations dans `storage` ; dorsal sur volume local                                                                                           |
| Passerelle d'API        | `kong:2.8.1`                                    | configuration déclarative engendrée depuis `docker/kong/kong.template.yml` par l'installateur                                                              |
| Exécution des fonctions | `supabase/edge-runtime:v1.67.2`                 | profil `applicatif` ; monte `supabase/functions` en lecture seule                                                                                          |
| Interface web           | construite depuis `docker/Dockerfile.openpulse` | profil `applicatif` ; la construction échoue si l'URL d'API ou la clé publique manquent                                                                    |

Deux services sont derrière le profil `applicatif` et ne démarrent qu'avec
`docker compose --profile applicatif up -d` : ils supposent le code source
présent, ce qui n'est pas le cas d'une installation qui ne veut que la couche
de données.

La terminaison TLS n'est pas fournie. Une instance exposée sur l'internet doit
placer une terminaison TLS devant la passerelle — la composition ouvre volontairement
des ports en clair sur l'hôte, ce qui convient à une installation locale et à
rien d'autre.

## 8. Sécurité : ce sur quoi elle repose vraiment

Quatre couches, du plus fiable au plus fragile :

1. **Sécurité au niveau ligne en base** — 355 tables protégées, politiques ancrées sur `auth.uid()` et sur les rôles applicatifs. Seule couche qui résiste à un contournement de l'interface. Elle ne fonctionne que si `profiles.user_id` existe, d'où la gravité du défaut de `supabase/schema-00-bootstrap.sql`.
2. **Rôles applicatifs** — `public.user_roles`, type énuméré `app_role`, fonctions `has_role(_user_id, _role)` et dérivées, déclarées `SECURITY DEFINER` avec `search_path` figé, ce qui est la bonne pratique.
3. **Vérification de jeton à la passerelle** — déclarée fonction par fonction dans `supabase/config.toml`. Fiable là où elle est activée.
4. **Contrôles dans le code des fonctions** — pour celles déclarées sans vérification à la passerelle. ⚠ non prouvé : non audité ici.

Trois points faibles identifiés : l'origine autorisée par défaut des fonctions n'est pas la vôtre, et 311 fichiers de fonctions référencent encore l'en-tête permissif historique ; 9 tables `drive_*` n'ont pas de protection au niveau ligne, leur cloisonnement est entièrement applicatif ; le mode d'authentification du service de fichiers est **désactivé par défaut**.

La double authentification existe (facteurs TOTP côté fournisseur, table `profiles_secrets`, composant `src/components/auth/TwoFactorSetup.tsx`) mais **n'est pas imposée** par la distribution. `SELF_HOSTING.md:134` la présente comme acquise pour les administrateurs ; rien dans l'arbre ne l'impose, et le service de fichiers documente explicitement le cas d'une instance où les comptes n'en ont pas.

## 9. Récapitulatif des divergences avec la documentation héritée

| Affirmation héritée                                   | Emplacement                                                                                      | Mesure réelle                                                             |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------- |
| API applicative Express.js port 4000                  | `docs/SELF_HOSTING_GUIDE.md:32,89`                                                               | inexistante ; `docker/Dockerfile.backend:22,28` copie un `server/` absent |
| 436+ tables                                           | `ARCHITECTURE.md:65,485`, `docs/QUICK_START_ON_PREMISE.md:275`, `docs/SELF_HOSTING_GUIDE.md:355` | 363 noms de table créés                                                   |
| Toutes les tables protégées au niveau ligne           | `ARCHITECTURE.md:485`                                                                            | 355 sur 363 ; 10 sans protection                                          |
| 254 fonctions de bord                                 | `ARCHITECTURE.md:65,131,628,802`                                                                 | 272                                                                       |
| 86 pages                                              | `ARCHITECTURE.md:123`                                                                            | 165 pages hors tests, 170 chemins de route                                |
| Schéma consolidé de 151 tables issu de 501 migrations | `docker/init-db/00-full-schema.sql:7,11`                                                         | 28 `CREATE TABLE`, 0 politique, 0 référence à `auth`                      |
| Services autonomes, bureau, mobile                    | absents de `ARCHITECTURE.md`                                                                     | 4 services FastAPI, 1 application Tauri, 1 coque Capacitor                |
| Pile de surveillance disponible                       | `docs/SELF_HOSTING_GUIDE.md:505`                                                                 | `docker-compose.monitoring.yml` absent de l'arbre                         |
| 4 Go de RAM suffisent                                 | `docs/QUICK_START_ON_PREMISE.md:16`, `docs/SELF_HOSTING_GUIDE.md:46`                             | la construction du frontal réclame 8 Go de tas                            |
