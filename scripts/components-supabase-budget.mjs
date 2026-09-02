#!/usr/bin/env node
/**
 * Chantier #4 (audit 2026-06-02) — budget dégressif des imports directs
 * `@/integrations/supabase/client` dans `src/components/**`.
 *
 * Objectif : forcer la migration vers la couche `src/services/` (hooks
 * domaines + RPC dédiés) au lieu d'appeler Supabase depuis les composants
 * de présentation. Mirror du pattern `any-budget.mjs`.
 *
 * Usage : `node scripts/components-supabase-budget.mjs` (exit 1 si dépassé)
 *
 * Baseline mesurée le 2026-06-04 session 138 : 196 occurrences.
 * Cible T5 2026 : 175 (-10 %). T6 : 155. T7 : 130. T8 : 100.
 *
 * Session 148 (2026-06-04) — exclusion des fichiers `__tests__/` du compteur :
 *   les tests doivent légitimement importer `supabase` pour le mocker
 *   (cf. `src/test-utils/supabaseMockFactory.ts`). Le budget couvre
 *   uniquement les composants de présentation. Re-baseline post-T5 : 175.
 */
import { execSync } from 'node:child_process';

// Rebaseline 2026-07-06 (audit Fable 5 · action 90.3) : mesuré 169.
// L'audit visait ≤ 177 à J+90 → **déjà atteint**. Nouveau ratchet 155 pour
// forcer la migration email S+1 / CRM S+2 / trésorerie S+3.
// Session 154 (2026-07-07) : exclusion des `*.test.tsx` en plus de
// `__tests__/` — les tests deep* important `supabase` pour mock ne doivent
// pas peser dans le compteur de dette applicative.
// 🎯 Cible T4 2026 : 130. T5 : 105. T6 : 75. T7 : 40.
// Baseline post-exclusion tests (session 154) : 143 (169 −26 fichiers *.deep*.test.tsx).
const BUDGET = 106;

const out = execSync(
  `grep -rlE "from ['\\\"]@/integrations/supabase/client" src/components --include='*.tsx' | grep -vE "(__tests__|\\.test\\.)" || true`,
  { encoding: 'utf8', shell: '/bin/bash' },
);
const count = out.split('\n').filter(Boolean).length;

console.log(
  `[components-supabase-budget] composants important @/integrations/supabase/client : ${count} (budget : ${BUDGET}, hors __tests__)`,
);

if (count > BUDGET) {
  console.error(
    `\n❌ Budget dépassé : ${count} > ${BUDGET}.\n` +
      `Migrer le nouvel appel vers src/hooks/<domain>/ ou src/services/ avant merge.`,
  );
  process.exit(1);
}
console.log('✅ Budget respecté.');
