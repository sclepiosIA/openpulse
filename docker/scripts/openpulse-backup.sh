#!/usr/bin/env bash
# OpenPulse — sauvegarde cohérente de l'instance Docker canonique.
#
# Produit un répertoire autoportant : rôles PostgreSQL, dump des schémas utiles,
# stockage objet local et inventaire SHA-256. La restauration est volontairement
# distincte et s'exécute pendant une fenêtre de maintenance confirmée.
set -euo pipefail
umask 077

ROOT="${OPENPULSE_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
COMPOSE=(docker compose --env-file "$ROOT/.env" -f "$ROOT/docker/docker-compose.openpulse.yml")
BACKUP_DIR="${BACKUP_DIR:-$ROOT/backups}"
TIMESTAMP="${OPENPULSE_TIMESTAMP:-$(date -u +%Y%m%dT%H%M%SZ)}"
DEST="$BACKUP_DIR/$TIMESTAMP"
DRY_RUN=false
APPLICATION_SERVICES=(frontend kong functions realtime rest auth storage)
RUNNING_SERVICES=()
RESTART_REQUIRED=false

if [[ "${1:-}" == "--dry-run" ]]; then
  DRY_RUN=true
elif [[ $# -ne 0 ]]; then
  printf 'Usage: %s [--dry-run]\n' "$0" >&2
  exit 64
fi

run() {
  if "$DRY_RUN"; then
    printf '+ '
    printf '%q ' "$@"
    printf '\n'
  else
    "$@"
  fi
}

make_roles_idempotent() {
  local line delimiter
  delimiter="\$openpulse_role\$"
  while IFS= read -r line || [[ -n "$line" ]]; do
    if [[ "$line" =~ ^CREATE[[:space:]]ROLE[[:space:]].*\;$ ]]; then
      printf 'DO %s BEGIN %s EXCEPTION WHEN duplicate_object THEN NULL; END %s;\n' \
        "$delimiter" "$line" "$delimiter"
    else
      printf '%s\n' "$line"
    fi
  done
}

capture_running_services() {
  local service candidate running_services
  if "$DRY_RUN"; then
    printf '+ capture running services; stop only active frontend/API/storage services\n'
    return
  fi

  if running_services="$("${COMPOSE[@]}" ps --services --filter status=running)"; then
    :
  else
    printf "Impossible d'inventorier les services actifs ; sauvegarde annulée.\n" >&2
    return 1
  fi
  while IFS= read -r service; do
    for candidate in "${APPLICATION_SERVICES[@]}"; do
      if [[ "$service" == "$candidate" ]]; then
        RUNNING_SERVICES+=("$service")
        break
      fi
    done
  done <<< "$running_services"
}

restart_services() {
  local restart_status=0
  if [[ ${#RUNNING_SERVICES[@]} -gt 0 ]]; then
    "${COMPOSE[@]}" start "${RUNNING_SERVICES[@]}" || restart_status=$?
  fi
  RESTART_REQUIRED=false
  return "$restart_status"
}

on_exit() {
  local status=$?
  trap - EXIT
  if ! "$DRY_RUN" && "$RESTART_REQUIRED"; then
    set +e
    restart_services
    local restart_status=$?
    set -e
    if [[ $restart_status -ne 0 ]]; then
      printf 'Sauvegarde interrompue et redémarrage incomplet ; vérifier les services Compose.\n' >&2
      status=$restart_status
    fi
  fi
  exit "$status"
}
trap on_exit EXIT

if ! "$DRY_RUN" && [[ ! -f "$ROOT/.env" ]]; then
  printf 'Fichier .env introuvable : %s\n' "$ROOT/.env" >&2
  exit 1
fi

# Ne jamais charger la configuration d'une instance lors d'une vérification de
# contrat. En exécution réelle, Compose lit le même fichier et nous ne retenons
# ici que le nom de base, sans afficher de valeur de configuration.
if ! "$DRY_RUN"; then
  # shellcheck disable=SC1091
  source "$ROOT/.env"
fi
: "${POSTGRES_DB:=postgres}"

printf 'Sauvegarde OpenPulse vers %s\n' "$DEST"
if ! "$DRY_RUN" && [[ -e "$DEST" ]]; then
  printf 'Destination déjà présente : %s\n' "$DEST" >&2
  exit 1
fi
run mkdir -p "$BACKUP_DIR"
run mkdir -m 700 "$DEST"

# Le dump SQL et les octets du stockage forment un seul snapshot logique. Les
# services capables d'écrire sont brièvement arrêtés, puis leur état initial est
# restauré par le trap, y compris si une commande de sauvegarde échoue.
capture_running_services
if "$DRY_RUN"; then
  printf '+ stop captured frontend/API/storage services before snapshot\n'
elif [[ ${#RUNNING_SERVICES[@]} -gt 0 ]]; then
  RESTART_REQUIRED=true
  "${COMPOSE[@]}" stop "${RUNNING_SERVICES[@]}"
fi

# Les rôles et GRANT sont hors du dump d'une base ; les omettre rendrait anon,
# authenticated et service_role inutilisables après restauration.
if "$DRY_RUN"; then
  run "${COMPOSE[@]}" exec -T db pg_dumpall --roles-only --no-role-passwords --quote-all-identifiers -U postgres
else
  "${COMPOSE[@]}" exec -T db pg_dumpall --roles-only --no-role-passwords --quote-all-identifiers -U postgres \
    | make_roles_idempotent \
    | gzip -9 > "$DEST/globals.sql.gz"
fi

# Les schémas auth et storage font partie des données applicatives. Le format
# custom rend possible une restauration contrôlée avec pg_restore.
if "$DRY_RUN"; then
  run "${COMPOSE[@]}" exec -T db pg_dump -U postgres -d "$POSTGRES_DB" --format=custom --compress=9 --schema=public --schema=auth --schema=storage --schema=extensions
else
  "${COMPOSE[@]}" exec -T db pg_dump -U postgres -d "$POSTGRES_DB" \
    --format=custom --compress=9 \
    --schema=public --schema=auth --schema=storage --schema=extensions \
    > "$DEST/database.dump"
fi

if "$DRY_RUN"; then
  # STORAGE_BACKEND=file : les octets doivent voyager avec leurs métadonnées SQL.
  run "${COMPOSE[@]}" cp --archive storage:/var/lib/storage "$DEST/storage-data"
  printf '+ SHA-256 globals.sql.gz database.dump storage-data/** > %q\n' "$DEST/SHA256SUMS"
else
  "${COMPOSE[@]}" cp --archive storage:/var/lib/storage "$DEST/storage-data"
  chmod -R go-rwx "$DEST"
  (
    cd "$DEST"
    if command -v sha256sum >/dev/null 2>&1; then
      HASHER=(sha256sum)
    elif command -v shasum >/dev/null 2>&1; then
      HASHER=(shasum -a 256)
    else
      printf 'Aucun outil SHA-256 disponible (sha256sum ou shasum).\n' >&2
      exit 1
    fi
    find globals.sql.gz database.dump storage-data -type f -print0 | sort -z | xargs -0 "${HASHER[@]}" > SHA256SUMS
  )
  if restart_services; then
    :
  else
    restart_status=$?
    printf 'Sauvegarde terminée mais redémarrage incomplet ; vérifier les services Compose.\n' >&2
    exit "$restart_status"
  fi
  printf 'Sauvegarde terminée : %s\n' "$DEST"
fi
