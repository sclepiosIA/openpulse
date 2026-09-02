#!/usr/bin/env node
/**
 * Phase 4 — Observabilité CI.
 *
 * Garde-fou minimal sur la chaîne d'observabilité runtime :
 *   1. `src/main.tsx` initialise les 3 captures critiques :
 *        - consoleCapture       (logs navigateur agrégés)
 *        - frontendErrorCapture (window.onerror + unhandledrejection -> frontend_error_logs)
 *        - webVitalsCapture     (LCP/INP/CLS via PerformanceObserver -> web_vitals_log)
 *   2. `frontendErrorCapture.ts` doit toujours pousser vers la table
 *      `frontend_error_logs` (insert direct ou RPC) et filtrer le bruit
 *      connu (Playwright, ResizeObserver, JWT expiré, upstream-timeout).
 *
 * Toute régression masquerait silencieusement les crashes utilisateur,
 * d'où échec dur (exit 1) à la moindre brèche.
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

// 1. main.tsx — captures runtime obligatoires
const main = read('src/main.tsx');
const requiredInits = [
  { name: 'consoleCapture', re: /consoleCapture\.init\(\s*\)/ },
  { name: 'frontendErrorCapture', re: /frontendErrorCapture\.init\(\s*\)/ },
  { name: 'webVitalsCapture', re: /webVitalsCapture\.init\(\s*\)/ },
];
for (const { name, re } of requiredInits) {
  if (!re.test(main)) failures.push(`src/main.tsx ne déclenche plus ${name}.init()`);
}

// 2. frontendErrorCapture — sink + filtres anti-bruit
const fec = read('src/lib/frontendErrorCapture.ts');
if (!/frontend_error_logs|log_frontend_error/.test(fec)) {
  failures.push('frontendErrorCapture.ts ne référence plus le sink frontend_error_logs / log_frontend_error');
}
for (const noise of ['ResizeObserver', 'Playwright', 'JWT', 'upstream']) {
  if (!new RegExp(noise, 'i').test(fec)) {
    failures.push(`frontendErrorCapture.ts ne filtre plus le bruit "${noise}"`);
  }
}

// 3. Console-free zones sensibles (audit Fable 5 · 90.6)
//    Interdit `console.*` sur les chemins portant des données PII / santé /
//    financières. Utiliser `debug.*` (src/lib/debug.ts) qui filtre en prod.
import { execSync } from 'node:child_process';
const SENSITIVE_DIRS = [
  'src/components/email',
  'src/components/rgpd',
  'src/components/rh',
  'src/components/tresorerie',
  'src/hooks/email',
  'src/hooks/rgpd',
  'src/hooks/rh',
  'src/hooks/tresorerie',
];
const existing = SENSITIVE_DIRS.filter((d) => fs.existsSync(path.join(ROOT, d)));
if (existing.length) {
  const cmd =
    `grep -rEn "console\\.(log|debug|info|warn|error)" ` +
    existing.join(' ') +
    ` --include='*.ts' --include='*.tsx' | grep -Ev '(__tests__/|\\.(test|spec)\\.tsx?:)' || true`;
  const hits = execSync(cmd, { encoding: 'utf8', shell: '/bin/bash' })
    .split('\n')
    .filter(Boolean);
  if (hits.length) {
    failures.push(
      `console.* interdit sur chemins sensibles (utiliser debug.*) — ${hits.length} occurrence(s) :\n    ` +
        hits.slice(0, 10).join('\n    '),
    );
  }
}

if (failures.length) {
  console.error('❌ runtime-observability budget failed:\n');
  for (const f of failures) console.error('  - ' + f);
  console.error('\nLa chaîne d\'observabilité runtime doit rester opérationnelle.');
  process.exit(1);
}
console.log('✅ runtime-observability budget OK (captures init + sink + filtres bruit + zones sensibles console-free).');
