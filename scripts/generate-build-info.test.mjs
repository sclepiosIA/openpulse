import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { createBuildInfo, resolveBuildSha, sameFile } from './generate-build-info.mjs';

test('publie un SHA Git complet avec le dépôt canonique', () => {
  const sha = 'a'.repeat(40);
  assert.deepEqual(createBuildInfo({ OPENPULSE_GIT_SHA: sha, OPENPULSE_BUILD_AT: '2026-07-20T00:00:00Z' }, 'marqueIA/marque-client-compass'), {
    schema_version: 1,
    repo: 'marqueIA/marque-client-compass',
    git_sha: sha,
    built_at: '2026-07-20T00:00:00Z',
  });
});

test('résout les alias de chemin avant de détecter le module principal', () => {
  const canonical = (value) => value.replace('/private/tmp/', '/tmp/');
  assert.equal(sameFile('/tmp/build/script.mjs', '/private/tmp/build/script.mjs', canonical), true);
});

test('ignore un SHA de runner hérité hors CI et utilise le HEAD du worktree', () => {
  const head = 'b'.repeat(40);
  assert.equal(
    resolveBuildSha({ GITHUB_SHA: 'a'.repeat(40), OPENPULSE_GIT_SHA: 'c'.repeat(40) }, head),
    head,
  );
  assert.equal(resolveBuildSha({ OPENPULSE_GIT_SHA: 'c'.repeat(40) }, ''), 'c'.repeat(40));
});

test('utilise le SHA du runner en CI et respecte toujours l’override explicite', () => {
  const head = 'b'.repeat(40);
  assert.equal(resolveBuildSha({ CI: 'true', GITHUB_SHA: 'a'.repeat(40) }, head), 'a'.repeat(40));
  assert.equal(
    resolveBuildSha({ CI: 'true', GITHUB_SHA: 'a'.repeat(40), OPENPULSE_GIT_SHA: 'c'.repeat(40) }, head),
    'c'.repeat(40),
  );
});

test('le build Docker conserve le générateur jusqu’au prebuild Vite', () => {
  const dockerfile = readFileSync('docker/Dockerfile.frontend', 'utf8');
  assert.doesNotMatch(dockerfile, /RUN rm -rf[^\n]*\bscripts\b/);
  assert.match(dockerfile, /ARG OPENPULSE_GIT_SHA/);
  assert.match(dockerfile, /NODE_OPTIONS=--max-old-space-size=8192/);
});

test('refuse un SHA abrégé', () => {
  assert.throws(() => createBuildInfo({ OPENPULSE_GIT_SHA: '725547c' }, 'marqueIA/marque-client-compass'), /40 caractères/);
});
