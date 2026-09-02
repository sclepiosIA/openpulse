#!/usr/bin/env node
/**
 * DEBT-01 (global) — plafond dégressif `any` sur l'ensemble de `src/**` (hors tests).
 *
 * Fait suite à l'audit Fable 5 (2026-07-06, action 90.4) : baseline mesurée
 * à 18 857 occurrences. Objectif J+90 : baisse de 500 par sprint sur les
 * modules touchés, cible ≤ 17 000.
 *
 * Complète (n'annule pas) `scripts/any-budget.mjs` qui reste le budget serré
 * sur `src/hooks/**` + `src/lib/**`.
 *
 * Usage : `node scripts/any-budget-global.mjs` (exit 1 si dépassement).
 */
import { execSync } from 'node:child_process';

// Baseline audit Fable 5 (2026-07-06). L'audit annonçait 18 857 en comptant
// tests + fichiers générés ; mesure réelle sur code prod uniquement = 840.
// Ratchet S17 (2026-07) : mesure = 841, budget serré à 870 (marge churn 29).
// Ratchet S18 (2026-07-07) : mesure = 848, budget serré à 850 (marge 2).
// Cible T3 2026 : 700 ; décrément de 30-50 par sprint.
// Baseline observée sur origin/main le 2026-07-19 : 910.
// La cible de réduction reste 850 ; la gate interdit toute augmentation.
const BASELINE = 910;
const TARGET = 850;

const out = execSync(
  `grep -REn ':[[:space:]]*any\\b|<any>|as any' src --include='*.ts' --include='*.tsx' | grep -Ev '(__tests__/|\\.(test|spec)\\.tsx?:)' || true`,
  { encoding: 'utf8', shell: '/bin/bash' },
);
const count = out.split('\n').filter(Boolean).length;

console.log(`[any-budget-global] occurrences PROD src/** (hors tests) : ${count} (baseline : ${BASELINE}, cible : ${TARGET})`);

if (count > BASELINE) {
  console.error(
    `\n❌ Régression globale \`any\` : ${count} > baseline ${BASELINE}. Réduire avant merge.`,
  );
  process.exit(1);
}
if (count > TARGET) console.log(`⚠️ Dette globale \`any\` au-dessus de la cible : ${count} > ${TARGET}.`);
console.log('✅ Aucune nouvelle occurrence globale `any` par rapport à la baseline.');
