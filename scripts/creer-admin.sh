#!/usr/bin/env bash
# =====================================================================
# Création du premier compte administrateur d'une instance OpenPulse.
#
# POURQUOI CE SCRIPT EXISTE
# L'installateur renvoyait vers ce fichier, qui n'existait dans aucun commit :
# une instance fraîchement installée n'avait donc AUCUN moyen d'ouvrir une
# session. L'inscription libre est désactivée par défaut — c'est le bon défaut,
# mais il rend le premier compte impossible à créer depuis l'interface.
#
# Le compte est créé par l'API d'authentification avec la clé de service, puis
# le rôle « admin » lui est attribué en base. Le déclencheur on_auth_user_created
# ayant déjà créé son profil, ce script ne fait qu'ajouter le rôle.
#
# Usage : scripts/creer-admin.sh <adresse@exemple.org> [mot-de-passe]
#         Sans mot de passe, un mot de passe fort est engendré et affiché une
#         seule fois.
# =====================================================================
set -euo pipefail

RACINE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$RACINE"

ADRESSE="${1:-}"
if [ -z "$ADRESSE" ]; then
  echo "usage : scripts/creer-admin.sh <adresse@exemple.org> [mot-de-passe]" >&2
  exit 1
fi
case "$ADRESSE" in
  *@*.*) ;;
  *) echo "adresse invalide : $ADRESSE" >&2; exit 1 ;;
esac

if [ ! -f .env ]; then
  echo "fichier .env absent : lancez d'abord scripts/installer.sh" >&2
  exit 1
fi

# Lecture ciblée : on n'exporte pas tout le fichier de secrets dans l'environnement.
lire_env() { grep -m1 "^$1=" .env | cut -d= -f2- || true; }
SERVICE_ROLE_KEY="$(lire_env SERVICE_ROLE_KEY)"
API_PUBLIQUE="$(lire_env PUBLIC_API_URL)"
POSTGRES_DB="$(lire_env POSTGRES_DB)"
: "${POSTGRES_DB:=postgres}"
: "${API_PUBLIQUE:=http://localhost:8000}"

if [ -z "$SERVICE_ROLE_KEY" ]; then
  echo "SERVICE_ROLE_KEY absente de .env : installation incomplète." >&2
  exit 1
fi

MOT_DE_PASSE="${2:-}"
ENGENDRE=0
if [ -z "$MOT_DE_PASSE" ]; then
  MOT_DE_PASSE="$(openssl rand -base64 48 | tr -d '\n/+=' | head -c 24)"
  ENGENDRE=1
fi

COMPOSE="docker compose --env-file $RACINE/.env -f docker/docker-compose.openpulse.yml"

echo "== création du compte =="
REPONSE="$(curl -sS -X POST "$API_PUBLIQUE/auth/v1/admin/users" \
  -H "apikey: $SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$ADRESSE\",\"password\":\"$MOT_DE_PASSE\",\"email_confirm\":true}")"

IDENTIFIANT="$(printf '%s' "$REPONSE" | node -e '
  let d = ""; process.stdin.on("data", (c) => (d += c)).on("end", () => {
    try { const j = JSON.parse(d); process.stdout.write(j.id || "") } catch { process.stdout.write("") }
  })')"

# Reprise apres echec : si le compte existe deja — parce qu'une tentative
# precedente s'est arretee entre sa creation et l'attribution du role — on le
# retrouve plutot que d'obliger a repartir d'une autre adresse.
if [ -z "$IDENTIFIANT" ] && printf '%s' "$REPONSE" | grep -q 'email_exists'; then
  echo "  compte deja present : recuperation de son identifiant"
  IDENTIFIANT="$($COMPOSE exec -T db psql -U postgres -d "$POSTGRES_DB" -At -c \
    "SELECT user_id FROM public.profiles WHERE lower(email) = lower('$ADRESSE') LIMIT 1;" 2>/dev/null | tr -d '[:space:]')"
  if [ -n "$IDENTIFIANT" ]; then
    echo "  identifiant retrouve : $IDENTIFIANT"
    MOT_DE_PASSE=""
    ENGENDRE=0
  fi
fi

if [ -z "$IDENTIFIANT" ]; then
  echo "création refusée par le service d'authentification :" >&2
  printf '%s\n' "$REPONSE" | head -c 500 >&2
  echo >&2
  echo "Causes fréquentes : adresse déjà prise, service non démarré, mot de passe trop court." >&2
  exit 1
fi
echo "  compte créé : $IDENTIFIANT"

echo "== attribution du rôle admin =="
$COMPOSE exec -T db psql -U postgres -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 -q <<SQL
-- Le profil a déjà été créé par le déclencheur on_auth_user_created ; sans lui,
-- l'insertion du rôle échouerait sur la clé étrangère et signalerait que le
-- déclencheur n'a pas été posé.
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = '$IDENTIFIANT') THEN
    RAISE EXCEPTION 'aucun profil pour ce compte : le declencheur on_auth_user_created est absent (voir supabase/schema-02-auth-declencheurs.sql)';
  END IF;
END \$\$;

INSERT INTO public.user_roles (user_id, role)
VALUES ('$IDENTIFIANT', 'admin')
ON CONFLICT DO NOTHING;

DO \$\$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = '$IDENTIFIANT' AND role = 'admin') THEN
    RAISE EXCEPTION 'le role admin n''a pas ete attribue';
  END IF;
  RAISE NOTICE 'role admin attribue';
END \$\$;
SQL

echo "== dossiers de rangement des documents =="
# document_folders.owner_id est NOT NULL : ces dossiers ne peuvent pas etre
# crees par le schema, qui s'applique avant tout compte. Le declencheur de
# rangement sait s'en passer, mais un rangement par defaut vaut mieux qu'un
# depot en vrac.
$COMPOSE exec -T db psql -U postgres -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 -q <<SQL
INSERT INTO public.document_folders (id, name, owner_id, folder_type, is_restricted, position)
VALUES
  ('72008f57-d6e8-42e7-a950-6894525343ee', 'Autres documents', '$IDENTIFIANT', 'shared', false, 100),
  ('e3763f37-9f4d-49d0-8edc-66296122b280', 'Études',           '$IDENTIFIANT', 'shared', false, 101)
ON CONFLICT (id) DO NOTHING;
SQL
echo "  deux dossiers partagés créés"

echo
echo "== compte administrateur prêt =="
echo "  adresse : $ADRESSE"
if [ "$ENGENDRE" = "1" ]; then
  echo "  mot de passe : $MOT_DE_PASSE"
  echo
  echo "  Ce mot de passe n'est affiché qu'ici et n'est stocké nulle part."
  echo "  Changez-le à la première connexion."
fi
