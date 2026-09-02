import {
  assertEquals,
  assertExists,
  assertThrows,
  assertRejects,
} from 'https://deno.land/std@0.224.0/assert/mod.ts'

type CapturedHandler = (req: Request) => Response | Promise<Response>

let handlerPromise: Promise<CapturedHandler> | undefined

const ENV_VALUES = {
  SUPABASE_URL: 'https://unit-test.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'unit-test-service-role-key',
  CRON_SECRET: 'unit-test-cron-secret',
}

function restoreEnv(previous: Record<string, string | undefined>) {
  for (const [key, value] of Object.entries(previous)) {
    if (value === undefined) {
      Deno.env.delete(key)
    } else {
      Deno.env.set(key, value)
    }
  }
}

async function loadHandler(): Promise<CapturedHandler> {
  if (handlerPromise) return await handlerPromise

  handlerPromise = (async () => {
    const previousEnv: Record<string, string | undefined> = {}
    for (const [key, value] of Object.entries(ENV_VALUES)) {
      previousEnv[key] = Deno.env.get(key)
      Deno.env.set(key, value)
    }

    const originalServe = Deno.serve
    let capturedHandler: CapturedHandler | undefined

    Object.defineProperty(Deno, 'serve', {
      value: (arg1: unknown, arg2?: unknown) => {
        capturedHandler =
          typeof arg1 === 'function' ? (arg1 as CapturedHandler) : (arg2 as CapturedHandler)
        return {
          finished: Promise.resolve(),
          shutdown() {},
          ref() {},
          unref() {},
          addr: { hostname: '127.0.0.1', port: 0, transport: 'tcp' },
        }
      },
      configurable: true,
      writable: true,
    })

    try {
      await import('./index.ts')
    } finally {
      Object.defineProperty(Deno, 'serve', {
        value: originalServe,
        configurable: true,
        writable: true,
      })
      restoreEnv(previousEnv)
    }

    assertExists(capturedHandler)
    return capturedHandler
  })()

  return await handlerPromise
}

function jsonRequest(headers?: HeadersInit): Request {
  return new Request('http://localhost/social-scheduler', {
    method: 'POST',
    headers,
  })
}

async function readJson(response: Response): Promise<unknown> {
  return await response.json()
}

Deno.test('module loads and registers a Deno.serve handler', async () => {
  const handler = await loadHandler()
  assertEquals(typeof handler, 'function')
})

Deno.test('OPTIONS request returns ok with CORS headers', async () => {
  const handler = await loadHandler()

  const response = await handler(
    new Request('http://localhost/social-scheduler', { method: 'OPTIONS' })
  )

  assertEquals(response.status, 200)
  assertEquals(await response.text(), 'ok')
  assertExists(response.headers.get('access-control-allow-origin'))
})

Deno.test('rejects request without cron secret', async () => {
  const handler = await loadHandler()

  const response = await handler(jsonRequest())

  assertEquals(response.status, 403)
  assertEquals(response.headers.get('content-type'), 'application/json')
  assertEquals(await readJson(response), { error: 'Forbidden' })
})

Deno.test('rejects request with incorrect cron secret', async () => {
  const handler = await loadHandler()

  const response = await handler(jsonRequest({ 'x-cron-secret': 'wrong-secret' }))

  assertEquals(response.status, 403)
  assertEquals(await readJson(response), { error: 'Forbidden' })
})

