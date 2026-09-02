import { assertEquals, assertExists } from 'https://deno.land/std@0.224.0/assert/mod.ts'
import { importEdgeModuleOffline } from '../_shared/module-load-test-harness.ts'

Deno.test(
  'module loads offline without sending email or opening a real HTTP listener',
  async () => {
    const { module, stats } = await importEdgeModuleOffline(new URL('./index.ts', import.meta.url))

    assertExists(module)
    assertEquals(stats.listenCalls + stats.serveCalls, 1)
    assertEquals(stats.serveHttpCalls, 0)
    assertEquals(stats.fetchCalls, 0)
  }
)
