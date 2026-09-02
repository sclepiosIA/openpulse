#!/usr/bin/env bash
# Compatibilité : l'entrée canonique sauvegarde aussi les rôles et le stockage.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec "$SCRIPT_DIR/openpulse-backup.sh" "$@"
