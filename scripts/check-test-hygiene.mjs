#!/usr/bin/env node
/**
 * Détecte les problèmes d'hygiène dans la suite de tests :
 *   - `.only(` / `describe.only` / `it.only` → BLOQUANT (exit 1)
 *   - `.skip(` / `.todo(` / `xit(` / `xdescribe(` → non bloquant, listé pour suivi
 *
 * Usage :
 *   node scripts/check-test-hygiene.mjs           # bloque sur .only
 *   node scripts/check-test-hygiene.mjs --report  # écrit docs/tests/HYGIENE.md
 */
import { readFileSync, writeFileSync, readdirSync, statSync, mkdirSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOTS = ['src', 'tests', 'e2e', 'supabase/functions'];
const TEST_RX = /\.(test|spec)\.(ts|tsx)$|_test\.ts$/;
const ONLY_RX = /\b(describe|it|test|context|suite)\.only\s*\(/;
const SKIP_RX = /\b(describe|it|test)\.(skip|todo)\(|\bxit\(|\bxdescribe\(/;

const only = [];
const skip = [];

function walk(dir) {
  let entries;
  try { entries = readdirSync(dir); } catch { return; }
  for (const name of entries) {
    if (name === 'node_modules' || name === 'dist' || name.startsWith('.')) continue;
    const p = join(dir, name);
    const s = statSync(p);
    if (s.isDirectory()) walk(p);
    else if (TEST_RX.test(name)) inspect(p);
  }
}

function inspect(file) {
  const content = readFileSync(file, 'utf8');
  content.split('\n').forEach((line, i) => {
    if (ONLY_RX.test(line)) only.push({ file: relative(process.cwd(), file), line: i + 1, text: line.trim() });
    if (SKIP_RX.test(line)) skip.push({ file: relative(process.cwd(), file), line: i + 1, text: line.trim() });
  });
}

for (const r of ROOTS) walk(r);

console.log(`\nTest hygiene report`);
console.log(`  .only found : ${only.length}`);
console.log(`  .skip/.todo : ${skip.length}`);

if (process.argv.includes('--report')) {
  mkdirSync('docs/tests', { recursive: true });
  const md = [
    `# Test Hygiene — ${new Date().toISOString().slice(0, 10)}`,
    ``,
    `## .only (BLOQUANT en CI) — ${only.length}`,
    ...only.map(o => `- \`${o.file}:${o.line}\` — ${o.text}`),
    ``,
    `## .skip / .todo — ${skip.length}`,
    ...skip.map(s => `- \`${s.file}:${s.line}\` — ${s.text}`),
    ``,
  ].join('\n');
  writeFileSync('docs/tests/HYGIENE.md', md);
  console.log('  → docs/tests/HYGIENE.md written');
}

if (only.length > 0) {
  console.error(`\n❌ ${only.length} .only trouvé(s) — retirer avant merge :`);
  only.slice(0, 20).forEach(o => console.error(`   ${o.file}:${o.line}`));
  process.exit(1);
}
console.log('✅ OK — pas de .only');
