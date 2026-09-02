import { createHash } from 'node:crypto'
import { writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const STORAGE_HOST = 'objets.openpulse.example.org'
const CANONICAL_REPOSITORY =
  'https://gitea.exploitant.example.org/marqueia/marque-client-compass'
const REQUIRED_PLATFORMS = ['darwin-aarch64', 'windows-x86_64']
const SHA_256 = /^[0-9a-f]{64}$/
const SHA_1 = /^[0-9a-f]{40}$/

function invariant(condition, message) {
  if (!condition) throw new Error(message)
}

function immutableAssetUrl(value, commit, expectedName) {
  const parsed = new URL(value)
  invariant(parsed.protocol === 'https:', `forbidden asset protocol for ${expectedName}`)
  invariant(parsed.hostname === STORAGE_HOST, `forbidden asset host for ${expectedName}`)
  invariant(
    parsed.pathname === `/desktop-downloads/${commit}/${expectedName}`,
    `non-immutable asset URL for ${expectedName}`
  )
  invariant(!parsed.search && !parsed.hash, `asset URL must not contain query data: ${expectedName}`)
}

async function responseBytes(response, label, maxBytes = Number.POSITIVE_INFINITY) {
  invariant(response.ok, `${label} unavailable (${response.status})`)
  const type = response.headers.get('content-type')?.toLowerCase() ?? ''
  invariant(!type.includes('text/html'), `${label} unexpectedly returned HTML`)
  const chunks = []
  let size = 0
  for await (const chunk of response.body ?? []) {
    const bytes = Buffer.from(chunk)
    size += bytes.length
    invariant(size <= maxBytes, `${label} exceeds the verification size limit`)
    chunks.push(bytes)
  }
  return Buffer.concat(chunks, size)
}

async function payloadDigest(response, label) {
  invariant(response.ok, `payload unavailable: ${label} (${response.status})`)
  const type = response.headers.get('content-type')?.toLowerCase() ?? ''
  invariant(!type.includes('text/html'), `payload unexpectedly returned HTML: ${label}`)
  const hash = createHash('sha256')
  let size = 0
  for await (const chunk of response.body ?? []) {
    const bytes = Buffer.from(chunk)
    hash.update(bytes)
    size += bytes.length
  }
  return { sha256: hash.digest('hex'), size }
}

function fetchOptions() {
  return {
    cache: 'no-store',
    headers: { 'cache-control': 'no-cache' },
    signal: AbortSignal.timeout(120_000),
  }
}

export async function verifyDesktopRelease({ manifestUrl, expectedSha = '', fetchImpl = fetch }) {
  const manifestResponse = await fetchImpl(manifestUrl, fetchOptions())
  const manifestBytes = await responseBytes(manifestResponse, 'desktop manifest', 5_000_000)
  const manifest = JSON.parse(manifestBytes.toString('utf8'))
  const source = manifest.source ?? {}
  const commit = source.commit ?? ''

  invariant(SHA_1.test(commit), 'desktop manifest source SHA missing or invalid')
  invariant(!expectedSha || commit === expectedSha, `desktop manifest SHA mismatch`)
  invariant(
    source.canonical_repository === CANONICAL_REPOSITORY,
    'desktop manifest canonical repository mismatch'
  )

  const checksumsMeta = manifest.checksums ?? {}
  invariant(SHA_256.test(checksumsMeta.sha256 ?? ''), 'checksums SHA-256 missing or invalid')
  invariant(Number.isInteger(checksumsMeta.size) && checksumsMeta.size > 0, 'checksums size missing')
  immutableAssetUrl(checksumsMeta.url, commit, 'checksums.json')

  const checksumsResponse = await fetchImpl(checksumsMeta.url, fetchOptions())
  const checksumsBytes = await responseBytes(checksumsResponse, 'checksums manifest', 20_000_000)
  invariant(checksumsBytes.length === checksumsMeta.size, 'checksums size mismatch')
  invariant(
    createHash('sha256').update(checksumsBytes).digest('hex') === checksumsMeta.sha256,
    'checksums digest mismatch'
  )

  const checksums = JSON.parse(checksumsBytes.toString('utf8'))
  invariant(checksums.source?.commit === commit, 'checksums source SHA mismatch')
  invariant(
    checksums.source?.canonical_repository === CANONICAL_REPOSITORY,
    'checksums canonical repository mismatch'
  )
  const assets = checksums.assets ?? {}
  invariant(Object.keys(assets).length > 0, 'checksums asset inventory is empty')

  const verifiedAssets = []
  for (const [name, asset] of Object.entries(assets)) {
    invariant(name && !name.includes('/') && !name.includes('\\'), `invalid asset name: ${name}`)
    invariant(SHA_256.test(asset.sha256 ?? ''), `asset digest missing: ${name}`)
    invariant(Number.isInteger(asset.size) && asset.size >= 0, `asset size missing: ${name}`)
    immutableAssetUrl(asset.url, commit, name)
    const response = await fetchImpl(asset.url, fetchOptions())
    const observed = await payloadDigest(response, name)
    invariant(observed.size === asset.size, `payload size mismatch: ${name}`)
    invariant(observed.sha256 === asset.sha256, `payload digest mismatch: ${name}`)
    verifiedAssets.push(name)
  }

  const platforms = manifest.platforms ?? {}
  for (const platform of REQUIRED_PLATFORMS) {
    const payload = platforms[platform] ?? {}
    invariant(typeof payload.signature === 'string' && payload.signature.trim(), `signature missing: ${platform}`)
    invariant(SHA_256.test(payload.sha256 ?? ''), `platform digest missing: ${platform}`)
    invariant(Number.isInteger(payload.size) && payload.size > 0, `platform size missing: ${platform}`)
    const name = new URL(payload.url).pathname.split('/').at(-1)
    invariant(Boolean(name && assets[name]), `platform asset missing from checksums: ${platform}`)
    immutableAssetUrl(payload.url, commit, name)
    invariant(assets[name].sha256 === payload.sha256, `platform digest mismatch: ${platform}`)
    invariant(assets[name].size === payload.size, `platform size mismatch: ${platform}`)
  }

  return { manifest, verifiedAssets }
}

function cliArguments(argv) {
  const result = {}
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index]
    const value = argv[index + 1]
    invariant(key?.startsWith('--') && value, `invalid argument: ${key ?? ''}`)
    result[key.slice(2)] = value
  }
  invariant(result['manifest-url'], '--manifest-url is required')
  invariant(result.output, '--output is required')
  return result
}

async function main() {
  const args = cliArguments(process.argv.slice(2))
  const result = await verifyDesktopRelease({
    manifestUrl: args['manifest-url'],
    expectedSha: args['expected-sha'] ?? '',
  })
  await writeFile(args.output, `${JSON.stringify(result.manifest, null, 2)}\n`, 'utf8')
  process.stdout.write(
    `Verified Desktop release ${result.manifest.version} (${result.verifiedAssets.length} assets)\n`
  )
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
    process.exitCode = 1
  })
}
