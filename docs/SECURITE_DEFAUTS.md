# Valeurs par défaut de sécurité — distribution OpenPulse

OpenPulse s'installe en une instance par organisation. Chaque instance héberge
ses propres clients et ses propres données : un défaut permissif n'y est pas une
commodité de développement, c'est une brèche livrée clé en main.

Ce document fixe la valeur retenue pour chaque réglage de sécurité de la
distribution, l'endroit vérifié dans l'arbre, et ce qui se produit si l'on
assouplit. Chaque chemin cité a été relevé dans le code, pas déduit.

Règle générale : **échec bruyant plutôt qu'ouverture silencieuse.** Un réglage
absent doit empêcher le démarrage ou faire échouer la requête, jamais retomber
sur une valeur commode.

## 1. Plateforme de données et fonctions de bord

| Réglage | Emplacement vérifié | Valeur amont | Valeur sûre OpenPulse | Conséquence de l'assouplir |
| --- | --- | --- | --- | --- |
| `enable_signup` | `supabase/config.toml:37` | `true` | `false` | N'importe qui crée un compte sur l'instance. Toute politique d'accès accordée au rôle `authenticated` sans contrôle de rôle devient de fait publique. L'ouverture des inscriptions est une décision d'exploitant, jamais un défaut. |
| Confirmation d'adresse e-mail | aucun bloc `[auth.email]` dans `supabase/config.toml` (sections présentes : `[api]` L3, `[db]` L10, `[studio]` L15, `[inbucket]` L20, `[storage]` L26, `[auth]` L31, `[edge_runtime]` L39) | implicite, non confirmée | bloc `[auth.email]` explicite avec `enable_confirmations = true` | Des comptes existent sous des adresses que personne n'a prouvé posséder ; toute logique d'invitation ou de rattachement par domaine devient usurpable. |
| `site_url` / `additional_redirect_urls` | `supabase/config.toml:34` et `:35` | `http://localhost:3000` / `https://localhost:3000` | URL réelle de l'instance, liste de redirection énumérée et minimale | Une liste large ou joker transforme le flux d'authentification en redirection ouverte : le jeton part vers un site tiers. |
| `jwt_expiry` | `supabase/config.toml:36` | `3600` | `3600` (conservé) | Allonger la durée de vie allonge d'autant la fenêtre d'exploitation d'un jeton volé, sans compensation. |
| `verify_jwt` par fonction | `supabase/config.toml` — 211 blocs `[functions.*]`, dont **45 à `verify_jwt = false`** | 45 fonctions sans vérification de jeton | `true` par défaut ; `false` seulement pour une liste blanche justifiée et commentée dans le fichier | Une fonction sans vérification de jeton est appelable par le monde entier. Combinée à la clé de service, elle contourne intégralement la sécurité au niveau ligne. |
| Origines CORS des fonctions | `supabase/functions/_shared/cors.ts` (substitut) | constante `corsHeaders` à `*` | `OPENPULSE_CORS_ORIGINES` obligatoire, énumérée, refus par défaut, `*` refusé, erreur explicite si absente | Une origine générique permet à n'importe quelle page web de lire les réponses de l'API avec les identifiants du visiteur. |
| `OPENPULSE_CORS_ORIGINES=aucune` | `supabase/functions/_shared/cors.ts` | — | acceptable, mais doit être **déclaré** | Le refus total est sûr ; ce qui ne doit jamais être sûr par accident, c'est l'autorisation. D'où l'obligation de déclarer explicitement l'absence de client navigateur. |
| `INTERNAL_INVOCATION_SECRET` | `supabase/functions/_shared/internal-secret.ts:35` (repli sur la clé de service L36, L42, L50) | non fourni | valeur forte obligatoire | Le garde actuel est déjà à échec fermé : si aucun secret n'est configuré, toute requête est rejetée en 401 (L54-L61). Ce comportement doit être préservé — ne jamais introduire un « si le secret est vide, on laisse passer ». |
| `[api] max_rows` | `supabase/config.toml:8` | `1000` | `1000` (conservé) | Relever le plafond augmente le volume qu'une seule requête abusive exfiltre. |
| `[storage] file_size_limit` | `supabase/config.toml:29` | `50MiB` | `50MiB` (conservé) | Un plafond plus haut ouvre un déni de service par remplissage de stockage sur une instance auto-hébergée. |
| `project_id` | `supabase/config.toml:1` | identifiant d'un projet hébergé de l'amont | valeur propre à l'organisation installatrice | Un identifiant hérité fait pointer les outils de l'installateur vers l'infrastructure d'un tiers. |

## 2. Services Python / FastAPI

Les quatre services exposent le même contrat : un mode d'authentification
`disabled` ou `jwt`, et un garde de démarrage qui n'exige `jwt` **que** si
l'environnement est déclaré `prod`. Le défaut livré est donc `dev` + `disabled`,
c'est-à-dire aucune authentification, avec un utilisateur anonyme forgé côté
serveur.

