#!/usr/bin/env node
/**
 * scripts/check-migration-grants.mjs
 *
 * CICD-02 Phase 3.1 — Static lint for new migrations.
 *
 * Enforces the project rule (cf. memory & supabase-db guidelines):
 *   « Every CREATE TABLE in the public schema MUST be followed by GRANT
 *     statements in the SAME migration. »
 *
 * Usage:
 *   node scripts/check-migration-grants.mjs <file1.sql> [<file2.sql> ...]
 *
 * Exit codes:
 *   0 — all checked files pass.
 *   1 — at least one CREATE TABLE public.<name> lacks a matching GRANT.
 *   2 — usage error.
 *
 * Heuristic:
 *   For each `CREATE TABLE [IF NOT EXISTS] public.<name>` found in a file,
 *   the same file must also contain at least one `GRANT ... ON public.<name>`
 *   (case-insensitive). We tolerate schema-qualified or bare references
 *   matching the table name. We ignore CREATE TABLE in non-public schemas
 *   (auth/storage/etc are reserved and shouldn't be created by app migrations).
 *
 * False positives: a migration that ONLY alters an existing table won't be
 * flagged (no CREATE TABLE = nothing to check). A migration that creates a
 * table and grants on it in a DO block is detected via substring match.
 */

import { readFileSync } from 'node:fs';
import { basename } from 'node:path';

const files = process.argv.slice(2);
if (files.length === 0) {
  console.error('Usage: check-migration-grants.mjs <file.sql> [...]');
  process.exit(2);
}

const CREATE_RE =
  /create\s+table\s+(?:if\s+not\s+exists\s+)?public\.([a-z_][a-z0-9_]*)/gi;
const GRANT_RE_TPL = (name) =>
  new RegExp(
    `grant\\s+[^;]+\\s+on\\s+(?:table\\s+)?(?:public\\.)?${name}\\b`,
    'i',
  );

let failed = 0;
const failures = [];

for (const file of files) {
  let sql;
  try {
    sql = readFileSync(file, 'utf8');
  } catch (err) {
    console.error(`::error file=${file}::Cannot read: ${err.message}`);
    failed++;
    continue;
  }

  // Strip line comments to avoid matching CREATE TABLE in a comment.
  const stripped = sql
    .replace(/--[^\n]*/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '');

  CREATE_RE.lastIndex = 0;
  const created = new Set();
  let m;
  while ((m = CREATE_RE.exec(stripped)) !== null) {
    created.add(m[1].toLowerCase());
  }

  if (created.size === 0) continue;

  const missing = [];
  for (const name of created) {
    if (!GRANT_RE_TPL(name).test(stripped)) {
      missing.push(name);
    }
  }

  if (missing.length > 0) {
    failed++;
    failures.push({ file, missing });
    for (const name of missing) {
      console.error(
        `::error file=${file}::CREATE TABLE public.${name} without GRANT in same migration (rule: every public table requires explicit GRANTs).`,
      );
    }
  }
}

if (failures.length > 0) {
  console.error('');
  console.error('Migration GRANT lint — FAIL');
  for (const f of failures) {
    console.error(`  • ${basename(f.file)} — missing GRANTs for: ${f.missing.join(', ')}`);
  }
  console.error('');
  console.error(
    'Fix: add `GRANT SELECT, INSERT, UPDATE, DELETE ON public.<name> TO authenticated;`',
  );
  console.error(
    '     and `GRANT ALL ON public.<name> TO service_role;` (plus anon if public reads).',
  );
  process.exit(1);
}

console.log(`Migration GRANT lint — OK (${files.length} file(s) checked).`);
