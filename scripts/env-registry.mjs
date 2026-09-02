/**
 * scripts/env-registry.mjs — source de verite UNIQUE de la configuration.
 *
 * Tout consommateur (verification au demarrage, integration continue,
 * generation de documentation) lit ce fichier et lui seul. Ajouter une variable
 * ailleurs sans l'inscrire ici est un defaut : `check-env.mjs --inconnues`
 * le signale.
 *
 * Champs d'une entree :
 *   nom        identifiant de la variable, tel que le code le lit
 *   portee     'build' | 'plateforme' | 'bord' | 'service'
 *   niveau     'requis' | 'conditif' | 'option'
 *   profils    profils dans lesquels la variable est exigee
 *   defaut     valeur de repli raisonnable et neutre, '' si aucune
 *   absence    'demarrage' | 'fonctionnalite' | 'silence'
 *   debloque   ce que la variable rend possible, en une phrase
 *   lu         emplacements chemin:ligne verifies dans l'arbre amont
 *   valide     contrainte optionnelle : { type, min, valeurs, interdits }
 *   requisSi   predicat optionnel (env) => boolean, pour les couples
 *   secret     true si la valeur ne doit jamais apparaitre dans un journal
 */

export const PROFILS = ['minimal', 'complet'];
export const PORTEES = ['build', 'plateforme', 'bord', 'service'];

/** Valeurs de remplissage refusees partout : elles trahissent un .env non rempli. */
export const REMPLISSAGES_INTERDITS = [
  'CHANGE_ME',
  'CHANGE_ME_JWT_SECRET',
  'CHANGE_ME_APP_SECRET',
  'dev-only-secret',
  'A_REMPLIR',
  'TODO',
  'changeme',
  'GENERER_AVEC_OPENSSL_RAND',
];

const vrai = (v) => ['1', 'true', 'on', 'oui', 'yes'].includes(String(v ?? '').trim().toLowerCase());
const rempli = (v) => String(v ?? '').trim() !== '';
/** Un drapeau de backend est "actif" des qu'il vaut autre chose que supabase/legacy. */
const backendExterne = (v, defaut) => {
  const x = String(v ?? defaut).trim().toLowerCase();
  return x === 'azure' || x === 'hybrid';
};
const estProd = (v) => ['prod', 'production'].includes(String(v ?? '').trim().toLowerCase());

/** Fabrique compacte : les entrees optionnelles se decrivent en une ligne. */
function e(nom, portee, niveau, profils, defaut, absence, debloque, lu, extra = {}) {
  return { nom, portee, niveau, profils, defaut, absence, debloque, lu, ...extra };
}

