import { assertEquals, assertExists, assertNotEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts'
import { type EdgeHandler, importEdgeModuleOffline } from '../_shared/module-load-test-harness.ts'

const TEST_ENV: Record<string, string> = {
  SUPABASE_URL: 'http://localhost:54321',
  SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
  SUPABASE_ANON_KEY: 'test-anon-key',
  AZURE_OPENAI_ENDPOINT: 'http://localhost:8080',
  AZURE_OPENAI_API_KEY: 'test-azure-key',
  AZURE_OPENAI_DEPLOYMENT: 'test-deployment',
}

async function withEnv<T>(fn: () => Promise<T>): Promise<T> {
  const previous = new Map<string, string | undefined>()
  for (const [key, value] of Object.entries(TEST_ENV)) {
    previous.set(key, Deno.env.get(key))
    Deno.env.set(key, value)
  }
  try {
    return await fn()
  } finally {
    for (const [key, value] of previous) {
      if (value === undefined) Deno.env.delete(key)
      else Deno.env.set(key, value)
    }
  }
}

async function loadHandler(): Promise<EdgeHandler> {
  const { module, stats, serveHandler } = await importEdgeModuleOffline(
    new URL('./index.ts', import.meta.url)
  )
  assertExists(module)
  assertExists(serveHandler)
  assertEquals(stats.fetchCalls, 0)
  assertEquals(stats.serveCalls, 1)
  return serveHandler
}

Deno.test('pulse-ai-chat rejects unauthenticated POST with CORS headers', async () => {
  const handler = await loadHandler()
  await withEnv(async () => {
    const response = await handler(
      new Request('http://localhost', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'Bonjour' }],
        }),
      })
    )
    assertEquals(response.status, 401)
    assertNotEquals(response.headers.get('Access-Control-Allow-Origin'), '*')
    assertEquals(await response.json(), { error: 'Missing authorization' })
  })
})

Deno.test('pulse-ai-chat handles OPTIONS but does not accept GET as a completion', async () => {
  const handler = await loadHandler()
  await withEnv(async () => {
    const options = await handler(new Request('http://localhost', { method: 'OPTIONS' }))
    assertEquals(options.status, 200)
    assertNotEquals(options.headers.get('Access-Control-Allow-Origin'), '*')

    const get = await handler(new Request('http://localhost', { method: 'GET' }))
    assertEquals(get.status, 401)
    assertNotEquals(get.headers.get('Access-Control-Allow-Origin'), '*')
  })
})
