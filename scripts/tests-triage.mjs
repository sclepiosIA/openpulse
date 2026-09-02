#!/usr/bin/env node
/**
 * Test triage — action 30.2 (classes 2-5).
 *
 * Scanne les fichiers de test et classe les patterns fragiles connus
 * (catalogue de triage 2026-07). Écrit docs/audits/tests/triage.md.
 *
 * Classes couvertes :
 *   2. Assertions Tailwind périmées   (toHaveClass sur classes utilitaires
 *      renommées : bg-primary/10, text-muted-foreground, h-10, etc.)
 *   3. Noms de channels Realtime dynamiques hardcodés
 *      (supabase.channel('foo-bar') dans un test mais code applicatif
 *       utilise un suffixe uuid/user_id)
 *   4. Timezone : new Date('YYYY-MM-DD') sans TZ + assertion sur ISO
 *   5. Mocks de rôles manquants (useAuth mocké sans user_roles / has_role)
 *
 * Non-blocking : rapport uniquement, pas de modification de code.
 */
import { readdirSync, readFileSync, statSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const ROOT = "src";
const OUT = "docs/audits/tests";

const PATTERNS = {
  "class2-tailwind-brittle": [
    /toHaveClass\(['"][^'"]*(bg-primary|text-muted-foreground|border-input|ring-offset-background|h-10|w-10|px-4|py-2)[^'"]*['"]/,
  ],
  "class3-channel-hardcoded": [
    /\.channel\(['"][a-z0-9_-]+['"]\)/i,
  ],
  "class4-timezone-naive": [
    /new Date\(['"]\d{4}-\d{2}-\d{2}['"]\)/,
    /toISOString\(\)\.slice\(0,\s*10\)/,
  ],
  "class5-role-mock-missing": [
    // useAuth mocké sans jamais mentionner user_roles/has_role/app_role
    /vi\.mock\(['"].*useAuth['"]/,
  ],
};

function walk(dir, acc = []) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    const s = statSync(p);
    if (s.isDirectory()) walk(p, acc);
    else if (/\.(test|deep\d*\.test)\.(ts|tsx)$/.test(e)) acc.push(p);
  }
  return acc;
}

const files = walk(ROOT);
const buckets = Object.fromEntries(Object.keys(PATTERNS).map((k) => [k, []]));

for (const f of files) {
  const src = readFileSync(f, "utf8");
  for (const [klass, rxs] of Object.entries(PATTERNS)) {
    for (const rx of rxs) {
      if (rx.test(src)) {
        // Classe 5 : vérifier qu'aucun mock de rôle n'est présent
        if (klass === "class5-role-mock-missing") {
          if (/user_roles|has_role|app_role/.test(src)) break;
        }
        buckets[klass].push(f);
        break;
      }
    }
  }
}

mkdirSync(OUT, { recursive: true });
const md = [
  "# Triage tests — classes 2 à 5 (action 30.2)",
  "",
  `Scan sur ${files.length} fichiers de test.`,
  "",
  ...Object.entries(buckets).flatMap(([k, list]) => [
    `## ${k} — ${list.length} fichier(s)`,
    "",
    ...list.slice(0, 50).map((f) => `- \`${f}\``),
    list.length > 50 ? `- … +${list.length - 50} autres` : "",
    "",
  ]),
].join("\n");
writeFileSync(join(OUT, "triage.md"), md);

console.log(`✓ ${files.length} tests scannés → ${OUT}/triage.md`);
for (const [k, list] of Object.entries(buckets)) {
  console.log(`  ${k.padEnd(32)} ${list.length}`);
}