Deno.test(
  'authorized request selects due scheduled posts and calls social-publish for each row',
  async () => {
    const handler = await loadHandler()
    const originalFetch = globalThis.fetch

    const restCalls: string[] = []
    const publishBodies: unknown[] = []

    // deno-lint-ignore require-await -- Fetch API requires Promise<Response>.
    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const request = input instanceof Request ? input : undefined
      const url = request?.url ?? String(input)
      const method = init?.method ?? request?.method ?? 'GET'

      if (url.includes('/rest/v1/social_scheduled_posts')) {
        restCalls.push(url)
        assertEquals(method, 'GET')
        return new Response(JSON.stringify([{ id: 'scheduled-1' }, { id: 'scheduled-2' }]), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      }

      if (url === `${ENV_VALUES.SUPABASE_URL}/functions/v1/social-publish`) {
        assertEquals(method, 'POST')
        assertEquals((init?.headers as Record<string, string>)['Content-Type'], 'application/json')
        assertEquals(
          (init?.headers as Record<string, string>)['x-cron-secret'],
          ENV_VALUES.CRON_SECRET
        )

        const body = JSON.parse(String(init?.body))
        publishBodies.push(body)

        return new Response(JSON.stringify({ published: true, scheduled_id: body.scheduled_id }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      }

      throw new Error(`Unexpected fetch call: ${method} ${url}`)
    }

    try {
      const response = await handler(jsonRequest({ 'x-cron-secret': ENV_VALUES.CRON_SECRET }))
      const body = await readJson(response)

      assertEquals(response.status, 200)
      assertEquals(response.headers.get('content-type'), 'application/json')
      assertEquals(restCalls.length, 1)

      const restUrl = new URL(restCalls[0])
      assertEquals(restUrl.origin, ENV_VALUES.SUPABASE_URL)
      assertEquals(restUrl.pathname, '/rest/v1/social_scheduled_posts')
      assertEquals(restUrl.searchParams.get('select'), 'id')
      assertEquals(restUrl.searchParams.get('status'), 'eq.scheduled')
      assertEquals(restUrl.searchParams.get('limit'), '20')
      assertExists(restUrl.searchParams.get('scheduled_at'))
      assertEquals(restUrl.searchParams.get('scheduled_at')?.startsWith('lte.'), true)

      assertEquals(publishBodies, [
        { scheduled_id: 'scheduled-1' },
        { scheduled_id: 'scheduled-2' },
      ])

      assertEquals(body, {
        ok: true,
        processed: 2,
        results: [
          { id: 'scheduled-1', ok: true, published: true, scheduled_id: 'scheduled-1' },
          { id: 'scheduled-2', ok: true, published: true, scheduled_id: 'scheduled-2' },
        ],
      })
    } finally {
      globalThis.fetch = originalFetch
    }
  }
)

Deno.test(
  'authorized request reports zero processed posts when no scheduled post is due',
  async () => {
    const handler = await loadHandler()
    const originalFetch = globalThis.fetch

    let restCallCount = 0
    let publishCallCount = 0

    // deno-lint-ignore require-await -- Fetch API requires Promise<Response>.
    globalThis.fetch = async (input: RequestInfo | URL): Promise<Response> => {
      const url = input instanceof Request ? input.url : String(input)

      if (url.includes('/rest/v1/social_scheduled_posts')) {
        restCallCount++
        return new Response(JSON.stringify([]), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      }

      if (url.includes('/functions/v1/social-publish')) {
        publishCallCount++
      }

      throw new Error(`Unexpected fetch call: ${url}`)
    }

    try {
      const response = await handler(jsonRequest({ 'x-cron-secret': ENV_VALUES.CRON_SECRET }))

      assertEquals(response.status, 200)
      assertEquals(await readJson(response), {
        ok: true,
        processed: 0,
        results: [],
      })
      assertEquals(restCallCount, 1)
      assertEquals(publishCallCount, 0)
    } finally {
      globalThis.fetch = originalFetch
    }
  }
)

Deno.test(
  'authorized request captures per-row social-publish failures without failing the whole scheduler',
  async () => {
    const handler = await loadHandler()
    const originalFetch = globalThis.fetch

    // deno-lint-ignore require-await -- Fetch API requires Promise<Response>.
    globalThis.fetch = async (input: RequestInfo | URL): Promise<Response> => {
      const url = input instanceof Request ? input.url : String(input)

      if (url.includes('/rest/v1/social_scheduled_posts')) {
        return new Response(JSON.stringify([{ id: 'scheduled-fail' }]), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      }

      if (url === `${ENV_VALUES.SUPABASE_URL}/functions/v1/social-publish`) {
        throw new Error('publish boom')
      }

      throw new Error(`Unexpected fetch call: ${url}`)
    }

    try {
      const response = await handler(jsonRequest({ 'x-cron-secret': ENV_VALUES.CRON_SECRET }))

      assertEquals(response.status, 200)
      assertEquals(await readJson(response), {
        ok: true,
        processed: 1,
        results: [{ id: 'scheduled-fail', ok: false, error: 'publish boom' }],
      })
    } finally {
      globalThis.fetch = originalFetch
    }
  }
)

Deno.test('local JSON helper rejects invalid response JSON', async () => {
  await assertRejects(
    () => readJson(new Response('not-json', { headers: { 'content-type': 'application/json' } })),
    SyntaxError
  )
})

Deno.test('Request constructor throws for invalid URL', () => {
  assertThrows(() => new Request('not a valid url'), TypeError)
})
