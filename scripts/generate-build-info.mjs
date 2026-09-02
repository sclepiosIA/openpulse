import { execFileSync } from 'node:child_process';
import { realpathSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const FULL_SHA = /^[0-9a-f]{40}$/i;

export function createBuildInfo(env, repo) {
  const gitSha = String(env.OPENPULSE_GIT_SHA || env.GITEA_SHA || env.GITHUB_SHA || '').trim().toLowerCase();
  if (!FULL_SHA.test(gitSha)) throw new Error('OPENPULSE_GIT_SHA doit contenir un SHA Git complet de 40 caractères');
  if (!repo || !repo.includes('/')) throw new Error('Le dépôt canonique owner/name est requis');
  return { schema_version: 1, repo, git_sha: gitSha, built_at: env.OPENPULSE_BUILD_AT || new Date().toISOString() };
}

export function resolveBuildSha(env, headSha) {
  const isCi = env.CI === 'true' || env.GITHUB_ACTIONS === 'true' || env.GITEA_ACTIONS === 'true';
  if (!isCi && headSha) return headSha;
  const explicit = String(env.OPENPULSE_GIT_SHA || '').trim();
  if (explicit) return explicit;
  if (isCi) {
    const runnerSha = String(env.GITEA_SHA || env.GITHUB_SHA || '').trim();
    if (runnerSha) return runnerSha;
  }
  return headSha;
}

function git(...args) {
  return execFileSync('git', args, { encoding: 'utf8' }).trim();
}

async function main() {
  // Le depot canonique est propre a chaque instance : argument, puis
  // variable d'environnement, puis un defaut neutre.
  const repo = process.argv[2] || process.env.OPENPULSE_REPO || 'openpulse/openpulse';
  let headSha = '';
  try {
    headSha = git('rev-parse', 'HEAD');
  } catch {
    // Les builds Docker minimaux n'embarquent pas .git et fournissent OPENPULSE_GIT_SHA.
  }
  const env = {
    ...process.env,
    OPENPULSE_GIT_SHA: resolveBuildSha(process.env, headSha),
    OPENPULSE_BUILD_AT:
      process.env.OPENPULSE_BUILD_AT ||
      (headSha ? git('show', '-s', '--format=%cI', 'HEAD') : new Date().toISOString()),
  };
  const info = createBuildInfo(env, repo);
  await mkdir('public', { recursive: true });
  await writeFile('public/build-info.json', `${JSON.stringify(info, null, 2)}\n`, 'utf8');
  process.stdout.write(`build-info ${info.repo}@${info.git_sha}\n`);
}

export function sameFile(left, right, realpath = realpathSync) {
  try { return realpath(left) === realpath(right); } catch { return false; }
}

if (process.argv[1] && sameFile(path.resolve(process.argv[1]), fileURLToPath(import.meta.url))) await main();
