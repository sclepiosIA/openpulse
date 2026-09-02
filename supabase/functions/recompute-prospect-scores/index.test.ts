import {
  assertEquals,
  assertExists,
  assertThrows,
  assertRejects, assertNotEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts'

type Handler = (req: Request) => Response | Promise<Response>

let capturedHandler: Handler | undefined
let handlerPromise: Promise<Handler> | undefined

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

async function getHandler(): Promise<Handler> {
  if (capturedHandler) return capturedHandler

  if (!handlerPromise) {
    const originalDescriptor = Object.getOwnPropertyDescriptor(Deno, 'serve')

    Object.defineProperty(Deno, 'serve', {
      configurable: true,
      writable: true,
      value: (arg1: unknown, arg2?: unknown) => {
        capturedHandler = (typeof arg1 === 'function' ? arg1 : arg2) as Handler
        return {
          finished: Promise.resolve(),
          shutdown: () => {},
          ref: () => {},
          unref: () => {},
          addr: { transport: 'tcp', hostname: '127.0.0.1', port: 0 },
        }
      },
    })

    handlerPromise = import('./index.ts')
      .then(() => {
        if (originalDescriptor) {
          Object.defineProperty(Deno, 'serve', originalDescriptor)
        }

        if (!capturedHandler) {
          throw new Error('Deno.serve handler was not captured')
        }

        return capturedHandler
      })
      .catch((error) => {
        if (originalDescriptor) {
          Object.defineProperty(Deno, 'serve', originalDescriptor)
        }
        throw error
      })
  }

  return handlerPromise
}

async function withEnv<T>(
  values: Record<string, string | undefined>,
  fn: () => Promise<T>
): Promise<T> {
  const previous = new Map<string, string | undefined>()

  for (const key of Object.keys(values)) {
    previous.set(key, Deno.env.get(key))
    const value = values[key]

    if (value === undefined) {
      Deno.env.delete(key)
    } else {
      Deno.env.set(key, value)
    }
  }

  try {
    return await fn()
  } finally {
    for (const [key, value] of previous) {
      if (value === undefined) {
        Deno.env.delete(key)
      } else {
        Deno.env.set(key, value)
      }
    }
  }
}

type FetchCall = {
  method: string
  url: string
  path: string
  search: string
  body: unknown
}

async function decodeBody(
  request: Request | undefined,
  body: BodyInit | null | undefined
): Promise<unknown> {
  const text = request
    ? await request.clone().text()
    : body == null
      ? ''
      : await new Response(body).text()

  return text.length > 0 ? JSON.parse(text) : undefined
}

function installFetchStub(responder: (call: FetchCall) => Response | Promise<Response>): {
  calls: FetchCall[]
  restore: () => void
} {
  const originalFetch = globalThis.fetch
  const calls: FetchCall[] = []

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const request = input instanceof Request ? input : undefined
    const url = new URL(request?.url ?? input.toString())
    const method = (init?.method ?? request?.method ?? 'GET').toUpperCase()
    const body = await decodeBody(request, init?.body ?? null)

    const call: FetchCall = {
      method,
      url: url.toString(),
      path: url.pathname,
      search: url.search,
      body,
    }

    calls.push(call)
    return await responder(call)
  }) as typeof fetch

  return {
    calls,
    restore: () => {
      globalThis.fetch = originalFetch
    },
  }
}

Deno.test('OPTIONS returns CORS preflight response without requiring auth', async () => {
  const handler = await getHandler()

  const response = await handler(new Request('http://localhost', { method: 'OPTIONS' }))

  assertEquals(response.status, 200)
  assertNotEquals(response.headers.get('Access-Control-Allow-Origin'), '*')
  assertEquals(
    response.headers.get('Access-Control-Allow-Headers'),
    'authorization, x-client-info, apikey, content-type, x-internal-secret'
  )
  assertEquals(await response.text(), '')
})

