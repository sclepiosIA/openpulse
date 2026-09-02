#!/usr/bin/env node
/**
 * V4 (audit 2026-06-07) — budget dégressif des imports directs
 * `@/integrations/supabase/client` dans `src/pages/**`.
 *
 * Miroir de `components-supabase-budget.mjs`. Les pages doivent déléguer à
 * `src/hooks/<domain>/` ou `src/services/` — pas d'accès direct au client
 * Supabase depuis la couche route (ADR-001 frontend boundaries).
 *
 * Baseline mesurée le 2026-06-07 : 19 occurrences (vs 55 audit externe).
 * Ratchet S23 (audit Fable 5 · 180.1) : mesure = 25 (regression +6),
 * budget provisoire = 26 (marge churn 1). Cible J+180 : 0.
 * Décrément prévu : −4/sprint sur les pages email/CRM/trésorerie.
 */
import { execSync } from 'node:child_process';

const BUDGET = 2;

const out = execSync(
  `grep -rlE "from ['\\\"]@/integrations/supabase/client" src/pages | grep -vE "(__tests__|\\.test\\.)" || true`,
  { encoding: 'utf8', shell: '/bin/bash' },
);
const count = out.split('\n').filter(Boolean).length;

console.log(
  `[pages-supabase-budget] pages important @/integrations/supabase/client : ${count} (budget : ${BUDGET}, hors tests)`,
);

if (count > BUDGET) {
  console.error(
    `\n❌ Budget dépassé : ${count} > ${BUDGET}.\n` +
      `Migrer le nouvel appel vers src/hooks/<domain>/ ou src/services/ avant merge.`,
  );
  process.exit(1);
}
console.log('✅ Budget respecté.');
