import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { gunzipSync, gzipSync } from 'node:zlib'

const script = new URL('../docker/scripts/openpulse-backup.sh', import.meta.url)
const restoreScript = new URL('../docker/scripts/openpulse-restore.sh', import.meta.url)
const legacyBackupScript = new URL('../docker/scripts/backup.sh', import.meta.url)
const legacyRestoreScript = new URL('../docker/scripts/restore.sh', import.meta.url)

function dryRun() {
  return execFileSync('bash', [script.pathname, '--dry-run'], {
    cwd: new URL('..', import.meta.url),
    encoding: 'utf8',
    env: {
      ...process.env,
      BACKUP_DIR: '/tmp/openpulse-backup-contract',
      OPENPULSE_INSTANCE: 'contract',
    },
  })
}

function restoreDryRun() {
  return execFileSync('bash', [restoreScript.pathname, '--dry-run', '/tmp/openpulse-backup'], {
    encoding: 'utf8',
  })
}

function sha256(content) {
  return createHash('sha256').update(content).digest('hex')
}

function pathExists(path) {
  try {
    statSync(path)
    return true
  } catch {
    return false
  }
}

function createRestoreFixture({
  corruptChecksum = false,
  failDatabasePreflight = false,
  failDatabaseRestore = false,
  failServiceInventory = false,
  failServiceStop = false,
  unlistedStorageFile = false,
  symlinkedStorage = false,
} = {}) {
  const sandbox = mkdtempSync(join(tmpdir(), 'openpulse-restore-'))
  const root = join(sandbox, 'root')
  const backup = join(sandbox, 'backup')
  const bin = join(sandbox, 'bin')
  const log = join(sandbox, 'docker.log')
  const globals = gzipSync('ALTER ROLE anon NOLOGIN;\n')
  const database = Buffer.from('DATABASE_DUMP')
  const object = Buffer.from('object')

  mkdirSync(join(root, 'docker'), { recursive: true })
  mkdirSync(join(backup, 'storage-data'), { recursive: true })
  mkdirSync(bin)
  writeFileSync(join(root, '.env'), 'POSTGRES_DB=postgres\n')
  writeFileSync(join(root, 'docker/docker-compose.openpulse.yml'), 'services: {}\n')
  writeFileSync(join(backup, 'globals.sql.gz'), globals)
  writeFileSync(join(backup, 'database.dump'), database)
  writeFileSync(join(backup, 'storage-data/object.bin'), object)
  if (symlinkedStorage) {
    symlinkSync('/tmp', join(backup, 'storage-data/external'))
  }
  if (unlistedStorageFile) {
    writeFileSync(join(backup, 'storage-data/unlisted.bin'), 'not-in-manifest')
  }
  writeFileSync(
    join(backup, 'SHA256SUMS'),
    `${corruptChecksum ? '0'.repeat(64) : sha256(database)}  database.dump\n` +
      `${sha256(globals)}  globals.sql.gz\n` +
      `${sha256(object)}  storage-data/object.bin\n`,
  )
  writeFileSync(
    join(bin, 'docker'),
    `#!/bin/sh
printf '%s\\n' "$*" >> "$DOCKER_LOG"
case "$*" in
  *' ps --services --filter status=running'*)
    if [ "$FAIL_SERVICE_INVENTORY" = 1 ]; then
      exit 39
    fi
    printf 'db\\nstorage\\nfrontend\\nkong\\nauth\\n'
    ;;
  *' stop frontend kong auth'*)
    if [ "$FAIL_SERVICE_STOP" = 1 ]; then
      exit 41
    fi
    ;;
  *' exec -T db psql '*)
    cat >/dev/null
    ;;
  *' exec -T db pg_restore --list'*)
    cat >/dev/null
    if [ "$FAIL_DATABASE_PREFLIGHT" = 1 ]; then
      exit 40
    fi
    ;;
  *' exec -T db pg_restore '*)
    cat >/dev/null
    if [ "$FAIL_DATABASE_RESTORE" = 1 ]; then
      exit 42
    fi
    ;;
esac
`,
  )
  chmodSync(join(bin, 'docker'), 0o755)

  const result = spawnSync('bash', [restoreScript.pathname, '--yes', backup], {
    encoding: 'utf8',
    env: {
      ...process.env,
      PATH: `${bin}:${process.env.PATH}`,
      DOCKER_LOG: log,
      FAIL_DATABASE_PREFLIGHT: failDatabasePreflight ? '1' : '0',
      FAIL_DATABASE_RESTORE: failDatabaseRestore ? '1' : '0',
      FAIL_SERVICE_INVENTORY: failServiceInventory ? '1' : '0',
      FAIL_SERVICE_STOP: failServiceStop ? '1' : '0',
      OPENPULSE_ROOT: root,
    },
  })
  const calls = pathExists(log) ? readFileSync(log, 'utf8').trim().split('\n').filter(Boolean) : []

  return {
    calls,
    cleanup: () => rmSync(sandbox, { recursive: true, force: true }),
    result,
  }
}

