// `Deno.serve` est un accesseur en LECTURE SEULE depuis Deno 2 : les
// affectations de ce banc levaient « Cannot set property serve of #<Object>
// which has only a getter », et le banc entier tombait. On rend la propriete
// inscriptible une fois, sans toucher aux affectations elles-memes.
Object.defineProperty(Deno, 'serve', { configurable: true, writable: true, value: Deno.serve })

import {
  assertEquals,
  assertExists,
  assertThrows,
  assertRejects, assertNotEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts'

type CapturedHandler = (req: Request) => Response | Promise<Response>

let handlerPromise: Promise<CapturedHandler> | undefined

async function getHandler(): Promise<CapturedHandler> {
  if (handlerPromise) return handlerPromise

  handlerPromise = (async () => {
    const originalServe = Deno.serve
    let capturedHandler: CapturedHandler | undefined

    try {
      ;(Deno as unknown as { serve: unknown }).serve = ((
        handlerOrOptions: unknown,
        maybeHandler?: unknown
      ) => {
        capturedHandler = (
          typeof handlerOrOptions === 'function' ? handlerOrOptions : maybeHandler
        ) as CapturedHandler

        return {
          finished: Promise.resolve(),
          shutdown: () => {},
          ref: () => {},
          unref: () => {},
          addr: { transport: 'tcp', hostname: '127.0.0.1', port: 0 },
        }
      }) as typeof Deno.serve

      await import('./index.ts')
    } finally {
      ;(Deno as unknown as { serve: unknown }).serve = originalServe
    }

    assertExists(capturedHandler)
    return capturedHandler
  })()

  return handlerPromise
}

async function withOfflineSupabaseRuntime<T>(fn: () => Promise<T>): Promise<T> {
  const previousUrl = Deno.env.get('SUPABASE_URL')
  const previousKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const originalFetch = globalThis.fetch

  Deno.env.set('SUPABASE_URL', 'https://example.supabase.co')
  Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', 'test-service-role-key')

  globalThis.fetch = ((_input: RequestInfo | URL, _init?: RequestInit) => {
    return Promise.resolve(
      new Response(JSON.stringify({ data: null, error: null }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    )
  }) as typeof fetch

  try {
    return await fn()
  } finally {
    globalThis.fetch = originalFetch

    if (previousUrl === undefined) {
      Deno.env.delete('SUPABASE_URL')
    } else {
      Deno.env.set('SUPABASE_URL', previousUrl)
    }

    if (previousKey === undefined) {
      Deno.env.delete('SUPABASE_SERVICE_ROLE_KEY')
    } else {
      Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', previousKey)
    }
  }
}

function makeJsonRequest(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request('http://localhost', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...headers,
    },
    body: JSON.stringify(body),
  })
}

function authorizedHeaders(ip: string): Record<string, string> {
  return {
    Authorization: 'Bearer test-token',
    'x-forwarded-for': ip,
  }
}

Deno.test('module registers an HTTP handler via Deno.serve', async () => {
  const handler = await getHandler()

  assertExists(handler)
  assertEquals(typeof handler, 'function')
})

Deno.test('OPTIONS request returns CORS preflight headers', async () => {
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

Deno.test(
  'POST without Authorization header returns 401 authentication error before reading body',
  async () => {
    const handler = await getHandler()

    const response = await handler(makeJsonRequest({ domain: 'example.com' }))

    assertEquals(response.status, 401)
    assertNotEquals(response.headers.get('Access-Control-Allow-Origin'), '*')
    assertEquals(response.headers.get('Content-Type'), 'application/json')
    assertEquals(await response.json(), { error: 'Authentication required' })
  }
)

Deno.test('POST with missing domain returns 400 validation error', async () => {
  const handler = await getHandler()

  await withOfflineSupabaseRuntime(async () => {
    const response = await handler(makeJsonRequest({}, authorizedHeaders('203.0.113.10')))

    assertEquals(response.status, 400)
    assertNotEquals(response.headers.get('Access-Control-Allow-Origin'), '*')
    assertEquals(response.headers.get('Content-Type'), 'application/json')
    assertEquals(await response.json(), { error: 'Domain is required' })
  })
})

Deno.test('POST with empty domain returns 400 validation error', async () => {
  const handler = await getHandler()

  await withOfflineSupabaseRuntime(async () => {
    const response = await handler(
      makeJsonRequest({ domain: '' }, authorizedHeaders('203.0.113.13'))
    )

    assertEquals(response.status, 400)
    assertEquals(response.headers.get('Content-Type'), 'application/json')
    assertEquals(await response.json(), { error: 'Domain is required' })
  })
})

Deno.test('POST with non-string domain returns 400 validation error', async () => {
  const handler = await getHandler()

  await withOfflineSupabaseRuntime(async () => {
    const response = await handler(
      makeJsonRequest({ domain: 12345 }, authorizedHeaders('203.0.113.11'))
    )

    assertEquals(response.status, 400)
    assertEquals(response.headers.get('Content-Type'), 'application/json')
    assertEquals(await response.json(), { error: 'Domain is required' })
  })
})

Deno.test('invalid JSON body is caught and returns 500 internal server error', async () => {
  const handler = await getHandler()

  await withOfflineSupabaseRuntime(async () => {
    const response = await handler(
      new Request('http://localhost', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer test-token',
          'x-forwarded-for': '203.0.113.12',
          'content-type': 'application/json',
        },
        body: '{invalid-json',
      })
    )

    assertEquals(response.status, 500)
    assertNotEquals(response.headers.get('Access-Control-Allow-Origin'), '*')
    assertEquals(response.headers.get('Content-Type'), 'application/json')
    assertEquals(await response.json(), { error: 'Internal server error' })
  })
})

Deno.test(
  'rate limiting allows 100 authorized requests per identifier then returns 429',
  async () => {
    const handler = await getHandler()

    await withOfflineSupabaseRuntime(async () => {
      const ip = `rate-limit-${crypto.randomUUID()}`

      for (let i = 0; i < 100; i++) {
        const response = await handler(makeJsonRequest({}, authorizedHeaders(ip)))

        assertEquals(response.status, 400)
        assertEquals(response.headers.get('Content-Type'), 'application/json')
        assertEquals(await response.json(), { error: 'Domain is required' })
      }

      const blockedResponse = await handler(makeJsonRequest({}, authorizedHeaders(ip)))

      assertEquals(blockedResponse.status, 429)
      assertNotEquals(blockedResponse.headers.get('Access-Control-Allow-Origin'), '*')
      assertEquals(blockedResponse.headers.get('Content-Type'), 'application/json')
      const payload = await blockedResponse.json()
      assertEquals(payload.error, 'Rate limit exceeded')
      assertEquals(Number.isInteger(payload.retry_after), true)
      assertEquals(payload.retry_after >= 1, true)
      assertEquals(blockedResponse.headers.get('Retry-After'), String(payload.retry_after))
    })
  }
)

Deno.test('unauthenticated requests do not consume rate limit quota', async () => {
  const handler = await getHandler()

  await withOfflineSupabaseRuntime(async () => {
    const ip = `unauthenticated-${crypto.randomUUID()}`

    for (let i = 0; i < 105; i++) {
      const unauthenticatedResponse = await handler(
        makeJsonRequest({ domain: 'example.com' }, { 'x-forwarded-for': ip })
      )

      assertEquals(unauthenticatedResponse.status, 401)
      assertEquals(await unauthenticatedResponse.json(), { error: 'Authentication required' })
    }

    const authenticatedResponse = await handler(makeJsonRequest({}, authorizedHeaders(ip)))

    assertEquals(authenticatedResponse.status, 400)
    assertEquals(await authenticatedResponse.json(), { error: 'Domain is required' })
  })
})

Deno.test('assertThrows and assertRejects imports are usable', async () => {
  const thrown = assertThrows(
    () => {
      throw new TypeError('expected synchronous failure')
    },
    TypeError,
    'expected synchronous failure'
  )

  assertEquals(thrown.message, 'expected synchronous failure')

  const rejected = await assertRejects(
    async () => {
      throw new Error('expected asynchronous failure')
    },
    Error,
    'expected asynchronous failure'
  )

  assertEquals(rejected.message, 'expected asynchronous failure')
})
