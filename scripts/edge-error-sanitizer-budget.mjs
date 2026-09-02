#!/usr/bin/env node
/**
 * scripts/edge-error-sanitizer-budget.mjs
 *
 * CICD-02 Phase 4 — Budget dégressif sur les Edge Functions sans
 * `error-sanitizer`. Empêche toute NOUVELLE fonction d'être déployée sans
 * ce garde-fou (règle projet : « Edge Functions must implement
 * `_shared/error-sanitizer.ts` to hide internal Azure/DB errors »).
 *
 * Usage : `node scripts/edge-error-sanitizer-budget.mjs`
 *   exit 0 si count ≤ BUDGET (et liste les fonctions hors-budget).
 *   exit 1 si count > BUDGET (régression : nouvelle fn sans sanitizer).
 *
 * Méthode :
 *   - Liste les `supabase/functions/<name>/index.ts` (hors `_shared`).
 *   - Compte celles qui N'IMPORTENT PAS `error-sanitizer`.
 *   - Compare au plancher figé ci-dessous.
 *
 * Le baseline doit DÉCROÎTRE — quand une fonction historique est remboursée
 * (sanitizer ajouté), on baisse `BUDGET` du même nombre.
 */
import { execSync } from 'node:child_process';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

// Baseline résiduelle mesurée le 2026-07-08 sur main/PR #59.
// Le gate est un ratchet anti-régression : il bloque toute remontée au-dessus
// des 14 fonctions historiques restantes, puis devra redescendre lot par lot.
// 🎯 Cible T7 : 0 (gate clos).
const BUDGET = 14;

const ROOT = 'supabase/functions';
const dirs = readdirSync(ROOT).filter((name) => {
  if (name === '_shared') return false;
  try {
    return statSync(join(ROOT, name)).isDirectory();
  } catch {
    return false;
  }
});

const missing = [];
let withIndex = 0;
for (const name of dirs) {
  const indexPath = join(ROOT, name, 'index.ts');
  let content;
  try {
    content = readFileSync(indexPath, 'utf8');
  } catch {
    continue; // pas d'index.ts → on ignore
  }
  withIndex++;
  if (!content.includes('error-sanitizer')) {
    missing.push(name);
  }
}

console.log(
  `[edge-error-sanitizer-budget] ${missing.length} / ${withIndex} fonctions sans error-sanitizer (budget : ${BUDGET})`,
);

if (missing.length > BUDGET) {
  console.error('');
  console.error(
    '❌ Budget dépassé — nouvelle Edge Function sans `error-sanitizer`.',
  );
  console.error(
    '   Règle projet : toute Edge Function doit importer et utiliser',
  );
  console.error(
    '   `_shared/error-sanitizer.ts` pour masquer les erreurs internes',
  );
  console.error('   (Azure/DB) dans les réponses HTTP.');
  console.error('');
  console.error('   Soit :');
  console.error(
    '     1. Ajoute `import { sanitizeError } from "../_shared/error-sanitizer.ts"`',
  );
  console.error(
    '        dans la nouvelle fonction et utilise-le dans le catch.',
  );
  console.error(
    '     2. (Exceptionnel) Justifie + incrémente BUDGET dans ce script.',
  );
  console.error('');
  console.error(`   Fonctions sans sanitizer (${missing.length}) :`);
  for (const name of missing.slice(0, 50)) console.error(`     • ${name}`);
  if (missing.length > 50) {
    console.error(`     ... et ${missing.length - 50} autres`);
  }
  process.exit(1);
}

if (missing.length < BUDGET) {
  console.log('');
  console.log(
    `✅ Budget non atteint (${missing.length} < ${BUDGET}). Pense à baisser BUDGET à ${missing.length} dans ${import.meta.url.split('/').pop()}.`,
  );
}