| Service | Environnement | Mode d'authentification | Effet du mode `disabled` | Valeur sûre OpenPulse |
| --- | --- | --- | --- | --- |
| Pulse | `services/openpulse-pulse-api/app/config.py:11` → `"dev"` | `services/openpulse-pulse-api/app/config.py:17` → `"disabled"` | `services/openpulse-pulse-api/app/auth.py:115-116` renvoie un utilisateur `"dev"` à tout appelant, sans jeton | `PULSE_ENV=prod`, `PULSE_AUTH_MODE=jwt`, secret/émetteur/audience obligatoires |
| Email | `services/openpulse-email-api/app/config.py:11` → `"dev"` | `services/openpulse-email-api/app/config.py:17` → `"disabled"` | `services/openpulse-email-api/app/auth.py:88` | `EMAIL_ENV=prod`, `EMAIL_AUTH_MODE=jwt` |
| Réunions | `services/openpulse-meetings-api/app/config.py:11` → `"dev"` | `services/openpulse-meetings-api/app/config.py:26` → `"disabled"` | `services/openpulse-meetings-api/app/auth.py:80` | `MEETINGS_ENV=prod`, `MEETINGS_AUTH_MODE=jwt` |
| Drive | `services/openpulse-gestion-drive-api/app/config.py:11` → `"dev"` | `services/openpulse-gestion-drive-api/app/config.py:27` → `"disabled"` | `services/openpulse-gestion-drive-api/app/auth.py:111` | `DRIVE_ENV=prod`, `DRIVE_AUTH_MODE=jwt` |

Réglages complémentaires vérifiés :

| Réglage | Emplacement vérifié | Valeur amont | Valeur sûre OpenPulse | Conséquence de l'assouplir |
| --- | --- | --- | --- | --- |
| `drive_app_secret` | `services/openpulse-gestion-drive-api/app/config.py:39` | littéral `"dev-only-secret"` | **aucune valeur par défaut** ; démarrage refusé si absent ou plus court que 32 octets | Les jetons d'envoi de fichiers sont signés avec un secret publié dans le dépôt : n'importe qui forge une autorisation d'écriture. Le garde `validate_runtime` (`config.py:86-87`) ne rejette cette valeur qu'en `prod` — le défaut la rend exploitable partout ailleurs. |
| `drive_require_mfa` | `services/openpulse-gestion-drive-api/app/config.py:33` | `True` | `True` (conservé, et non désactivable par défaut) | Abaisser cette valeur retire l'exigence de second facteur pour ouvrir une session Drive sur toute l'instance. |
| `*_cors_origins` | `services/openpulse-pulse-api/app/config.py:22`, `services/openpulse-email-api/app/config.py:22`, `services/openpulse-meetings-api/app/config.py:31`, `services/openpulse-gestion-drive-api/app/config.py:47` | `"http://localhost:5173"` | **vide par défaut**, obligatoire à l'installation | Un défaut « qui marche » évite à l'installateur de se poser la question et laisse traîner une origine de développement en production. Vide, le filtre n'autorise rien : l'exploitant doit décider. |
| `allow_credentials` / `allow_methods` | `main.py:37-40` des quatre services | `True` / `["*"]` | conserver `allow_credentials=True` **uniquement** avec une liste d'origines énumérée ; ne jamais combiner avec une origine générique | `allow_credentials=True` associé à une origine générique équivaut à publier les sessions de tous les utilisateurs. |
| `database_url` | `config.py:14` (Pulse, Email), `:15` (Réunions, Drive) | vide → dépôt en mémoire | obligatoire hors développement local | Un service qui démarre sans base ne signale rien : il perd les écritures en silence et donne l'illusion de fonctionner. |
| Périmètre du garde de démarrage | `services/openpulse-pulse-api/app/config.py:46-47`, `services/openpulse-email-api/app/config.py:42`, `services/openpulse-meetings-api/app/config.py:50`, `services/openpulse-gestion-drive-api/app/config.py:61-62` | contrôles actifs seulement si l'environnement vaut `prod`/`production` | inverser la charge : contrôles actifs **partout**, le mode permissif exigeant un aveu explicite (`*_ENV=dev-local`) | Aujourd'hui, oublier de déclarer `prod` suffit à désactiver tous les contrôles. Une distribution publique ne peut pas faire dépendre sa sécurité d'une chaîne de caractères que l'installateur ignore. |

## 3. Comptes, secrets et amorçage

