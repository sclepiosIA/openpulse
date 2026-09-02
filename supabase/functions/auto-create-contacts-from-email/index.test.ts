import { assertEquals, assertExists } from 'https://deno.land/std@0.224.0/assert/mod.ts'
import { importEdgeModuleOffline } from '../_shared/module-load-test-harness.ts'

async function readModuleSource(): Promise<string> {
  return await Deno.readTextFile(new URL('./index.ts', import.meta.url))
}

Deno.test('module loads offline without opening a real HTTP listener', async () => {
  const { module, stats } = await importEdgeModuleOffline(new URL('./index.ts', import.meta.url))

  assertExists(module)
  assertEquals(stats.listenCalls + stats.serveCalls, 1)
  assertEquals(stats.serveHttpCalls, 0)
  assertEquals(stats.fetchCalls, 0)
})

Deno.test(
  'source defines permissive CORS headers required by Supabase Edge Functions',
  async () => {
    const source = await readModuleSource()

    assertEquals(source.includes("import { corsHeaders } from '../_shared/cors.ts'"), true)
    const { corsHeaders } = await import('../_shared/cors.ts')
    assertEquals(
      corsHeaders['Access-Control-Allow-Headers'],
      'authorization, x-client-info, apikey, content-type, x-internal-secret'
    )
    assertEquals(corsHeaders['Access-Control-Allow-Origin'] === '*', false)
    assertEquals(
      source.includes(
        'if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });'
      ),
      true
    )
  }
)

Deno.test('source validates required entity id and contacts array', async () => {
  const source = await readModuleSource()

  assertEquals(source.includes('(!etablissement_id && !groupe_id)'), true)
  assertEquals(source.includes('!contacts'), true)
  assertEquals(source.includes('!Array.isArray(contacts)'), true)
  assertEquals(
    source.includes('Missing required fields: etablissement_id or groupe_id and contacts'),
    true
  )
})

Deno.test(
  'source rejects malformed email addresses with the expected validation rule',
  async () => {
    const source = await readModuleSource()

    assertEquals(source.includes('Invalid email format'), true)
    assertEquals(source.includes('/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/'), true)
  }
)

Deno.test(
  'source uses the expected confidence thresholds for contact creation workflow',
  async () => {
    const source = await readModuleSource()

    const confidenceThreshold = source.match(/const\s+CONFIDENCE_THRESHOLD\s*=\s*([0-9.]+)/)
    const minConfidence = source.match(/const\s+MIN_CONFIDENCE\s*=\s*([0-9.]+)/)

    assertExists(confidenceThreshold)
    assertExists(minConfidence)
    assertEquals(Number(confidenceThreshold[1]), 0.85)
    assertEquals(Number(minConfidence[1]), 0.65)
  }
)

Deno.test('source classifies contact functions into expected business categories', async () => {
  const source = await readModuleSource()

  assertEquals(source.includes("type_contact = 'cliniciens'"), true)
  assertEquals(source.includes("type_contact = 'administration'"), true)
  assertEquals(source.includes("type_contact = 'dim'"), true)
  assertEquals(source.includes("type_contact = 'informatique'"), true)
  assertEquals(source.includes("type_contact = 'secretariat'"), true)
  assertEquals(source.includes("type_contact = 'autre'"), true)
})

Deno.test(
  'source enforces non-service etablissement authorization before processing contacts',
  async () => {
    const source = await readModuleSource()

    assertEquals(source.includes('validateServiceOrUser(req)'), true)
    assertEquals(source.includes('!auth.authorized'), true)
    assertEquals(source.includes('Authentication required'), true)
    assertEquals(source.includes('assertEtablissementAccess(auth.userId, etablissement_id)'), true)
    assertEquals(source.includes('Forbidden: no access to this etablissement'), true)
  }
)
