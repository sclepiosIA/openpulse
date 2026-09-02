#!/usr/bin/env node
/**
 * codecov-absence-guard — action 30.4 (audit Fable 5).
 *
 * `codecov` npm est déprécié (le projet CodecovIO recommande l'action GitHub).
 * Constat 2026-07 : absent de package.json (dependencies + devDependencies),
 * mais présent en phantom dans package-lock.json via un ancien install.
 * Il sera purgé au prochain `npm ci` propre.
 *
 * Ce gate empêche toute réintroduction dans les manifestes.
 */
import { readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const FORBIDDEN = ["codecov"];
const failures = [];

for (const name of FORBIDDEN) {
  if (pkg.dependencies?.[name]) failures.push(`dependencies.${name}`);
  if (pkg.devDependencies?.[name]) failures.push(`devDependencies.${name}`);
}

if (failures.length) {
  console.error("❌ Paquets interdits présents dans package.json :");
  for (const f of failures) console.error("  - " + f);
  console.error("\nUtiliser l'action GitHub Codecov ou l'artefact coverage-report.");
  process.exit(1);
}
console.log("✅ codecov (déprécié) absent de package.json.");
