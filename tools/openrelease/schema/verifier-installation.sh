#!/usr/bin/env bash
# =====================================================================
# Vérifie qu'une base vierge devient une base OpenPulse exploitable.
#
# Ce script reproduit l'ORDRE REEL d'installation, service d'authentification
# compris. Ce n'est pas un détail : le schéma applicatif porte des clés
# étrangères vers auth.users, que seul ce service crée. Une version antérieure
# de ce script ne le lançait pas ; le schéma s'appliquait alors à moitié —
# toutes les tables, mais AUCUNE policy et AUCUNE sécurité au niveau ligne — et
# le script concluait malgré tout à une installation vérifiée.
#
# Usage : verifier-installation.sh [image-postgres]
# =====================================================================
set -uo pipefail

IMAGE="${1:-postgres:15}"
RACINE="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
SUFFIXE="$$"
DB="openpulse-verif-db-$SUFFIXE"
AUTH="openpulse-verif-auth-$SUFFIXE"
RESEAU="openpulse-verif-net-$SUFFIXE"
MDP_AUTH="verification"

nettoyer() {
  docker rm -f "$AUTH" "$DB" >/dev/null 2>&1
  docker network rm "$RESEAU" >/dev/null 2>&1
}
trap nettoyer EXIT

echec=0
verifier() {
  local libelle="$1" attendu="$2" obtenu="$3"
  if [ "${obtenu:-0}" -ge "$attendu" ]; then
    printf '  OK    %-32s %s (minimum %s)\n' "$libelle" "$obtenu" "$attendu"
  else
    printf '  ECHEC %-32s %s (minimum %s)\n' "$libelle" "${obtenu:-0}" "$attendu"
    echec=1
  fi
}
lire() { docker exec "$DB" psql -U postgres -tAc "$1" | tr -d '[:space:]'; }
appliquer() {
  local fichier="$1" libelle="$2"
  if erreurs=$(docker exec -i "$DB" psql -U postgres -v ON_ERROR_STOP=1 -q < "$fichier" 2>&1); then
    echo "  OK    $libelle"
  else
    echo "  ECHEC $libelle :" >&2
    echo "$erreurs" | grep -E '^ERROR' | head -4 >&2
    exit 1
  fi
}

