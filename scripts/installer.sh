#!/usr/bin/env bash
# =====================================================================
# Installation d'une instance OpenPulse.
#
# Ce script fait ce qu'aucune documentation ne remplace : il génère les secrets
# propres à l'instance, vérifie que la base est vierge, applique l'amorçage puis
# le schéma, puis remet un lien privé pour créer le premier administrateur.
#
# Aucun secret n'est fourni par défaut, aucune valeur d'exemple n'est réutilisée
# telle quelle : chaque instance a ses propres clés, générées ici.
#
# Usage : scripts/installer.sh [--url https://mon-domaine] [--sans-frontend]
#                              [--verifier-seulement]
# =====================================================================
set -euo pipefail

RACINE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$RACINE"

# Ports par defaut. Ils ne sont retenus que s'ils sont libres : voir plus bas
# la recherche d'un port disponible, qui met AUSSI l'URL publique a jour.
PORT_WEB_DEMANDE=8080
PORT_API_DEMANDE=8000
URL_PUBLIQUE=""
API_PUBLIQUE=""
SANS_FRONTEND=0
VERIFIER_SEULEMENT=0

while [ $# -gt 0 ]; do
  case "$1" in
    --url) URL_PUBLIQUE="$2"; shift 2 ;;
    --api-url) API_PUBLIQUE="$2"; shift 2 ;;
    --sans-frontend) SANS_FRONTEND=1; shift ;;
    --verifier-seulement) VERIFIER_SEULEMENT=1; shift ;;
    *) echo "argument inconnu : $1" >&2; exit 1 ;;
  esac
done
# --- ports reellement disponibles -------------------------------------
#
# Les ports etaient ecrits en dur. Si l'un d'eux etait deja pris -- un autre
# service de developpement sur 8080, c'est courant -- l'installation echouait
# sur un message de Docker qui ne dit pas quoi faire :
#
#   Bind for 127.0.0.1:8080 failed: port is already allocated
#
# Pire : le port retenu doit rester coherent avec PUBLIC_URL, qui sert aussi
# a la politique d'origine de la passerelle. Un port change a la main sans
# mettre l'URL a jour donne une instance qui demarre et refuse toutes ses
# propres requetes -- une panne dont la cause ne ressemble pas au symptome.
#
# On cherche donc un port libre, et on ecrit celui qu'on a retenu.
port_libre() {
  port="$1"
  fin=$((port + 40))
  while [ "$port" -le "$fin" ]; do
    if ! (exec 3<>"/dev/tcp/127.0.0.1/$port") 2>/dev/null; then
      printf '%s' "$port"
      return 0
    fi
    exec 3>&- 2>/dev/null || true
    port=$((port + 1))
  done
  echo "aucun port libre entre $1 et $fin" >&2
  return 1
}

PORT_WEB="$(port_libre "$PORT_WEB_DEMANDE")"
PORT_API="$(port_libre "$PORT_API_DEMANDE")"

if [ "$PORT_WEB" != "$PORT_WEB_DEMANDE" ]; then
  echo "  port $PORT_WEB_DEMANDE occupe : l'interface sera servie sur $PORT_WEB"
fi
if [ "$PORT_API" != "$PORT_API_DEMANDE" ]; then
  echo "  port $PORT_API_DEMANDE occupe : l'API sera servie sur $PORT_API"
fi

# --url l'emporte : l'exploitant qui nomme son domaine sait ou il publie.
if [ -z "$URL_PUBLIQUE" ]; then
  URL_PUBLIQUE="http://localhost:$PORT_WEB"
fi

