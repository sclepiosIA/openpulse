#!/usr/bin/env node
/**
 * Génère docs/tests/HEALTH.md — snapshot de la santé de la suite.
 * Ne lance aucun test : agrège les fichiers, coverage-summary.json si présent,
 * et le rapport d'hygiène.
 */
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

function walk(dir, rx, out = []) {
  let entries;
  try { entries = readdirSync(dir); } catch { return out; }
  for (const name of entries) {
    if (name === 'node_modules' || name === 'dist' || name.startsWith('.')) continue;
    const p = join(dir, name);
    const s = statSync(p);
    if (s.isDirectory()) walk(p, rx, out);
    else if (rx.test(name)) out.push(p);
  }
  return out;
}

const front = walk('src', /\.(test|spec)\.(ts|tsx)$/);
const edge = walk('supabase/functions', /(_test\.ts|\.test\.ts)$/);
const a11y = walk('tests/a11y', /\.test\.tsx?$/);
const e2e = [...walk('e2e', /\.spec\.ts$/), ...walk('tests/e2e', /\.spec\.ts$/)];
const e2eRoot = walk('e2e', /\.spec\.ts$/);
const e2eLegacy = walk('tests/e2e', /\.spec\.ts$/);

let cov = null;
if (existsSync('coverage/coverage-summary.json')) {
  try {
    const j = JSON.parse(readFileSync('coverage/coverage-summary.json', 'utf8'));
    cov = j.total;
  } catch {}
}

mkdirSync('docs/tests', { recursive: true });
const md = [
  `# Test Health — ${new Date().toISOString().slice(0, 10)}`,
  ``,
  `## Inventaire`,
  ``,
  `| Suite | Fichiers |`,
  `|---|---:|`,
  `| Vitest front (\`src/**\`) | ${front.length} |`,
  `| Deno edge functions | ${edge.length} |`,
  `| A11y (jest-axe) | ${a11y.length} |`,
  `| E2E Playwright | ${e2e.length} (racine: ${e2eRoot.length}, tests/e2e: ${e2eLegacy.length}) |`,
  ``,
  `## Couverture front`,
  ``,
  cov
    ? `| Métrique | % |\n|---|---:|\n| Lines | ${cov.lines.pct} |\n| Functions | ${cov.functions.pct} |\n| Branches | ${cov.branches.pct} |\n| Statements | ${cov.statements.pct} |`
    : `_Aucun \`coverage/coverage-summary.json\` — lancer \`bun run test:coverage\`._`,
  ``,
  `## Hygiène`,
  ``,
  `Voir \`docs/tests/HYGIENE.md\` (généré par \`node scripts/check-test-hygiene.mjs --report\`).`,
  ``,
  `## Objectifs (voir PLAN_TESTS_2026-07.md)`,
  ``,
  `- Lines ≥ 90 %, Branches ≥ 85 %`,
  `- E2E : 8 parcours P0 authentifiés (actuel : ${e2e.length})`,
  `- Edge fn critiques ≥ 80 %`,
  `- Mutation ≥ 60 % sur modules critiques`,
  ``,
].join('\n');

writeFileSync('docs/tests/HEALTH.md', md);
console.log('✅ docs/tests/HEALTH.md written');
console.log(`   front=${front.length} edge=${edge.length} a11y=${a11y.length} e2e=${e2e.length}`);
