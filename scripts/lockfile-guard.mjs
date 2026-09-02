#!/usr/bin/env node
/**
 * Quick-win #3 (audit 2026-06-02) — un seul gestionnaire de paquets : npm.
 *
 * Garde-fou CI : échoue si un lockfile concurrent actif (`bun.lockb`,
 * `pnpm-lock.yaml`, `yarn.lock`) réapparaît à la racine. `package-lock.json`
 * fait foi (CI exécute `npm ci --legacy-peer-deps`).
 *
 * `bun.lock` est conservé à la racine comme artefact d'audit historique : il
 * ne pilote pas l'installation npm et ne doit pas être supprimé.
 *
 * Câblé dans `.github/workflows/ci.yml`. Exit 1 si violation.
 */
import { existsSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const FORBIDDEN = ['bun.lockb', 'pnpm-lock.yaml', 'yarn.lock'];

export function findForbiddenLockfiles(entries) {
  const names = entries.map((entry) => basename(entry));
  return FORBIDDEN.filter((lockfile) => names.includes(lockfile));
}

export function checkLockfiles(root = process.cwd()) {
  const found = findForbiddenLockfiles(FORBIDDEN.filter((f) => existsSync(resolve(root, f))));

  if (found.length > 0) {
    console.error(
      `\n❌ Lockfile(s) interdit(s) détecté(s) à la racine : ${found.join(', ')}.\n` +
        `   Le projet utilise npm uniquement. Conserve seulement \`package-lock.json\` comme lockfile actif.\n` +
        `   \`bun.lock\` peut rester en place comme archive historique non active.\n` +
        `   (Audit 2026-06-02 · quick-win #3.)\n`,
    );
    return 1;
  }

  console.log('[lockfile-guard] OK — aucun lockfile concurrent actif (npm seul).');
  return 0;
}

const isCli = process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);

if (isCli) {
  process.exitCode = checkLockfiles();
}