// ---------------------------------------------------------------------------
// 1. Identite de l'instance et build frontend
// ---------------------------------------------------------------------------
const BUILD = [
  e('NODE_ENV', 'build', 'requis', ['minimal', 'complet'], 'production', 'fonctionnalite',
    "le mode de construction : hors 'production', le bundle n'est pas minifie et les bandeaux de diagnostic restent visibles",
    ['docker/Dockerfile.frontend:15', 'src/components/ui/error-boundary.tsx:101'],
    { valide: { type: 'enum', valeurs: ['production', 'staging', 'development', 'test'] } }),

  e('OPENPULSE_GIT_SHA', 'build', 'requis', ['minimal', 'complet'], '', 'demarrage',
    "la tracabilite du build ; le prebuild refuse de produire un bundle sans SHA complet lorsque .git est absent de l'image",
    ['scripts/generate-build-info.mjs:10', 'docker/Dockerfile.openpulse:13', 'services/openpulse-gestion-drive-api/app/config.py:12'],
    { valide: { type: 'sha40' } }),

  e('OPENPULSE_BUILD_AT', 'build', 'option', [], '', 'fonctionnalite',
    "l'horodatage affiche dans la page de diagnostic ; absent, l'heure d'execution du prebuild est utilisee",
    ['scripts/generate-build-info.mjs:43']),

  e('VITE_SUPABASE_URL', 'build', 'requis', ['minimal', 'complet'], '', 'silence',
    "la liaison du navigateur a la passerelle API ; l'amont repliait sur un domaine de l'editeur, ce qui faisait pointer une instance mal configuree vers un tiers",
    ['src/lib/supabaseBrowser.ts:9'], { valide: { type: 'url' } }),

  e('VITE_SUPABASE_PUBLISHABLE_KEY', 'build', 'requis', ['minimal', 'complet'], '', 'demarrage',
    "l'authentification du navigateur ; absente, une exception est levee au chargement du module client et l'application affiche un ecran blanc",
    ['src/lib/supabaseBrowser.ts:11', 'src/lib/supabaseBrowser.ts:14'],
    { valide: { type: 'jwt' } }),

  // Substituees dans index.html a la construction. Vite ne substitue que ce
  // qui existe : une variable absente laisse son marqueur LITTERAL dans le
  // HTML, et la politique de securite bloque alors chaque appel vers l'API
  // sans qu'aucune etape de build n'echoue. D'ou le niveau « silence ».
  // Substitue dans index.html : titre d'onglet, auteur du document, titre
  // d'apercu de lien. Ces trois valeurs sont servies AVANT tout JavaScript :
  // ni l'assistant de premier lancement ni le fournisseur de marque ne peuvent
  // les atteindre. C'est la seule part de l'identite qui exige une
  // reconstruction.
  e('VITE_MARQUE_NOM_PRODUIT', 'build', 'requis', ['minimal', 'complet'], 'OpenPulse', 'silence',
    "le nom affiche dans l'onglet du navigateur et dans l'apercu d'un lien partage ; absente, son marqueur reste litteral dans le HTML",
    ['index.html', 'docker/Dockerfile.openpulse', 'src/config/branding.ts']),

  e('VITE_CSP_IMG_EXTRA', 'build', 'requis', ['minimal', 'complet'], '', 'silence',
    "les origines d'images autorisees ; absente, son marqueur reste litteral dans le HTML et la politique devient invalide",
    ['index.html', 'docker/Dockerfile.openpulse']),
  e('VITE_CSP_CONNECT_EXTRA', 'build', 'requis', ['minimal', 'complet'], '', 'silence',
    "les origines joignables par requete et par WebSocket ; absente, le navigateur refuse chaque appel de l'application vers son propre backend",
    ['index.html', 'docker/Dockerfile.openpulse']),
  e('VITE_CSP_FRAME_EXTRA', 'build', 'requis', ['minimal', 'complet'], '', 'silence',
    "les origines integrables en cadre ; meme consequence si elle est absente",
    ['index.html', 'docker/Dockerfile.openpulse']),
  e('VITE_CSP_MEDIA_EXTRA', 'build', 'requis', ['minimal', 'complet'], '', 'silence',
    "les origines de flux audio et video ; meme consequence si elle est absente",
    ['index.html', 'docker/Dockerfile.openpulse']),

  e('VITE_DOCUMENTS_BACKEND', 'build', 'option', [], 'legacy', 'fonctionnalite',
    'le choix du backend Documents ; absent, le mode historique est conserve et le panneau Drive externe reste masque',
    ['src/lib/drive/driveClient.ts:36', 'src/lib/drive/driveClient.ts:54'],
    { valide: { type: 'enum', valeurs: ['legacy', 'azure', 'hybrid'] } }),

  e('VITE_DRIVE_API_URL', 'build', 'conditif', ['complet'], '', 'fonctionnalite',
    "les appels au service Drive ; absente alors que le backend Documents est externe, toute action Drive echoue sur 'API indisponible'",
    ['src/lib/drive/driveClient.ts:37', 'src/lib/drive/driveClient.ts:95', 'src/lib/drive/driveClient.ts:274'],
    { valide: { type: 'url' }, requisSi: (v) => backendExterne(v.VITE_DOCUMENTS_BACKEND, 'legacy') }),

  e('VITE_DOCUMENTS_UPLOAD_BACKEND', 'build', 'option', [], 'auto', 'fonctionnalite',
    "la cible d'envoi des fichiers ; absent, la cible est deduite du backend Documents",
    ['src/hooks/documents/useDocumentUpload.ts:24'],
    { valide: { type: 'enum', valeurs: ['auto', 'supabase', 'azure', 'nextcloud'] } }),

  e('VITE_DOCUMENTS_AI_PANEL', 'build', 'option', [], 'on', 'fonctionnalite',
    "l'affichage du panneau Assistant IA des documents ; absent, le panneau est visible et gere lui-meme son mode non configure",
    ['src/config/documentsAi.ts:13'], { valide: { type: 'interrupteur' } }),

  e('VITE_EMAIL_BACKEND', 'build', 'option', [], 'supabase', 'fonctionnalite',
    'le backend de messagerie ; absent, la messagerie historique est utilisee sans supervision externe',
    ['src/lib/emailBackend.ts:32'],
    { valide: { type: 'enum', valeurs: ['supabase', 'azure', 'hybrid'] } }),

  e('VITE_EMAIL_AZURE_API_URL', 'build', 'conditif', ['complet'], '', 'silence',
    "la supervision et la synchronisation de messagerie externalisees ; absente alors que le backend est externe, le panneau affiche 'non configure' et la synchronisation ne demarre jamais",
    ['src/lib/emailBackend.ts:51', 'src/services/azureServiceHealth.ts:71'],
    { valide: { type: 'url' }, requisSi: (v) => backendExterne(v.VITE_EMAIL_BACKEND, 'supabase') }),

  e('VITE_PULSE_BACKEND', 'build', 'option', [], 'supabase', 'fonctionnalite',
    'le backend de la discussion interne ; absent, le mode historique est conserve',
    ['src/lib/pulse/azureBackend.ts:25', 'src/lib/pulse/azureBackend.ts:90'],
    { valide: { type: 'enum', valeurs: ['supabase', 'azure', 'hybrid'] } }),

  e('VITE_PULSE_AZURE_API_URL', 'build', 'conditif', ['complet'], '', 'fonctionnalite',
    "les appels au service de discussion ; absente alors que le backend est externe, chaque appel leve 'non configure'",
    ['src/lib/pulse/azureBackend.ts:26', 'src/lib/pulse/azureApiClient.ts:86'],
    { valide: { type: 'url' }, requisSi: (v) => backendExterne(v.VITE_PULSE_BACKEND, 'supabase') }),

  e('VITE_PULSE_AZURE_WS_URL', 'build', 'option', [], '', 'fonctionnalite',
    "le temps reel de la discussion ; absente, l'URL est derivee de la base API (https vers wss, chemin /api/pulse/ws)",
    ['src/lib/pulse/azureBackend.ts:27', 'src/lib/pulse/azureBackend.ts:95']),

  e('VITE_VISIO_BACKEND', 'build', 'option', [], 'supabase', 'fonctionnalite',
    'le backend des salles de visioconference ; absent, le mode historique est conserve',
    ['src/config/meetingsBackend.ts:51'],
    { valide: { type: 'enum', valeurs: ['supabase', 'azure', 'hybrid'] } }),

  e('VITE_TRANSCRIPTION_BACKEND', 'build', 'option', [], 'supabase', 'fonctionnalite',
    'le backend du pipeline de transcription ; absent, le mode historique est conserve',
    ['src/config/meetingsBackend.ts:56'],
    { valide: { type: 'enum', valeurs: ['supabase', 'azure', 'hybrid'] } }),

  e('VITE_MEETINGS_API_BASE_URL', 'build', 'conditif', ['complet'], '', 'silence',
    "les appels au service Reunions ; absente alors qu'un des deux backends visio est externe, les sondes sont desactivees sans aucun message",
    ['src/config/meetingsBackend.ts:64', 'src/services/meetings/azureMeetingsApi.ts:44'],
    { valide: { type: 'url' },
      requisSi: (v) => backendExterne(v.VITE_VISIO_BACKEND, 'supabase') || backendExterne(v.VITE_TRANSCRIPTION_BACKEND, 'supabase') }),

  e('VITE_SENTRY_DSN', 'build', 'option', [], '', 'silence',
    "la collecte des erreurs de production ; absente, la collecte est desactivee sans aucun avertissement et aucune erreur ne remonte jamais",
    ['src/lib/monitoring.ts:180', 'src/lib/monitoring.ts:181']),

  e('VITE_OTEL_ENDPOINT', 'build', 'option', [], '', 'silence',
    'le tracage distribue ; absent, le tracage est desactive sans avertissement',
    ['src/lib/monitoring.ts:182', 'src/lib/monitoring.ts:183']),

  e('VITE_PLAUSIBLE_DOMAIN', 'build', 'option', [], '', 'fonctionnalite',
    "la mesure d'audience sans cookie ; absente, la mesure est desactivee",
    ['src/lib/pwa-analytics.ts:330', 'src/lib/pwa-analytics.ts:331']),

  e('VITE_PLAUSIBLE_API_HOST', 'build', 'option', [], '', 'silence',
    "le point de collecte auto-heberge ; absent alors que le domaine est defini, la bibliotheque emet vers son hote public par defaut, c'est-a-dire hors de votre infrastructure",
    ['src/lib/pwa-analytics.ts:332'],
    { requisSi: (v) => rempli(v.VITE_PLAUSIBLE_DOMAIN) }),

  e('VITE_MATOMO_SITE_ID', 'build', 'option', [], '', 'silence',
    "la mesure d'audience auto-hebergee ; la seule presence de cette variable active le traceur",
    ['src/lib/pwa-analytics.ts:336', 'src/lib/pwa-analytics.ts:337'],
    { valide: { type: 'entier' } }),

  e('VITE_MATOMO_TRACKER_URL', 'build', 'conditif', ['complet'], '', 'silence',
    "la destination du traceur d'audience ; absente alors que l'identifiant de site est defini, le traceur est actif avec une URL vide : aucune mesure collectee, aucune erreur",
    ['src/lib/pwa-analytics.ts:338'],
    { valide: { type: 'url' }, requisSi: (v) => rempli(v.VITE_MATOMO_SITE_ID) }),

  e('VITE_AUTHENTIK_SSO_ENABLED', 'build', 'option', [], 'false', 'fonctionnalite',
    "le bouton d'authentification unique sur l'ecran de connexion ; absent, seule la connexion par mot de passe est proposee",
    ['src/pages/Auth.tsx:44'], { valide: { type: 'booleen' } }),

  e('VITE_INTERNAL_TOOL_EMBED_RUNTIME_ENABLED', 'build', 'option', [], 'false', 'fonctionnalite',
    'les outils internes integres en iframe ; absent, les entrees de menu correspondantes sont masquees',
    ['src/pages/BackendViewer.tsx:97'], { valide: { type: 'booleen' } }),

  e('VITE_OPENPULSE_WEB_URL', 'build', 'conditif', ['complet'], '', 'silence',
    "l'ouverture des modules web depuis l'application de bureau ; l'amont repliait sur un domaine de l'editeur, ce qui envoyait les utilisateurs de bureau chez un tiers",
    ['apps/gestion-drive-desktop/src/api/desktopApi.ts:11'],
    { valide: { type: 'url' }, requisSi: () => false, note: "requis uniquement pour construire le client de bureau" }),
];

