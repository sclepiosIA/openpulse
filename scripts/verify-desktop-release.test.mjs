import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import test from 'node:test'

import { verifyDesktopRelease } from './verify-desktop-release.mjs'

const COMMIT = 'a'.repeat(40)
const BASE = `https://objets.openpulse.example.org/desktop-downloads/${COMMIT}`
const SOURCE = {
  canonical_repository: 'https://gitea.exploitant.example.org/marqueia/marque-client-compass',
  ci_repository: 'marqueIA/marque-client-compass',
  commit: COMMIT,
}

const digest = (value) => createHash('sha256').update(value).digest('hex')

function releaseFixture({ corruptMac = false, corruptChecksums = false } = {}) {
  const mac = Buffer.from('signed-macos-updater')
  const windows = Buffer.from('signed-windows-updater')
  const macUrl = `${BASE}/gestion-desktop.app.tar.gz`
  const windowsUrl = `${BASE}/gestion-desktop.exe`
  const checksums = {
    source: SOURCE,
    assets: {
      'gestion-desktop.app.tar.gz': {
        url: macUrl,
        sha256: digest(mac),
        size: mac.length,
      },
      'gestion-desktop.exe': {
        url: windowsUrl,
        sha256: digest(windows),
        size: windows.length,
      },
    },
  }
  const checksumsBytes = Buffer.from(`${JSON.stringify(checksums, null, 2)}\n`)
  const manifest = {
    version: '0.1.10',
    source: SOURCE,
    checksums: {
      url: `${BASE}/checksums.json`,
      sha256: corruptChecksums ? '0'.repeat(64) : digest(checksumsBytes),
      size: checksumsBytes.length,
    },
    platforms: {
      'darwin-aarch64': {
        url: macUrl,
        signature: 'tauri-signature-macos',
        sha256: digest(mac),
        size: mac.length,
      },
      'windows-x86_64': {
        url: windowsUrl,
        signature: 'tauri-signature-windows',
        sha256: digest(windows),
        size: windows.length,
      },
    },
  }
  const manifestUrl = `${BASE}/latest.json`
  const responses = new Map([
    [manifestUrl, [Buffer.from(JSON.stringify(manifest)), 'application/json']],
    [`${BASE}/checksums.json`, [checksumsBytes, 'application/json']],
    [macUrl, [corruptMac ? Buffer.alloc(mac.length, 0x78) : mac, 'application/gzip']],
    [windowsUrl, [windows, 'application/octet-stream']],
  ])
  const fetchImpl = async (url) => {
    const entry = responses.get(String(url))
    if (!entry) return new Response('missing', { status: 404 })
    return new Response(entry[0], { status: 200, headers: { 'content-type': entry[1] } })
  }
  return { manifestUrl, fetchImpl }
}

test('verifies the immutable checksum manifest and every public payload', async () => {
  const fixture = releaseFixture()
  const result = await verifyDesktopRelease({
    manifestUrl: fixture.manifestUrl,
    expectedSha: COMMIT,
    fetchImpl: fixture.fetchImpl,
  })

  assert.equal(result.manifest.source.commit, COMMIT)
  assert.deepEqual(result.verifiedAssets.sort(), [
    'gestion-desktop.app.tar.gz',
    'gestion-desktop.exe',
  ])
})

test('rejects a payload whose bytes do not match the checksum inventory', async () => {
  const fixture = releaseFixture({ corruptMac: true })
  await assert.rejects(
    verifyDesktopRelease({
      manifestUrl: fixture.manifestUrl,
      expectedSha: COMMIT,
      fetchImpl: fixture.fetchImpl,
    }),
    /payload digest mismatch.*gestion-desktop\.app\.tar\.gz/i
  )
})

test('rejects a checksum manifest whose bytes do not match latest.json', async () => {
  const fixture = releaseFixture({ corruptChecksums: true })
  await assert.rejects(
    verifyDesktopRelease({
      manifestUrl: fixture.manifestUrl,
      expectedSha: COMMIT,
      fetchImpl: fixture.fetchImpl,
    }),
    /checksums digest mismatch/i
  )
})
