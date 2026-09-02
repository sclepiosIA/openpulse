#!/usr/bin/env node
/**
 * Runner mutation testing sur les 5 modules pilotes (audit Fable 5 · 90.2).
 *
 * Exécute Stryker séquentiellement sur chaque module, agrège les scores dans
 * docs/audits/tests/mutation-pilotes.md. Non-blocking : ce script est appelé
 * manuellement ou par le workflow hebdomadaire (pas en gate PR — Stryker
 * consomme trop de temps CPU pour être bloquant).
 *
 * Usage : `node scripts/mutation-pilotes.mjs`
 */
import { spawnSync } from "node:child_process";
import { readFileSync, existsSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const MODULES = ["lib", "hooks-email", "hooks-tresorerie", "components-email", "utils"];
const OUT = "docs/audits/tests";
const results = [];

for (const mod of MODULES) {
  console.log(`\n===== stryker ${mod} =====`);
  const r = spawnSync("npx", ["stryker", "run"], {
    stdio: "inherit",
    env: { ...process.env, STRYKER_MODULE: mod },
  });
  const jsonPath = join("reports/mutation", `${mod}.json`);
  let score = null;
  let killed = 0, survived = 0, noCoverage = 0, timeout = 0;
  if (existsSync(jsonPath)) {
    try {
      const data = JSON.parse(readFileSync(jsonPath, "utf8"));
      // Stryker JSON reporter structure : files -> mutants -> status
      for (const f of Object.values(data.files ?? {})) {
        for (const m of f.mutants ?? []) {
          if (m.status === "Killed") killed++;
          else if (m.status === "Survived") survived++;
          else if (m.status === "NoCoverage") noCoverage++;
          else if (m.status === "Timeout") timeout++;
        }
      }
      const total = killed + survived + noCoverage + timeout;
      score = total > 0 ? ((killed + timeout) / total) * 100 : null;
    } catch (e) {
      console.warn(`  ⚠ Impossible de parser ${jsonPath}: ${e.message}`);
    }
  }
  results.push({ mod, status: r.status, score, killed, survived, noCoverage, timeout });
}

mkdirSync(OUT, { recursive: true });
const md = [
  "# Mutation testing — 5 modules pilotes (action 90.2)",
  "",
  `Run: ${new Date().toISOString()}`,
  "",
  "| Module | Score | Killed | Survived | NoCov | Timeout | Exit |",
  "|---|---|---|---|---|---|---|",
  ...results.map((r) => {
    const s = r.score == null ? "n/a" : `${r.score.toFixed(1)} %`;
    return `| ${r.mod} | ${s} | ${r.killed} | ${r.survived} | ${r.noCoverage} | ${r.timeout} | ${r.status} |`;
  }),
  "",
  "## Interprétation",
  "",
  "- **NoCoverage élevé** : tests présents mais qui n'exercent pas le code muté → candidats suppression / renforcement.",
  "- **Survived élevé** : assertions trop laxistes → renforcer.",
  "- **Score < 50 %** : module non protégé contre les régressions logiques.",
  "",
  "Cible audit : identifier ~30 % de fichiers deep2-deep5 à retirer sur ces modules sans baisse de score.",
  "",
].join("\n");
writeFileSync(join(OUT, "mutation-pilotes.md"), md);
console.log(`\n✓ Rapport écrit dans ${OUT}/mutation-pilotes.md`);