// ---------------------------------------------------------------------------
// 2. Base de donnees et pile plateforme auto-hebergee
// ---------------------------------------------------------------------------
const PLATEFORME = [
  e('OPENPULSE_INSTANCE', 'plateforme', 'option', [], 'openpulse', 'silence',
    "la separation de plusieurs instances sur une meme machine : ce nom prefixe les conteneurs, reseaux et volumes Docker. Deux instances qui le partagent partagent aussi leur base — la seconde installation reprendrait la premiere au lieu d'en creer une nouvelle, sans rien dire",
    ['docker/docker-compose.openpulse.yml:19']),

  e('POSTGRES_HOST', 'plateforme', 'requis', ['minimal', 'complet'], '', 'demarrage',
    'la connexion du service temps reel a la base',
    ['docker/docker-compose.openpulse.yml']),
  e('POSTGRES_PORT', 'plateforme', 'option', [], '5432', 'fonctionnalite',
    'le port de la base ; le compose fixe 5432 en dur, cette variable est declarative',
    ['.env.example'], { valide: { type: 'entier' } }),
  e('POSTGRES_DB', 'plateforme', 'requis', ['minimal', 'complet'], 'openpulse', 'demarrage',
    'le nom de la base applicative',
    ['docker/docker-compose.openpulse.yml']),
  // La composition auto-hebergee fixe le compte proprietaire dans l'image de
  // la base : cette variable ne concerne qu'une base externe, ou elle est bien
  // requise. La declarer requise partout faisait chercher a l'exploitant une
  // valeur que rien ne lit.
  e('POSTGRES_USER', 'plateforme', 'conditif', ['complet'], 'postgres', 'demarrage',
    'le compte proprietaire du schema, sur une base PostgreSQL externe',
    ['docker/docker-compose.dev.yml', 'docker/docker-compose.prod.yml']),
  e('POSTGRES_PASSWORD', 'plateforme', 'requis', ['minimal', 'complet'], '', 'demarrage',
    "la connexion du service temps reel ; absent, l'application demarre mais sans aucune mise a jour live",
    ['docker/docker-compose.openpulse.yml'], { secret: true, valide: { type: 'secret', min: 16 } }),
  e('POSTGREST_URL', 'plateforme', 'requis', ['minimal', 'complet'], 'http://rest:3000', 'demarrage',
    "l'adresse HTTP de l'API REST, utilisee par le service de stockage ; absente, les listes restent vides",
    ['docker/docker-compose.openpulse.yml'], { valide: { type: 'url' } }),
  e('DATABASE_URL', 'service', 'requis', ['minimal', 'complet'], '', 'silence',
    "la persistance des quatre services HTTP ; VIDE, chacun demarre avec un depot EN MEMOIRE : aucune erreur et toutes les donnees disparaissent au redemarrage",
    ['services/openpulse-gestion-drive-api/app/config.py:15', 'services/openpulse-email-api/app/config.py:14',
     'services/openpulse-meetings-api/app/config.py:15', 'services/openpulse-pulse-api/app/config.py:14',
     'scripts/bootstrap-onpremise.mjs:36'], { secret: true, valide: { type: 'urlpg' } }),

  e('JWT_SECRET', 'plateforme', 'requis', ['minimal', 'complet'], '', 'demarrage',
    "la signature de tous les jetons : identite, REST, temps reel, stockage, fonctions ; absent, personne ne peut se connecter",
    ['docker/docker-compose.openpulse.yml', 'docker/docker-compose.openpulse.yml',
     'docker/docker-compose.openpulse.yml', 'supabase/functions/oauth-token/index.ts:25'],
    { secret: true, valide: { type: 'secret', min: 32 } }),
  // Les trois secrets du service temps reel. Les longueurs ne sont pas
  // indicatives : le service sort au demarrage sur une cle de 15 ou 17 octets,
  // avec un message qui ne dit pas laquelle des deux valeurs est en cause.
  e('REALTIME_ADMIN_PASSWORD', 'plateforme', 'requis', ['minimal', 'complet'], '', 'demarrage',
    "la connexion du service temps reel a la base ; absent, les abonnements aux changements restent muets sans erreur visible",
    ['docker/docker-compose.openpulse.yml', 'scripts/installer.sh:71'],
    { secret: true, valide: { type: 'secret', min: 16 } }),
  e('REALTIME_ENC_KEY', 'plateforme', 'requis', ['minimal', 'complet'], '', 'demarrage',
    "le chiffrement des metadonnees du service temps reel ; exactement 16 octets",
    ['docker/docker-compose.openpulse.yml', 'scripts/installer.sh:75'],
    { secret: true, valide: { type: 'secret', min: 16 } }),
  e('REALTIME_SECRET_KEY_BASE', 'plateforme', 'requis', ['minimal', 'complet'], '', 'demarrage',
    "la derivation des cles de session du service temps reel ; au moins 64 octets",
    ['docker/docker-compose.openpulse.yml', 'scripts/installer.sh:76'],
    { secret: true, valide: { type: 'secret', min: 64 } }),
  // Mots de passe des roles de service, engendres par l'installateur. Ils
  // manquaient a la reference de configuration alors que la composition les
  // exige : un exploitant qui installe a la main ne les trouvait nulle part.
  e('AUTHENTICATOR_PASSWORD', 'plateforme', 'requis', ['minimal', 'complet'], '', 'demarrage',
    "la connexion de l'API REST a la base, avec un role sans privilege d'elevation ; absent, l'API ne demarre pas",
    ['docker/docker-compose.openpulse.yml', 'scripts/installer.sh'], { secret: true, valide: { type: 'secret', min: 12 } }),
  e('AUTH_ADMIN_PASSWORD', 'plateforme', 'requis', ['minimal', 'complet'], '', 'demarrage',
    "la connexion du service d'authentification, qui applique ses propres migrations ; absent, aucune session n'est possible",
    ['docker/docker-compose.openpulse.yml', 'scripts/installer.sh'], { secret: true, valide: { type: 'secret', min: 12 } }),
  e('STORAGE_ADMIN_PASSWORD', 'plateforme', 'requis', ['minimal', 'complet'], '', 'demarrage',
    "la connexion du service de stockage ; absent, aucun fichier ne peut etre depose ni relu",
    ['docker/docker-compose.openpulse.yml', 'scripts/installer.sh'], { secret: true, valide: { type: 'secret', min: 12 } }),
  e('PUBLIC_URL', 'plateforme', 'requis', ['minimal', 'complet'], '', 'demarrage',
    "l'origine publique de l'application, vue par le navigateur ; sert d'origine autorisee a la passerelle et de cible de redirection",
    ['docker/docker-compose.openpulse.yml', 'scripts/installer.sh'], { valide: { type: 'url' } }),
  e('PUBLIC_API_URL', 'plateforme', 'requis', ['minimal', 'complet'], '', 'demarrage',
    "l'origine publique de la passerelle ; doit etre egale a VITE_SUPABASE_URL, sinon le navigateur appelle une adresse que la politique de securite refuse",
    ['docker/docker-compose.openpulse.yml', 'scripts/installer.sh'], { valide: { type: 'url' } }),
  e('AUTH_REDIRECT_ALLOW_LIST', 'plateforme', 'option', [], '', 'fonctionnalite',
    "les redirections autorisees apres authentification, au-dela de SITE_URL ; absente, seule SITE_URL est acceptee et les liens d'invitation vers un autre domaine sont refuses",
    ['docker/docker-compose.openpulse.yml']),

  e('ANON_KEY', 'plateforme', 'requis', ['minimal', 'complet'], '', 'demarrage',
    "l'acces public a la passerelle ; doit etre identique a VITE_SUPABASE_PUBLISHABLE_KEY",
    ['docker/docker-compose.openpulse.yml', 'docker/docker-compose.openpulse.yml'],
    { valide: { type: 'jwt' } }),
  e('SERVICE_ROLE_KEY', 'plateforme', 'requis', ['minimal', 'complet'], '', 'demarrage',
    "les acces privilegies des fonctions de bord ; ne doit jamais etre expose au navigateur",
    ['docker/docker-compose.openpulse.yml', 'docker/docker-compose.openpulse.yml'],
    { secret: true, valide: { type: 'jwt' } }),
  e('API_EXTERNAL_URL', 'plateforme', 'requis', ['minimal', 'complet'], '', 'demarrage',
    "l'emetteur des jetons et les liens de confirmation envoyes par courriel",
    ['docker/docker-compose.openpulse.yml', 'docker/docker-compose.openpulse.yml'],
    { valide: { type: 'url' } }),
  e('SITE_URL', 'plateforme', 'requis', ['minimal', 'complet'], '', 'fonctionnalite',
    'la redirection apres authentification',
    ['docker/docker-compose.openpulse.yml'], { valide: { type: 'url' } }),
  e('VERIFY_JWT', 'plateforme', 'requis', ['minimal', 'complet'], 'true', 'silence',
    "la verification du jeton par la passerelle des fonctions ; l'amont fixait 'false' en dur, rendant chaque fonction de bord joignable sans jeton",
    ['docker/docker-compose.openpulse.yml'],
    { valide: { type: 'booleen' } }),
  e('SUPABASE_JWKS', 'plateforme', 'conditif', [], '', 'demarrage',
    "la verification des jetons signes en ES256 ou RS256 ; absente avec de tels jetons, tous les appels sont refuses",
    ['docker/docker-compose.openpulse.yml']),

  e('S3_ACCESS_KEY', 'plateforme', 'conditif', ['complet'], '', 'fonctionnalite',
    "l'ecriture dans le stockage objet ; la composition auto-hebergee ecrit sur un volume local et n'en a pas besoin",
    ['docker/docker-compose.yml'],
    { secret: true }),
  e('S3_SECRET_KEY', 'plateforme', 'conditif', ['complet'], '', 'fonctionnalite',
    "l'ecriture dans le stockage objet, meme condition que S3_ACCESS_KEY",
    ['docker/docker-compose.yml'],
    { secret: true }),
];