| Réglage | Emplacement vérifié | Valeur amont | Valeur sûre OpenPulse | Conséquence de l'assouplir |
| --- | --- | --- | --- | --- |
| Comptes de démonstration au premier démarrage | aucune insertion de compte dans les 942 fichiers de `supabase/migrations/` ; l'unique fabrique de comptes portail (`supabase/migrations/00000000000000_initial_schema.sql`) tire un mot de passe aléatoire et exige le rôle admin ou direction | aucun compte préchargé | **aucun compte préchargé** (état conservé) | Un compte de démonstration livré est un identifiant public. L'état amont est correct sur ce point : il doit être verrouillé par un test, pas laissé au hasard. |
| Exemption de second facteur sur une adresse codée en dur | `supabase/migrations/00000000000000_initial_schema.sql` — la fonction `enforce_2fa_for_admin` accorde le rôle `admin` sans second facteur dès que `profiles.is_sandbox = true` **et** que l'adresse égale une adresse de test de l'amont ; même motif en `:30` et dans `20260704141428_1f6da6bf-eeb5-46ff-81da-9fe5daacd8c9.sql:13` et `:32` ; contournement complémentaire en `20260513193803_bbd191ef-6f09-4987-8e95-9698938bd6e9.sql:5-9` (attribution d'un rôle équivalent admin à cette même adresse) | exemption permanente inscrite dans le schéma | **exemption supprimée** : `enforce_2fa_for_admin` sans branche d'exception, jeux d'essai passant par un second facteur réel ou par des tests unitaires | Une exemption inscrite dans le schéma survit à toutes les installations. Une adresse connue publiquement suffit alors à obtenir le rôle admin sans second facteur. Aucune exception ne doit dépendre d'une valeur littérale. |
| Mot de passe d'amorçage des comptes d'essai | `scripts/seed-e2e-users.ts:30` — `process.env.E2E_PASSWORD_DEFAULT || '<littéral en clair>'` | littéral de repli présent dans le dépôt | **aucun repli** : le script s'arrête si la variable n'est pas fournie | Un exploitant qui lance le script sans variable crée six comptes, dont un administrateur, avec un mot de passe publié dans le dépôt. |
| Jeton d'API en dur dans le schéma | 10 fichiers de `supabase/migrations/` (11 occurrences), par exemple `supabase/migrations/00000000000000_initial_schema.sql` | jeton d'un projet hébergé de l'amont, valide jusqu'en 2035 | **aucun jeton littéral** : espace réservé, valeur injectée à l'installation | Le schéma d'une instance neuve porte un identifiant appartenant à un tiers, et les traitements planifiés locaux ne s'exécutent jamais. |
| URL d'appel des traitements planifiés | 20 fichiers de `supabase/migrations/` (26 occurrences) | URL d'un projet hébergé de l'amont | espace réservé résolu à l'installation | Les tâches planifiées de l'instance appellent l'infrastructure d'un tiers, avec un jeton de ce tiers. |
| Journaux et archives d'exécution | les archives d'audit, hors distribution — 12 fichiers contenant un jeton d'API | présents dans l'arbre | **exclus de la distribution** | Des traces d'exécution réelles contiennent des jetons et des données d'exploitation qui n'ont rien à faire dans un dépôt public. |

## 4. Ce que la distribution doit refuser de démarrer sans

Un contrôle de démarrage, exécuté avant de servir la première requête, doit
refuser l'instance si l'un de ces éléments manque :

- `OPENPULSE_CORS_ORIGINES` (ou la déclaration explicite `aucune`) ;
- `INTERNAL_INVOCATION_SECRET` ;
- pour chaque service Python : le mode `jwt`, son secret, son émetteur, son
  audience, et l'URL de base de données ;
- `DRIVE_APP_SECRET`, distinct de toute valeur figurant dans le dépôt ;
- l'identifiant de projet et les URL de fonctions propres à l'organisation.

## 5. Points de vigilance connus, non couverts par un défaut

- `supabase/functions/workflow-webhook-trigger/index.ts:80-86` : la vérification
  de signature n'est appliquée que si la ligne de jeton porte un secret. Un
  déclencheur créé sans secret reste appelable avec le seul jeton, en clair.
- `supabase/functions/ip-validator/index.ts:23-25` : l'origine autorisée est
  écrite en dur, et l'en-tête `x-validator-secret` est annoncé dans la liste
  `Access-Control-Allow-Headers` alors qu'il n'est vérifié nulle part dans le
  fichier. Un en-tête annoncé mais non contrôlé se lit comme une protection
  qui n'existe pas.
- `supabase/functions/_shared/platform-auth.ts:7-8` : seconde constante d'origine
  générique (`PLATFORM_CORS` à `*`), utilisée par 5 fichiers. Elle relève du
  même correctif que la constante partagée, mais son remplacement n'est pas
  mécanique : elle sert aussi de socle aux réponses d'erreur.
- Les fichiers de `supabase/functions/` qui construisaient un objet d'en-têtes
  local avec une origine ouverte à toutes les origines ont été basculés vers le
  module partagé. Ceux dont les en-têtes acceptés sont spécifiques conservent
  leur objet, mais l'origine y est désormais résolue par `origineAutorisee()`.
  Aucune fonction de la distribution n'ouvre l'API à toutes les origines.
