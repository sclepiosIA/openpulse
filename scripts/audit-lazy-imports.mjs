#!/usr/bin/env node
/**
 * Audit lazy imports: flag raw `lazy` from 'react' (should use lazyWithRetry).
 * Autorisé: `import { lazyWithRetry as lazy } from '@/lib/lazyWithRetry'`.
 */
import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const ALLOWLIST = new Set(['src/lib/lazyWithRetry.ts']);
const files = execSync("rg -l '\\blazy\\(' src/", { encoding: 'utf8' })
  .split('\n')
  .filter(Boolean)
  .filter((f) => !ALLOWLIST.has(f) && !f.includes('/__tests__/') && !f.endsWith('.test.ts') && !f.endsWith('.test.tsx'));


const findings = [];
for (const file of files) {
  const src = readFileSync(file, 'utf8');
  if (!/\blazy\(/.test(src)) continue;
  // OK si import via lazyWithRetry
  const usesRetry = /from ['"]@\/lib\/lazyWithRetry['"]/.test(src);
  const importsReactLazy = /import\s+\{[^}]*\blazy\b[^}]*\}\s+from\s+['"]react['"]/.test(src);
  if (importsReactLazy && !usesRetry) {
    findings.push(file);
  }
}

if (findings.length === 0) {
  console.log('✅ Audit lazy: tous les usages passent par lazyWithRetry.');
  process.exit(0);
}
console.error('⚠️  Fichiers utilisant React.lazy sans lazyWithRetry :');
for (const f of findings) console.error('  - ' + f);
process.exit(1);