// ---------------------------------------------------------------------------
// 3. Fonctions de bord — socle
// ---------------------------------------------------------------------------
const BORD_SOCLE = [
  e('SUPABASE_URL', 'bord', 'requis', ['minimal', 'complet'], 'http://kong:8000', 'demarrage',
    "l'acces des 243 fonctions concernees a la passerelle interne",
    ['supabase/functions/jarvis-execute/index.ts:104', 'docker/docker-compose.openpulse.yml',
     'services/openpulse-gestion-drive-api/app/config.py:44']),
  e('SUPABASE_ANON_KEY', 'bord', 'requis', ['minimal', 'complet'], '', 'demarrage',
    "la validation des jetons utilisateur par 73 fonctions ; absente, elles repondent 401 a tout le monde",
    ['supabase/functions/_shared/auth-helpers.ts:19', 'docker/docker-compose.openpulse.yml',
     'services/openpulse-gestion-drive-api/app/config.py:45'], { valide: { type: 'jwt' } }),
  e('SUPABASE_SERVICE_ROLE_KEY', 'bord', 'requis', ['minimal', 'complet'], '', 'demarrage',
    "les acces privilegies de 223 fonctions ; absente, elles echouent des la creation de leur client",
    ['supabase/functions/_shared/auth-helpers.ts:41', 'docker/docker-compose.openpulse.yml'],
    { secret: true, valide: { type: 'jwt' } }),
  // Secret a usage unique engendre par l'installateur, qui autorise la
  // revendication du role d'administrateur sur une instance encore vierge. Il
  // n'est verifie que tant qu'aucun administrateur n'existe, et la comparaison
  // est a temps constant. Absent, `bootstrap-admin` leve des sa construction :
  // l'instance demarre mais personne ne peut jamais y obtenir de droits.
  // Synthese vocale de l'assistant (`jarvis-tts`). Optionnelles : sans elles la
  // fonction repond une erreur explicite et l'interface retombe sur du texte —
  // la conference vocale est degradee, pas cassee. Elles vont par paire : une
  // seule des deux ne sert a rien.
  e('AZURE_TTS_ENDPOINT', 'bord', 'option', [], '', 'fonctionnalite',
    "l'hote du service de synthese vocale ; absente, jarvis-tts refuse poliment et l'assistant reste muet",
    ['supabase/functions/jarvis-tts/index.ts'], {}),
  e('AZURE_TTS_API_KEY', 'bord', 'option', [], '', 'fonctionnalite',
    "la cle du service de synthese vocale ; meme effet que l'absence d'endpoint",
    ['supabase/functions/jarvis-tts/index.ts'], { secret: true }),
  e('OPENPULSE_INSTALLATION_CODE', 'bord', 'requis', ['minimal', 'complet'], '', 'demarrage',
    "le code d'installation qui autorise la creation du premier administrateur ; absent, l'instance reste sans administrateur possible",
    ['supabase/functions/bootstrap-admin/index.ts:108', 'scripts/installer.sh:151',
     'docker/docker-compose.openpulse.yml'],
    { secret: true }),
  // Le nom courant de la liste d'origines des fonctions de bord. L'ancien,
  // CORS_ALLOWED_ORIGINS, reste lu en second recours. Absente, le partage
  // retombe sur les origines de developpement : en production, le frontend de
  // l'exploitant est refuse par le navigateur, avec pour seule trace un
  // message de console -- d'ou le niveau « silence ».
  e('OPENPULSE_ORIGINES_AUTORISEES', 'bord', 'requis', ['minimal', 'complet'], '', 'silence',
    "les origines autorisees a appeler les fonctions de bord ; absente, seules les origines de developpement passent et votre frontend est refuse",
    ['supabase/functions/_shared/cors.ts'], { valide: { type: 'origines' } }),

  e('CORS_ALLOWED_ORIGINS', 'bord', 'requis', ['minimal', 'complet'], '', 'silence',
    "l'autorisation du navigateur a appeler les fonctions ; absente, le code repliait sur une liste d'origines codees en dur appartenant a l'editeur et votre frontend etait refuse, avec pour seule trace la console",
    ['supabase/functions/_shared/cors.ts'], { valide: { type: 'origines' } }),
  e('PUBLIC_APP_URL', 'bord', 'requis', ['complet'], '', 'silence',
    "les liens envoyes par courriel par 4 fonctions (enquetes, relances, transferts) ; absente, l'amont fabriquait des liens vers un domaine de l'editeur",
    ['supabase/functions/send-enquete/index.ts:142', 'supabase/functions/relance-enquetes/index.ts:36',
     'supabase/functions/dpi-enquete-api/index.ts:125', 'supabase/functions/create-email-transfer/index.ts:32'],
    { valide: { type: 'url' } }),
  e('APP_URL', 'bord', 'requis', ['complet'], '', 'silence',
    "les liens des notifications de partage de document ; second nom du precedent, meme valeur, meme fuite si absent",
    ['supabase/functions/notify-document-shared/index.ts:198'], { valide: { type: 'url' } }),
  e('INTERNAL_FUNCTION_SECRET', 'bord', 'requis', ['complet'], '', 'silence',
    "l'authentification des appels internes entre 23 fonctions ; absent, ce chemin n'authentifie jamais et les declencheurs recoivent 401 sans trace autre qu'un journal",
    ['supabase/functions/_shared/auth-helpers.ts:42'], { secret: true, valide: { type: 'secret', min: 32 } }),
  e('CRON_SECRET', 'bord', 'requis', ['complet'], '', 'silence',
    "les 11 taches planifiees ; absent, la comparaison a temps constant compare deux chaines vides, renvoie faux, et chaque tache repond 401 : rappels, relances et synchronisations ne partent jamais",
    ['supabase/functions/daily-task-reminder/index.ts:56'], { secret: true, valide: { type: 'secret', min: 32 } }),
  e('INTERNAL_INVOCATION_SECRET', 'bord', 'requis', ['complet'], '', 'silence',
    'le second nom du secret de declenchement interne, utilise par 2 fonctions planifiees ; meme consequence silencieuse',
    ['supabase/functions/daily-task-reminder/index.ts:57'], { secret: true, valide: { type: 'secret', min: 32 } }),
  e('EMAIL_ENCRYPTION_KEY', 'bord', 'requis', ['minimal', 'complet'], '', 'silence',
    "le chiffrement des identifiants de messagerie de 14 fonctions ET le sel de pseudonymisation du module de conformite, ou le repli litteral 'salt' rend les pseudonymes reproductibles par quiconque lit le code",
    ['supabase/functions/forward-email/index.ts:299', 'supabase/functions/rgpd-anonymize/index.ts:117',
     'supabase/functions/social-sync/index.ts:12'], { secret: true, valide: { type: 'secret', min: 32 } }),
  e('EMAIL_TRACKING_HMAC_SECRET', 'bord', 'option', [], '', 'fonctionnalite',
    "la signature des liens de suivi de lecture ; absent, la fonction repond 500 et les liens sont morts, ce qui est le comportement sur",
    ['supabase/functions/track-email-click/index.ts:77'], { secret: true, valide: { type: 'secret', min: 32 } }),
  e('IP_VALIDATOR_SECRET', 'bord', 'option', [], '', 'fonctionnalite',
    "la protection de la validation d'adresse IP ; absent avec la liste blanche activee, tous les appels sont refuses",
    ['supabase/functions/ip-validator/index.ts:126'], { secret: true }),
  e('SUPABASE_JWT_SECRET', 'bord', 'option', [], '', 'fonctionnalite',
    "le repli de signature du point d'entree OAuth de l'application, si vous ne reutilisez pas JWT_SECRET",
    ['supabase/functions/oauth-token/index.ts:25'], { secret: true }),
];