# Sans --api-url, l'URL d'API se DEDUIT de l'URL publique : « --url
# https://mon-domaine » seul construisait un frontend qui appelait
# http://localhost:8000, donc une application muette sur toute autre machine
# que celle qui l'a construite. Le port 8000 est celui que la passerelle expose
# par defaut ; --api-url reste la pour une topologie differente.
# Le port RETENU, pas une valeur en dur. La version precedente lisait
# `${API_PORT:-8000}` — une variable qui n'existe pas a ce stade, la recherche
# de port libre posant `PORT_API`. L'URL retombait donc toujours sur 8000, meme
# quand l'API ecoutait ailleurs.
#
# Mesure sur une installation depuis un clone frais, machine portant deja une
# instance : API_PORT=8001 dans le .env, et PUBLIC_API_URL=http://localhost:8000.
# La nouvelle instance aurait parle a l'API de l'ANCIENNE — pas une panne, un
# melange, ce qui est pire.
if [ -z "$API_PUBLIQUE" ]; then
  case "$URL_PUBLIQUE" in
    http://localhost*|http://127.0.0.1*) API_PUBLIQUE="http://localhost:${PORT_API}" ;;
    *) API_PUBLIQUE="$(node -e 'const u=new URL(process.argv[1]); u.port="'"${PORT_API}"'"; u.pathname="/"; process.stdout.write(u.origin)' "$URL_PUBLIQUE")" ;;
  esac
  echo "  URL d'API deduite : $API_PUBLIQUE (surchargeable avec --api-url)"
fi

ENV_FICHIER="$RACINE/.env"
# --env-file est explicite : avec -f docker/…, compose chercherait .env dans
# docker/ et non a la racine du depot.
# Empreinte du code construit, exigee par le script d'empreinte. Hors depot git
# — une archive telechargee, par exemple — on laisse l'exploitant la fournir.
OPENPULSE_GIT_SHA="${OPENPULSE_GIT_SHA:-$(git -C "$RACINE" rev-parse HEAD 2>/dev/null || true)}"
export OPENPULSE_GIT_SHA

COMPOSE="docker compose --env-file $RACINE/.env -f docker/docker-compose.openpulse.yml"

titre() { printf '\n== %s ==\n' "$1"; }
echec() { printf 'ECHEC : %s\n' "$1" >&2; exit 1; }

# --- 0. prérequis ------------------------------------------------------
titre "prérequis"
command -v docker >/dev/null 2>&1 || echec "docker est requis"
docker compose version >/dev/null 2>&1 || echec "docker compose (v2) est requis"
command -v node >/dev/null 2>&1 || echec "node 20+ est requis pour générer les clés"
command -v openssl >/dev/null 2>&1 || echec "openssl est requis pour générer les secrets"
echo "  docker  : $(docker version --format '{{.Server.Version}}')"
echo "  node    : $(node --version)"

if [ "$VERIFIER_SEULEMENT" = "1" ]; then
  echo
  echo "prérequis satisfaits."
  exit 0
fi

# --- 1. secrets d'instance --------------------------------------------
titre "secrets d'instance"
if [ -f "$ENV_FICHIER" ]; then
  echo "  $ENV_FICHIER existe déjà : conservé, aucun secret régénéré."
  echo "  (supprimez-le pour repartir de zéro, en sachant que la base"
  echo "   existante deviendra alors illisible)"
else
  JWT_SECRET="$(openssl rand -hex 32)"
  POSTGRES_PASSWORD="$(openssl rand -base64 48 | tr -d '\n/+=' | head -c 28)"
  AUTHENTICATOR_PASSWORD="$(openssl rand -base64 48 | tr -d '\n/+=' | head -c 28)"
  AUTH_ADMIN_PASSWORD="$(openssl rand -base64 48 | tr -d '\n/+=' | head -c 28)"
  STORAGE_ADMIN_PASSWORD="$(openssl rand -base64 48 | tr -d '\n/+=' | head -c 28)"
  REALTIME_ADMIN_PASSWORD="$(openssl rand -base64 48 | tr -d '\n/+=' | head -c 28)"
  # Le service temps reel impose deux longueurs exactes : 16 octets pour la
  # cle de chiffrement, 64 pour la base de derivation. Une valeur plus courte
  # le fait sortir au demarrage avec un message qui ne dit pas laquelle.
  REALTIME_ENC_KEY="$(openssl rand -base64 48 | tr -d '\n/+=' | head -c 16)"
  REALTIME_SECRET_KEY_BASE="$(openssl rand -base64 144 | tr -d '\n/+=' | head -c 64)"
  ENCRYPTION_KEY="$(openssl rand -hex 32)"
  OPENPULSE_INSTALLATION_CODE="$(openssl rand -base64 36 | tr -d '\n/+=' | head -c 24)"

  # Les clés anon et service_role sont des jetons signés par le secret de
  # l'instance : elles ne peuvent donc pas être copiées d'une autre instance.
  CLES="$(node scripts/generer-cles.mjs "$JWT_SECRET")"
  ANON_KEY="$(echo "$CLES" | sed -n '1p')"
  SERVICE_ROLE_KEY="$(echo "$CLES" | sed -n '2p')"

  umask 077
  cat > "$ENV_FICHIER" <<ENV
