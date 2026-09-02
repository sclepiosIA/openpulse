import {
  assertEquals,
  assertExists,
  assertThrows,
  assertRejects,
} from 'https://deno.land/std@0.224.0/assert/mod.ts'
import { importEdgeModuleOffline } from '../_shared/module-load-test-harness.ts'

async function readModuleSource(): Promise<string> {
  return await Deno.readTextFile(new URL('./index.ts', import.meta.url))
}

function extractStringConst(source: string, constName: string): string {
  const escapedName = constName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = source.match(new RegExp(`const\\s+${escapedName}\\s*=\\s*['"]([^'"]+)['"]\\s*;`))
  if (!match) {
    throw new Error(`Missing string const ${constName}`)
  }
  return match[1]
}

Deno.test(
  'source contract: Google token endpoint is the expected HTTPS OAuth token URL',
  async () => {
    const source = await readModuleSource()

    assertThrows(
      () => extractStringConst(source, 'MISSING_CONST_FOR_TEST'),
      Error,
      'Missing string const MISSING_CONST_FOR_TEST'
    )

    const googleTokenUrl = new URL(extractStringConst(source, 'GOOGLE_TOKEN_URL'))

    assertEquals(googleTokenUrl.protocol, 'https:')
    assertEquals(googleTokenUrl.hostname, 'oauth2.googleapis.com')
    assertEquals(googleTokenUrl.pathname, '/token')
  }
)

Deno.test(
  'source contract: refresh request is built with the Google refresh_token grant',
  async () => {
    const source = await readModuleSource()

    assertExists(source.match(/fetch\(\s*GOOGLE_TOKEN_URL\s*,\s*{/))
    assertExists(source.match(/method:\s*'POST'/))
    assertExists(source.match(/'Content-Type':\s*'application\/x-www-form-urlencoded'/))
    assertExists(
      source.match(
        /new URLSearchParams\(\s*{[\s\S]*client_id:\s*GOOGLE_CLIENT_ID[\s\S]*client_secret:\s*GOOGLE_CLIENT_SECRET[\s\S]*refresh_token:\s*refreshTokenPlain[\s\S]*grant_type:\s*'refresh_token'[\s\S]*}\s*\)/
      )
    )
  }
)

Deno.test(
  'source contract: Google connection lookup is scoped to the authenticated user and provider',
  async () => {
    const source = await readModuleSource()

    assertExists(source.match(/supabase\.auth\.getUser\(\)/))
    assertExists(
      source.match(
        /\.from\('user_oauth_connections'\)[\s\S]*\.select\('\*'\)[\s\S]*\.eq\('user_id',\s*user\.id\)[\s\S]*\.eq\('provider',\s*'google'\)[\s\S]*\.single\(\)/
      )
    )
    assertExists(source.match(/throw new Error\('Unauthorized'\)/))
    assertExists(source.match(/throw new Error\('No Google connection found'\)/))
  }
)

Deno.test(
  'source contract: OAuth tokens are decrypted and encrypted for storage at rest',
  async () => {
    const source = await readModuleSource()

    assertExists(source.match(/decryptToken\(connection\.refresh_token_encrypted\)/))
    assertExists(source.match(/encryptToken\(tokens\.access_token\)/))
    assertExists(source.match(/access_token_encrypted:\s*encryptedAccessToken/))
    assertExists(source.match(/token_expires_at:\s*expiresAt/))
    assertExists(source.match(/updated_at:\s*new Date\(\)\.toISOString\(\)/))
  }
)

Deno.test(
  'source contract: CORS preflight and sanitized error responses are configured',
  async () => {
    const source = await readModuleSource()

    assertExists(source.match(/'Access-Control-Allow-Origin':\s*origineAutorisee\(\)/))
    assertExists(
      source.match(
        /'Access-Control-Allow-Headers':\s*'authorization, x-client-info, apikey, content-type, x-internal-secret'/
      )
    )
    assertExists(
      source.match(
        /if \(req\.method === 'OPTIONS'\)\s*{[\s\S]*return new Response\(null,\s*{ headers: corsHeaders }\)/
      )
    )
    assertExists(
      source.match(
        /buildErrorResponse\(\s*'oauth-google-refresh'\s*,\s*error\s*,\s*corsHeaders\s*,\s*500\s*\)/
      )
    )
  }
)

Deno.test('source contract: successful response returns refreshed token and expiry', async () => {
  const source = await readModuleSource()

  assertExists(source.match(/const tokens = await tokenResponse\.json\(\)/))
  assertExists(
    source.match(
      /const expiresAt = new Date\(Date\.now\(\) \+ tokens\.expires_in \* 1000\)\.toISOString\(\)/
    )
  )
  assertExists(
    source.match(
      /JSON\.stringify\(\s*{\s*success:\s*true,\s*access_token:\s*tokens\.access_token,\s*expires_at:\s*expiresAt\s*}\s*\)/
    )
  )
  assertExists(source.match(/'Content-Type':\s*'application\/json'/))
})

Deno.test(
  'source contract: Google refresh failures do not expose upstream token response as success',
  async () => {
    const source = await readModuleSource()

    assertExists(
      source.match(
        /if \(!tokenResponse\.ok\)\s*{[\s\S]*const errorText = await tokenResponse\.text\(\)[\s\S]*throw new Error\('Failed to refresh token'\)[\s\S]*}/
      )
    )
    assertExists(
      source.match(/console\.error\('\[oauth-google-refresh\] Refresh failed:',\s*errorText\)/)
    )
  }
)

Deno.test('module loads offline without opening a real HTTP listener', async () => {
  const { module, stats } = await importEdgeModuleOffline(new URL('./index.ts', import.meta.url))

  assertExists(module)
  assertEquals(stats.listenCalls + stats.serveCalls, 1)
  assertEquals(stats.serveHttpCalls, 0)
  assertEquals(stats.fetchCalls, 0)
})

Deno.test('test helper rejects for missing source files', async () => {
  await assertRejects(
    () => Deno.readTextFile(new URL(`./__missing_${crypto.randomUUID()}.ts`, import.meta.url)),
    Deno.errors.NotFound
  )
})
