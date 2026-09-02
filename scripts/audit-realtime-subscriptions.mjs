#!/usr/bin/env node
/**
 * Audit Realtime subscriptions.
 *
 * Détecte les usages de `supabase.channel(` qui risquent de fuiter :
 *  - appel hors d'un `useEffect` (module scope ou render body)
 *  - absence de `removeChannel` dans le cleanup
 *
 * Sortie: liste des occurrences suspectes + code de sortie != 0 si des
 * fuites sont détectées, pour usage en CI.
 */
import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const files = execSync("rg -l 'supabase\\.channel\\(' src/", { encoding: 'utf8' })
  .split('\n')
  .filter(Boolean);

const findings = [];

for (const file of files) {
  const src = readFileSync(file, 'utf8');
  const hasChannel = /supabase\.channel\(/.test(src);
  const hasRemove = /removeChannel\(/.test(src);
  const hasUseEffect = /useEffect\s*\(/.test(src);

  // Fichiers "lib" non-hook: on tolère un pattern factory/refcount explicite.
  const isLib = file.startsWith('src/lib/');
  if (isLib) continue;

  if (hasChannel && !hasRemove) {
    findings.push({ file, reason: 'channel() sans removeChannel()' });
  }
  if (hasChannel && !hasUseEffect) {
    findings.push({ file, reason: 'channel() hors useEffect' });
  }
}

if (findings.length === 0) {
  console.log('✅ Audit Realtime : aucun leak détecté.');
  process.exit(0);
}

console.error('❌ Audit Realtime : fuites potentielles détectées');
for (const f of findings) {
  console.error(`  - ${f.file} — ${f.reason}`);
}
process.exit(1);
