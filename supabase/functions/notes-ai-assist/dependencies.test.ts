import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts'
import { dirname, fromFileUrl, join } from 'https://deno.land/std@0.224.0/path/mod.ts'

const functionDir = dirname(fromFileUrl(import.meta.url))
const localImportPattern = /from\s+['"](\.\.?\/[^'"]+)['"]/g

Deno.test('notes-ai-assist ships every local module dependency', async () => {
  const entrypoint = join(functionDir, 'index.ts')
  const source = await Deno.readTextFile(entrypoint)
  const missing: string[] = []

  for (const match of source.matchAll(localImportPattern)) {
    const dependency = join(functionDir, match[1])
    try {
      await Deno.stat(dependency)
    } catch (error) {
      if (error instanceof Deno.errors.NotFound) missing.push(match[1])
      else throw error
    }
  }

  assertEquals(missing, [])
})
