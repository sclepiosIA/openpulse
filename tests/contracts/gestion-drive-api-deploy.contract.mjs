import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const root = new URL('../../', import.meta.url)
const read = (path) => readFile(new URL(path, root), 'utf8')
const [
  dockerfile,
  workflow,
  migrations,
  migrationState,
  initialMigration,
  desktopRefreshMigration,
  desktopHandoffMigration,
  storage,
  health,
  repository,
  desktopAuth,
] = await Promise.all([
  read('services/openpulse-gestion-drive-api/Dockerfile'),
  read('.github/workflows/deploy-gestion-drive-api.yml'),
  read('services/openpulse-gestion-drive-api/scripts/migrate.py'),
  read('services/openpulse-gestion-drive-api/app/migration_state.py'),
  read('services/openpulse-gestion-drive-api/migrations/0001_init_drive.sql'),
  read('services/openpulse-gestion-drive-api/migrations/0003_desktop_refresh_sessions.sql'),
  read('services/openpulse-gestion-drive-api/migrations/0004_desktop_handoff_challenges.sql'),
  read('services/openpulse-gestion-drive-api/app/storage.py'),
  read('services/openpulse-gestion-drive-api/app/routers/health.py'),
  read('services/openpulse-gestion-drive-api/app/repository.py'),
  read('services/openpulse-gestion-drive-api/app/routers/desktop_auth.py'),
])

assert.match(dockerfile, /FROM python:3\.13-slim@sha256:[0-9a-f]{64}/)
assert.match(dockerfile, /COPY scripts \.\/scripts/)
assert.match(dockerfile, /python scripts\/migrate\.py/)
assert.match(dockerfile, /exec uvicorn app\.main:app/)

assert.doesNotMatch(workflow, /pull_request:/, 'PRs must not deploy production or access OIDC')
assert.match(workflow, /deploy:[\s\S]*environment: gestion-production/)
assert.match(workflow, /npm run test:contract/)
assert.match(workflow, /python -m pytest -q/)
assert.match(workflow, /services:[\s\S]*postgres:[\s\S]*postgres:16-alpine/)
assert.match(workflow, /python scripts\/migrate\.py/)
assert.match(workflow, /DRIVE_TEST_POSTGRES_URL[\s\S]*test_postgres_integration\.py/)
assert.match(workflow, /POSTGRES_PASSWORD:\s*drive_ci_only/)
assert.match(workflow, /CI_POSTGRES_PASSWORD:\s*drive_ci_only/)
assert.doesNotMatch(workflow, /postgres:\*{3}@/)
assert.match(workflow, /python -m ruff check app scripts tests/)
assert.match(workflow, /az acr manifest show-metadata/)
assert.match(workflow, /IMAGE_DIGEST=\$DIGEST/)
assert.match(workflow, /\$IMAGE_NAME@\$IMAGE_DIGEST/)
assert.match(workflow, /PRODUCTION_REVISIONS/)
assert.doesNotMatch(workflow, /latestReadyRevisionName/)
assert.match(workflow, /test "\$LIVE_IMAGE" = "\$IMAGE"/)
assert.match(workflow, /OPENPULSE_GIT_SHA="\$GITHUB_SHA"/)
assert.match(workflow, /payload\['source_sha'\] == os\.environ\['GITHUB_SHA'\]/)
for (const secret of [
  'database-url',
  'azure-storage-conn',
  'drive-jwt-secret',
  'drive-app-secret',
]) {
  assert.match(workflow, new RegExp(`secretref:${secret}`))
}
assert.match(workflow, /DRIVE_ENV=prod/)
assert.match(workflow, /DRIVE_AUTH_MODE=jwt/)
assert.match(workflow, /DRIVE_CORS_ORIGINS=https:\/\/openpulse-gestion-web\./)
assert.match(workflow, /\/readyz/)
assert.match(workflow, /ANON_STATUS/)
assert.match(workflow, /MALFORMED_STATUS/)
assert.match(workflow, /forbidden\.invalid/)
assert.match(workflow, /access-control-allow-origin/i)
assert.match(workflow, /revision set-mode[\s\S]*--mode multiple/)
assert.match(workflow, /--revision-suffix/)
assert.match(workflow, /revision label add[\s\S]*--label candidate/)
assert.match(workflow, /---candidate\./)
assert.match(workflow, /--revision-weight[\s\S]*=100[\s\S]*=0/)
assert.match(workflow, /rollback_candidate/)
assert.match(workflow, /revision deactivate/)
assert.doesNotMatch(workflow, /cancel-in-progress:\s*true/)

assert.match(migrations, /pg_advisory_lock/)
assert.match(migrations, /async with conn\.transaction\(\)/)
assert.match(migrations, /migration_manifest\(directory\)/)
assert.match(migrations, /migration_sql\(sql_file\)/)
assert.match(migrations, /drive_schema_migrations/)
assert.match(migrations, /Checksum migration modifié/)
assert.match(migrationState, /_LEGACY_WRAPPED_MIGRATIONS = \{"0001_init_drive\.sql"\}/)
assert.match(migrationState, /controls == \["begin", "commit"\]/)
assert.match(initialMigration, /^begin;/m)
assert.match(initialMigration, /^commit;/m)
assert.match(desktopRefreshMigration, /drive_desktop_refresh_sessions/)
assert.match(desktopRefreshMigration, /token_hash text not null unique/)
assert.match(desktopRefreshMigration, /family_id uuid not null/)
assert.match(
  desktopRefreshMigration,
  /unique index[\s\S]*\(user_id\)[\s\S]*rotated_at is null and revoked_at is null/
)
assert.match(repository, /pg_advisory_xact_lock\(hashtextextended\(\$1, 0\)\)/)
assert.ok(
  (repository.match(/pg_advisory_xact_lock\(hashtextextended\(\$1, 0\)\)/g) ?? []).length >= 3,
  'create, rotate/replay and logout must share the per-user transaction lock'
)
assert.doesNotMatch(desktopRefreshMigration, /provider_refresh|supabase_refresh/)
assert.match(desktopHandoffMigration, /drive_desktop_handoff_challenges/)
assert.match(desktopHandoffMigration, /challenge_hash text not null unique/)
assert.match(desktopHandoffMigration, /nonce_hash text not null/)
assert.doesNotMatch(desktopHandoffMigration, /access_token|refresh_token|totp|provider_bearer/)
assert.match(desktopAuth, /secrets\.token_urlsafe/)
assert.match(desktopAuth, /hashlib\.sha256/)
assert.match(desktopAuth, /fresh_mfa_required/)
assert.match(desktopAuth, /entry\.get\("method"\) == "totp"/)
assert.match(desktopAuth, /redeem_desktop_handoff_challenge/)
assert.match(desktopAuth, /rotate_desktop_refresh_session/)
assert.match(desktopAuth, /revoke_desktop_refresh_family/)
assert.doesNotMatch(desktopAuth, /grant_type=refresh_token/)
assert.match(storage, /BlobSasPermissions\(create=True\)/)
assert.doesNotMatch(storage, /BlobSasPermissions\(write=True/)
assert.match(storage, /compute_blob_sha256/)
assert.match(storage, /get_container_properties/)
assert.match(health, /asyncio\.to_thread/)
assert.match(repository, /actual_manifest == migration_manifest\(\)/)
assert.match(repository, /completion_event_id/)

console.log('Gestion Drive API deploy contract: OK')
