import { assertEquals, assertExists, assertNotEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts'
import { importEdgeModuleOffline } from '../_shared/module-load-test-harness.ts'

type Handler = (request: Request) => Response | Promise<Response>

Deno.test('pulse-notify registers offline and handles CORS preflight', async () => {
  const { module, stats } = await importEdgeModuleOffline(new URL('./index.ts', import.meta.url))
  const handler = module.handler as Handler

  assertExists(handler)
  assertEquals(stats.fetchCalls, 0)
  assertEquals(stats.listenCalls + stats.serveCalls > 0, true)

  const response = await handler(
    new Request('http://localhost/pulse-notify', { method: 'OPTIONS' })
  )
  assertEquals(response.status, 200)
  assertNotEquals(response.headers.get('Access-Control-Allow-Origin'), '*')
  assertEquals(
    response.headers.get('Access-Control-Allow-Headers'),
    'authorization, x-client-info, apikey, content-type, x-internal-secret'
  )
})
