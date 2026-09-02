import { assertEquals, assertExists } from 'https://deno.land/std@0.224.0/assert/mod.ts'
import { importEdgeModuleOffline } from '../_shared/module-load-test-harness.ts'

Deno.test('module loads offline without opening a real HTTP listener', async () => {
  const { module, stats } = await importEdgeModuleOffline(new URL('./index.ts', import.meta.url))

  assertExists(module)
  assertEquals(stats.serveCalls, 1)
  assertEquals(stats.listenCalls, 0)
  assertEquals(stats.fetchCalls, 0)
})

Deno.test('source protects the cron with the internal secret', async () => {
  const source = await Deno.readTextFile(new URL('./index.ts', import.meta.url))

  assertEquals(source.includes('requireInternalSecret(req, corsHeaders)'), true)
  assertEquals(source.includes('check_thread_integrity'), true)
  assertEquals(source.includes('DRIFT_THRESHOLD'), true)
})