# Secrets de CETTE instance, générés le $(date -u +%Y-%m-%dT%H:%M:%SZ).
# Ne jamais versionner ce fichier. Ne jamais réutiliser ces valeurs ailleurs.

POSTGRES_DB=postgres
POSTGRES_PASSWORD=$POSTGRES_PASSWORD
AUTHENTICATOR_PASSWORD=$AUTHENTICATOR_PASSWORD
AUTH_ADMIN_PASSWORD=$AUTH_ADMIN_PASSWORD
STORAGE_ADMIN_PASSWORD=$STORAGE_ADMIN_PASSWORD
REALTIME_ADMIN_PASSWORD=$REALTIME_ADMIN_PASSWORD
REALTIME_ENC_KEY=$REALTIME_ENC_KEY
REALTIME_SECRET_KEY_BASE=$REALTIME_SECRET_KEY_BASE

JWT_SECRET=$JWT_SECRET
ANON_KEY=$ANON_KEY
SERVICE_ROLE_KEY=$SERVICE_ROLE_KEY
ENCRYPTION_KEY=$ENCRYPTION_KEY
OPENPULSE_INSTALLATION_CODE=$OPENPULSE_INSTALLATION_CODE

PUBLIC_URL=$URL_PUBLIQUE
PUBLIC_API_URL=$API_PUBLIQUE
# Les ports RETENUS, pas ceux demandes : sans cette persistance, un
# « docker compose up » ulterieur repartirait sur les valeurs par defaut et
# se heurterait de nouveau au port occupe.
API_PORT=$PORT_API
WEB_PORT=$PORT_WEB

# Nom de l'instance : prefixe des conteneurs, reseaux et volumes Docker. A ne
# changer que pour faire cohabiter plusieurs instances sur une meme machine.
# Deux instances qui partagent ce nom partagent aussi leur base : la seconde
# installation reprendrait la premiere au lieu d'en creer une nouvelle.
OPENPULSE_INSTANCE=${OPENPULSE_INSTANCE:-openpulse}

# Défauts sûrs. Les assouplir est une décision, pas un réglage.
DISABLE_SIGNUP=true
MAILER_AUTOCONFIRM=false
MFA_ENABLED=true
# Le moteur d'execution des fonctions verifie le jeton par defaut. Cette
# variable s'appelait FUNCTIONS_VERIFY_JWT, que la composition ne lit plus :
# la modifier n'avait donc aucun effet, et rien ne le disait.
VERIFY_JWT=true

BRAND_NAME=OpenPulse
ENV
  chmod 600 "$ENV_FICHIER"
  echo "  secrets générés dans $ENV_FICHIER (droits 600)"
fi

set -a
# shellcheck disable=SC1090
. "$ENV_FICHIER"
set +a

# --- 2. base de données ------------------------------------------------
titre "base de données"
$COMPOSE up -d db >/dev/null
for _ in $(seq 1 60); do
  $COMPOSE exec -T db pg_isready -U postgres >/dev/null 2>&1 && break
  sleep 1
done
$COMPOSE exec -T db pg_isready -U postgres >/dev/null 2>&1 || echec "la base n'a pas démarré"
echo "  base démarrée"

psql_() { $COMPOSE exec -T db psql -U postgres -d "${POSTGRES_DB:-postgres}" "$@"; }

