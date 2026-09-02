import { assertEquals, assertExists } from 'https://deno.land/std@0.224.0/assert/mod.ts'
import { importEdgeModuleOffline } from '../_shared/module-load-test-harness.ts'

Deno.test('module loads offline without opening a real HTTP listener', async () => {
  const { module, stats } = await importEdgeModuleOffline(new URL('./index.ts', import.meta.url))

  assertExists(module)
  assertEquals(stats.listenCalls + stats.serveCalls, 1)
  assertEquals(stats.serveHttpCalls, 0)
  assertEquals(stats.fetchCalls, 0)
})

Deno.test(
  'source keeps search input and result context protected before GPT synthesis',
  async () => {
    const source = await Deno.readTextFile(new URL('./index.ts', import.meta.url))

    assertEquals(source.includes('sanitizeForAI(query'), true)
    assertEquals(source.includes('detectPromptInjection(query)'), true)
    assertEquals(source.includes("wrapUserContent(sourcesContext, 'SEARCH_RESULTS')"), true)
    assertEquals(source.includes('callGpt5Mini('), true)
  }
)