test('the canonical backup script covers database globals and object storage', () => {
  const output = dryRun()

  assert.match(output, /docker compose --env-file .*\.env -f .*docker\/docker-compose\.openpulse\.yml/)
  assert.match(output, /pg_dumpall --roles-only/)
  assert.match(output, /--no-role-passwords/)
  assert.match(output, /--quote-all-identifiers/)
  assert.match(output, /pg_dump .*--format=custom/)
  assert.match(output, /cp --archive storage:\/var\/lib\/storage .*storage-data/)
  assert.match(output, /SHA256SUMS/)
})

test('the canonical restore script verifies and restores the complete backup', () => {
  const output = restoreDryRun()

  assert.match(output, /verify SHA256SUMS/)
  assert.match(output, /globals\.sql\.gz.*psql .*ON_ERROR_STOP=1/)
  assert.match(output, /pg_restore .*database\.dump/)
  assert.match(output, /cp --archive .*storage-data\/\. storage:\/var\/lib\/storage/)
  assert.match(output, /docker compose --env-file .*\.env -f .*docker\/docker-compose\.openpulse\.yml/)
})

test('the restore preserves database ownership and changes storage only after the database succeeds', () => {
  const output = restoreDryRun()
  const databaseRestore = output.indexOf('pg_restore')
  const storageReset = output.indexOf('run --rm --no-deps --entrypoint sh storage')

  assert.ok(databaseRestore >= 0, 'the restore plan must include pg_restore')
  assert.ok(storageReset >= 0, 'the restore plan must include the storage reset')
  assert.ok(databaseRestore < storageReset, 'storage must not be reset before pg_restore succeeds')
  assert.doesNotMatch(output.slice(databaseRestore, output.indexOf('\n', databaseRestore)), /--no-owner/)
})

test('a complete restore simulation preserves the initial service set and safe operation order', () => {
  const fixture = createRestoreFixture()

  try {
    assert.equal(
      fixture.result.status,
      0,
      [fixture.result.stderr, fixture.result.stdout, ...fixture.calls].filter(Boolean).join('\n'),
    )
    const restoreIndex = fixture.calls.findIndex(
      (line) => line.includes('pg_restore') && !line.includes('pg_restore --list'),
    )
    const storageStopIndex = fixture.calls.findIndex((line) => line.includes('stop storage'))
    const storageResetIndex = fixture.calls.findIndex((line) => line.includes('find /var/lib/storage'))
    assert.ok(restoreIndex >= 0)
    assert.ok(storageStopIndex >= 0)
    assert.ok(storageStopIndex < restoreIndex)
    assert.ok(storageResetIndex > restoreIndex)
    assert.match(fixture.calls[storageResetIndex], /run --rm --no-deps --entrypoint sh storage/)
    assert.ok(fixture.calls.some((line) => line.includes('stop frontend kong auth')))
    assert.ok(fixture.calls.some((line) => line.includes('start storage frontend kong auth')))
  } finally {
    fixture.cleanup()
  }
})

test('an invalid checksum aborts before any Docker mutation', () => {
  const fixture = createRestoreFixture({ corruptChecksum: true })

  try {
    assert.notEqual(fixture.result.status, 0)
    assert.deepEqual(fixture.calls, [])
  } finally {
    fixture.cleanup()
  }
})

test('an invalid database archive aborts before any service mutation', () => {
  const fixture = createRestoreFixture({ failDatabasePreflight: true })

  try {
    assert.notEqual(fixture.result.status, 0)
    assert.ok(fixture.calls.some((line) => line.includes('pg_restore --list')))
    assert.ok(fixture.calls.every((line) => !line.includes(' stop ')))
    assert.ok(fixture.calls.every((line) => !line.includes('find /var/lib/storage')))
  } finally {
    fixture.cleanup()
  }
})

test('a backup containing symlinks is rejected before any Docker mutation', () => {
  const fixture = createRestoreFixture({ symlinkedStorage: true })

  try {
    assert.notEqual(fixture.result.status, 0)
    assert.match(fixture.result.stderr, /lien symbolique/i)
    assert.deepEqual(fixture.calls, [])
  } finally {
    fixture.cleanup()
  }
})