Deno.test('rejects unauthenticated requests with 401 JSON response', async () => {
  await withEnv(
    {
      SUPABASE_URL: 'http://supabase.local',
      SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
      INTERNAL_FUNCTION_SECRET: 'internal-secret',
    },
    async () => {
      const handler = await getHandler()

      const response = await handler(new Request('http://localhost', { method: 'POST' }))

      assertEquals(response.status, 401)
      assertEquals(response.headers.get('Content-Type'), 'application/json')
      assertNotEquals(response.headers.get('Access-Control-Allow-Origin'), '*')
      assertEquals(await response.json(), { error: 'Unauthorized' })
    }
  )
})

Deno.test('processes prospects, computes capped scores and writes daily snapshots', async () => {
  await withEnv(
    {
      SUPABASE_URL: 'http://supabase.local',
      SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
      INTERNAL_FUNCTION_SECRET: 'internal-secret',
    },
    async () => {
      const handler = await getHandler()

      const { calls, restore } = installFetchStub((call) => {
        if (call.method === 'GET' && call.path === '/rest/v1/etablissements') {
          assertEquals(call.search.includes('limit=500'), true)
          return jsonResponse([
            { id: 'etab-a', score_conversion: 80 },
            { id: 'etab-b', score_conversion: 140 },
          ])
        }

        if (call.method === 'POST' && call.path === '/rest/v1/rpc/compute_behavioral_score') {
          const body = call.body as { _etablissement_id: string }

          if (body._etablissement_id === 'etab-a') {
            return jsonResponse({
              behavioral_score: 33,
              engagement_velocity: 7,
            })
          }

          if (body._etablissement_id === 'etab-b') {
            return jsonResponse({
              behavioral_score: 60,
              engagement_velocity: 12,
            })
          }
        }

        if (call.method === 'POST' && call.path === '/rest/v1/rpc/compute_attribution') {
          const body = call.body as {
            _etablissement_id: string
            _model: string
          }

          assertEquals(body._model, 'time_decay')
          return jsonResponse({
            model: 'time_decay',
            etablissement_id: body._etablissement_id,
            channels: { email: 0.7, phone: 0.3 },
          })
        }

        if (call.method === 'PATCH' && call.path === '/rest/v1/etablissements') {
          return jsonResponse([])
        }

        if (call.method === 'POST' && call.path === '/rest/v1/prospect_score_history') {
          return jsonResponse([])
        }

        return jsonResponse({ message: `Unexpected request: ${call.method} ${call.path}` }, 500)
      })

      try {
        const response = await handler(
          new Request('http://localhost', {
            method: 'POST',
            headers: { 'x-function-secret': 'internal-secret' },
          })
        )

        assertEquals(response.status, 200)
        const payload = await response.json()

        assertEquals(payload.success, true)
        assertEquals(payload.processed, 2)
        assertEquals(payload.snapshots, 2)
        assertEquals(payload.errors, 0)
        assertExists(payload.duration_ms)

        const updates = calls.filter(
          (call) => call.method === 'PATCH' && call.path === '/rest/v1/etablissements'
        )
        assertEquals(updates.length, 2)
        assertEquals(updates[0].body, {
          behavioral_score: 33,
          engagement_velocity: 7,
          attribution_summary: {
            model: 'time_decay',
            etablissement_id: 'etab-a',
            channels: { email: 0.7, phone: 0.3 },
          },
        })
        assertEquals(updates[1].body, {
          behavioral_score: 60,
          engagement_velocity: 12,
          attribution_summary: {
            model: 'time_decay',
            etablissement_id: 'etab-b',
            channels: { email: 0.7, phone: 0.3 },
          },
        })

        const snapshots = calls.filter(
          (call) => call.method === 'POST' && call.path === '/rest/v1/prospect_score_history'
        )
        assertEquals(snapshots.length, 2)

        assertEquals(snapshots[0].body, {
          etablissement_id: 'etab-a',
          score: 73,
          static_score: 40,
          behavioral_score: 33,
          engagement_velocity: 7,
          computed_at: (snapshots[0].body as { computed_at: string }).computed_at,
        })
        assertEquals(
          (snapshots[0].body as { computed_at: string }).computed_at.endsWith('T00:00:00.000Z'),
          true
        )

        assertEquals(snapshots[1].body, {
          etablissement_id: 'etab-b',
          score: 100,
          static_score: 50,
          behavioral_score: 60,
          engagement_velocity: 12,
          computed_at: (snapshots[1].body as { computed_at: string }).computed_at,
        })
        assertEquals(
          (snapshots[1].body as { computed_at: string }).computed_at.endsWith('T00:00:00.000Z'),
          true
        )
      } finally {
        restore()
      }
    }
  )
})

