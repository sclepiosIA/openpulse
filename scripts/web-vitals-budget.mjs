#!/usr/bin/env node
/**
 * Phase 4 — Observabilité CI.
 *
 * Garde-fou minimal pour s'assurer que la chaîne Web Vitals reste branchée :
 *   1. `src/main.tsx` importe et initialise `webVitalsCapture`.
 *   2. `src/lib/webVitalsCapture.ts` cible bien le RPC `log_web_vital`.
 *   3. La migration LCP P75 (`check_lcp_p75_alert`) existe toujours et est planifiée.
 *
 * Toute régression sur ces 3 points masquerait l'observabilité côté frontend
 * et donc l'alerting Direction LCP > 4 s, sans qu'aucun test fonctionnel
 * ne le détecte. Ce script est volontairement très simple : il échoue dur
 * (exit 1) à la moindre brèche.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const failures = [];

function read(file) {
  const p = path.join(ROOT, file);
  if (!fs.existsSync(p)) {
    failures.push(`Fichier manquant : ${file}`);
    return '';
  }
  return fs.readFileSync(p, 'utf8');
}

// 1. main.tsx doit importer + init webVitalsCapture
const main = read('src/main.tsx');
if (!/from\s+['"][^'"]*webVitalsCapture['"]/.test(main)) {
  failures.push("src/main.tsx n'importe pas webVitalsCapture");
}
if (!/webVitalsCapture\.init\(\s*\)/.test(main)) {
  failures.push('src/main.tsx ne déclenche pas webVitalsCapture.init()');
}

// 2. webVitalsCapture.ts doit appeler le RPC log_web_vital
const capture = read('src/lib/webVitalsCapture.ts');
if (!/log_web_vital/.test(capture)) {
  failures.push('webVitalsCapture.ts ne référence plus le RPC log_web_vital');
}
for (const metric of ['LCP', 'INP', 'CLS']) {
  if (!new RegExp(`["']${metric}["']`).test(capture)) {
    failures.push(`webVitalsCapture.ts ne capture plus la métrique ${metric}`);
  }
}

// 3. Migration alerte LCP P75 doit exister + être planifiée via cron
const migrationsDir = path.join(ROOT, 'supabase/migrations');
let foundLcpFn = false;
let foundLcpSchedule = false;
if (fs.existsSync(migrationsDir)) {
  for (const f of fs.readdirSync(migrationsDir)) {
    if (!f.endsWith('.sql')) continue;
    const sql = fs.readFileSync(path.join(migrationsDir, f), 'utf8');
    if (/FUNCTION\s+public\.check_lcp_p75_alert\s*\(/i.test(sql)) foundLcpFn = true;
    if (/cron\.schedule\s*\(\s*'monitor-lcp-p75-check'/i.test(sql)) foundLcpSchedule = true;
  }
}
if (!foundLcpFn) failures.push("Migration check_lcp_p75_alert introuvable");
if (!foundLcpSchedule) failures.push("Cron 'monitor-lcp-p75-check' non planifié");

if (failures.length) {
  console.error('❌ web-vitals budget failed:\n');
  for (const f of failures) console.error('  - ' + f);
  console.error('\nLa chaîne d\'observabilité Web Vitals doit rester opérationnelle.');
  process.exit(1);
}
console.log('✅ web-vitals budget OK (capture wired, RPC référencé, cron LCP P75 planifié).');