# Les rôles sont créés sans mot de passe par l'amorçage : chaque service se
# connecte avec le sien, propre à l'instance.
configurer_roles() {
psql_ -v ON_ERROR_STOP=1 -q <<SQL
ALTER ROLE authenticator WITH LOGIN PASSWORD '${AUTHENTICATOR_PASSWORD}';
DO \$\$ BEGIN
  EXECUTE format('ALTER ROLE supabase_auth_admin WITH LOGIN PASSWORD %L', '${AUTH_ADMIN_PASSWORD}');
  EXECUTE format('ALTER ROLE supabase_storage_admin WITH LOGIN PASSWORD %L', '${STORAGE_ADMIN_PASSWORD}');
END \$\$;
-- Le service d'authentification applique ses propres migrations : il lui faut
-- son schema, et seulement son schema.
ALTER ROLE supabase_auth_admin SET search_path TO auth;
ALTER ROLE supabase_storage_admin SET search_path TO storage;
GRANT ALL ON SCHEMA auth TO supabase_auth_admin;
GRANT ALL ON ALL SEQUENCES IN SCHEMA auth TO supabase_auth_admin;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_auth_admin IN SCHEMA auth GRANT ALL ON TABLES TO supabase_auth_admin;
GRANT ALL ON ALL TABLES IN SCHEMA auth TO supabase_auth_admin;
-- Les services executent CREATE SCHEMA IF NOT EXISTS au demarrage, meme quand le
-- schema existe : cela exige le privilege CREATE sur la BASE, distinct de tout
-- droit sur le schema lui-meme. Sans lui, le service redemarre en boucle sur un
-- refus dont le message ne nomme pas l'objet.
GRANT CREATE ON DATABASE "${POSTGRES_DB:-postgres}" TO supabase_auth_admin, supabase_storage_admin;

-- Les services doivent POSSEDER leur schema, pas seulement y ecrire : ils y
-- appliquent des GRANT au demarrage, ce qui exige la propriete.
ALTER SCHEMA auth OWNER TO supabase_auth_admin;
ALTER SCHEMA storage OWNER TO supabase_storage_admin;
GRANT ALL ON SCHEMA storage TO supabase_storage_admin;
GRANT ALL ON ALL SEQUENCES IN SCHEMA storage TO supabase_storage_admin;
GRANT ALL ON ALL TABLES IN SCHEMA storage TO supabase_storage_admin;

-- Le service temps reel applique lui aussi ses migrations, dans le schema
-- _realtime qu'il cree seul. Il lit en outre le flux de replication logique :
-- l'attribut REPLICATION lui est indispensable, et ne peut pas etre remplace
-- par un GRANT.
DO \$\$ BEGIN
  EXECUTE format('ALTER ROLE supabase_admin WITH LOGIN REPLICATION PASSWORD %L', '${REALTIME_ADMIN_PASSWORD}');
END \$\$;
GRANT CREATE ON DATABASE "${POSTGRES_DB:-postgres}" TO supabase_admin;
-- Le service temps reel migre dans DEUX schemas, et doit etre proprietaire des
-- deux :
--   _realtime : sa configuration, ses locataires
--   realtime  : ses abonnements, ses types, ses fonctions
--
-- Le second manquait. Ses droits etaient poses par schema-10-temps-reel.sql,
-- qui s'applique APRES le schema applicatif -- soit longtemps apres le premier
-- demarrage du service. Celui-ci se connectait donc sans droit d'ecriture sur
-- le schema ou il doit migrer, et echouait des sa premiere migration. Mesure
-- sur une base vierge : has_schema_privilege('supabase_admin','realtime',
-- 'CREATE') rendait false a l'issue de l'amorcage.
CREATE SCHEMA IF NOT EXISTS _realtime;
ALTER SCHEMA _realtime OWNER TO supabase_admin;
GRANT ALL ON SCHEMA _realtime TO supabase_admin;

CREATE SCHEMA IF NOT EXISTS realtime;
ALTER SCHEMA realtime OWNER TO supabase_admin;
GRANT ALL ON SCHEMA realtime TO supabase_admin;
SQL
}

# Le schéma consolidé n'est pas idempotent : l'appliquer sur une base déjà
# peuplée produirait des milliers d'erreurs et un état incohérent.
TABLES="$(psql_ -tAc "SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'" | tr -d '[:space:]')"
if [ "$TABLES" != "0" ]; then
  echo "  la base contient déjà $TABLES tables : amorçage et schéma non réappliqués."
  echo "  (c'est le comportement attendu lors d'une réinstallation)"
