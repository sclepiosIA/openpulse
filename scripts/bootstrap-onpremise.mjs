#!/usr/bin/env node
/**
 * bootstrap-onpremise.mjs — squelette (action 180.4 étape E)
 *
 * Applique dans l'ordre les 8 fichiers squashés supabase/migrations/00000000000000_*.sql
 * à une base PostgreSQL cible (self-hosted Supabase / on-premise client).
 *
 * Usage:
 *   DATABASE_URL=postgres://... node scripts/bootstrap-onpremise.mjs [--dry-run]
 *
 * Prérequis:
 *   - Base vierge (pas de schéma public existant), extensions activables.
 *   - Utilisateur avec droits SUPERUSER ou équivalent (create extension).
 *
 * Non-blocking: si les fichiers squashés n'existent pas encore, le script
 * liste ce qui serait appliqué et sort en code 0 (mode preview).
 */
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const MIGRATIONS_DIR = "supabase/migrations";
const SQUASH_PREFIX = "00000000000000_";
const EXPECTED_ORDER = [
  "00_extensions",
  "01_enums",
  "02_tables",
  "03_indexes",
  "04_functions",
  "05_triggers",
  "06_grants",
  "07_policies",
  "08_seeds",
];

const dryRun = process.argv.includes("--dry-run");
const dbUrl = process.env.DATABASE_URL;

function resolveSquashFiles() {
  if (!existsSync(MIGRATIONS_DIR)) return [];
  const all = readdirSync(MIGRATIONS_DIR);
  return EXPECTED_ORDER
    .map((slug) => all.find((f) => f.startsWith(SQUASH_PREFIX) && f.includes(slug)))
    .filter(Boolean)
    .map((f) => join(MIGRATIONS_DIR, f));
}

const files = resolveSquashFiles();

if (files.length === 0) {
  console.log("ℹ  Aucun fichier squashé détecté (préfixe " + SQUASH_PREFIX + ").");
  console.log("   Ordre attendu une fois le squash effectué :");
  for (const slug of EXPECTED_ORDER) console.log("     - " + SQUASH_PREFIX + slug + ".sql");
  console.log("   Régénérer via le plan docs/audits/migration/SQUASH-PLAN.md.");
  process.exit(0);
}

if (files.length !== EXPECTED_ORDER.length) {
  console.error(`✗ Squash incomplet : ${files.length}/${EXPECTED_ORDER.length} fichiers trouvés.`);
  process.exit(1);
}

console.log(`→ Bootstrap on-premise (${files.length} fichiers squashés)`);
for (const f of files) {
  const bytes = readFileSync(f).length;
  console.log(`  • ${f}  (${(bytes / 1024).toFixed(1)} KiB)`);
}

if (dryRun) {
  console.log("\n(dry-run) Aucune exécution SQL — fin.");
  process.exit(0);
}

if (!dbUrl) {
  console.error("✗ DATABASE_URL manquant. Aborter.");
  process.exit(1);
}

// Exécution réelle : déléguée à `psql` pour éviter une dépendance runtime `pg`.
// Chaque fichier est appliqué dans une transaction dédiée.
import { spawnSync } from "node:child_process";
let failed = false;
for (const f of files) {
  console.log(`\n▶ Applying ${f} ...`);
  const r = spawnSync(
    "psql",
    [dbUrl, "-v", "ON_ERROR_STOP=1", "--single-transaction", "-f", f],
    { stdio: "inherit" },
  );
  if (r.status !== 0) {
    console.error(`✗ Echec sur ${f}`);
    failed = true;
    break;
  }
}
process.exit(failed ? 1 : 0);
