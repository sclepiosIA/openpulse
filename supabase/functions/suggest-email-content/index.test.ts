import { assertEquals, assertNotEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts'
import { handler } from './index.ts'
// Le socle CORS n'emet plus '*' : l'origine attendue est celle que le module
// partage calcule pour l'instance. On la lit du VRAI module, on ne la simule pas.
import { corsHeaders as socleCors } from '../_shared/cors.ts'

const corsHeaders = {
  origin: socleCors['Access-Control-Allow-Origin'],
  allowedHeaders: socleCors['Access-Control-Allow-Headers'],
}

function request(body?: unknown): Request {
  return new Request('http://localhost', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

async function assertRequiredEtablissementId(body: unknown): Promise<void> {
  const response = await handler(request(body))

  assertEquals(response.status, 400)
  assertEquals(response.headers.get('Access-Control-Allow-Origin'), corsHeaders.origin)
  assertNotEquals(response.headers.get('Access-Control-Allow-Origin'), '*')
  assertEquals(response.headers.get('Content-Type'), 'application/json')
  assertEquals(await response.json(), { error: 'etablissement_id is required' })
}

Deno.test('OPTIONS request returns CORS headers and an empty body', async () => {
  const response = await handler(new Request('http://localhost', { method: 'OPTIONS' }))

  assertEquals(response.status, 200)
  assertEquals(response.headers.get('Access-Control-Allow-Origin'), corsHeaders.origin)
  assertNotEquals(response.headers.get('Access-Control-Allow-Origin'), '*')
  assertEquals(response.headers.get('Access-Control-Allow-Headers'), corsHeaders.allowedHeaders)
  assertEquals(await response.text(), '')
})

Deno.test('POST request without etablissement_id returns a 400 validation error', async () => {
  await assertRequiredEtablissementId({ context: 'Contexte commercial utile' })
})

Deno.test(
  'POST request with an empty etablissement_id is rejected before any business processing',
  async () => {
    await assertRequiredEtablissementId({
      etablissement_id: '',
      context: 'Ce contexte ne doit pas être traité sans identifiant',
    })
  }
)

Deno.test(
  'POST request with a null etablissement_id is rejected with the same validation contract',
  async () => {
    await assertRequiredEtablissementId({
      etablissement_id: null,
      context: "Contexte ignoré car l'identifiant est absent",
    })
  }
)
