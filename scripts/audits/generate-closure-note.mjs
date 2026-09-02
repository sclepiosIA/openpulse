#!/usr/bin/env node
/**
 * generate-closure-note.mjs — Génère automatiquement une note d'archive
 * standardisée pour un correctif d'audit (run e2e / triage).
 *
 * Sortie : un fichier markdown `audits/archives/closure-<run>-<slug>.md`
 *          + (optionnel) déplacement du rapport audit dans `archive/` du dossier.
 *
 * Usage :
 *   node scripts/audits/generate-closure-note.mjs \
 *     --run run-1782663570 \
 *     --title "Crash global useSupportOpenCount (Realtime)" \
 *     --root-cause "Réutilisation du channel 'support-tickets-badge' en StrictMode → 'cannot add postgres_changes callbacks after subscribe()' non capturée → ErrorBoundary global." \
 *     --fix "src/hooks/support/useSupportOpenCount.ts,src/lib/realtimeMonitor.ts,src/lib/frontendErrorCapture.ts" \
 *     --tests "src/hooks/support/useSupportOpenCount.test.ts,src/hooks/support/useSupportOpenCount.deep.test.ts,tests/e2e/support-realtime-remount.spec.ts" \
 *     --routes "/rd,/projets,/support,/people,/recrutement" \
 *     --archive-audit audits/e2e/audit-run-1782663570.md \
 *     --archive-triage audits/auto/triage-run-1782663570.json
 *
 * Tous les flags sauf --run et --root-cause sont optionnels.
 * Multiples invocations pour des correctifs similaires => même template,
 * même nommage => trace homogène et grep-able.
 */

import fs from 'node:fs';
import path from 'node:path';

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const val = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : 'true';
      args[key] = val;
    }
  }
  return args;
}

function list(v) {
  return v ? v.split(',').map((s) => s.trim()).filter(Boolean) : [];
}

function slugify(s) {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function mvIfExists(src) {
  if (!src || !fs.existsSync(src)) return null;
  const dir = path.dirname(src);
  const base = path.basename(src);
  const archiveDir = path.join(dir, 'archive');
  fs.mkdirSync(archiveDir, { recursive: true });
  const dest = path.join(archiveDir, base.replace(/(\.[^.]+)$/, '.CLOSED$1'));
  fs.renameSync(src, dest);
  return dest;
}

function bulletList(items) {
  if (!items.length) return '_(aucun)_';
  return items.map((i) => `- \`${i}\``).join('\n');
}

function main() {
  const args = parseArgs(process.argv);
  if (!args.run || !args['root-cause']) {
    console.error('Usage: --run <id> --root-cause <text> [--title ...] [--fix a,b] [--tests a,b] [--routes a,b] [--archive-audit path] [--archive-triage path]');
    process.exit(1);
  }

  const run = args.run;
  const title = args.title || 'Correctif audit';
  const rootCause = args['root-cause'];
  const fixed = list(args.fix);
  const tests = list(args.tests);
  const routes = list(args.routes);
  const date = todayIso();
  const slug = slugify(title);

  const archivedAudit = args['archive-audit'] ? mvIfExists(args['archive-audit']) : null;
  const archivedTriage = args['archive-triage'] ? mvIfExists(args['archive-triage']) : null;

  const out = `# 🗂 Note de clôture — ${title}

> Note générée automatiquement par \`scripts/audits/generate-closure-note.mjs\`.
> Format standard pour tracer les correctifs similaires (même root cause Realtime,
> même pattern de fix, mêmes tests de non-régression).

## 📌 Run concerné

- **Run id** : \`${run}\`
- **Date de clôture** : ${date}
- **Audit archivé** : ${archivedAudit ? `\`${archivedAudit}\`` : '_(non déplacé)_'}
- **Triage archivé** : ${archivedTriage ? `\`${archivedTriage}\`` : '_(non déplacé)_'}

## 🔬 Cause racine

${rootCause}

## 🛠 Fichiers corrigés

${bulletList(fixed)}

## 🧪 Tests mis à jour / ajoutés

${bulletList(tests)}

## 🧭 Routes / surfaces vérifiées

${bulletList(routes)}

## ✅ Critère d'acceptation

Le scénario de repro du run \`${run}\` ne reproduit plus le défaut :
- aucune exception non capturée dans la console sur les routes listées,
- aucun écran \`ErrorBoundary\` global déclenché,
- les tests listés ci-dessus passent localement (\`bunx vitest run\` / \`playwright test\`).

---

_Note générée le ${date} — slug \`${slug}\`._
`;

  const archivesDir = 'audits/archives';
  fs.mkdirSync(archivesDir, { recursive: true });
  const outPath = path.join(archivesDir, `closure-${run}-${slug}.md`);
  fs.writeFileSync(outPath, out, 'utf8');
  console.log(`✅ Note de clôture écrite : ${outPath}`);
  if (archivedAudit) console.log(`   ↳ audit déplacé : ${archivedAudit}`);
  if (archivedTriage) console.log(`   ↳ triage déplacé : ${archivedTriage}`);
}

main();
