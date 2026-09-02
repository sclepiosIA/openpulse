import { assertEquals, assertMatch } from 'https://deno.land/std@0.224.0/assert/mod.ts'

Deno.test('jarvis-tts delegates CORS to the shared allowlist', async () => {
  const source = await Deno.readTextFile(new URL('./index.ts', import.meta.url))

  assertMatch(source, /import \{ getCorsHeaders \} from '\.\.\/_shared\/cors\.ts'/)
  assertMatch(source, /getCorsHeaders\(req\.headers\.get\(['"]origin['"]\)\)/)
  assertEquals(source.includes("'Access-Control-Allow-Origin': '*'"), false)

  const { getCorsHeaders } = await import('../_shared/cors.ts')
  const headers = getCorsHeaders('https://origine-non-declaree.invalid')
  assertEquals(headers['Access-Control-Allow-Origin'] === '*', false)
})
