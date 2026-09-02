#!/usr/bin/env bash
# =====================================================================
# Régénère le schéma initial consolidé d'OpenPulse.
#
# Pourquoi par exécution et non par relecture : le corpus historique de
# migrations n'est pas rejouable tel quel, et personne ne peut garantir à la
# lecture ce qu'il produit. On le rejoue donc réellement sur une base amorcée,
# puis on extrait le schéma obtenu. Le résultat décrit un état atteignable, pas
# une reconstruction théorique.
#
# Aucun accès à une base de production n'est requis, et aucun n'est souhaitable.
#
# Usage : regenerer.sh <chemin-du-corpus-de-migrations> [--garder-conteneur]
# =====================================================================
set -euo pipefail

CORPUS="${1:?chemin du corpus de migrations attendu}"
GARDER="${2:-}"
RACINE="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
CONTENEUR="openpulse-schema-$$"
IMAGE="postgres:15"

BOOTSTRAP="$RACINE/supabase/schema-00-bootstrap.sql"
CIBLE="$RACINE/supabase/migrations/00000000000000_initial_schema.sql"
NEUTRALISER="$RACINE/tools/openrelease/schema/neutraliser.py"

[ -d "$CORPUS" ] || { echo "corpus introuvable : $CORPUS" >&2; exit 1; }
[ -f "$BOOTSTRAP" ] || { echo "bootstrap introuvable : $BOOTSTRAP" >&2; exit 1; }

nettoyer() {
  if [ "$GARDER" != "--garder-conteneur" ]; then
    docker rm -f "$CONTENEUR" >/dev/null 2>&1 || true
  else
    echo "conteneur conservé : $CONTENEUR"
  fi
}
trap nettoyer EXIT

echo "== 1. base jetable =="
docker run -d --name "$CONTENEUR" -e POSTGRES_PASSWORD=postgres "$IMAGE" >/dev/null
for _ in $(seq 1 60); do
  docker exec "$CONTENEUR" pg_isready -U postgres >/dev/null 2>&1 && break
  sleep 1
done
docker exec "$CONTENEUR" pg_isready -U postgres >/dev/null 2>&1 || { echo "base indisponible" >&2; exit 1; }

echo "== 2. amorçage =="
docker exec -i "$CONTENEUR" psql -U postgres -v ON_ERROR_STOP=1 -q < "$BOOTSTRAP" 2>&1 \
  | grep -iE '^ERROR' && { echo "amorçage en échec" >&2; exit 1; } || true

echo "== 3. rejeu du corpus, tolérant, en ordre lexical =="
total=0; applique=0; echoue=0
for f in $(ls "$CORPUS"/*.sql | sort); do
  total=$((total + 1))
  if docker exec -i "$CONTENEUR" psql -U postgres -v ON_ERROR_STOP=1 -q < "$f" >/dev/null 2>&1; then
    applique=$((applique + 1))
  else
    echoue=$((echoue + 1))
  fi
done
echo "   $applique/$total appliquées, $echoue en échec"

# Une chute brutale du taux d'application signale une régression d'amorçage
# plutôt qu'une dette de migration : c'est ce qui s'était produit quand le
# bootstrap créait une table du schéma public avec une forme divergente.
seuil=$((total * 80 / 100))
if [ "$applique" -lt "$seuil" ]; then
  echo "ARRET : moins de 80% des migrations s'appliquent. L'amorçage est probablement en cause." >&2
  exit 1
fi

echo "== 4. extraction du schéma =="
docker exec "$CONTENEUR" pg_dump -U postgres --schema-only --no-owner --no-privileges \
  --schema=public > "$CIBLE.brut"

python3 - "$CIBLE.brut" "$CIBLE" <<'PY'
import re, sys
src, dst = sys.argv[1], sys.argv[2]
s = open(src, encoding='utf-8').read()
entete = """-- =====================================================================
-- OpenPulse — schéma initial consolidé.
--
-- Généré par tools/openrelease/schema/regenerer.sh. Ne pas éditer à la main.
--
-- Prérequis : supabase/schema-00-bootstrap.sql doit avoir été appliqué.
-- Ce fichier n'est PAS idempotent : il s'applique sur une base vierge.
-- =====================================================================

"""
s = re.sub(r'^CREATE SCHEMA public;$', '-- (schema public deja present)', s, flags=re.M)
s = re.sub(r'^COMMENT ON SCHEMA public IS .*;$', '', s, flags=re.M)
open(dst, 'w', encoding='utf-8').write(entete + s)
PY
rm -f "$CIBLE.brut"
echo "   $(wc -l < "$CIBLE") lignes"

echo "== 5. neutralisation =="
python3 "$NEUTRALISER" "$CIBLE"

echo "== 6. preuve : base vierge -> amorçage -> schéma =="
PREUVE="openpulse-preuve-$$"
docker rm -f "$PREUVE" >/dev/null 2>&1 || true
docker run -d --name "$PREUVE" -e POSTGRES_PASSWORD=postgres "$IMAGE" >/dev/null
for _ in $(seq 1 60); do docker exec "$PREUVE" pg_isready -U postgres >/dev/null 2>&1 && break; sleep 1; done
docker exec -i "$PREUVE" psql -U postgres -v ON_ERROR_STOP=1 -q < "$BOOTSTRAP" >/dev/null 2>&1
if docker exec -i "$PREUVE" psql -U postgres -v ON_ERROR_STOP=1 -q < "$CIBLE" >/dev/null 2>&1; then
  echo "   schéma appliqué sans erreur sur une base vierge"
  docker exec "$PREUVE" psql -U postgres -tA -c "
    SELECT '   tables    : ' || count(*) FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'
    UNION ALL SELECT '   policies  : ' || count(*) FROM pg_policies WHERE schemaname='public'
    UNION ALL SELECT '   RLS actif : ' || count(*) FROM pg_tables t JOIN pg_class c ON c.relname=t.tablename WHERE t.schemaname='public' AND c.relrowsecurity"
  docker rm -f "$PREUVE" >/dev/null 2>&1
else
  echo "   ECHEC : le schéma généré ne s'applique pas sur une base vierge" >&2
  docker rm -f "$PREUVE" >/dev/null 2>&1
  exit 1
fi

echo
echo "schéma régénéré : $CIBLE"
