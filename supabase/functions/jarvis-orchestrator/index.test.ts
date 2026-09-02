import {
  assertEquals,
  assertExists,
  assertStringIncludes,
} from 'https://deno.land/std@0.224.0/assert/mod.ts'
import { importEdgeModuleOffline } from '../_shared/module-load-test-harness.ts'

Deno.test('module loads offline without opening a real HTTP listener', async () => {
  const { module, stats } = await importEdgeModuleOffline(new URL('./index.ts', import.meta.url))

  assertExists(module)
  assertEquals(stats.listenCalls + stats.serveCalls, 1)
  assertEquals(stats.serveHttpCalls, 0)
  assertEquals(stats.fetchCalls, 0)
})

Deno.test('keeps service-or-user authorization and user binding', async () => {
  const source = await Deno.readTextFile(new URL('./index.ts', import.meta.url))

  assertStringIncludes(source, 'const auth = await validateServiceOrUser(req)')
  assertStringIncludes(source, 'if (!auth.authorized)')
  assertStringIncludes(
    source,
    'const user_id = (!auth.isServiceCall && auth.userId) ? auth.userId : request.user_id'
  )
})
