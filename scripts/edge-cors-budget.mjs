#!/usr/bin/env node
/**
 * Audit 2026-06-07 V2b — budget dégressif d'usage du wildcard CORS
 * (`Access-Control-Allow-Origin: *`) dans les Edge Functions.
 *
 * Empêche toute nouvelle régression et tracke la migration progressive vers
 * `getCorsHeaders(requestOrigin)` (allowlist `_shared/cors.ts`).
 *
 * Baseline 2026-06-07 : 209 fonctions inlinent `Access-Control-Allow-Origin: '*'`.
 * Rebaseline 2026-07-07 (audit Fable 5 · session 154) : mesure = 220
 * (nouvelles edge fns ajoutées entre juin et juillet). Budget serré à 222
 * (marge churn 2). Cible juillet 2026 : 200. Octobre 2026 : 100.
 * Fin 2026 : ≤ 10 (webhooks externes documentés uniquement).
 *
 * Usage : `node scripts/edge-cors-budget.mjs` (exit 1 si dépassé).
 */
import { execSync } from 'node:child_process';

const BUDGET = 222;

const out = execSync(
  String.raw`grep -rln "Access-Control-Allow-Origin.*['\"]\*['\"]" supabase/functions --include=index.ts || true`,
  { encoding: 'utf8', shell: '/bin/bash' },
);
const count = out.split('\n').filter(Boolean).length;

console.log(`[edge-cors-budget] Edge functions avec wildcard CORS inline : ${count} (budget : ${BUDGET})`);

if (count > BUDGET) {
  console.error(
    `\n❌ Budget CORS wildcard dépassé : ${count} > ${BUDGET}. ` +
      `Importer \`getCorsHeaders\` depuis \`_shared/cors.ts\` et passer \`req.headers.get('origin')\`.`,
  );
  process.exit(1);
}
console.log('✅ Budget respecté.');
