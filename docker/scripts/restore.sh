#!/usr/bin/env bash
# Compatibilité : l'entrée canonique vérifie et restaure le backup complet.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec "$SCRIPT_DIR/openpulse-restore.sh" "$@"
