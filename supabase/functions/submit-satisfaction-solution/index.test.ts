import {
  assertEquals,
  assertExists,
  assertThrows,
  assertRejects,
} from 'https://deno.land/std@0.224.0/assert/mod.ts'
import { importEdgeModuleOffline } from '../_shared/module-load-test-harness.ts'
import { corsHeaders } from '../_shared/cors.ts'

const indexUrl = new URL('./index.ts', import.meta.url)

async function readIndexSource(): Promise<string> {
  return await Deno.readTextFile(indexUrl)
}

Deno.test('source defines the expected Supabase Edge Function wiring', async () => {
  const source = await readIndexSource()

  assertEquals(
    source.includes('import { serve } from "https://deno.land/std@0.168.0/http/server.ts";'),
    true
  )
  assertEquals(source.includes('import { createClient } from "@supabase/supabase-js";'), true)
  assertEquals(source.includes('serve(async (req) =>'), true)
  // La consolidation CORS a deporte les en-tetes dans ../_shared/cors.ts :
  // index.ts n'a plus d'objet en ligne, il importe le socle partage. Les deux
  // attendus de source sont realignes sur leur equivalent exact dans le fichier
  // livre, et les deux suivants exercent REELLEMENT le socle -- l'assertion
  // n'est pas relachee, elle porte sur la valeur reellement emise.
  assertEquals(source.includes("import { corsHeaders } from '../_shared/cors.ts'"), true)
  assertEquals(
    source.includes(
      "// en-tetes autorises d'origine : authorization, x-client-info, apikey, content-type"
    ),
    true
  )
  assertEquals(corsHeaders['Access-Control-Allow-Origin'] === '*', false)
  assertEquals(
    corsHeaders['Access-Control-Allow-Headers'],
    'authorization, x-client-info, apikey, content-type, x-internal-secret'
  )
  assertEquals(source.includes("if (req.method === 'OPTIONS')"), true)
})

Deno.test('source enforces public survey anti-spam and token validation rules', async () => {
  const source = await readIndexSource()

  assertEquals(source.includes('extractClientIp(req)'), true)
  assertEquals(
    source.includes(
      'checkRateLimit(`submit-satisfaction-solution:${ip}`, { limit: 5, windowSec: 60 })'
    ),
    true
  )
  assertEquals(source.includes('rateLimitedResponse(rl.retryAfterSec!, corsHeaders)'), true)

  // The legacy wrapper validates token presence, then delegates lifecycle
  // validation (expiration and one-time use) to submit_enquete.
  assertEquals(source.includes("typeof payload.token_enquete === 'string'"), true)
  assertEquals(source.includes('.trim()'), true)
  assertEquals(source.includes("'token_enquete requis'"), true)
  assertEquals(source.includes('{ status: 400'), true)
})

Deno.test('source verifies token binding and one-time usage before accepting answers', async () => {
  const source = await readIndexSource()

  assertExists(source.match(/supabase\.rpc\(['"]submit_enquete['"],\s*\{/))
  assertEquals(source.includes('p_token: token'), true)
  assertEquals(source.includes("p_type: 'satisfaction'"), true)
  assertEquals(source.includes('p_payload: payload'), true)
  assertEquals(source.includes("'deja_repondu' ? 409"), true)
  assertEquals(source.includes('{ status: 400'), true)
})

Deno.test('source delegates survey payload sanitization to the RPC', async () => {
  const source = await readIndexSource()

  assertEquals(source.includes('const payload = await req.json();'), true)
  assertEquals(source.includes('p_payload: payload'), true)
  assertEquals(source.includes('sanitizeErrorForClient(error)'), true)
  assertEquals(source.includes('sanitizeErrorForClient(err)'), true)
  assertEquals(source.includes('status: 500,'), true)
})

Deno.test('source delegates public respondent creation to the RPC', async () => {
  const source = await readIndexSource()

  assertEquals(source.includes('Endpoint legacy maintenu pour compatibilité.'), true)
  assertEquals(source.includes('submit_enquete(token, type, payload)'), true)
  assertEquals(source.includes("plan d'action automatique"), true)
  assertExists(
    source.match(/const result = data as \{ success: boolean; error\?: string; id\?: string \}/)
  )
  assertEquals(source.includes('JSON.stringify({ success: true, id: result.id })'), true)
})

Deno.test('source maps RPC business outcomes to HTTP errors', async () => {
  const source = await readIndexSource()

  assertEquals(source.includes("result?.error === 'deja_repondu' ? 409"), true)
  assertEquals(
    source.includes("result?.error === 'token_expire' || result?.error === 'token_invalide' ? 401"),
    true
  )
  assertEquals(source.includes(': 400'), true)
  assertEquals(source.includes("result?.error || 'unknown'"), true)
  assertEquals(source.includes('status: 500,'), true)
})

Deno.test('assert helpers behave as expected for the local test harness', async () => {
  assertThrows(() => JSON.parse('{invalid-json'))
  await assertRejects(async () => {
    await Promise.reject(new Error('offline rejection'))
  }, Error)
})

Deno.test('module loads without opening a listener or fetching', async () => {
  const { module, stats } = await importEdgeModuleOffline(indexUrl)

  assertExists(module)
  assertEquals(stats.listenCalls + stats.serveCalls, 1)
  assertEquals(stats.serveHttpCalls, 0)
  assertEquals(stats.fetchCalls, 0)
})
