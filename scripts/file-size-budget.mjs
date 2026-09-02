#!/usr/bin/env node
/**
 * DEBT-02 — budget anti god-files.
 *
 * Bloque toute PR qui crée un nouveau fichier applicatif dépassant le
 * plafond (`MAX_LINES`) ou qui fait remonter un fichier existant
 * au-dessus du baseline gelé.
 *
 * Le plafond est figé manuellement après chaque refacto significative.
 * Cible long-terme : 800 lignes par fichier (cf. memory `technical-debt-status`).
 */
import fs from 'node:fs';
import path from 'node:path';

// Plafond dur — aucun fichier ne doit le dépasser.
// Baseline 2026-06-03 : 2 fichiers > 1250 (MarqueMonitor 1353, AuthenticatedRoutes 1305).
// DEBT-02 clôturé S55 (MarqueMonitor 1353→425, AuthenticatedRoutes 1305→455).
// S56 : plafond baissé 1400 → 1250 (max actuel src = 1219, useGlobalSearch.ts).
// S73 : plafond baissé 1250 → 1200 après refacto DEBT-02 (max actuel src = 1172, GestionUtilisateurs.tsx).
// S81 : plafond baissé 1200 → 1100 — tous les god-components P1 > 1000 L refactorés (S75-S80).
//       Max actuel src applicatif = 1067 (FinderColumnView). Marge confortable.
// S87 : plafond baissé 1100 → 1000 — plus aucun fichier applicatif > 1000 L après EtablissementDetail.tsx (max actuel 993, Etablissements.tsx).
const MAX_LINES = 1000;

// Fichiers exclus (générés / data).
const EXCLUDE = [
  /^src\/integrations\/supabase\/types\.ts$/,
  /^src\/data\//,
  /^src\/lib\/kb-content\//,
  /\.test\.(ts|tsx)$/,
  /\.d\.ts$/,
];

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(e.name)) out.push(p);
  }
  return out;
}

const files = walk('src');
const violations = [];
for (const f of files) {
  const rel = f.replace(/\\/g, '/');
  if (EXCLUDE.some((re) => re.test(rel))) continue;
  const lines = fs.readFileSync(f, 'utf8').split('\n').length;
  if (lines > MAX_LINES) violations.push({ file: rel, lines });
}

violations.sort((a, b) => b.lines - a.lines);

console.log(`[file-size-budget] plafond : ${MAX_LINES} lignes`);
console.log(`[file-size-budget] fichiers analysés : ${files.length}`);
console.log(`[file-size-budget] violations : ${violations.length}`);
for (const v of violations) console.log(`  - ${v.file} : ${v.lines}`);

if (violations.length > 0) {
  console.error(`\n❌ Budget god-files dépassé. Refactorer ou réévaluer MAX_LINES.`);
  process.exit(1);
}
console.log('✅ Budget respecté.');
