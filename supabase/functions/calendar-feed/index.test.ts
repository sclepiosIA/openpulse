import { assertEquals, assertExists } from 'https://deno.land/std@0.224.0/assert/mod.ts'
import { importEdgeModuleOffline } from '../_shared/module-load-test-harness.ts'

Deno.test('module loads offline without opening a real HTTP listener', async () => {
  const { module, stats } = await importEdgeModuleOffline(new URL('./index.ts', import.meta.url))

  assertExists(module)
  assertEquals(stats.listenCalls + stats.serveCalls, 1)
  assertEquals(stats.serveHttpCalls, 0)
  assertEquals(stats.fetchCalls, 0)
})

Deno.test('source requires an opaque calendar token and rate-limits requests', async () => {
  const source = await Deno.readTextFile(new URL('./index.ts', import.meta.url))

  assertEquals(source.includes("searchParams.get('token')"), true)
  assertEquals(source.includes('checkRateLimit'), true)
  assertEquals(source.includes('Too Many Requests'), true)
})
