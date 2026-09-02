import { assertEquals, assertExists } from 'https://deno.land/std@0.224.0/assert/mod.ts'
import { importEdgeModuleOffline } from '../_shared/module-load-test-harness.ts'

Deno.test('prepare-annual-review registers offline without module-load I/O', async () => {
  const { module, stats } = await importEdgeModuleOffline(new URL('./index.ts', import.meta.url))

  assertExists(module)
  assertEquals(stats.fetchCalls, 0)
  assertEquals(stats.listenCalls + stats.serveCalls > 0, true)
})
