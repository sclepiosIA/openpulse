#!/usr/bin/env node
/**
 * Update badges/coverage.svg from coverage/coverage-summary.json.
 * Action 30.3 (audit Fable 5) — remplace le badge statique 80 % par la
 * couverture réellement mesurée en CI.
 *
 * Usage : `node scripts/update-coverage-badge.mjs`
 * Non-blocking : si le fichier de couverture n'existe pas, le badge est
 * régénéré avec la mention "unknown" et le script sort en code 0.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";

const SUMMARY = "coverage/coverage-summary.json";
const OUT = "badges/coverage.svg";

function color(pct) {
  if (pct >= 90) return "#4c1";        // brightgreen
  if (pct >= 80) return "#97ca00";     // green
  if (pct >= 70) return "#a4a61d";     // yellowgreen
  if (pct >= 60) return "#dfb317";     // yellow
  if (pct >= 50) return "#fe7d37";     // orange
  return "#e05d44";                    // red
}

function badgeSvg(label, value, valueColor) {
  const labelWidth = 62;
  const valueWidth = Math.max(38, value.length * 7 + 12);
  const total = labelWidth + valueWidth;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${total}" height="20" role="img" aria-label="${label}: ${value}">
<title>${label}: ${value}</title>
<linearGradient id="s" x2="0" y2="100%"><stop offset="0" stop-color="#bbb" stop-opacity=".1"/><stop offset="1" stop-opacity=".1"/></linearGradient>
<clipPath id="r"><rect width="${total}" height="20" rx="3" fill="#fff"/></clipPath>
<g clip-path="url(#r)">
<rect width="${labelWidth}" height="20" fill="#555"/>
<rect x="${labelWidth}" width="${valueWidth}" height="20" fill="${valueColor}"/>
<rect width="${total}" height="20" fill="url(#s)"/>
</g>
<g fill="#fff" text-anchor="middle" font-family="Verdana,DejaVu Sans,sans-serif" text-rendering="geometricPrecision" font-size="110">
<text x="${labelWidth * 5}" y="150" transform="scale(.1)" fill="#010101" fill-opacity=".3" textLength="${(labelWidth - 10) * 10}">${label}</text>
<text x="${labelWidth * 5}" y="140" transform="scale(.1)" textLength="${(labelWidth - 10) * 10}">${label}</text>
<text x="${(labelWidth + valueWidth / 2) * 10}" y="150" transform="scale(.1)" fill="#010101" fill-opacity=".3" textLength="${(valueWidth - 10) * 10}">${value}</text>
<text x="${(labelWidth + valueWidth / 2) * 10}" y="140" transform="scale(.1)" textLength="${(valueWidth - 10) * 10}">${value}</text>
</g>
</svg>`;
}

let value = "unknown";
let valueColor = "#9f9f9f";

if (existsSync(SUMMARY)) {
  const summary = JSON.parse(readFileSync(SUMMARY, "utf8"));
  const pct = summary?.total?.lines?.pct;
  if (typeof pct === "number") {
    value = `${pct.toFixed(1)}%`;
    valueColor = color(pct);
  }
} else {
  console.warn(`ℹ  ${SUMMARY} introuvable — badge en 'unknown'.`);
}

mkdirSync("badges", { recursive: true });
writeFileSync(OUT, badgeSvg("coverage", value, valueColor));
console.log(`✓ ${OUT} → coverage: ${value}`);
