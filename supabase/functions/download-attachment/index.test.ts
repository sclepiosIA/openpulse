import { assertEquals, assertNotEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts'
import { importEdgeModuleOffline } from '../_shared/module-load-test-harness.ts'

async function withEnv<T>(fn: () => Promise<T>): Promise<T> {
  const values = {
    SUPABASE_URL: 'https://unit-test-project.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'unit-test-service-role-key',
    EMAIL_ENCRYPTION_KEY: 'unit-test-encryption-key',
  }
  const previous = new Map(Object.keys(values).map((key) => [key, Deno.env.get(key)]))
  for (const [key, value] of Object.entries(values)) Deno.env.set(key, value)
  try {
    return await fn()
  } finally {
    for (const [key, value] of previous) {
      value === undefined ? Deno.env.delete(key) : Deno.env.set(key, value)
    }
  }
}

Deno.test(
  'download-attachment handler handles CORS preflight and validates a missing attachment_id offline',
  async () => {
    await withEnv(async () => {
      const originalFetch = globalThis.fetch
      globalThis.fetch = ((input: RequestInfo | URL) => {
        const url = input instanceof Request ? input.url : input.toString()
        if (url.includes('/auth/v1/user')) {
          return Promise.resolve(
            new Response(JSON.stringify({ id: 'user-123' }), {
              headers: { 'content-type': 'application/json' },
            })
          )
        }
        throw new Error(`Unexpected fetch call: ${url}`)
      }) as typeof fetch

      try {
        const { module, stats } = await importEdgeModuleOffline(
          new URL('./index.ts', import.meta.url)
        )
        assertEquals(stats.listenCalls, 1)
        assertEquals(stats.fetchCalls, 0)
        const handler = module.handler as (request: Request) => Promise<Response>

        const options = await handler(
          new Request('http://localhost/download-attachment', {
            method: 'OPTIONS',
          })
        )
        assertEquals(options.status, 200)
        assertNotEquals(options.headers.get('Access-Control-Allow-Origin'), '*')
        assertEquals(
          options.headers.get('Access-Control-Allow-Headers'),
          'authorization, x-client-info, apikey, content-type, x-internal-secret'
        )

        const response = await handler(
          new Request('http://localhost/download-attachment', {
            method: 'POST',
            headers: {
              authorization: 'Bearer user-jwt',
              'content-type': 'application/json',
            },
            body: JSON.stringify({}),
          })
        )
        assertEquals(response.status, 400)
        assertNotEquals(response.headers.get('Access-Control-Allow-Origin'), '*')
        assertEquals(await response.json(), {
          error: 'attachment_id is required',
        })
      } finally {
        globalThis.fetch = originalFetch
      }
    })
  }
)
