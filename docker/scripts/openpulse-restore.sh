#!/usr/bin/env bash
# OpenPulse — restauration d'une sauvegarde produite par openpulse-backup.sh.
#
# Cette opération est destructive. Elle vérifie d'abord toutes les empreintes,
# coupe les services applicatifs, restaure rôles, schémas et stockage objet, puis
# rétablit uniquement ceux qui étaient actifs. Elle ne restaure jamais les secrets.
set -euo pipefail
umask 077

ROOT="${OPENPULSE_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
COMPOSE=(docker compose --env-file "$ROOT/.env" -f "$ROOT/docker/docker-compose.openpulse.yml")
DRY_RUN=false
ASSUME_YES=false
BACKUP=""
STAGED_BACKUP=""
APPLICATION_SERVICES=(frontend kong functions realtime rest auth)
RUNNING_APPLICATION_SERVICES=()
STORAGE_WAS_RUNNING=false
RESTORE_STARTED=false

usage() {
  printf 'Usage: %s [--dry-run] [--yes] <repertoire-sauvegarde>\n' "$0" >&2
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run) DRY_RUN=true ;;
    --yes) ASSUME_YES=true ;;
    -h|--help) usage; exit 0 ;;
    -*) usage; exit 64 ;;
    *)
      [[ -z "$BACKUP" ]] || { usage; exit 64; }
      BACKUP="$1"
      ;;
  esac
  shift
done

[[ -n "$BACKUP" ]] || { usage; exit 64; }
if ! "$DRY_RUN"; then
  BACKUP="$(cd "$BACKUP" && pwd)"
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

capture_running_services() {
  local service candidate running_services
  if "$DRY_RUN"; then
    printf '+ capture running services; preserve the initial application/storage state\n'
    return
  fi

  if running_services="$("${COMPOSE[@]}" ps --services --filter status=running)"; then
    :
  else
    printf "Impossible d'inventorier les services actifs ; restauration annulée.\n" >&2
    return 1
  fi
  while IFS= read -r service; do
    if [[ "$service" == storage ]]; then
      STORAGE_WAS_RUNNING=true
      continue
    fi
    for candidate in "${APPLICATION_SERVICES[@]}"; do
      if [[ "$service" == "$candidate" ]]; then
        RUNNING_APPLICATION_SERVICES+=("$service")
        break
      fi
    done
  done <<< "$running_services"
}

verify_checksums() {
  if "$DRY_RUN"; then
    printf '+ verify SHA256SUMS (sha256sum --check or shasum -a 256 -c) in %q\n' "$BACKUP"
  elif command -v sha256sum >/dev/null 2>&1; then
    (cd "$BACKUP" && sha256sum --check SHA256SUMS)
  elif command -v shasum >/dev/null 2>&1; then
    (cd "$BACKUP" && shasum -a 256 -c SHA256SUMS)
  else
    printf 'Aucun outil SHA-256 disponible (sha256sum ou shasum).\n' >&2
    return 1
  fi
}

verify_manifest_inventory() {
  local actual_files manifest_files
  if "$DRY_RUN"; then
    printf '+ verify SHA256SUMS lists exactly globals.sql.gz, database.dump and storage-data/**\n'
    return
  fi

  actual_files="$(
    cd "$BACKUP"
    find globals.sql.gz database.dump storage-data -type f -print | LC_ALL=C sort
  )"
  manifest_files="$(
    cd "$BACKUP"
    sed -E 's/^[[:xdigit:]]{64}[[:space:]]+[*]?//' SHA256SUMS | LC_ALL=C sort
  )"
  if [[ "$actual_files" != "$manifest_files" ]]; then
    printf 'Sauvegarde refusée : inventaire SHA-256 incomplet ou incohérent.\n' >&2
    return 1
  fi
}

on_exit() {
  local status=$?
  trap - EXIT
  if [[ $status -ne 0 ]] && "$RESTORE_STARTED"; then
    printf 'Restauration interrompue : les services restent arrêtés pour éviter un état partiel.\n' >&2
  fi
  if [[ -n "$STAGED_BACKUP" ]]; then
    rm -rf -- "$STAGED_BACKUP"
  fi
  exit "$status"
}
trap on_exit EXIT

pipe_globals() {
  if "$DRY_RUN"; then
    printf '+ gunzip -c %q | ' "$BACKUP/globals.sql.gz"
    printf '%q ' "${COMPOSE[@]}" exec -T db psql -v ON_ERROR_STOP=1 -U postgres -d postgres
    printf '\n'
  else
    # Les CREATE ROLE du backup sont idempotents ; toute autre erreur doit
    # interrompre la restauration avant de toucher la base ou le stockage.
    gunzip -c "$BACKUP/globals.sql.gz" \
      | "${COMPOSE[@]}" exec -T db psql -v ON_ERROR_STOP=1 -U postgres -d postgres
  fi
}

