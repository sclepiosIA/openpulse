import { assertEquals, assertExists, assertNotEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts'
import { importEdgeModuleOffline } from '../_shared/module-load-test-harness.ts'

type Handler = (request: Request) => Response | Promise<Response>

async function withEnv<T>(
  values: Record<string, string | undefined>,
  fn: () => Promise<T>
): Promise<T> {
  const previous = new Map<string, string | undefined>()
  for (const [key, value] of Object.entries(values)) {
    previous.set(key, Deno.env.get(key))
    if (value === undefined) Deno.env.delete(key)
    else Deno.env.set(key, value)
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

Deno.test(
  'provision client preserves CORS and rejects unauthenticated requests offline',
  async () => {
    const { module, stats } = await importEdgeModuleOffline(new URL('./index.ts', import.meta.url))
    const handler = module.handler as Handler

    assertExists(handler)
    assertEquals(stats.fetchCalls, 0)
    assertEquals(stats.listenCalls + stats.serveCalls > 0, true)

    await withEnv(
      {
        SUPABASE_URL: 'http://localhost:54321',
        SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
        SUPABASE_ANON_KEY: 'test-anon-key',
        PRODUCT_WEBHOOK_SECRET: undefined,
      },
      async () => {
        const preflight = await handler(new Request('http://localhost', { method: 'OPTIONS' }))
        assertEquals(preflight.status, 200)
        assertNotEquals(preflight.headers.get('Access-Control-Allow-Origin'), '*')
        assertEquals(preflight.headers.get('Access-Control-Allow-Methods'), 'POST, OPTIONS')
        // Cette fonction ne reprend pas la constante partagee : elle declare
        // son propre objet CORS avec l'en-tete x-cron-secret dont elle a besoin
        // (index.ts:6-11). La liste attendue est donc la sienne, pas celle du socle.
        assertEquals(
          preflight.headers.get('Access-Control-Allow-Headers'),
          'authorization, x-client-info, apikey, content-type, x-cron-secret'
        )

        const unauthorized = await handler(
          new Request('http://localhost', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ mode: 'scan' }),
          })
        )
        assertEquals(unauthorized.status, 401)
        assertNotEquals(unauthorized.headers.get('Access-Control-Allow-Origin'), '*')
        assertEquals(await unauthorized.json(), { error: 'Unauthorized' })
      }
    )
  }
)