echo "== base vierge, image $IMAGE =="
docker network create "$RESEAU" >/dev/null
docker run -d --name "$DB" --network "$RESEAU" -e POSTGRES_PASSWORD=postgres "$IMAGE" >/dev/null
for _ in $(seq 1 60); do docker exec "$DB" pg_isready -U postgres >/dev/null 2>&1 && break; sleep 1; done
docker exec "$DB" pg_isready -U postgres >/dev/null 2>&1 || { echo "base indisponible" >&2; exit 1; }
[ "$(lire "SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'")" = "0" ] \
  || { echo "la base n'est pas vierge" >&2; exit 1; }
echo "  base vierge confirmée"

echo
echo "== amorçage =="
appliquer "$RACINE/supabase/schema-00-bootstrap.sql" "amorçage appliqué"
docker exec -i "$DB" psql -U postgres -v ON_ERROR_STOP=1 -q >/dev/null 2>&1 <<SQL
ALTER ROLE supabase_auth_admin WITH LOGIN PASSWORD '$MDP_AUTH';
ALTER ROLE supabase_auth_admin SET search_path TO auth;
GRANT ALL ON SCHEMA auth TO supabase_auth_admin;
GRANT CREATE ON DATABASE postgres TO supabase_auth_admin;
ALTER SCHEMA auth OWNER TO supabase_auth_admin;
SQL

echo
echo "== service d'authentification : il crée le schéma dont dépend le reste =="
docker run -d --name "$AUTH" --network "$RESEAU" \
  -e GOTRUE_API_HOST=0.0.0.0 -e GOTRUE_API_PORT=9999 -e API_EXTERNAL_URL=http://localhost \
  -e GOTRUE_DB_DRIVER=postgres \
  -e "GOTRUE_DB_DATABASE_URL=postgres://supabase_auth_admin:$MDP_AUTH@$DB:5432/postgres?search_path=auth" \
  -e GOTRUE_SITE_URL=http://localhost \
  -e GOTRUE_JWT_SECRET=verificationverificationverification \
  supabase/gotrue:v2.170.0 >/dev/null
pret=0
for _ in $(seq 1 45); do
  [ "$(lire "SELECT count(*) FROM information_schema.tables WHERE table_schema='auth'")" -ge 5 ] && { pret=1; break; }
  sleep 2
done
[ "$pret" = "1" ] || { echo "  ECHEC le service n'a pas créé son schéma" >&2; docker logs "$AUTH" --tail 5 >&2; exit 1; }
echo "  OK    $(lire "SELECT count(*) FROM information_schema.tables WHERE table_schema='auth'") tables créées par le service"

echo
echo "== schéma applicatif =="
appliquer "$RACINE/supabase/migrations/00000000000000_initial_schema.sql" "schéma initial"
appliquer "$RACINE/supabase/schema-01-complements.sql" "compléments de colonnes"
appliquer "$RACINE/supabase/schema-03-tables-absentes.sql" "tables absentes du corpus"
appliquer "$RACINE/supabase/schema-02-auth-declencheurs.sql" "déclencheurs d'authentification"
appliquer "$RACINE/supabase/schema-04-durcissement.sql" "durcissement des policies"

echo
echo "== la base obtenue est-elle exploitable ? =="
verifier "tables"            440 "$(lire "SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'")"
verifier "policies"         1300 "$(lire "SELECT count(*) FROM pg_policies WHERE schemaname='public'")"
verifier "tables avec RLS"   430 "$(lire "SELECT count(*) FROM pg_tables t JOIN pg_class c ON c.relname=t.tablename WHERE t.schemaname='public' AND c.relrowsecurity")"
verifier "fonctions"         700 "$(lire "SELECT count(*) FROM information_schema.routines WHERE routine_schema='public'")"
verifier "index"            1200 "$(lire "SELECT count(*) FROM pg_indexes WHERE schemaname='public'")"
verifier "clés étrangères"   600 "$(lire "SELECT count(*) FROM information_schema.table_constraints WHERE constraint_schema='public' AND constraint_type='FOREIGN KEY'")"

echo
echo "== invariants =="
verifier "profiles.user_id présent" 1 "$(lire "SELECT count(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='user_id'")"
verifier "profiles.is_sandbox présent" 1 "$(lire "SELECT count(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='is_sandbox'")"
verifier "auth.uid() résoluble" 1 "$(lire "SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='auth' AND p.proname='uid'")"
verifier "déclencheur de création de profil" 1 "$(lire "SELECT count(*) FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='auth' AND c.relname='users' AND t.tgname='on_auth_user_created' AND NOT t.tgisinternal")"

verifier "policies sans restriction de role (0 attendu, inverse)" 1 "$(lire "SELECT CASE WHEN count(*) = 0 THEN 1 ELSE 0 END FROM pg_policies WHERE schemaname='public' AND qual='true' AND (roles='{public}' OR roles IS NULL)")"

sans_rls="$(lire "SELECT count(*) FROM pg_tables t JOIN pg_class c ON c.relname=t.tablename WHERE t.schemaname='public' AND NOT c.relrowsecurity")"
echo "  info  tables sans RLS               $sans_rls"
if [ "${sans_rls:-0}" -gt 0 ]; then
  docker exec "$DB" psql -U postgres -tAc "SELECT '          ' || t.tablename FROM pg_tables t JOIN pg_class c ON c.relname=t.tablename WHERE t.schemaname='public' AND NOT c.relrowsecurity ORDER BY 1 LIMIT 10"
fi

echo
if [ "$echec" = "0" ]; then
  echo "INSTALLATION VERIFIEE : une base vierge devient une base OpenPulse exploitable."
else
  echo "INSTALLATION NON VERIFIEE : voir les échecs ci-dessus." >&2
  exit 1
fi
