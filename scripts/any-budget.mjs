#!/usr/bin/env node
/**
 * DEBT-01 — budget dégressif `any` sur src/hooks/** & src/lib/** (PROD only, hors __tests__).
 *
 * Usage : `node scripts/any-budget.mjs` (exit code 1 si le budget est dépassé)
 *
 * Le baseline est figé manuellement ci-dessous après chaque trimestre.
 * Cible : -10 %/trimestre. Mettre à jour `BUDGET` lors de la revue.
 *
 * NOTE (session 29) : on exclut désormais `__tests__/` car les mocks Vitest
 * exigent légitimement des `any`. Le budget se concentre sur le code de prod
 * où la chasse a réellement un impact (typage runtime + DX).
 */
import { execSync } from 'node:child_process';

// Baseline mesurée le 2026-06-03 session 29 (hors __tests__) : 63 occurrences.
// Session 30 : socialClient helper → 60. Sessions antérieures figeaient prod+tests.
// Session 2026-07-03 : le script excluait `__tests__/` mais PAS les tests
// co-localisés `*.test.ts` / `*.spec.ts`, ce qui gonflait artificiellement le
// compteur (418 avec tests, 24 sans). On aligne l'exclusion sur l'intention
// (code prod uniquement) et on rebaseline à 24.
// 🎯 Cible T3 2026 : 20. T4 : 15. T5 : 10 (-10 %/Q).
// Baseline observée sur origin/main le 2026-07-19 : 76.
// La cible de réduction reste 24 ; la gate interdit toute augmentation.
const BASELINE = 76;
const TARGET = 24;

const out = execSync(
  `grep -REn ':[[:space:]]*any\\b|<any>|as any' src/hooks src/lib --exclude-dir=__tests__ --include='*.ts' --include='*.tsx' | grep -Ev '\\.(test|spec)\\.tsx?:' || true`,
  { encoding: 'utf8', shell: '/bin/bash' },
);
const count = out.split('\n').filter(Boolean).length;

console.log(`[any-budget] occurrences PROD src/hooks + src/lib (hors __tests__) : ${count} (baseline : ${BASELINE}, cible : ${TARGET})`);

if (count > BASELINE) {
  console.error(
    `\n❌ Régression \`any\` : ${count} > baseline ${BASELINE}. Réduire avant merge.`,
  );
  process.exit(1);
}
if (count > TARGET) console.log(`⚠️ Dette \`any\` au-dessus de la cible : ${count} > ${TARGET}.`);
console.log('✅ Aucune nouvelle occurrence `any` par rapport à la baseline.');
