#!/usr/bin/env bash
# =====================================================================
# Construit l'application de bureau pour UNE instance donnée.
#
# POURQUOI CE SCRIPT
# Les URL de l'instance sont figées dans le binaire à la compilation : c'est ce
# qui évite de demander deux adresses à l'utilisateur au premier lancement. Mais
# elles se règlent par TROIS variables lues à trois endroits différents — deux
# côté Rust (`option_env!` dans `crates/sync-core/src/config.rs`) et une côté
# interface (`import.meta.env` dans `src/api/desktopApi.ts`). En oublier une
# produit un paquet cohérent en apparence, qui vise l'instance voulue par un
# chemin de code et le gabarit par l'autre.
#
# Ce script les pose ensemble, et vérifie APRÈS COUP ce que le binaire porte
# réellement — une construction qui prétend viser une instance sans la viser
# serait la panne la plus coûteuse à diagnostiquer, puisqu'elle ne se voit
# qu'une fois installée.
#
# Usage :
#   scripts/construire-pour-instance.sh https://mon-instance.example
#   scripts/construire-pour-instance.sh https://mon-instance.example https://api.mon-instance.example
#
# Sans second argument, l'URL d'API est déduite en suffixant « /drive ».
# =====================================================================
set -euo pipefail

RACINE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$RACINE"

WEB="${1:-}"
if [ -z "$WEB" ]; then
  echo "usage : $0 <url-instance> [url-api]" >&2
  exit 1
fi
WEB="${WEB%/}"
API="${2:-$WEB/drive}"
API="${API%/}"

case "$WEB" in
  https://*) ;;
  *) echo "ECHEC : l'URL de l'instance doit être en HTTPS (reçu : $WEB)" >&2; exit 1 ;;
esac

export OPENPULSE_WEB_BASE_URL="$WEB"
export OPENPULSE_API_BASE_URL="$API"
export VITE_OPENPULSE_WEB_URL="$WEB"

echo "== cible =="
echo "  interface et liens : $WEB"
echo "  API de synchronisation : $API"

echo
echo "== contrôles avant construction =="
npm run typecheck
npm test -- --run
cargo test -p gestion-drive-sync-core --lib

echo
echo "== vérification de la cible réellement compilée =="
# `option_env!` est résolu à la compilation : c'est le SEUL moyen honnête de
# savoir ce que le binaire porte. `build.rs` déclare les deux variables à Cargo,
# sans quoi une reconstruction réutiliserait l'artefact du build précédent.
COMPILE="$(cargo run -q -p gestion-drive-sync-core --example preuve_url)"
echo "$COMPILE" | sed 's/^/  /'
echo "$COMPILE" | grep -qF "WEB=$WEB" || { echo "ECHEC : le binaire ne porte pas l'URL demandée." >&2; exit 1; }
echo "$COMPILE" | grep -qF "API=$API" || { echo "ECHEC : le binaire ne porte pas l'API demandée." >&2; exit 1; }

echo
echo "== construction du paquet =="
npm run tauri:build

echo
echo "Paquet construit. Les artefacts sont sous target/release/bundle/ (racine de l'espace de travail Cargo)."
