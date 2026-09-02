#!/usr/bin/env node
/**
 * Audit Fable 5 — action 180.5 (fraîcheur documentaire).
 *
 * Deux garde-fous :
 *   1. Compteurs déclarés dans la doc (tests, migrations) alignés sur la
 *      mesure repo. Divergence > 15 % ⇒ échec.
 *   2. Docs de `docs/*.md` racine avec une entête "Dernière mise à jour" :
 *      date > 12 mois ⇒ échec (rappel de refresh).
 *
 * En mode warn-only via `--warn` (utilisé la première quinzaine pour
 * laisser le temps aux mainteneurs de mettre à jour).
 */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const WARN_ONLY = process.argv.includes('--warn');
const ROOT = process.cwd();
const failures = [];
const warnings = [];

function measure(cmd) {
  return Number(execSync(cmd, { encoding: 'utf8', shell: '/bin/bash' }).trim()) || 0;
}

// 1) Mesures repo
const measuredMigrations = fs.existsSync('supabase/migrations')
  ? fs.readdirSync('supabase/migrations').filter((f) => f.endsWith('.sql')).length
  : 0;
const measuredUnitTests = measure(
  `find src -name '*.test.*' -o -name '*.spec.*' 2>/dev/null | wc -l`,
);
const measuredE2ETests = measure(
  `find tests -name '*.test.*' -o -name '*.spec.*' 2>/dev/null | wc -l`,
);

// 2) Cross-check des compteurs déclarés dans TESTING_GUIDE
const guidePath = 'docs/TESTING_GUIDE.md';
if (fs.existsSync(guidePath)) {
  const guide = fs.readFileSync(guidePath, 'utf8');
  const rx = /\*\*([\d\s]+)\*\*\s+(?:fichiers de tests? E2E|migrations SQL|fichiers de test sous `src\/\*\*`)/gi;
  const declarations = [...guide.matchAll(rx)].map((m) => Number(m[1].replace(/\s/g, '')));
  const expected = [measuredUnitTests, measuredE2ETests, measuredMigrations];
  for (const decl of declarations) {
    const nearest = expected.reduce(
      (best, val) => (Math.abs(val - decl) < Math.abs(best - decl) ? val : best),
      expected[0],
    );
    const diffPct = (Math.abs(nearest - decl) / Math.max(nearest, 1)) * 100;
    if (diffPct > 15) {
      failures.push(
        `TESTING_GUIDE.md : compteur déclaré ${decl} diverge de la mesure la plus proche ${nearest} (${diffPct.toFixed(0)} %)`,
      );
    }
  }
}

// 3) Fraîcheur des docs racine
const now = Date.now();
const YEAR_MS = 365 * 24 * 3600 * 1000;
const docFiles = fs.existsSync('docs')
  ? fs.readdirSync('docs').filter((f) => f.endsWith('.md'))
  : [];
for (const f of docFiles) {
  const p = path.join('docs', f);
  const content = fs.readFileSync(p, 'utf8').slice(0, 2000);
  const m = content.match(/Derni[eè]re mise [aà] jour[^\n]*?(\w+\s+\d{4}|\d{4}-\d{2}-\d{2})/i);
  if (!m) continue;
  const raw = m[1];
  let date;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    date = new Date(raw);
  } else {
    // "Juillet 2026" → parse FR month
    const MONTHS = {
      janvier: 0, février: 1, fevrier: 1, mars: 2, avril: 3, mai: 4, juin: 5,
      juillet: 6, août: 7, aout: 7, septembre: 8, octobre: 9, novembre: 10, décembre: 11, decembre: 11,
    };
    const parts = raw.toLowerCase().split(/\s+/);
    const mo = MONTHS[parts[0]];
    const yr = Number(parts[1]);
    if (mo != null && yr) date = new Date(yr, mo, 1);
  }
  if (!date || Number.isNaN(date.getTime())) continue;
  const ageMonths = (now - date.getTime()) / (YEAR_MS / 12);
  if (ageMonths > 12) {
    failures.push(`docs/${f} — dernière mise à jour ${raw} (${ageMonths.toFixed(0)} mois) > 12 mois`);
  } else if (ageMonths > 6) {
    warnings.push(`docs/${f} — dernière mise à jour ${raw} (${ageMonths.toFixed(0)} mois) > 6 mois`);
  }
}

console.log(`[doc-freshness] mesures repo : ${measuredUnitTests} tests unit / ${measuredE2ETests} E2E / ${measuredMigrations} migrations`);
if (warnings.length) {
  console.log('\n⚠️  Avertissements (docs > 6 mois) :');
  for (const w of warnings) console.log('  - ' + w);
}
if (failures.length) {
  console.error('\n❌ Fraîcheur documentaire hors seuils :');
  for (const f of failures) console.error('  - ' + f);
  if (!WARN_ONLY) process.exit(1);
  console.log('\n(mode --warn : pas d\'échec CI, à remplacer par un run bloquant après nettoyage)');
}
if (!failures.length) console.log('✅ Fraîcheur documentaire OK.');