// ---------------------------------------------------------------------------
// 4. Fonctions de bord — integrations, forme compacte
//    [nom, absence, debloque, lu, options?]
// ---------------------------------------------------------------------------
const INTEGRATIONS = [
  // Modeles de langage
  ['AZURE_OPENAI_ENDPOINT', 'fonctionnalite', "les 51 fonctions d'IA ; absent avec les deux replis absents, chacune leve 'fournisseur non configure' (erreur visible)", ['supabase/functions/_shared/azure-gpt5-mini.ts:56'], { valide: { type: 'url' } }],
  ['AZURE_OPENAI_API_KEY', 'fonctionnalite', "l'authentification du modele principal, utilise par 52 fonctions", ['supabase/functions/_shared/azure-gpt5-mini.ts:57'], { secret: true }],
  ['AZURE_OPENAI_ENDPOINT_FALLBACK', 'fonctionnalite', 'le deploiement de secours sonde par la verification de sante', ['supabase/functions/jarvis-health-check/index.ts:283']],
  ['AZURE_OPENAI_API_KEY_FALLBACK', 'fonctionnalite', 'le deploiement de secours', ['supabase/functions/jarvis-health-check/index.ts:284'], { secret: true }],
  ['AZURE_GPT5_MINI_ENDPOINT', 'silence', "le premier repli economique de la chaine ; absent, la chaine passe au repli suivant, plus couteux par appel, sans aucun avertissement", ['supabase/functions/_shared/azure-gpt5-mini.ts:44']],
  ['AZURE_GPT5_MINI_API_KEY', 'silence', 'le premier repli economique', ['supabase/functions/_shared/azure-gpt5-mini.ts:45'], { secret: true }],
  ['AZURE_GPT52_ENDPOINT', 'fonctionnalite', 'le deuxieme repli de la chaine de modeles', ['supabase/functions/_shared/azure-gpt5-mini.ts:62']],
  ['AZURE_GPT52_API_KEY', 'fonctionnalite', 'le deuxieme repli de la chaine', ['supabase/functions/_shared/azure-gpt5-mini.ts:63'], { secret: true }],
  ['AZURE_EMBEDDING_ENDPOINT', 'silence', "la vectorisation des documents ; absent, l'indexation ne produit aucun vecteur et la recherche semantique ne renvoie jamais de resultat, sans erreur", ['supabase/functions/jarvis-generate-embedding/index.ts:43']],
  ['AZURE_TRANSCRIBE_ENDPOINT', 'fonctionnalite', "la transcription audio ; absent, le pipeline de comptes rendus s'arrete apres l'envoi du fichier", ['supabase/functions/meeting-notes-process/index.ts:76']],
  ['AZURE_TRANSCRIBE_API_KEY', 'fonctionnalite', 'la transcription audio', ['supabase/functions/meeting-notes-process/index.ts:77'], { secret: true }],
  ['AZURE_IMAGE_ENDPOINT', 'fonctionnalite', "la generation d'images", ['supabase/functions/generate-image/index.ts:50']],
  ['AZURE_IMAGE_API_KEY', 'fonctionnalite', "la generation d'images", ['supabase/functions/generate-image/index.ts:51'], { secret: true }],
  ['AZURE_IMAGE_DEPLOYMENT', 'fonctionnalite', "le nom du deploiement de generation d'images", ['supabase/functions/generate-image/index.ts:52']],
  ['OPENAI_API_KEY', 'fonctionnalite', 'la transcription directe par la fonction dediee ; absente, elle repond 500', ['supabase/functions/transcribe-audio/index.ts:60'], { secret: true }],
  ['BRAVE_SEARCH_API_KEY', 'fonctionnalite', "l'outil de recherche web de l'assistant", ['supabase/functions/jarvis-brain/tools/web-search-tools.ts:51'], { secret: true }],

  // Courriel sortant et notifications
  ['RESEND_API_KEY', 'silence', "l'envoi reel de courriel par 11 fonctions ; absente, elles ne echouent PAS : elles journalisent 'envoi ignore' et renvoient success:true, l'interface confirmant un envoi qui n'a jamais eu lieu", ['supabase/functions/send-transcription-email/index.ts:155', 'supabase/functions/notify-document-shared/index.ts:101', 'supabase/functions/booking-notify/index.ts:252'], { secret: true }],
  ['VAPID_PUBLIC_KEY', 'fonctionnalite', "les notifications navigateur ; absente, la fonction leve 'cles VAPID non configurees'", ['supabase/functions/send-push-notification/index.ts:81']],
  ['VAPID_PRIVATE_KEY', 'fonctionnalite', 'les notifications navigateur', ['supabase/functions/send-push-notification/index.ts:82'], { secret: true }],
  ['VAPID_SUBJECT', 'silence', "le contact VAPID ET le sel du hachage des adresses IP dans la fonction de telechargement de transfert, ou le repli litteral 'salt' rend le hachage reversible", ['supabase/functions/send-push-notification/index.ts:83', 'supabase/functions/download-email-transfer/index.ts:40'], { valide: { type: 'mailto' } }],
  ['STALWART_ADMIN_PASSWORD', 'fonctionnalite', "l'administration du serveur de messagerie interne, requis seulement si vous montez ce service", ['docker/docker-compose.dev.yml'], { secret: true }],
  ['STALWART_URL', 'fonctionnalite', 'la migration et la synchronisation JMAP ; absente, repli sur le nom de service interne, correct dans le compose fourni', ['supabase/functions/migrate-to-jmap/index.ts:45']],

  // Documents et bureautique
  ['NEXTCLOUD_URL', 'fonctionnalite', "les 4 fonctions de fichiers WebDAV ; absente, l'onglet correspondant reste vide", ['supabase/functions/nextcloud-files/index.ts:41'], { valide: { type: 'url' } }],
  ['NEXTCLOUD_USERNAME', 'fonctionnalite', 'le compte de service du serveur de fichiers', ['supabase/functions/nextcloud-files/index.ts:42']],
  ['NEXTCLOUD_APP_PASSWORD', 'fonctionnalite', "le mot de passe d'application du compte de service", ['supabase/functions/nextcloud-files/index.ts:43'], { secret: true }],
  ['NEXTCLOUD_BASE_FOLDER', 'silence', "le dossier racine des documents ; absent, la racine du compte est utilisee et les documents applicatifs se melangent aux fichiers personnels", ['supabase/functions/nextcloud-files/index.ts:44']],
  ['ONLYOFFICE_DOCUMENT_SERVER_URL', 'fonctionnalite', "l'edition collaborative de documents", ['supabase/functions/onlyoffice-token/index.ts:20'], { valide: { type: 'url' } }],
  ['ONLYOFFICE_JWT_SECRET', 'fonctionnalite', "la confiance entre l'application et le serveur d'edition", ['supabase/functions/onlyoffice-token/index.ts:19'], { secret: true }],
  ['ONLYOFFICE_DOCSPACE_URL', 'fonctionnalite', "l'espace documentaire heberge", ['supabase/functions/docspace-upload/index.ts:24']],
  ['ONLYOFFICE_API_KEY', 'fonctionnalite', "la cle de l'espace documentaire", ['supabase/functions/docspace-upload/index.ts:25'], { secret: true }],

  // Signature electronique
  ['DOCUSEAL_API_KEY', 'fonctionnalite', 'les 4 fonctions de signature electronique', ['supabase/functions/signature-cancel/index.ts:22'], { secret: true }],
  ['DOCUSEAL_WEBHOOK_SECRET', 'silence', "la verification des rappels du service de signature ; absent, un rappel non signe peut declarer un document signe", ['supabase/functions/docuseal-webhook/index.ts:38'], { secret: true }],

  // Banque et comptabilite
  ['QONTO_API_KEY', 'fonctionnalite', 'la synchronisation des operations bancaires ; absente, le module tresorerie reste vide', ['supabase/functions/qonto-get-client-invoices/index.ts:44'], { secret: true }],
  ['QONTO_ORGANIZATION_ID', 'fonctionnalite', "l'identification de l'organisation bancaire", ['supabase/functions/qonto-get-client-invoices/index.ts:45']],
  ['QONTO_CLIENT_ID', 'fonctionnalite', 'le raccordement bancaire delegue', ['supabase/functions/qonto-auth/index.ts:50']],
  ['QONTO_CLIENT_SECRET', 'fonctionnalite', 'le raccordement bancaire delegue', ['supabase/functions/qonto-auth/index.ts:51'], { secret: true }],
  ['QONTO_REDIRECT_URI', 'fonctionnalite', "le retour d'autorisation bancaire", ['supabase/functions/qonto-auth/index.ts:52']],
  ['QONTO_ENCRYPTION_KEY', 'silence', "le chiffrement des jetons bancaires en base ; absente, ils sont conserves en clair", ['supabase/functions/qonto-auth/index.ts:111'], { secret: true }],
  ['QONTO_WEBHOOK_SECRET', 'silence', 'la verification des rappels bancaires', ['supabase/functions/qonto-webhook-handler/index.ts:26'], { secret: true }],
  ['CHORUS_PRO_CLIENT_ID', 'fonctionnalite', 'la transmission des factures au secteur public', ['supabase/functions/compta-chorus-pro-submit/index.ts:56']],
  ['CHORUS_PRO_CLIENT_SECRET', 'fonctionnalite', 'la transmission des factures au secteur public', ['supabase/functions/compta-chorus-pro-submit/index.ts:57'], { secret: true }],
  ['CHORUS_PRO_LOGIN', 'fonctionnalite', 'le compte de transmission des factures publiques', ['supabase/functions/compta-chorus-pro-submit/index.ts:58']],
  ['CHORUS_PRO_PASSWORD', 'fonctionnalite', 'le compte de transmission des factures publiques', ['supabase/functions/compta-chorus-pro-submit/index.ts:59'], { secret: true }],

  // Identites tierces et reseaux sociaux
  ['GOOGLE_CLIENT_ID', 'fonctionnalite', "le raccordement de l'agenda et de la visioconference externes", ['supabase/functions/oauth-google-init/index.ts:23']],
  ['GOOGLE_CLIENT_SECRET', 'fonctionnalite', 'le raccordement des services externes', ['supabase/functions/oauth-google-refresh/index.ts:20'], { secret: true }],
  ['GOOGLE_REFRESH_TOKEN', 'fonctionnalite', 'la creation automatique de liens de reunion par un compte de service', ['supabase/functions/create-google-meet-link/index.ts:30'], { secret: true }],
  ['GOOGLE_TOKEN_ENCRYPTION_KEY', 'silence', "le chiffrement dedie des jetons externes ; absente, le code repliait sur la cle de role de service comme matiere de chiffrement, pour le dechiffrement seulement, et tout nouveau chiffrement echoue", ['supabase/functions/_shared/google-token-crypto.ts:16'], { secret: true, valide: { type: 'secret', min: 32 } }],
  ['OAUTH_STATE_SECRET', 'silence', "la signature de l'etat OAuth ; absent, l'echange est expose au rejeu d'etat", ['supabase/functions/oauth-google-init/index.ts:58'], { secret: true, valide: { type: 'secret', min: 32 } }],
  ['LINKEDIN_CLIENT_ID', 'fonctionnalite', 'la publication sur le reseau professionnel', ['supabase/functions/social-oauth-callback/index.ts:38']],
  ['LINKEDIN_CLIENT_SECRET', 'fonctionnalite', 'la publication sur le reseau professionnel', ['supabase/functions/social-oauth-callback/index.ts:39'], { secret: true }],
  ['META_APP_ID', 'fonctionnalite', 'la publication sur les reseaux sociaux grand public', ['supabase/functions/social-oauth-callback/index.ts:23']],
  ['META_APP_SECRET', 'fonctionnalite', 'la publication sur les reseaux sociaux grand public', ['supabase/functions/social-oauth-callback/index.ts:24'], { secret: true }],
  ['TIKTOK_CLIENT_KEY', 'fonctionnalite', 'la publication video courte', ['supabase/functions/social-oauth-callback/index.ts:52']],
  ['TIKTOK_CLIENT_SECRET', 'fonctionnalite', 'la publication video courte', ['supabase/functions/social-oauth-callback/index.ts:53'], { secret: true }],

  // Messagerie instantanee et telephonie
  ['SLACK_WEBHOOK_URL', 'silence', "le canal de messagerie d'equipe de l'assistant ; absent, le canal est ignore en silence", ['supabase/functions/jarvis-multi-channel/index.ts:106'], { secret: true }],
  ['TEAMS_WEBHOOK_URL', 'silence', "le canal collaboratif de l'assistant ; absent, le canal est ignore en silence", ['supabase/functions/jarvis-multi-channel/index.ts:107'], { secret: true }],
  ['WHATSAPP_TOKEN', 'silence', "le canal de messagerie mobile de l'assistant", ['supabase/functions/jarvis-multi-channel/index.ts:108'], { secret: true }],
  ['WHATSAPP_PHONE_NUMBER_ID', 'silence', "le numero emetteur du canal mobile", ['supabase/functions/jarvis-multi-channel/index.ts:286']],
  ['TWILIO_ACCOUNT_SID', 'silence', 'le canal SMS et voix', ['supabase/functions/jarvis-multi-channel/index.ts:105']],
  ['TWILIO_AUTH_TOKEN', 'silence', 'le canal SMS et voix', ['supabase/functions/jarvis-multi-channel/index.ts:148'], { secret: true }],
  ['TWILIO_PHONE_NUMBER', 'silence', 'le numero emetteur SMS et voix', ['supabase/functions/jarvis-multi-channel/index.ts:149']],

  // API sortante vers vos propres produits
  ['PLATFORM_SSO_JWT_SECRET', 'fonctionnalite', "l'emission de jetons d'authentification unique vers un produit partenaire ; absent, la fonction leve 'non configure'", ['supabase/functions/_shared/platform-auth.ts:164'], { secret: true, valide: { type: 'secret', min: 32 } }],
  ['PRODUCT_API_URL', 'fonctionnalite', 'la cible des provisions de clients vers un produit partenaire', ['supabase/functions/platform-sso-issue/index.ts:112']],
  ['PRODUCT_WEBHOOK_SECRET', 'silence', 'la signature des rappels envoyes au produit partenaire', ['supabase/functions/provision-client-on-production/index.ts:209'], { secret: true }],
];

