import {
  assertEquals,
  assertExists,
  assertThrows,
  assertRejects, assertNotEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts'

type CapturedHandler = (request: Request, info?: unknown) => Response | Promise<Response>

let capturedHandler: CapturedHandler | undefined
let importPromise: Promise<void> | undefined

const REQUIRED_ENV = ['SUPABASE_URL', 'SUPABASE_ANON_KEY'] as const

function snapshotEnv(): Record<string, string | undefined> {
  const snapshot: Record<string, string | undefined> = {}
  for (const key of REQUIRED_ENV) {
    snapshot[key] = Deno.env.get(key)
  }
  return snapshot
}

function restoreEnv(snapshot: Record<string, string | undefined>) {
  for (const [key, value] of Object.entries(snapshot)) {
    if (value === undefined) {
      Deno.env.delete(key)
    } else {
      Deno.env.set(key, value)
    }
  }
}

async function importModuleWithStubbedServe() {
  if (importPromise) return importPromise

  importPromise = (async () => {
    const envSnapshot = snapshotEnv()
    // Deno >= 2.2 : Deno.serve est un getter, on stubbe via defineProperty
    // (même pattern que workflow-dispatcher/index.test.ts).
    const originalServeDescriptor = Object.getOwnPropertyDescriptor(Deno, 'serve')

    Deno.env.set('SUPABASE_URL', 'http://localhost:54321')
    Deno.env.set('SUPABASE_ANON_KEY', 'test-anon-key')

    Object.defineProperty(Deno, 'serve', {
      configurable: true,
      writable: true,
      value: ((optionsOrHandler: unknown, maybeHandler?: unknown) => {
        capturedHandler = (
          typeof optionsOrHandler === 'function' ? optionsOrHandler : maybeHandler
        ) as CapturedHandler

        return {
          addr: { hostname: '127.0.0.1', port: 0, transport: 'tcp' },
          finished: Promise.resolve(),
          shutdown: () => {},
          ref: () => {},
          unref: () => {},
        }
      }) as typeof Deno.serve,
    })

    try {
      await import('./index.ts')
    } finally {
      if (originalServeDescriptor) Object.defineProperty(Deno, 'serve', originalServeDescriptor)
      restoreEnv(envSnapshot)
    }
  })()

  return importPromise
}

async function getHandler(): Promise<CapturedHandler> {
  await importModuleWithStubbedServe()
  assertExists(capturedHandler)
  return capturedHandler
}

Deno.test('module loads and registers the Supabase Edge Function handler', async () => {
  const handler = await getHandler()

  assertExists(handler)
  assertEquals(typeof handler, 'function')
})

Deno.test('OPTIONS preflight returns CORS headers without requiring authentication', async () => {
  const handler = await getHandler()

  const response = await handler(
    new Request('http://localhost/generate-workflow-from-prompt', {
      method: 'OPTIONS',
    })
  )

  assertEquals(response.status, 200)
  assertNotEquals(response.headers.get('Access-Control-Allow-Origin'), '*')
  assertEquals(
    response.headers.get('Access-Control-Allow-Headers'),
    'authorization, x-client-info, apikey, content-type, x-internal-secret'
  )
  assertEquals(await response.text(), '')
})

Deno.test('request without Authorization returns a 401 JSON error', async () => {
  const handler = await getHandler()

  const response = await handler(
    new Request('http://localhost/generate-workflow-from-prompt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: 'Créer une tâche quand une facture devient en retard',
      }),
    })
  )

  assertEquals(response.status, 401)
  assertNotEquals(response.headers.get('Access-Control-Allow-Origin'), '*')
  assertEquals(response.headers.get('Content-Type'), 'application/json')

  const payload = await response.json()
  assertEquals(payload, { error: 'Authentification requise' })
})

Deno.test('unauthenticated request does not call fetch or external services', async () => {
  const handler = await getHandler()
  const originalFetch = globalThis.fetch
  let fetchCalls = 0

  globalThis.fetch = (() => {
    fetchCalls++
    return Promise.resolve(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    )
  }) as typeof fetch

  try {
    const response = await handler(
      new Request('http://localhost/generate-workflow-from-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: 'Génère un workflow de relance de facture impayée après trente jours',
        }),
      })
    )

    assertEquals(response.status, 401)
    assertEquals(fetchCalls, 0)
    assertEquals(await response.json(), { error: 'Authentification requise' })
  } finally {
    globalThis.fetch = originalFetch
  }
})

Deno.test(
  'non-OPTIONS methods without Authorization consistently return the authentication error',
  async () => {
    const handler = await getHandler()

    for (const method of ['GET', 'PUT', 'DELETE']) {
      const response = await handler(
        new Request('http://localhost/generate-workflow-from-prompt', {
          method,
        })
      )

      assertEquals(response.status, 401)
      assertEquals(await response.json(), { error: 'Authentification requise' })
    }
  }
)
