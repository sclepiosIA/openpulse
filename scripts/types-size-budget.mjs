#!/usr/bin/env node
/**
 * types.ts size budget — action 180.2 (audit Fable 5).
 *
 * `src/integrations/supabase/types.ts` est auto-généré par la CLI Supabase
 * et croît linéairement avec le schéma (135 tables × ~250 lignes). Cette
 * masse est un vecteur d'OOM sur les runs de couverture.
 *
 * Le fichier ne peut pas être découpé (regen atomique par la CLI) mais on
 * peut au moins verrouiller la trajectoire : baseline mesurée + marge
 * churn, décrément forcé au fur et à mesure que les tables inutilisées
 * sont retirées via migrations.
 *
 * Non-blocking : ce gate n'est pas ajouté à la CI tant que la trajectoire
 * de baisse n'est pas amorcée. Utilisable manuellement pour tracking.
 */
import { readFileSync, statSync } from "node:fs";

const FILE = "src/integrations/supabase/types.ts";

// Baseline S27 (2026-07) : 34 280 lignes. Cible J+180 : ≤ 30 000
// (retrait de ~15 tables héritées via cleanup migrations planifié).
const BUDGET_LINES = 35000;
const BUDGET_BYTES = 1_800_000; // ~1.8 Mo

const bytes = statSync(FILE).size;
const lines = readFileSync(FILE, "utf8").split("\n").length;

console.log(
  `[types-size] ${FILE} : ${lines} lignes / ${(bytes / 1024).toFixed(0)} KiB ` +
    `(budgets : ≤ ${BUDGET_LINES} lignes, ≤ ${(BUDGET_BYTES / 1024).toFixed(0)} KiB)`,
);

let failed = false;
if (lines > BUDGET_LINES) {
  console.error(`❌ Dépassement lignes : ${lines} > ${BUDGET_LINES}`);
  failed = true;
}
if (bytes > BUDGET_BYTES) {
  console.error(`❌ Dépassement taille : ${bytes} > ${BUDGET_BYTES}`);
  failed = true;
}
if (failed) {
  console.error(
    "\nMitigation : supprimer tables inutilisées via migration ou re-scoper la génération Supabase.",
  );
  process.exit(1);
}
console.log("✅ types.ts sous budget.");
