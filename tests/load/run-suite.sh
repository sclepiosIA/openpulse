#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────
# k6 Run-Suite — Exécute une suite de tests k6 par catégorie
# Usage:
#   ./k6/run-suite.sh critical              # tests critiques uniquement
#   ./k6/run-suite.sh clinical standard     # tests cliniques, scénario standard
#   ./k6/run-suite.sh compliance            # conformité HDS/RGPD/PRA/chaos
#   ./k6/run-suite.sh all                   # tous les tests
#
# Suites disponibles: critical, clinical, support, compliance, scale, all
# ──────────────────────────────────────────────────────────
set -euo pipefail

SUITE="${1:-critical}"
SCENARIO="${2:-smoke}"
SUMMARY_STATS="avg,min,med,max,p(90),p(95),p(99)"
TESTS_DIR="$(dirname "$0")/tests"
RESULTS_DIR="$(dirname "$0")/results"

mkdir -p "$RESULTS_DIR"

export K6_SCENARIO="$SCENARIO"

# ── Suite definitions ────────────────────────────────────
declare -A SUITE_TESTS

SUITE_TESTS[critical]="01 02 04 06 19 20 30 31 32 33 34"
SUITE_TESTS[clinical]="03 05 08 09 10 11 12 13 14 15 16 24 25 26 27 28 35 36 37 38 39 40"
SUITE_TESTS[support]="17 18 21 22 23 29 41 42 43 44 45 47 48 49 54 55"
SUITE_TESTS[compliance]="46 51 52 53"
SUITE_TESTS[scale]="07 50"

if [ "$SUITE" = "all" ]; then
  TESTS="${SUITE_TESTS[critical]} ${SUITE_TESTS[clinical]} ${SUITE_TESTS[support]} ${SUITE_TESTS[compliance]} ${SUITE_TESTS[scale]}"
elif [ -n "${SUITE_TESTS[$SUITE]+x}" ]; then
  TESTS="${SUITE_TESTS[$SUITE]}"
else
  echo "❌ Suite inconnue: $SUITE"
  echo "   Suites disponibles: critical, clinical, support, compliance, scale, all"
  exit 1
fi

PASSED=0
FAILED=0
TOTAL=0

echo "═══════════════════════════════════════════════════════"
echo " k6 Suite: $SUITE — Scénario: $SCENARIO"
echo " $(date '+%Y-%m-%d %H:%M:%S')"
echo "═══════════════════════════════════════════════════════"
echo ""

for test_num in $TESTS; do
  # Find the matching test file
  test_file=$(ls "$TESTS_DIR"/${test_num}_*.js 2>/dev/null | head -1)
  if [ -z "$test_file" ]; then
    echo "  ⚠️ Fichier introuvable pour test $test_num — ignoré"
    continue
  fi

  test_name="$(basename "$test_file" .js)"
  TOTAL=$((TOTAL + 1))

  echo "── [$TOTAL] $test_name ──────────────────────────────"

  if k6 run "$test_file" \
    --summary-trend-stats="$SUMMARY_STATS" \
    --summary-export="$RESULTS_DIR/${test_name}_${SCENARIO}.json" \
    2>&1; then
    echo "  ✅ PASS"
    PASSED=$((PASSED + 1))
  else
    echo "  ❌ FAIL"
    FAILED=$((FAILED + 1))
  fi

  echo ""
done

echo "═══════════════════════════════════════════════════════"
echo " Suite: $SUITE | Résultats: $PASSED/$TOTAL passed, $FAILED failed"
echo " Résultats JSON: $RESULTS_DIR/"
echo "═══════════════════════════════════════════════════════"

exit $FAILED