test('an unlisted backup file is rejected before any Docker mutation', () => {
  const fixture = createRestoreFixture({ unlistedStorageFile: true })

  try {
    assert.notEqual(fixture.result.status, 0)
    assert.match(fixture.result.stderr, /inventaire SHA-256 incomplet/i)
    assert.deepEqual(fixture.calls, [])
  } finally {
    fixture.cleanup()
  }
})

test('a failed database restore leaves object storage untouched', () => {
  const fixture = createRestoreFixture({ failDatabaseRestore: true })

  try {
    assert.notEqual(fixture.result.status, 0)
    assert.ok(fixture.calls.some((line) => line.includes('pg_restore')))
    assert.ok(fixture.calls.every((line) => !line.includes('find /var/lib/storage')))
    assert.match(fixture.result.stderr, /services restent arrêtés/i)
  } finally {
    fixture.cleanup()
  }
})

test('a partial service-stop failure is reported before database or storage mutation', () => {
  const fixture = createRestoreFixture({ failServiceStop: true })

  try {
    assert.notEqual(fixture.result.status, 0)
    assert.ok(fixture.calls.some((line) => line.includes('stop frontend kong auth')))
    assert.ok(fixture.calls.every((line) => !line.includes('psql')))
    assert.ok(
      fixture.calls.every(
        (line) => !line.includes('pg_restore') || line.includes('pg_restore --list'),
      ),
    )
    assert.ok(fixture.calls.every((line) => !line.includes('find /var/lib/storage')))
    assert.match(fixture.result.stderr, /services restent arrêtés/i)
  } finally {
    fixture.cleanup()
  }
})

test('a restore service-inventory failure aborts before any mutation', () => {
  const fixture = createRestoreFixture({ failServiceInventory: true })

  try {
    assert.notEqual(fixture.result.status, 0)
    assert.ok(fixture.calls.some((line) => line.includes('ps --services')))
    assert.ok(fixture.calls.every((line) => !line.includes(' stop ')))
    assert.ok(fixture.calls.every((line) => !line.includes('psql') && !line.includes('find /var/lib/storage')))
  } finally {
    fixture.cleanup()
  }
})

test('legacy backup and restore entry points delegate to the canonical scripts', () => {
  assert.match(readFileSync(legacyBackupScript, 'utf8'), /exec .*openpulse-backup\.sh.*"\$@"/)
  assert.match(readFileSync(legacyRestoreScript, 'utf8'), /exec .*openpulse-restore\.sh.*"\$@"/)
})

test('backup and restore entry points are executable', () => {
  for (const entryPoint of [script, restoreScript, legacyBackupScript, legacyRestoreScript]) {
    assert.notEqual(statSync(entryPoint).mode & 0o111, 0, entryPoint.pathname)
  }
})

test('a real backup executes each dump once without printing its contents', () => {
  const sandbox = mkdtempSync(join(tmpdir(), 'openpulse-backup-'))
  const root = join(sandbox, 'root')
  const bin = join(sandbox, 'bin')
  const log = join(sandbox, 'docker.log')
  mkdirSync(join(root, 'docker'), { recursive: true })
  mkdirSync(bin)
  writeFileSync(join(root, '.env'), 'POSTGRES_DB=postgres\n')
  writeFileSync(join(root, 'docker/docker-compose.openpulse.yml'), 'services: {}\n')
  writeFileSync(
    join(bin, 'docker'),
    `#!/bin/sh
printf '%s\\n' "$*" >> "$DOCKER_LOG"
case "$*" in
  *pg_dumpall*) printf 'CREATE ROLE "anon";\\nALTER ROLE "anon" WITH NOLOGIN;\\n' ;;
  *' pg_dump '*) printf 'DATABASE_DUMP' ;;
  *' cp --archive storage:/var/lib/storage '*)
    for dest do :; done
    mkdir -p "$dest"
    printf 'object' > "$dest/object.bin"
    ;;
esac
`,
  )
  chmodSync(join(bin, 'docker'), 0o755)

  try {
    const output = execFileSync('bash', [script.pathname], {
      encoding: 'utf8',
      env: {
        ...process.env,
        PATH: `${bin}:${process.env.PATH}`,
        DOCKER_LOG: log,
        OPENPULSE_ROOT: root,
        OPENPULSE_TIMESTAMP: '20260901T000000Z',
        BACKUP_DIR: join(root, 'backups'),
      },
    })
    const calls = readFileSync(log, 'utf8').trim().split('\n')
    const destination = join(root, 'backups', '20260901T000000Z')

    const globalsSql = gunzipSync(readFileSync(join(destination, 'globals.sql.gz'))).toString('utf8')
    assert.doesNotMatch(output, /CREATE ROLE|DATABASE_DUMP/)
    assert.match(globalsSql, /DO \$openpulse_role\$ BEGIN[\s\S]*CREATE ROLE "anon";/)
    assert.match(globalsSql, /EXCEPTION WHEN duplicate_object THEN NULL;/)
    assert.match(globalsSql, /ALTER ROLE "anon" WITH NOLOGIN;/)
    assert.equal(calls.filter((line) => line.includes('pg_dumpall')).length, 1)
    assert.equal(calls.filter((line) => /\bpg_dump\b/.test(line) && !line.includes('pg_dumpall')).length, 1)
    assert.equal(statSync(destination).mode & 0o077, 0, 'backup directory must be private')
    for (const file of ['globals.sql.gz', 'database.dump', 'SHA256SUMS', 'storage-data/object.bin']) {
      assert.equal(statSync(join(destination, file)).mode & 0o077, 0, `${file} must be private`)
    }
  } finally {
    rmSync(sandbox, { recursive: true, force: true })
  }
})

