#!/usr/bin/env node
/**
 * Audit numérique: flag les `.toFixed(` / `.toLocaleString(` appelés sur des
 * accès chaînés (ex: `foo.bar.baz.toFixed`) sans null-safe `?.` ni wrapper
 * `safeNum(` / `safeFormat(`. Sort un rapport top-offenders. Non bloquant.
 */
import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const files = execSync("rg -l '\\.toFixed\\(|\\.toLocaleString\\(' src/ -g '*.ts' -g '*.tsx'", { encoding: 'utf8' })
  .split('\n')
  .filter(Boolean)
  .filter((f) => !f.includes('.test.') && !f.includes('/__tests__/'));

const risky = [];

for (const file of files) {
  const src = readFileSync(file, 'utf8');
  const lines = src.split('\n');
  lines.forEach((line, i) => {
    const m = line.match(/(\S*?)(\.toFixed|\.toLocaleString)\(/);
    if (!m) return;
    const before = m[1];
    // Sûrs : literals (100), variables scalaires (score), safe wrappers.
    if (/^\d+$/.test(before)) return;
    if (/safeNum|safeFormat/.test(line)) return;
    // Signal fort : accès en chaîne avec au moins 2 `.` sans `?.` juste avant.
    const chainDots = (before.match(/\./g) || []).length;
    if (chainDots >= 2 && !before.includes('?.')) {
      risky.push({ file, line: i + 1, snippet: line.trim().slice(0, 120) });
    }
  });
}

console.log(`📊 Audit numérique: ${risky.length} accès chaînés à risque`);
const byFile = new Map();
for (const r of risky) byFile.set(r.file, (byFile.get(r.file) || 0) + 1);
const top = [...byFile.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15);
if (top.length) {
  console.log('\nTop offenders :');
  for (const [f, n] of top) console.log(`  ${String(n).padStart(3)}  ${f}`);
}
process.exit(0);