const BORD_INTEGRATIONS = INTEGRATIONS.map(([nom, absence, debloque, lu, extra = {}]) =>
  e(nom, 'bord', 'option', [], '', absence, debloque, lu, extra));

// ---------------------------------------------------------------------------
// 5. Services HTTP
// ---------------------------------------------------------------------------
/** Fabrique les entrees communes aux quatre services HTTP. */
function service(prefixe, libelle, extras = []) {
  const cfg = {
    DRIVE: 'services/openpulse-gestion-drive-api/app/config.py',
    EMAIL: 'services/openpulse-email-api/app/config.py',
    MEETINGS: 'services/openpulse-meetings-api/app/config.py',
    PULSE: 'services/openpulse-pulse-api/app/config.py',
  }[prefixe];
  const l = { DRIVE: [11, 27, 34, 35, 36, 47], EMAIL: [11, 17, 13, 19, 20, 22], MEETINGS: [11, 26, 27, 28, 29, 31], PULSE: [11, 17, 18, 19, 20, 22] }[prefixe];
  return [
    e(`${prefixe}_ENV`, 'service', 'requis', ['minimal', 'complet'], 'prod', 'silence',
      `la validation de configuration du service ${libelle} : elle ne s'execute QUE si la valeur vaut prod. Toute autre valeur laisse le service demarrer sans authentification, sans stockage reel et avec un depot en memoire, sans le moindre avertissement`,
      [`${cfg}:${l[0]}`], { valide: { type: 'enum', valeurs: ['dev', 'staging', 'prod', 'production'] } }),
    e(`${prefixe}_AUTH_MODE`, 'service', 'requis', ['minimal', 'complet'], 'jwt', 'silence',
      `l'authentification du service ${libelle} ; la valeur disabled ouvre l'API a tous et n'est refusee qu'en environnement prod`,
      [`${cfg}:${l[1]}`], { valide: { type: 'enum', valeurs: ['disabled', 'jwt'] } }),
    e(`${prefixe}_JWT_SECRET`, 'service', 'conditif', ['complet'], '', 'demarrage',
      `la verification des jetons du service ${libelle} ; en mode jwt le service refuse de demarrer sans lui`,
      [`${cfg}:${l[2]}`],
      { secret: true, valide: { type: 'secret', min: 32 },
        requisSi: (v) => String(v[`${prefixe}_AUTH_MODE`] ?? '').toLowerCase() === 'jwt' }),
    e(`${prefixe}_JWT_ISSUER`, 'service', 'conditif', ['complet'], 'openpulse', 'demarrage',
      `l'emetteur attendu des jetons du service ${libelle} ; exige avec le secret et l'audience en mode jwt`,
      [`${cfg}:${l[3]}`],
      { requisSi: (v) => String(v[`${prefixe}_AUTH_MODE`] ?? '').toLowerCase() === 'jwt' }),
    e(`${prefixe}_JWT_AUDIENCE`, 'service', 'conditif', ['complet'], `openpulse-${libelle.toLowerCase()}-api`, 'demarrage',
      `l'audience attendue des jetons du service ${libelle}`,
      [`${cfg}:${l[4]}`],
      { requisSi: (v) => String(v[`${prefixe}_AUTH_MODE`] ?? '').toLowerCase() === 'jwt' }),
    e(`${prefixe}_CORS_ORIGINS`, 'service', 'requis', ['complet'], '', 'silence',
      `les origines autorisees a appeler le service ${libelle} ; absente, le repli est le seul poste de developpement local et votre frontend est refuse par le navigateur`,
      [`${cfg}:${l[5]}`], { valide: { type: 'origines' } }),
    ...extras,
  ];
}