restore_database() {
  if "$DRY_RUN"; then
    printf '+ '
    printf '%q ' "${COMPOSE[@]}" exec -T db pg_restore -U postgres -d "${POSTGRES_DB:-postgres}" --clean --if-exists --exit-on-error database.dump
    printf '\n'
  else
    "${COMPOSE[@]}" exec -T db pg_restore \
      -U postgres -d "${POSTGRES_DB:-postgres}" \
      --clean --if-exists --exit-on-error \
      < "$BACKUP/database.dump"
  fi
}

if ! "$DRY_RUN"; then
  [[ -f "$ROOT/.env" ]] || { printf 'Fichier .env introuvable : %s\n' "$ROOT/.env" >&2; exit 1; }

  # La source peut venir d'un support externe ou d'un répertoire modifiable.
  # Toute la restauration travaille sur une copie privée figée, jamais sur la
  # source après validation. Les liens symboliques sont interdits : ils feraient
  # vérifier un objet puis en copier un autre dans le volume de stockage live.
  STAGED_BACKUP="$(mktemp -d "${TMPDIR:-/tmp}/openpulse-restore.XXXXXXXX")"
  chmod 700 "$STAGED_BACKUP"
  cp -a "$BACKUP/." "$STAGED_BACKUP/"
  if find "$STAGED_BACKUP" -type l -print -quit | grep -q .; then
    printf 'Sauvegarde refusée : un lien symbolique est présent.\n' >&2
    exit 1
  fi
  BACKUP="$STAGED_BACKUP"

  for required in SHA256SUMS globals.sql.gz database.dump storage-data; do
    [[ -e "$BACKUP/$required" ]] || { printf 'Sauvegarde incomplète : %s absent\n' "$required" >&2; exit 1; }
  done
  # shellcheck disable=SC1091
  source "$ROOT/.env"
fi
: "${POSTGRES_DB:=postgres}"

printf 'Restauration OpenPulse depuis %s\n' "$BACKUP"
verify_manifest_inventory
verify_checksums
if "$DRY_RUN"; then
  printf '+ '
  printf '%q ' "${COMPOSE[@]}" exec -T db pg_restore --list
  printf '< %q\n' "$BACKUP/database.dump"
else
  "${COMPOSE[@]}" exec -T db pg_restore --list < "$BACKUP/database.dump" >/dev/null
fi

if ! "$DRY_RUN" && ! "$ASSUME_YES"; then
  printf 'Cette opération remplace la base et le stockage objet actuels. Taper RESTAURER : '
  read -r confirmation
  [[ "$confirmation" == RESTAURER ]] || { printf 'Restauration annulée.\n'; exit 1; }
fi

# L'état de service initial est conservé. La base reste active pour recevoir les
# dumps ; toutes les façades capables d'écrire sont coupées avant mutation.
capture_running_services
if "$DRY_RUN"; then
  run "${COMPOSE[@]}" stop frontend kong functions realtime rest auth
  run "${COMPOSE[@]}" stop storage
else
  RESTORE_STARTED=true
  if [[ ${#RUNNING_APPLICATION_SERVICES[@]} -gt 0 ]]; then
    "${COMPOSE[@]}" stop "${RUNNING_APPLICATION_SERVICES[@]}"
  fi
  if "$STORAGE_WAS_RUNNING"; then
    "${COMPOSE[@]}" stop storage
  fi
fi

pipe_globals
restore_database

# Le stockage objet actuel ne change qu'après une restauration SQL réussie. Un
# conteneur éphémère monte le même volume pendant que le service reste arrêté.
run "${COMPOSE[@]}" run --rm --no-deps --entrypoint sh storage -c 'find /var/lib/storage -mindepth 1 -maxdepth 1 -exec rm -rf -- {} +'
run "${COMPOSE[@]}" cp --archive "$BACKUP/storage-data/." storage:/var/lib/storage

if "$DRY_RUN"; then
  printf '+ start the exact application/storage service set captured before restore\n'
else
  SERVICES_TO_START=()
  "$STORAGE_WAS_RUNNING" && SERVICES_TO_START+=(storage)
  SERVICES_TO_START+=("${RUNNING_APPLICATION_SERVICES[@]}")
  if [[ ${#SERVICES_TO_START[@]} -gt 0 ]]; then
    "${COMPOSE[@]}" start "${SERVICES_TO_START[@]}"
  fi
  RESTORE_STARTED=false
fi

printf 'Restauration terminée. Rejouer les contrôles de docs/DEMARRAGE_RAPIDE.md avant la remise en service.\n'