else
  titre "amorçage"
  psql_ -v ON_ERROR_STOP=1 -q < supabase/schema-00-bootstrap.sql
  echo "  amorçage appliqué"

  # Les mots de passe des rôles de service doivent exister avant que les
  # services concernés démarrent.
  titre "mots de passe des rôles de service"
  configurer_roles
  echo "  rôles de service configurés"

  # L'authentification et le stockage sont propriétaires de leurs schémas : ils
  # doivent avoir migré avant que le schéma applicatif, qui porte des clés
  # étrangères vers auth.users, soit appliqué.
  titre "services propriétaires de leurs schémas"
  $COMPOSE up -d auth storage >/dev/null
  pret=0
  for _ in $(seq 1 60); do
    tables_auth="$(psql_ -tAc "SELECT count(*) FROM information_schema.tables WHERE table_schema='auth'" | tr -d '[:space:]')"
    if [ "${tables_auth:-0}" -ge 5 ]; then pret=1; break; fi
    sleep 2
  done
  [ "$pret" = "1" ] || echec "le service d'authentification n'a pas créé son schéma (voir: docker compose logs auth)"
  echo "  authentification : $(psql_ -tAc "SELECT count(*) FROM information_schema.tables WHERE table_schema='auth'" | tr -d '[:space:]') tables créées par le service"
  echo "  stockage         : $(psql_ -tAc "SELECT count(*) FROM information_schema.tables WHERE table_schema='storage'" | tr -d '[:space:]') tables"

  titre "schéma applicatif"
  psql_ -v ON_ERROR_STOP=1 -q < supabase/migrations/00000000000000_initial_schema.sql
  echo "  schéma appliqué"

  # Le corpus ne cree pas certaines colonnes : elles ont ete ajoutees hors
  # migration en production. Leur absence ne se voit qu'a l'usage, quand une
  # fonction les reference.
  titre "compléments de schéma"
  psql_ -v ON_ERROR_STOP=1 -q < supabase/schema-01-complements.sql
  echo "  colonnes absentes du corpus ajoutées"
  psql_ -v ON_ERROR_STOP=1 -q < supabase/schema-03-tables-absentes.sql
  echo "  tables absentes du corpus créées"

  # Le corpus ne contient aucun declencheur sur auth.users : il etait pose hors
  # migration cote plateforme hebergee. Sans lui, la creation d'un compte
  # reussit mais ne cree aucun profil, en silence.
  titre "déclencheurs d'authentification"
  psql_ -v ON_ERROR_STOP=1 -q < supabase/schema-02-auth-declencheurs.sql
  echo "  déclencheurs posés"

  # Le schema est extrait d'une base reelle : il porte les choix qui y ont ete
  # faits, dont une policy que rien ne restreignait.
  titre "durcissement"
  psql_ -v ON_ERROR_STOP=1 -q < supabase/schema-04-durcissement.sql
  echo "  policies laxistes corrigées"

  # Les vingt et un espaces de stockage ne sont crees par aucune migration : sur la
  # plateforme hebergee ils l'avaient ete a la main. Sans eux, le premier envoi
  # de fichier echoue sur « Bucket not found ». Applique ici, apres le demarrage
  # du service de stockage qui cree storage.buckets et storage.objects.
  titre "espaces de stockage"
  psql_ -v ON_ERROR_STOP=1 -q < supabase/schema-05-stockage.sql
  echo "  21 espaces créés, règles d'accès posées"

  # Un declencheur routait tout document sans dossier vers deux identifiants
  # ecrits en dur, que rien ne cree : AUCUN document ne pouvait etre depose sur
  # une instance neuve. Le declencheur resout desormais sa cible.
  titre "rangement des documents"
  psql_ -v ON_ERROR_STOP=1 -q < supabase/schema-06-dossiers-documents.sql
  echo "  déclencheur de rangement corrigé"
  psql_ -v ON_ERROR_STOP=1 -q < supabase/schema-07-documents-durcissement.sql
  echo "  documents orphelins fermés, historique des versions partagé"
  psql_ -v ON_ERROR_STOP=1 -q < supabase/schema-08-pages.sql
  echo "  pages rédigées activées, recherche sur le corps et sans accent"
  psql_ -v ON_ERROR_STOP=1 -q < supabase/schema-09-premier-administrateur.sql
  echo "  premier administrateur autorisé, porte dérobée retirée"
  psql_ -v ON_ERROR_STOP=1 -q < supabase/schema-10-bootstrap-instance.sql
  echo "  bootstrap administrateur atomique activé"
  # Temps reel : droits du service sur les schemas qu'il traverse, et
  # publication des tables que l'application ecoute. Le schema `realtime`
  # lui-meme est cree par le service, qui porte ses propres migrations : voir
  # l'en-tete « temps reel » de schema-00-bootstrap.sql.
  psql_ -v ON_ERROR_STOP=1 -q < supabase/schema-10-temps-reel.sql
  echo "  droits et publication du temps réel posés"
  # La cle de configuration des applications externes doit exister AVANT toute
  # ecriture : l'ecran de configuration met a jour la ligne, il ne la cree pas.
  psql_ -v ON_ERROR_STOP=1 -q < supabase/schema-11-applications-externes.sql
  echo "  applications externes : clé de configuration disponible"
  # Le module Notes est un tableau blanc collaboratif : sans ces six tables,
  # la page se charge et reste vide, sans erreur visible.
  psql_ -v ON_ERROR_STOP=1 -q < supabase/schema-12-tableau-blanc.sql
  echo "  tableau blanc : 6 tables, sécurité au niveau ligne posée"
