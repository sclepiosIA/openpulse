#!/usr/bin/env node
/**
 * Migrations inventory — action 180.3 (squash on-premise prep).
 *
 * Produces a JSON snapshot + markdown report of all migrations under
 * supabase/migrations/, classifying them by dominant SQL verb.
 *
 * Non-blocking: writes artifacts under docs/audits/migration/ and prints
 * a summary. Intended to feed the eventual squash + on-premise bootstrap.
 */
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const MIGRATIONS_DIR = "supabase/migrations";
const OUT_DIR = "docs/audits/migration";

const CATEGORIES = [
  ["create_table", /\bcreate\s+(or\s+replace\s+)?table\b/i],
  ["alter_table", /\balter\s+table\b/i],
  ["create_policy", /\bcreate\s+policy\b/i],
  ["drop_policy", /\bdrop\s+policy\b/i],
  ["create_function", /\bcreate\s+(or\s+replace\s+)?function\b/i],
  ["create_trigger", /\bcreate\s+(or\s+replace\s+)?trigger\b/i],
  ["create_index", /\bcreate\s+(unique\s+)?index\b/i],
  ["grant", /\bgrant\b/i],
  ["insert_seed", /\binsert\s+into\b/i],
  ["drop", /\bdrop\s+(table|function|trigger|policy|index)\b/i],
];

function classify(sql) {
  const hits = new Set();
  for (const [name, rx] of CATEGORIES) {
    if (rx.test(sql)) hits.add(name);
  }
  return [...hits];
}

const files = readdirSync(MIGRATIONS_DIR)
  .filter((f) => f.endsWith(".sql"))
  .sort();

const inventory = [];
const counters = Object.fromEntries(CATEGORIES.map(([k]) => [k, 0]));
let totalBytes = 0;

for (const file of files) {
  const p = join(MIGRATIONS_DIR, file);
  const sql = readFileSync(p, "utf8");
  totalBytes += sql.length;
  const cats = classify(sql);
  for (const c of cats) counters[c]++;
  inventory.push({
    file,
    bytes: sql.length,
    categories: cats,
  });
}

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(
  join(OUT_DIR, "inventory.json"),
  JSON.stringify({ total: files.length, totalBytes, counters, files: inventory }, null, 2),
);

const md = [
  "# Inventaire des migrations (action 180.3)",
  "",
  `- Total migrations: **${files.length}**`,
  `- Taille cumulée: **${(totalBytes / 1024).toFixed(1)} KiB**`,
  `- Première: \`${files[0]}\``,
  `- Dernière: \`${files.at(-1)}\``,
  "",
  "## Répartition par catégorie (nombre de migrations contenant le verbe)",
  "",
  "| Catégorie | Nombre |",
  "|---|---|",
  ...CATEGORIES.map(([k]) => `| ${k} | ${counters[k]} |`),
  "",
  "> Snapshot destiné à préparer le squash + bootstrap on-premise.",
  "> Régénérer via `node scripts/migrations-inventory.mjs`.",
  "",
].join("\n");
writeFileSync(join(OUT_DIR, "inventory.md"), md);

console.log(`✓ Inventaire écrit dans ${OUT_DIR}/ (${files.length} migrations)`);
for (const [k, v] of Object.entries(counters)) {
  console.log(`  ${k.padEnd(18)} ${v}`);
}
