import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import vm from 'node:vm'

const ROOT = new URL('../../', import.meta.url)

async function source(relativePath) {
  return readFile(new URL(relativePath, ROOT), 'utf8')
}

test('Penpot SSO bootstrap starts the native OIDC flow without URL credentials', async () => {
  const [html, script] = await Promise.all([
    source('infra/azure/internal-tools/penpot-sso-bootstrap.html'),
    source('infra/azure/internal-tools/penpot-sso-bootstrap.js'),
  ])

  assert.match(html, /referrer[^>]+no-referrer/i)
  assert.match(html, /src="\/openpulse-sso-bootstrap\.js"/)
  assert.doesNotMatch(html, /<script(?![^>]+src=)/i)

  assert.match(script, /fetch\(['"]\/api\/auth\/oidc\?provider=oidc['"]/)
  assert.match(script, /method:\s*['"]POST['"]/)
  assert.match(script, /credentials:\s*['"]include['"]/)
  assert.match(script, /https:\/\/sso\.marque-ia\.com/)
  assert.match(script, /location\.replace\(/)
  assert.doesNotMatch(script, /access_token|refresh_token|flow_token|password|client_secret/i)
})

async function runPenpotBootstrap(redirectUri) {
  const script = await source('infra/azure/internal-tools/penpot-sso-bootstrap.js')
  const status = { textContent: 'Initialisation' }
  const fetchCalls = []
  let replacedWith = null

  vm.runInNewContext(script, {
    URL,
    document: { getElementById: () => status },
    fetch: async (url, options) => {
      fetchCalls.push({ url, options })
      return { ok: true, status: 200, json: async () => ({ redirect_uri: redirectUri }) }
    },
    location: { replace: (url) => { replacedWith = url } },
  })
  await new Promise((resolve) => setImmediate(resolve))
  await new Promise((resolve) => setImmediate(resolve))
  return { fetchCalls, replacedWith, status: status.textContent }
}

test('Penpot bootstrap follows only the expected authorization-code callback', async () => {
  const valid = new URL('https://sso.exploitant.example.org/application/o/authorize/')
  valid.searchParams.set('client_id', 'penpot')
  valid.searchParams.set('redirect_uri', 'https://design.exploitant.example.org/api/auth/oidc/callback')
  valid.searchParams.set('response_type', 'code')
  valid.searchParams.set('scope', 'openid profile email')
  valid.searchParams.set('state', 'opaque-state')

  const result = await runPenpotBootstrap(valid.toString())
  assert.equal(result.fetchCalls.length, 1)
  assert.equal(result.fetchCalls[0].url, '/api/auth/oidc?provider=oidc')
  assert.equal(result.fetchCalls[0].options.method, 'POST')
  assert.equal(result.fetchCalls[0].options.credentials, 'include')
  assert.equal(result.replacedWith, valid.toString())
})

test('Penpot bootstrap rejects an Authentik redirect targeting another callback', async () => {
  const malicious = new URL('https://sso.exploitant.example.org/application/o/authorize/')
  malicious.searchParams.set('client_id', 'other-app')
  malicious.searchParams.set('redirect_uri', 'https://evil.example/callback')
  malicious.searchParams.set('response_type', 'code')
  malicious.searchParams.set('scope', 'openid')
  malicious.searchParams.set('state', 'opaque-state')

  const result = await runPenpotBootstrap(malicious.toString())
  assert.equal(result.replacedWith, null)
  assert.match(result.status, /indisponible/i)
})

test('runtime catalogue stages canonical tools as pending and never self-verifies', async () => {
  const migration = await source(
    'supabase/migrations/20260724190000_internal_tools_same_site_oidc_pending.sql'
  )

  assert.match(migration, /https:\/\/forge\.marque-ia\.com\//)
  assert.match(migration, /https:\/\/design\.marque-ia\.com\//)
  assert.match(
    migration,
    /"externalUrl"\s*:\s*"https:\/\/gitea\.40\.89\.137\.50\.nip\.io\/"/
  )
  assert.match(
    migration,
    /"externalUrl"\s*:\s*"https:\/\/design\.40\.89\.137\.50\.nip\.io\/"/
  )
  assert.match(migration, /user\/oauth2\/authentik/)
  assert.match(migration, /openpulse-sso-bootstrap/)
  assert.match(migration, /"readiness"\s*:\s*"pending"/)
  assert.doesNotMatch(migration, /"readiness"\s*:\s*"verified"/)
  assert.doesNotMatch(migration, /access_token|refresh_token|client_secret|password/i)
})

test('Desktop native fallbacks reuse the canonical same-site web origin', async () => {
  const [config, menu, tray] = await Promise.all([
    source('apps/gestion-drive-desktop/crates/sync-core/src/config.rs'),
    source('apps/gestion-drive-desktop/src-tauri/src/menu.rs'),
    source('apps/gestion-drive-desktop/src-tauri/src/tray.rs'),
  ])

  assert.match(
    config,
    /pub const DEFAULT_WEB_BASE_URL: &str = "https:\/\/espace\.marque-ia\.com"/
  )
  for (const nativeSource of [menu, tray]) {
    assert.match(nativeSource, /DEFAULT_WEB_BASE_URL\.to_string\(\)/)
    assert.doesNotMatch(nativeSource, /https:\/\/gestion\.marque-ia\.com/)
  }
})

test('GoTrue allows the same-site Gestion OAuth callback', async () => {
  const deployScript = await source('infra/azure/gestion-platform/deploy-on-vm.sh')
  assert.match(
    deployScript,
    /ADDITIONAL_REDIRECT_URLS=.*https:\/\/espace\.marque-ia\.com\/\*\*/
  )
})

test('Azure workflow keeps iframe and Gestion SSO activation explicitly fail-closed', async () => {
  const workflow = await source('.github/workflows/deploy-gestion-azure.yml')

  assert.match(
    workflow,
    /VITE_INTERNAL_TOOL_EMBED_RUNTIME_ENABLED:\s*\$\{\{\s*vars\.VITE_INTERNAL_TOOL_EMBED_RUNTIME_ENABLED\s*\|\|\s*'false'\s*\}\}/
  )
  assert.match(
    workflow,
    /VITE_AUTHENTIK_SSO_ENABLED:\s*\$\{\{\s*vars\.VITE_AUTHENTIK_SSO_ENABLED\s*\|\|\s*'false'\s*\}\}/
  )
})

test('gateway keeps the Desktop parent same-site and allows every exact iframe ancestor', async () => {
  const [caddy, mainCaddy, compose] = await Promise.all([
    source('infra/azure/internal-tools/Caddyfile'),
    source('infra/azure/gestion-platform/config/Caddyfile'),
    source('infra/azure/gestion-platform/docker-compose.yml'),
  ])

  assert.match(mainCaddy, /import\s+\/etc\/caddy\/internal-tools\.caddy/)
  assert.match(compose, /\.\.\/internal-tools\/Caddyfile:\/etc\/caddy\/internal-tools\.caddy:ro/)
  assert.match(compose, /\.\.\/internal-tools:\/srv\/openpulse-internal-tools:ro/)

  assert.match(caddy, /espace\.marque-ia\.com,\s*espace\.40\.89\.137\.50\.nip\.io\s*\{/)
  assert.match(
    caddy,
    /reverse_proxy\s+https:\/\/openpulse-gestion-web\.bravetree-bd6393e8\.francecentral\.azurecontainerapps\.io/
  )
  assert.match(caddy, /forge\.marque-ia\.com,\s*gitea\.40\.89\.137\.50\.nip\.io\s*\{/)
  assert.match(caddy, /design\.marque-ia\.com,\s*design\.40\.89\.137\.50\.nip\.io\s*\{/)
  assert.match(caddy, /sso\.marque-ia\.com,\s*authentik\.40\.89\.137\.50\.nip\.io\s*\{/)
  assert.match(caddy, /sign\.40\.89\.137\.50\.nip\.io\s*\{/)
  assert.match(caddy, /path\s+\/openpulse-sso-bootstrap\s+\/openpulse-sso-bootstrap\.js/)

  for (const ancestor of [
    'https://espace.exploitant.example.org',
    'https://openpulse-gestion-web.openpulse.example.org',
    'https://gestion.exploitant.example.org',
    'http://tauri.localhost',
    'https://tauri.localhost',
    'tauri://localhost',
  ]) {
    assert.ok(caddy.includes(ancestor), `missing exact ancestor ${ancestor}`)
  }

  const frameAncestors = [...caddy.matchAll(/frame-ancestors[^"\n]+/g)].map((match) => match[0])
  assert.ok(frameAncestors.length >= 2)
  assert.equal((caddy.match(/import gsi_embed_headers/g) ?? []).length, 4)
  assert.ok(frameAncestors.every((policy) => !policy.includes('*')))
})