fi


# --- le temps reel a-t-il reellement migre ? -----------------------------
#
# Cette verification ne peut PAS vivre dans un fichier de schema : a ce
# moment-la le service n'a pas encore tourne. Il applique ses migrations a la
# premiere connexion d'un locataire, pas au demarrage.
#
# Sans elle, l'installation se terminait sur un succes alors que le temps reel
# etait mort : la connexion websocket s'etablit, le canal passe a SUBSCRIBED --
# c'est le serveur de canaux qui repond, pas la base -- et aucun evenement
# n'arrive jamais. Rien, dans l'application, ne distingue cet etat d'une base ou
# il ne se passe simplement rien.
titre "temps réel"
if docker ps --format '{{.Names}}' 2>/dev/null | grep -q realtime; then
  # Le service migre a la premiere connexion : on lui laisse le temps de la voir.
  migrations=""
  for _ in $(seq 1 12); do
    migrations="$(psql_ -tAc \
      "SELECT count(*) FROM information_schema.tables WHERE table_schema='realtime' AND table_name='schema_migrations'" \
      2>/dev/null | tr -d '[:space:]')"
    [ "${migrations:-0}" = "1" ] && break
    sleep 5
  done

  if [ "${migrations:-0}" != "1" ]; then
    echo "  ATTENTION : le service temps réel n'a pas encore migré."
    echo "  Les mises à jour en direct seront muettes. L'application fonctionne"
    echo "  sans elles : les écrans se rafraîchissent au chargement."
  else
    appliquees="$(psql_ -tAc 'SELECT count(*) FROM realtime.schema_migrations' | tr -d '[:space:]')"
    liste="$(psql_ -tAc \
      "SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='realtime' AND p.proname='list_changes'" \
      | tr -d '[:space:]')"
    echo "  migrations du service : ${appliquees}"
    if [ "${liste:-0}" = "0" ]; then
      echo "  ATTENTION : realtime.list_changes est absente — les migrations sont bloquées."
      echo "  Voir les traces du service : docker logs <conteneur realtime>"
    else
      echo "  schéma complet, lecture du journal de transactions opérationnelle"
    fi
  fi
else
  echo "  service non démarré : vérification reportée au premier lancement"
fi

titre "état de la base"
psql_ -tA <<'SQL'
SELECT '  tables            : ' || count(*) FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE';
SELECT '  policies          : ' || count(*) FROM pg_policies WHERE schemaname='public';
SELECT '  tables avec RLS   : ' || count(*) FROM pg_tables t JOIN pg_class c ON c.relname=t.tablename WHERE t.schemaname='public' AND c.relrowsecurity;
SQL