const SERVICES = [
  ...service('DRIVE', 'Drive', [
    e('DRIVE_REQUIRE_MFA', 'service', 'requis', ['complet'], 'true', 'silence',
      "l'exigence d'une session a second facteur pour ouvrir le Drive ; passer a false retire cette protection sans que rien ne le signale dans l'interface",
      ['services/openpulse-gestion-drive-api/app/config.py:33'], { valide: { type: 'booleen' } }),
    e('DRIVE_APP_SECRET', 'service', 'requis', ['complet'], '', 'demarrage',
      "la signature des jetons d'envoi de fichier ; la validation refuse de demarrer si la valeur fait moins de 32 caracteres ou vaut la valeur de developpement",
      ['services/openpulse-gestion-drive-api/app/config.py:39'], { secret: true, valide: { type: 'secret', min: 32 } }),
    e('DRIVE_JWT_TTL_SECONDS', 'service', 'option', [], '3600', 'demarrage',
      "la duree de vie du jeton d'acces Drive ; hors de l'intervalle 900 a 86400 la validation refuse de demarrer",
      ['services/openpulse-gestion-drive-api/app/config.py:37'], { valide: { type: 'entier', min: 900, max: 86400 } }),
    e('DESKTOP_REFRESH_TTL_SECONDS', 'service', 'option', [], '2592000', 'demarrage',
      "la duree de vie du jeton de renouvellement du client de bureau ; hors de l'intervalle 1 a 90 jours la validation refuse de demarrer",
      ['services/openpulse-gestion-drive-api/app/config.py:38'], { valide: { type: 'entier', min: 86400, max: 7776000 } }),
    e('AZURE_STORAGE_CONNECTION_STRING', 'service', 'requis', ['complet'], '', 'silence',
      "le stockage reel des fichiers du Drive et des enregistrements de reunion ; VIDE, les URL signees sont factices : l'envoi semble reussir et aucun octet n'est ecrit",
      ['services/openpulse-gestion-drive-api/app/config.py:18', 'services/openpulse-meetings-api/app/config.py:18'],
      { secret: true }),
    e('AZURE_STORAGE_ACCOUNT_KEY', 'service', 'conditif', [], '', 'silence',
      "la seconde moitie de la variante en deux morceaux du stockage des services ; sans elle, AZURE_STORAGE_ACCOUNT seul ne suffit pas et les URL signees restent factices",
      ['scripts/check-env.mjs'], { secret: true }),
    e('AZURE_STORAGE_ACCOUNT', 'service', 'conditif', [], '', 'silence',
      'la variante en deux morceaux du stockage des services, a completer par AZURE_STORAGE_ACCOUNT_KEY ; l ancienne variable homonyme de la pile plateforme a ete retiree, elle n avait plus de consommateur',
      ['services/openpulse-gestion-drive-api/app/config.py:19', 'services/openpulse-meetings-api/app/config.py:19']),
    e('DRIVE_BLOB_CONTAINER_FILES', 'service', 'option', [], 'openpulse-drive-files', 'fonctionnalite',
      'le conteneur de stockage des fichiers du Drive',
      ['services/openpulse-gestion-drive-api/app/config.py:22']),
    e('DRIVE_BLOB_CONTAINER_VERSIONS', 'service', 'option', [], 'openpulse-drive-versions', 'fonctionnalite',
      'le conteneur de stockage des versions de fichiers',
      ['services/openpulse-gestion-drive-api/app/config.py:23']),
    e('DRIVE_SAS_TTL_MINUTES', 'service', 'option', [], '15', 'fonctionnalite',
      "la duree de vie des URL signees d'acces aux fichiers",
      ['services/openpulse-gestion-drive-api/app/config.py:24'], { valide: { type: 'entier', min: 1, max: 1440 } }),
  ]),
  ...service('EMAIL', 'Email'),
  ...service('MEETINGS', 'Meetings', [
    e('MEETINGS_BLOB_CONTAINER_RECORDINGS', 'service', 'option', [], 'openpulse-meetings-recordings', 'fonctionnalite',
      'le conteneur de stockage des enregistrements de reunion',
      ['services/openpulse-meetings-api/app/config.py:22']),
    e('MEETINGS_SAS_TTL_MINUTES', 'service', 'option', [], '30', 'fonctionnalite',
      "la duree de vie des URL signees d'envoi d'enregistrement",
      ['services/openpulse-meetings-api/app/config.py:23'], { valide: { type: 'entier', min: 1, max: 1440 } }),
  ]),
  ...service('PULSE', 'Pulse'),
];

