import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const workflow = await readFile(
  new URL('../../.github/workflows/deploy-gestion-azure.yml', import.meta.url),
  'utf8',
);
const platformCompose = await readFile(
  new URL('../../infra/azure/gestion-platform/docker-compose.yml', import.meta.url),
  'utf8',
);

assert.match(workflow, /az acr manifest show-metadata/);
assert.match(workflow, /\[\[ "\$DIGEST" =~ \^sha256:\[0-9a-f\]\{64\}\$ \]\]/);
assert.match(workflow, /IMAGE="\$ACR_NAME\.azurecr\.io\/\$IMAGE_NAME@\$IMAGE_DIGEST"/);
assert.match(workflow, /test "\$LIVE_IMAGE" = "\$IMAGE"/);
assert.match(workflow, /AUTH_STATUS=.*auth\/v1\/health/);
assert.match(workflow, /test "\$AUTH_STATUS" = '401'/);
assert.match(workflow, /functions\/v1\/platform-health/);
assert.match(workflow, /openpulse-instance/);
assert.doesNotMatch(workflow, /grep -RqsE? ['"]\.supabase\\?\.co/);

assert.match(platformCompose, /\.\.\/\.\.\/\.\.\/supabase\/functions:\/home\/deno\/functions:ro/);
assert.match(platformCompose, /\.\/functions\/main:\/home\/deno\/functions\/main:ro/);
assert.match(platformCompose, /--main-service",\s*"\/home\/deno\/functions\/main"/);

console.log('Gestion Azure workflow contract: OK');