# --- 3. configuration de la passerelle ---------------------------------
titre "passerelle"
# Kong ne substitue pas les variables de son fichier declaratif : on le genere.
# Piege classique de Docker : monter « ./kong/kong.yml » avant que le fichier
# existe fait creer un REPERTOIRE de ce nom. L'installation echoue alors sur
# « IsADirectoryError », et le message ne dit pas d'ou vient le repertoire.
if [ -d "$RACINE/docker/kong/kong.yml" ]; then
  rmdir "$RACINE/docker/kong/kong.yml" 2>/dev/null || {
    echo "docker/kong/kong.yml est un repertoire non vide : retirez-le puis relancez." >&2
    exit 1
  }
  echo "  repertoire kong.yml parasite retire (cree par un montage anterieur)"
fi

python3 - "$RACINE/docker/kong/kong.template.yml" "$RACINE/docker/kong/kong.yml" <<'PYK'
import os, sys, re
modele, sortie = sys.argv[1], sys.argv[2]
s = open(modele, encoding='utf-8').read()
manquantes = []
def remplacer(m):
    nom = m.group(1)
    val = os.environ.get(nom)
    if not val:
        manquantes.append(nom)
        return m.group(0)
    return val
s = re.sub(r'\$\{(\w+)\}', remplacer, s)
if manquantes:
    print('variables manquantes : ' + ', '.join(sorted(set(manquantes))), file=sys.stderr)
    sys.exit(1)
open(sortie, 'w', encoding='utf-8').write(s)
PYK
# Le fichier contient les deux clés de passerelle, mais Kong s'exécute avec un
# utilisateur non-root (UID 100, groupe nogroup) dans son conteneur. Un mode
# 600 hérité du `umask 077` rend le bind-mount illisible et provoque une boucle
# de redémarrage. Le répertoire reste contrôlé par l'opérateur ; seul le bit de
# lecture indispensable au processus conteneur est ajouté, jamais l'écriture.
chmod 604 "$RACINE/docker/kong/kong.yml"
echo "  configuration generee : docker/kong/kong.yml"

# --- 3. services -------------------------------------------------------
titre "services"
if [ "$SANS_FRONTEND" = "1" ]; then
  # Socle seul : base, API REST, authentification, stockage, passerelle.
  $COMPOSE up -d >/dev/null
  echo "  socle : base, API REST, authentification, stockage, passerelle"
else
  # Le profil applicatif ajoute les fonctions de bord et le frontend, qui
  # exigent le code applicatif.
  #
  # LE FRONTEND EST RECONSTRUIT, PAS SEULEMENT DEMARRE.
  # Les variables VITE_* sont figees DANS LE BUNDLE au moment de la
  # construction : l'URL de l'API, la cle publique, le nom du produit. Un
  # `up -d` reutilise une image existante sans la reconstruire, et l'instance
  # repart alors avec la configuration de l'installation precedente.
  #
  # Mesure sur une reinstallation apres changement de port : l'image portait
  # encore http://localhost:8000 dans son bundle alors que le .env disait 8001.
  # L'application se chargeait, et appelait l'API d'une AUTRE instance --
  # « Failed to fetch » a la connexion, sans que rien ne designe la cause.
  echo "  construction du frontend (les variables VITE_* y sont figees)…"
  $COMPOSE --profile applicatif build frontend >/dev/null
  $COMPOSE --profile applicatif up -d >/dev/null
  echo "  socle + fonctions de bord + frontend"
fi

titre "état des services"
$COMPOSE ps --format 'table {{.Service}}\t{{.Status}}' 2>/dev/null || $COMPOSE ps

cat <<FIN

Installation terminée.

  interface        : ${PUBLIC_URL}
  API              : ${PUBLIC_API_URL}
  secrets          : .env (droits 600, à sauvegarder hors de la machine)

Étapes suivantes :
  1. ouvrir ce lien privé pour créer le premier compte administrateur :
       ${PUBLIC_URL%/}/#installation=${OPENPULSE_INSTALLATION_CODE}
  2. aucun code n'est à recopier ; le lien devient inutilisable après création
     du premier administrateur.
  3. l'inscription libre est DESACTIVEE : les comptes suivants s'invitent
     depuis l'application ou se créent avec le même script ;
  4. vérifier l'installation :
       tools/openrelease/schema/verifier-installation.sh
FIN
