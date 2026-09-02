#!/usr/bin/env node
/**
 * Audit PageDataState: liste les pages qui font du fetch async (useQuery/useEffect + supabase)
 * mais n'enrobent PAS le rendu dans <PageDataState>. Sortie non bloquante (exit 0),
 * utilisée comme rapport de progression Chantier 2.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) out.push(...walk(p));
    else if (/\.(tsx)$/.test(p) && !p.includes('.test.') && !p.includes('/__tests__/')) out.push(p);
  }
  return out;
}

const files = walk('src/pages');
const missing = [];
let covered = 0;

for (const f of files) {
  const src = readFileSync(f, 'utf8');
  const doesAsync = /useQuery\(|supabase\.\w+\(/.test(src);
  if (!doesAsync) continue;
  const hasState = /<PageDataState\b/.test(src) || /PageDataState\s*[\{,]/.test(src);
  if (hasState) covered++;
  else missing.push(f);
}

const total = covered + missing.length;
const ratio = total ? Math.round((covered / total) * 100) : 100;
console.log(`📊 PageDataState coverage: ${covered}/${total} pages (${ratio}%)`);
if (missing.length) {
  console.log('\nPages sans <PageDataState> (top 30) :');
  missing.slice(0, 30).forEach((f) => console.log('  - ' + f));
  if (missing.length > 30) console.log(`  ... et ${missing.length - 30} de plus`);
}
process.exit(0);
