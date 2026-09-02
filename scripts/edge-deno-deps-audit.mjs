#!/usr/bin/env node
/**
 * Audit des dépendances Deno des Edge Functions — action 180.6.
 *
 * Recense toutes les URLs importées par les Edge Functions, groupe par
 * module + version, et flag les fragmentations (plusieurs versions d'un
 * même package = risque de divergence de comportement + poids CPU cold-start).
 *
 * Écrit docs/audits/edge/deno-deps.md. Non-blocking (rapport seulement).
 */
import { readdirSync, readFileSync, statSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const ROOT = "supabase/functions";
const OUT = "docs/audits/edge";
const IMPORT_RX = /from\s+["']([a-z]+:\/\/[^"']+)["']/gi;
// Files allowed to keep raw URL imports (they ARE the centralized source).
const SHARED_ALLOWLIST = new Set(["supabase/functions/_shared/deps.ts"]);

function walk(dir, acc = []) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    const s = statSync(p);
    if (s.isDirectory()) walk(p, acc);
    else if (/\.(ts|mts)$/.test(e) && !/\.test\.ts$/.test(e)) acc.push(p);
  }
  return acc;
}

const files = walk(ROOT);
const byUrl = new Map();
const byPkg = new Map();

function extractPkgVersion(url) {
  // deno.land/std@X.Y.Z/... or esm.sh/pkg@X.Y.Z/...
  const m = url.match(/^(https?:\/\/[^/]+\/(?:x\/|@[^/]+\/)?[^@/]+)@([^/]+)/);
  if (m) return { pkg: m[1], version: m[2] };
  const stripped = url.replace(/^https?:\/\//, "").split("/").slice(0, 2).join("/");
  return { pkg: stripped, version: "unpinned" };
}

for (const f of files) {
  const src = readFileSync(f, "utf8");
  const seen = new Set();
  for (const m of src.matchAll(IMPORT_RX)) {
    const url = m[1];
    seen.add(url);
  }
  for (const url of seen) {
    byUrl.set(url, (byUrl.get(url) ?? 0) + 1);
    const { pkg, version } = extractPkgVersion(url);
    if (!byPkg.has(pkg)) byPkg.set(pkg, new Map());
    const v = byPkg.get(pkg);
    v.set(version, (v.get(version) ?? 0) + 1);
  }
}

const fragmented = [...byPkg.entries()]
  .filter(([, versions]) => versions.size > 1)
  .sort((a, b) => b[1].size - a[1].size);

mkdirSync(OUT, { recursive: true });
const md = [
  "# Audit dépendances Deno — Edge Functions (action 180.6)",
  "",
  `Scan: ${files.length} fichiers .ts sous \`supabase/functions/\`.`,
  `URLs uniques : ${byUrl.size}. Packages distincts : ${byPkg.size}.`,
  "",
  "## Packages fragmentés (≥ 2 versions coexistantes)",
  "",
  "| Package | # versions | Versions (occurrences) |",
  "|---|---|---|",
  ...fragmented.map(([pkg, versions]) => {
    const cells = [...versions.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([v, n]) => `${v} (${n})`)
      .join(", ");
    return `| \`${pkg}\` | ${versions.size} | ${cells} |`;
  }),
  "",
  "## Top 20 URLs par nombre de fichiers",
  "",
  "| URL | # fichiers |",
  "|---|---|",
  ...[...byUrl.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([url, n]) => `| \`${url}\` | ${n} |`),
  "",
  "## Recommandations",
  "",
  "1. **Consolider `deno.land/std`** : cible unique `@0.224.0` (LTS actuel). ",
  "   Migration des ~213 imports en `@0.168.0` restants.",
  "2. **Épingler `@supabase/supabase-js`** : figer sur `2.58.0` partout ",
  "   (retirer les `@2`, `@2.39.7`, `@2.45.0`, etc.).",
"3. **Centraliser** dans `supabase/functions/_shared/deps.ts` (créé S19) : ",
  "   les nouvelles fonctions importent depuis ce fichier ; migration batch ",
  "   des existantes par domaine (email S+1, jarvis S+2, etc.).",
  "",
].join("\n");
writeFileSync(join(OUT, "deno-deps.md"), md);

console.log(`✓ ${files.length} fichiers scannés → ${OUT}/deno-deps.md`);
console.log(`  URLs uniques   : ${byUrl.size}`);
console.log(`  Packages       : ${byPkg.size}`);
console.log(`  Fragmentés ≥2v : ${fragmented.length}`);
for (const [pkg, versions] of fragmented.slice(0, 5)) {
  console.log(`    ${pkg}  → ${versions.size} versions`);
}
