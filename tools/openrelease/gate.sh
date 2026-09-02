#!/usr/bin/env bash
# Barriere complete : extraction a blanc puis scan de l'arbre courant.
# Usage : tools/openrelease/gate.sh [chemin-du-snapshot-amont]
# Sans argument, ne fait que le scan de l'arbre courant.
set -euo pipefail

RACINE="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$RACINE"

RAPPORTS=".openrelease-report"
mkdir -p "$RAPPORTS"

if [ $# -ge 1 ]; then
  SNAP="$1"
  echo "== extraction a blanc depuis $SNAP =="
  node tools/openrelease/extract.mjs \
    --upstream "$SNAP" \
    --out "$RAPPORTS/arbre-theorique" \
    --dry-run \
    --rapport "$RAPPORTS/extraction.json"
  echo
fi

echo "== barriere de publication sur l'arbre courant =="
if node tools/openrelease/scan.mjs --cible . --severite medium --tout \
     --rapport "$RAPPORTS/scan.json"; then
  echo
  echo "== coherence des reecritures =="
  # La barriere mesure ce qui reste de l'editeur. Ce controle mesure ce qui a
  # ete transforme a moitie : un depot peut etre publiable et incoherent.
  node tools/openrelease/verifier-coherence.mjs .
  echo

  # Le manifeste est publie avec le depot. Une regle qui dit « remplace cette
  # adresse » doit l'ecrire : publier le manifeste revenait a publier la carte
  # de l'infrastructure qu'il sert a masquer. Ce controle verifie que les
  # definitions sensibles sont restees hors du depot.
  node tools/openrelease/verifier-manifeste-prive.mjs .
  echo

  # Le depot doit rester remettable a un tiers : licence, attributions,
  # documents d'entree, metadonnees de paquet. Le seuil superieur -- publication
  # a des inconnus -- se controle avec --publication.
  node tools/openrelease/verifier-pret-a-publier.mjs .
  echo
  echo "== integration continue portable =="
  node tools/openrelease/verifier-ci-portable.mjs .
  echo
  echo "== liens du parcours d'installation =="
  node tools/openrelease/verifier-liens.mjs .
  echo
  echo "== espaces de stockage =="
  node tools/openrelease/verifier-espaces-stockage.mjs .
  echo
  echo "== registre d'environnement =="
  node tools/openrelease/verifier-registre-env.mjs .
  echo
  echo "== modele de configuration contre registre =="
  node tools/openrelease/verifier-modele-env.mjs .
  echo
  echo "== versions d'images citees par la documentation =="
  node tools/openrelease/verifier-versions-images.mjs .
  echo
  echo "== licences des dependances de production =="
  # Volontairement NON bloquant : les constats de ce controle sont des
  # arbitrages, pas des defauts. Ils appartiennent a qui publie, et les faire
  # echouer la barriere reviendrait a laisser un outil trancher a sa place.
  # Ils bloquent en revanche le lot 10 : voir docs/LICENCES_DEPENDANCES.md.
  node tools/openrelease/auditer-licences.mjs . | sed -n '1,12p' || true
  echo
  echo "== chiffres de licence ecrits dans les documents =="
  # Celui-ci EST bloquant, et la nuance compte. Il ne juge aucun arbitrage : il
  # verifie que NOTICE, docs/LICENCES_DEPENDANCES.md et CHANTIER.md disent ce
  # que la mesure dit. Ils avaient diverge -- trois jours durant, ils ont
  # annonce une contamination GPL levee entre-temps. Un depot dont les papiers
  # s'accusent d'une contamination qui n'existe plus se fait refuser sur sa
  # propre foi ; un depot dont les papiers taisent une contamination reelle
  # fait construire dessus des gens qui l'apprendront trop tard.
  node tools/openrelease/verifier-notice-licences.mjs .
  echo
  echo "VERT : aucun constat bloquant ni eleve, aucune reecriture partielle."
else
  code=$?
  echo
  if [ "$code" = "2" ]; then
    echo "ERREUR D'OUTIL : la barriere n'a pas pu conclure."
  else
    echo "ROUGE : constats bloquants ou eleves. Publication interdite."
    echo "Detail : $RAPPORTS/scan.json"
  fi
  exit "$code"
fi
