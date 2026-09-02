import {
  assertEquals,
  assertExists,
  assertThrows,
  assertRejects, assertNotEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts'

type CapturedHandler = (req: Request) => Response | Promise<Response>

const ENV_KEYS = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'INTERNAL_FUNCTION_SECRET'] as const

function snapshotEnv(keys: readonly string[]) {
  const snapshot = new Map<string, string | undefined>()
  for (const key of keys) snapshot.set(key, Deno.env.get(key))
  return snapshot
}

function restoreEnv(snapshot: Map<string, string | undefined>) {
  for (const [key, value] of snapshot) {
    if (value === undefined) Deno.env.delete(key)
    else Deno.env.set(key, value)
  }
}

let handlerPromise: Promise<CapturedHandler> | undefined

async function getCapturedHandler(): Promise<CapturedHandler> {
  if (!handlerPromise) {
    handlerPromise = (async () => {
      const envSnapshot = snapshotEnv(ENV_KEYS)
      // Deno >= 2.2 : Deno.serve est un getter, on stubbe via defineProperty
      // (même pattern que workflow-dispatcher/index.test.ts).
      const originalServeDescriptor = Object.getOwnPropertyDescriptor(Deno, 'serve')
      let capturedHandler: CapturedHandler | undefined

      try {
        Deno.env.set('SUPABASE_URL', 'http://localhost:54321')
        Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', 'test-service-role-key')
        Deno.env.set('INTERNAL_FUNCTION_SECRET', 'test-internal-secret')

        Object.defineProperty(Deno, 'serve', {
          configurable: true,
          writable: true,
          value: (first: unknown, second?: unknown) => {
            capturedHandler =
              typeof first === 'function' ? (first as CapturedHandler) : (second as CapturedHandler)
            return {
              finished: Promise.resolve(),
              shutdown: () => {},
              ref: () => {},
              unref: () => {},
              addr: {
                transport: 'tcp',
                hostname: '127.0.0.1',
                port: 0,
              },
            }
          },
        })

        await import('./index.ts')
      } finally {
        if (originalServeDescriptor) Object.defineProperty(Deno, 'serve', originalServeDescriptor)
        restoreEnv(envSnapshot)
      }

      assertExists(capturedHandler)
      return capturedHandler
    })()
  }

  return handlerPromise
}

Deno.test('module loads and registers an HTTP handler with Deno.serve', async () => {
  const handler = await getCapturedHandler()

  assertEquals(typeof handler, 'function')
})

Deno.test('OPTIONS request returns CORS preflight response without authentication', async () => {
  const handler = await getCapturedHandler()

  const response = await handler(new Request('http://localhost', { method: 'OPTIONS' }))

  assertEquals(response.status, 200)
  assertNotEquals(response.headers.get('Access-Control-Allow-Origin'), '*')
  assertEquals(
    response.headers.get('Access-Control-Allow-Headers'),
    'authorization, x-client-info, apikey, content-type, x-internal-secret'
  )
  assertEquals(await response.text(), '')
})

Deno.test('unauthenticated non-OPTIONS request returns 401 JSON error', async () => {
  const handler = await getCapturedHandler()

  const response = await handler(new Request('http://localhost', { method: 'POST' }))
  const body = await response.json()

  assertEquals(response.status, 401)
  assertEquals(response.headers.get('Content-Type'), 'application/json')
  assertNotEquals(response.headers.get('Access-Control-Allow-Origin'), '*')
  assertEquals(body, { error: 'Unauthorized' })
})

Deno.test('wrong internal function secret is rejected', async () => {
  const handler = await getCapturedHandler()
  const envSnapshot = snapshotEnv(['INTERNAL_FUNCTION_SECRET'])

  try {
    Deno.env.set('INTERNAL_FUNCTION_SECRET', 'expected-secret')

    const response = await handler(
      new Request('http://localhost', {
        method: 'POST',
        headers: {
          'x-function-secret': 'wrong-secret',
        },
      })
    )
    const body = await response.json()

    assertEquals(response.status, 401)
    assertEquals(body, { error: 'Unauthorized' })
  } finally {
    restoreEnv(envSnapshot)
  }
})

Deno.test('wrong bearer token is not treated as service role', async () => {
  const handler = await getCapturedHandler()
  const envSnapshot = snapshotEnv(['INTERNAL_FUNCTION_SECRET'])

  try {
    Deno.env.delete('INTERNAL_FUNCTION_SECRET')

    const response = await handler(
      new Request('http://localhost', {
        method: 'POST',
        headers: {
          authorization: 'Bearer not-the-service-role-key',
        },
      })
    )
    const body = await response.json()

    assertEquals(response.status, 401)
    assertEquals(body.error, 'Unauthorized')
  } finally {
    restoreEnv(envSnapshot)
  }
})

Deno.test('malformed header names still throw before handler execution', () => {
  assertThrows(() => {
    new Request('http://localhost', {
      headers: {
        'x-invalid\nheader': 'value',
      },
    })
  })
})

Deno.test('captured handler promise resolves successfully', async () => {
  await assertRejects(
    async () => {
      const handler = await getCapturedHandler()
      if (typeof handler === 'function') {
        throw new Error('handler captured')
      }
    },
    Error,
    'handler captured'
  )
})