test('a failed backup surfaces an incomplete service restart', () => {
  const sandbox = mkdtempSync(join(tmpdir(), 'openpulse-backup-failure-'))
  const root = join(sandbox, 'root')
  const bin = join(sandbox, 'bin')
  const log = join(sandbox, 'docker.log')
  mkdirSync(join(root, 'docker'), { recursive: true })
  mkdirSync(bin)
  writeFileSync(join(root, '.env'), 'POSTGRES_DB=postgres\n')
  writeFileSync(join(root, 'docker/docker-compose.openpulse.yml'), 'services: {}\n')
  writeFileSync(
    join(bin, 'docker'),
    `#!/bin/sh
printf '%s\\n' "$*" >> "$DOCKER_LOG"
case "$*" in
  *' ps --services --filter status=running'*)
    printf 'frontend\\nkong\\nstorage\\n'
    ;;
  *' stop frontend kong storage'*)
    exit 42
    ;;
  *' start frontend kong storage'*)
    exit 43
    ;;
esac
`,
  )
  chmodSync(join(bin, 'docker'), 0o755)

  try {
    const result = spawnSync('bash', [script.pathname], {
      encoding: 'utf8',
      env: {
        ...process.env,
        PATH: `${bin}:${process.env.PATH}`,
        DOCKER_LOG: log,
        OPENPULSE_ROOT: root,
        OPENPULSE_TIMESTAMP: '20260901T000000Z',
        BACKUP_DIR: join(root, 'backups'),
      },
    })
    const calls = readFileSync(log, 'utf8').trim().split('\n')

    assert.notEqual(result.status, 0)
    assert.ok(calls.some((line) => line.includes('stop frontend kong storage')))
    assert.ok(calls.some((line) => line.includes('start frontend kong storage')))
    assert.match(result.stderr, /redémarrage incomplet/i)
  } finally {
    rmSync(sandbox, { recursive: true, force: true })
  }
})

test('a backup service-inventory failure aborts before stopping or dumping', () => {
  const sandbox = mkdtempSync(join(tmpdir(), 'openpulse-backup-inventory-'))
  const root = join(sandbox, 'root')
  const bin = join(sandbox, 'bin')
  const log = join(sandbox, 'docker.log')
  mkdirSync(join(root, 'docker'), { recursive: true })
  mkdirSync(bin)
  writeFileSync(join(root, '.env'), 'POSTGRES_DB=postgres\n')
  writeFileSync(join(root, 'docker/docker-compose.openpulse.yml'), 'services: {}\n')
  writeFileSync(
    join(bin, 'docker'),
    `#!/bin/sh
printf '%s\\n' "$*" >> "$DOCKER_LOG"
case "$*" in
  *' ps --services --filter status=running'*) exit 39 ;;
esac
`,
  )
  chmodSync(join(bin, 'docker'), 0o755)

  try {
    const result = spawnSync('bash', [script.pathname], {
      encoding: 'utf8',
      env: {
        ...process.env,
        PATH: `${bin}:${process.env.PATH}`,
        DOCKER_LOG: log,
        OPENPULSE_ROOT: root,
        OPENPULSE_TIMESTAMP: '20260901T000000Z',
        BACKUP_DIR: join(root, 'backups'),
      },
    })
    const calls = readFileSync(log, 'utf8').trim().split('\n')

    assert.notEqual(result.status, 0)
    assert.ok(calls.some((line) => line.includes('ps --services')))
    assert.ok(calls.every((line) => !line.includes(' stop ') && !line.includes('pg_dump')))
  } finally {
    rmSync(sandbox, { recursive: true, force: true })
  }
})
