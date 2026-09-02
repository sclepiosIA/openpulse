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

Deno.test('keeps the internal-secret authentication gate', async () => {
  const source = await Deno.readTextFile(new URL('./index.ts', import.meta.url))

  assertStringIncludes(
    source,
    'import { requireInternalSecret } from "../_shared/internal-secret.ts"'
  )
  assertStringIncludes(source, 'const internalDenied = requireInternalSecret(req, corsHeaders)')
  assertStringIncludes(source, 'if (internalDenied)')
})
