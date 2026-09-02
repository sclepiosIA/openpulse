import {
  assertEquals,
  assertExists,
  assertThrows,
  assertRejects,
} from 'https://deno.land/std@0.224.0/assert/mod.ts'
import { importEdgeModuleOffline } from '../_shared/module-load-test-harness.ts'

Deno.test('module loads offline without opening a real HTTP listener', async () => {
  const { module, stats } = await importEdgeModuleOffline(new URL('./index.ts', import.meta.url))

  assertExists(module)
  assertEquals(stats.listenCalls + stats.serveCalls, 1)
  assertEquals(stats.serveHttpCalls, 0)
  assertEquals(stats.fetchCalls, 0)
})

Deno.test('assert helpers available', async () => {
  assertThrows(
    () => {
      throw new Error('boom')
    },
    Error,
    'boom'
  )

  await assertRejects(
    async () => {
      await Promise.resolve()
      throw new Error('async boom')
    },
    Error,
    'async boom'
  )
})