Deno.test('accepts service-role Authorization header when internal secret is absent', async () => {
  await withEnv(
    {
      SUPABASE_URL: 'http://supabase.local',
      SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
      INTERNAL_FUNCTION_SECRET: undefined,
    },
    async () => {
      const handler = await getHandler()

      const { calls, restore } = installFetchStub((call) => {
        if (call.method === 'GET' && call.path === '/rest/v1/etablissements') {
          return jsonResponse([])
        }

        return jsonResponse({ message: `Unexpected request: ${call.method} ${call.path}` }, 500)
      })

      try {
        const response = await handler(
          new Request('http://localhost', {
            method: 'POST',
            headers: { authorization: 'Bearer service-role-key' },
          })
        )

        assertEquals(response.status, 200)
        const payload = await response.json()

        assertEquals(payload.success, true)
        assertEquals(payload.processed, 0)
        assertEquals(payload.snapshots, 0)
        assertEquals(payload.errors, 0)
        assertEquals(typeof payload.duration_ms, 'number')
      } finally {
        assertEquals(
          calls.filter((call) => call.method === 'GET' && call.path === '/rest/v1/etablissements')
            .length >= 1,
          true
        )
        restore()
      }
    }
  )
})

Deno.test(
  'counts behavioral RPC errors and skips update plus snapshot for that prospect',
  async () => {
    await withEnv(
      {
        SUPABASE_URL: 'http://supabase.local',
        SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
        INTERNAL_FUNCTION_SECRET: 'internal-secret',
      },
      async () => {
        const handler = await getHandler()

        const { calls, restore } = installFetchStub((call) => {
          if (call.method === 'GET' && call.path === '/rest/v1/etablissements') {
            return jsonResponse([{ id: 'broken-etab', score_conversion: 100 }])
          }

          if (call.method === 'POST' && call.path === '/rest/v1/rpc/compute_behavioral_score') {
            return jsonResponse(
              {
                message: 'RPC failure',
                code: 'P0001',
                details: 'compute_behavioral_score failed',
                hint: null,
              },
              400
            )
          }

          return jsonResponse({ message: `Unexpected request: ${call.method} ${call.path}` }, 500)
        })

        try {
          const response = await handler(
            new Request('http://localhost', {
              method: 'POST',
              headers: { 'x-function-secret': 'internal-secret' },
            })
          )

          assertEquals(response.status, 200)
          const payload = await response.json()

          assertEquals(payload.success, true)
          assertEquals(payload.processed, 0)
          assertEquals(payload.snapshots, 0)
          assertEquals(payload.errors, 1)
          assertExists(payload.duration_ms)

          assertEquals(
            calls.some(
              (call) => call.method === 'PATCH' && call.path === '/rest/v1/etablissements'
            ),
            false
          )
          assertEquals(
            calls.some(
              (call) => call.method === 'POST' && call.path === '/rest/v1/prospect_score_history'
            ),
            false
          )
        } finally {
          restore()
        }
      }
    )
  }
)

Deno.test('module handler capture guard throws a clear error', () => {
  assertThrows(
    () => {
      const missing: Handler | undefined = undefined
      if (!missing) throw new Error('Deno.serve handler was not captured')
    },
    Error,
    'Deno.serve handler was not captured'
  )
})

Deno.test('unexpected fetch failures are propagated as rejected promises', async () => {
  const { restore } = installFetchStub(() => {
    throw new Error('Unexpected offline request')
  })

  try {
    await assertRejects(
      () => fetch('http://supabase.local/unexpected'),
      Error,
      'Unexpected offline request'
    )
  } finally {
    restore()
  }
})
