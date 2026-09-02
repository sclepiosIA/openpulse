#!/usr/bin/env node
/**
 * Audit Edge Functions : croise `verify_jwt=false` (config.toml) avec
 * l'utilisation de `SUPABASE_SERVICE_ROLE_KEY` + détection d'éléments
 * de hardening (signature HMAC, validation zod, rate limit, error sanitizer).
 *
 * Sortie : docs/audits/edge-functions-public-service-role.csv
 *
 * Plan de remédiation audit 2026-06-06 — P0.3.
 */
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

const ROOT = resolve(process.cwd());
const FUNCTIONS_DIR = join(ROOT, 'supabase/functions');
const CONFIG_TOML = join(ROOT, 'supabase/config.toml');
const OUTPUT = join(ROOT, 'docs/audits/edge-functions-public-service-role.csv');

function parseVerifyJwt(toml) {
  const map = new Map();
  const re = /\[functions\.([^\]]+)\]([\s\S]*?)(?=\n\[|$)/g;
  let m;
  while ((m = re.exec(toml)) !== null) {
    const name = m[1].trim();
    const body = m[2];
    const vj = /verify_jwt\s*=\s*(true|false)/.exec(body);
    map.set(name, vj ? vj[1] === 'true' : null);
  }
  return map;
}

function readIndex(fnDir) {
  for (const f of ['index.ts', 'index.js']) {
    const p = join(fnDir, f);
    if (existsSync(p)) return readFileSync(p, 'utf8');
  }
  return null;
}

function classify(name) {
  if (/webhook|callback/i.test(name)) return 'webhook|callback';
  if (/public|booking|career|emargement|track-/i.test(name)) return 'public-api';
  if (/^oauth-/i.test(name)) return 'oauth';
  if (/^(jarvis|sync|process|generate|enrich|admin)-/i.test(name)) return 'internal-likely';
  return 'unknown';
}

const cfg = parseVerifyJwt(readFileSync(CONFIG_TOML, 'utf8'));
const rows = [];
for (const entry of readdirSync(FUNCTIONS_DIR)) {
  if (entry.startsWith('_')) continue;
  const dir = join(FUNCTIONS_DIR, entry);
  if (!statSync(dir).isDirectory()) continue;
  const code = readIndex(dir);
  if (code === null) continue;
  const verifyJwt = cfg.has(entry) ? cfg.get(entry) : null; // null = not declared (= default)
  const usesServiceRole = /SUPABASE_SERVICE_ROLE_KEY/.test(code);
  const hasSignature = /(hmac|crypto\.subtle|verify.*signature|x-.*signature)/i.test(code);
  const hasZod = /from\s+["']npm:zod|from\s+["']https:\/\/deno\.land\/x\/zod/.test(code);
  const hasRateLimit = /rate.?limit|rateLimit|throttle/i.test(code);
  const hasSanitizer = /error-sanitizer|sanitizeError/i.test(code);
  rows.push({
    function: entry,
    verify_jwt: verifyJwt === null ? 'default' : String(verifyJwt),
    uses_service_role: String(usesServiceRole),
    has_signature_check: String(hasSignature),
    has_zod_validation: String(hasZod),
    has_rate_limit: String(hasRateLimit),
    has_error_sanitizer: String(hasSanitizer),
    category: classify(entry),
    risk: verifyJwt === false && usesServiceRole && !hasSignature ? 'HIGH' : (verifyJwt === false && usesServiceRole ? 'MEDIUM' : 'LOW'),
  });
}

// CSV
const headers = Object.keys(rows[0]);
const csv = [headers.join(','), ...rows.map(r => headers.map(h => r[h]).join(','))].join('\n');
mkdirSync(join(ROOT, 'docs/audits'), { recursive: true });
writeFileSync(OUTPUT, csv + '\n');

const high = rows.filter(r => r.risk === 'HIGH').length;
const med = rows.filter(r => r.risk === 'MEDIUM').length;
console.log(`[edge-fn-audit] ${rows.length} fonctions analysées`);
console.log(`  HIGH risk (verify_jwt=false + service_role + sans signature): ${high}`);
console.log(`  MEDIUM risk (verify_jwt=false + service_role, signature présente): ${med}`);
console.log(`  CSV : ${OUTPUT}`);