export const REGISTRE = [...BUILD, ...PLATEFORME, ...BORD_SOCLE, ...BORD_INTEGRATIONS, ...SERVICES];

/**
 * Variables reservees a l'integration continue et aux tests. Presentes sur une
 * instance en service, elles n'ont aucun effet ; leur presence signale plutot
 * une confusion entre un poste de developpement et un serveur.
 */
export const CI_ET_TESTS = [
  'CI', 'E2E_BASE_URL', 'E2E_EMAIL', 'E2E_PASSWORD', 'E2E_PASSWORD_DEFAULT', 'E2E_ADMIN_EMAIL',
  'E2E_ADMIN_PASSWORD', 'E2E_ADMIN_TOTP_SECRET', 'E2E_SKIP_SETUP', 'PLAYWRIGHT_BASE_URL',
  'TEST_ACCOUNTS_PASSWORD', 'RUN_CRUD_E2E', 'RUN_RBAC_MATRIX', 'RUN_VISUAL', 'RUN_EDGE_IMPORT_TEST',
  'EDGE_TEST_SCENARIO', 'X_API_KEY_TEST', 'WEBDAV_TEST_TEMP_KEY', 'DRIVE_TEST_POSTGRES_URL',
  'VITEST_MAX_FORKS', 'VITEST_FORK_HEAP_MB', 'STRYKER_MODULE', 'CAP_SERVER_URL', 'EXPORT_DIR',
  'DB_HOST', 'DB_NAME', 'DB_USER', 'DB_PASSWORD', 'MINIO_ACCESS_KEY', 'MINIO_SECRET_KEY',
  'AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'SUPABASE_SERVICE_KEY', 'GITHUB_SHA', 'GITEA_SHA',
];

/**
 * Variables declarees par les modeles de configuration de l'amont mais lues par
 * aucun code livre. Les conserver serait un piege : un exploitant croirait
 * regler un comportement qui est en realite code en dur.
 * Chacune a ete verifiee : zero lecture dans src, supabase/functions, services,
 * apps, infra et scripts.
 */
export const OBSOLETES = [
  'SMTP_HOST', 'SMTP_PORT', 'SMTP_SECURE', 'SMTP_USER', 'SMTP_PASS', 'IMAP_HOST', 'IMAP_PORT',
  'SUPPORT_EMAIL', 'SUPPORT_EMAIL_PASSWORD', 'S3_ENDPOINT', 'S3_BUCKET', 'S3_REGION',
  'ENCRYPTION_KEY', 'CORS_ORIGIN', 'RATE_LIMIT_WINDOW_MS', 'RATE_LIMIT_MAX',
  'REDIS_HOST', 'REDIS_PORT', 'REDIS_PASSWORD', 'REDIS_URL', 'JWT_EXPIRES_IN',
  'REFRESH_TOKEN_EXPIRES_IN', 'SENTRY_DSN', 'GRAFANA_ADMIN_PASSWORD', 'SENTRY_SECRET_KEY',
  'SENTRY_DB_USER', 'SENTRY_DB_NAME', 'SENTRY_DB_PASSWORD', 'DEBUG', 'LOG_LEVEL',
  'SUPABASE_HOST', 'SUPABASE_PORT', 'VITE_API_URL', 'VITE_APP_ENV', 'VITE_PORT',
  'VITE_SUPABASE_PROJECT_ID',
];

export const INDEX = new Map(REGISTRE.map((v) => [v.nom, v]));
export const aides = { vrai, rempli, backendExterne, estProd };
