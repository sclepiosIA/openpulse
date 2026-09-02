import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const workflowPath = fileURLToPath(
  new URL('../../.github/workflows/security-audit.yml', import.meta.url),
);
const workflow = await readFile(workflowPath, 'utf8');
const gates = ['gitleaks', 'semgrep', 'npm-audit', 'type-check', 'eslint-security', 'sbom'];

for (const gate of gates) {
  assert.match(
    workflow,
    new RegExp(`needs\\.${gate}\\.result != 'success'`),
    `security summary must fail when ${gate} does not succeed`,
  );
  assert.match(
    workflow,
    new RegExp(`needs\\.${gate}\\.result == 'success'`),
    `security summary must report ${gate}`,
  );
}

assert.match(workflow, /needs: \[gitleaks, semgrep, npm-audit, type-check, eslint-security, sbom\]/);
assert.doesNotMatch(workflow, /semgrep scan[^\n]*\|\|\s*true/);
assert.doesNotMatch(workflow, /npm audit[^\n]*\|\|\s*true/);
assert.doesNotMatch(workflow, /cyclonedx-npm[^\n]*--ignore-npm-errors/);
assert.doesNotMatch(workflow, /continue-on-error:\s*true/);

const actionRefs = [...workflow.matchAll(/^\s*uses:\s+[^\s@]+@([^\s#]+)/gm)];
assert.ok(actionRefs.length > 0, 'workflow must use pinned actions');
for (const [, ref] of actionRefs) {
  assert.match(ref, /^[a-f0-9]{40}$/, `action ref must remain SHA-pinned: ${ref}`);
}

const workflowsDirectory = fileURLToPath(
  new URL('../../.github/workflows/', import.meta.url),
);
const workflowNames = (await readdir(workflowsDirectory)).filter((name) => /\.ya?ml$/.test(name));
for (const name of workflowNames) {
  const source = await readFile(new URL(`../../.github/workflows/${name}`, import.meta.url), 'utf8');
  assert.doesNotMatch(source, /npm ci --legacy-peer-deps/, `${name} must use strict npm ci`);

  for (const [, ref] of source.matchAll(/^\s*uses:\s+[^\s@]+@([^\s#]+)/gm)) {
    assert.match(ref, /^[a-f0-9]{40}$/, `${name} action ref must remain SHA-pinned: ${ref}`);
  }
}

const coverageWorkflow = await readFile(
  new URL('../../.github/workflows/coverage.yml', import.meta.url),
  'utf8',
);
assert.match(coverageWorkflow, /steps\.cov\.outcome/);
assert.match(coverageWorkflow, /Coverage execution failed/);

console.log('security-audit workflow fail-closed contract passed');