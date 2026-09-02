#!/usr/bin/env node
/**
 * Audit Fable 5 — action 90.5 (tests Edge critiques).
 *
 * L'audit demandait ≥ 30 fonctions critiques testées. Mesure 2026-07-06 :
 * **314 fichiers de test edge** hors `_shared/`, action déjà atteinte.
 *
 * Ce garde-fou empêche la régression : les fonctions edge nommées ci-dessous
 * (critiques pour la sécurité / la conformité / le revenu) DOIVENT conserver
 * un fichier de test co-localisé (`index.test.ts` ou `*_test.ts`).
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.join(process.cwd(), 'supabase/functions');

const CRITICAL = [
  'jarvis-brain',
  'sync-emails',
  'rgpd-export-data',
  'facturation-actions',
  'qonto-auth',
  'qonto-sync-transactions',
  'qonto-webhook-handler',
  'admin-create-user',
  'admin-disable-user',
  'auto-create-etablissement',
];

const failures = [];
for (const fn of CRITICAL) {
  const dir = path.join(ROOT, fn);
  if (!fs.existsSync(dir)) {
    failures.push(`Fonction critique introuvable : supabase/functions/${fn}`);
    continue;
  }
  const files = fs.readdirSync(dir);
  const hasTest = files.some((f) => /(_test\.ts|\.test\.ts)$/.test(f));
  if (!hasTest) {
    failures.push(`supabase/functions/${fn} n'a plus de test co-localisé`);
  }
}

if (failures.length) {
  console.error('❌ edge-critical-tests budget failed:\n');
  for (const f of failures) console.error('  - ' + f);
  process.exit(1);
}
console.log(`✅ edge-critical-tests : ${CRITICAL.length} fonctions critiques conservent leur test.`);
