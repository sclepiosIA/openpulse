import { assertEquals, assertExists } from 'https://deno.land/std@0.224.0/assert/mod.ts'

type Handler = (req: Request) => Response | Promise<Response>

type FetchCall = {
  url: string
  method: string
  body?: string
}

let cachedHandler: Handler | undefined
let loadingHandler: Promise<Handler> | undefined

function snapshotEnv(keys: string[]): Record<string, string | undefined> {
  const snapshot: Record<string, string | undefined> = {}
  for (const key of keys) snapshot[key] = Deno.env.get(key)
  return snapshot
}

function restoreEnv(snapshot: Record<string, string | undefined>) {
  for (const [key, value] of Object.entries(snapshot)) {
    if (value === undefined) Deno.env.delete(key)
    else Deno.env.set(key, value)
  }
}

async function loadHandler(): Promise<Handler> {
  if (cachedHandler) return cachedHandler
  if (loadingHandler) return await loadingHandler

  loadingHandler = (async () => {
    const envKeys = [
      'SUPABASE_URL',
      'SUPABASE_SERVICE_ROLE_KEY',
      'SUPABASE_ANON_KEY',
      'CRON_SECRET',
    ]
    const envSnapshot = snapshotEnv(envKeys)
    const serveDescriptor = Object.getOwnPropertyDescriptor(Deno, 'serve')

    let capturedHandler: Handler | undefined

    Deno.env.set('SUPABASE_URL', 'http://localhost:54321')
    Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', 'test-service-role-key')
    Deno.env.set('SUPABASE_ANON_KEY', 'test-anon-key')
    Deno.env.set('CRON_SECRET', 'test-cron-secret')

    try {
      Object.defineProperty(Deno, 'serve', {
        configurable: true,
        writable: true,
        value: (...args: unknown[]) => {
          const handler = args.find((arg) => typeof arg === 'function') as Handler | undefined
          if (!handler) throw new Error('Deno.serve called without a handler')
          capturedHandler = handler
          return {
            addr: { transport: 'tcp', hostname: '127.0.0.1', port: 0 },
            finished: Promise.resolve(),
            shutdown: () => {},
            ref: () => {},
            unref: () => {},
          }
        },
      })

      await import('./index.ts')

      assertExists(capturedHandler)
      cachedHandler = capturedHandler
      return capturedHandler
    } finally {
      if (serveDescriptor) {
        Object.defineProperty(Deno, 'serve', serveDescriptor)
      }
      restoreEnv(envSnapshot)
    }
  })()

  return await loadingHandler
}

async function withMockedFetch<T>(
  resolver: (call: FetchCall) => Response | Promise<Response>,
  fn: (calls: FetchCall[]) => Promise<T>
): Promise<T> {
  const originalFetch = globalThis.fetch
  const calls: FetchCall[] = []

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = input instanceof Request ? input.url : String(input)
    const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase()

    let body: string | undefined
    if (typeof init?.body === 'string') {
      body = init.body
    } else if (init?.body instanceof Uint8Array) {
      body = new TextDecoder().decode(init.body)
    } else if (input instanceof Request && input.body) {
      body = await input.clone().text()
    }

    const call = { url, method, body }
    calls.push(call)
    return await resolver(call)
  }) as typeof fetch

  try {
    return await fn(calls)
  } finally {
    globalThis.fetch = originalFetch
  }
}

function jsonResponse(data: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json',
      ...headers,
    },
  })
}

function countResponse(count: number): Response {
  return new Response(null, {
    status: 200,
    headers: {
      'content-range': count === 0 ? '0-0/0' : `0-0/${count}`,
      'content-type': 'application/json',
    },
  })
}

function tableName(call: FetchCall): string {
  return new URL(call.url).pathname.split('/').pop() ?? ''
}

Deno.test('module loads and registers an HTTP handler', async () => {
  const handler = await loadHandler()
  assertExists(handler)
  assertEquals(typeof handler, 'function')
})

Deno.test('OPTIONS request returns ok without calling fetch', async () => {
  const handler = await loadHandler()

  await withMockedFetch(
    () => {
      throw new Error('fetch should not be called for OPTIONS')
    },
    async (calls) => {
      const response = await handler(new Request('http://localhost', { method: 'OPTIONS' }))

      assertEquals(response.status, 200)
      assertEquals(await response.text(), 'ok')
      assertEquals(calls.length, 0)
    }
  )
})

Deno.test(
  'non-cron request without bearer token returns Unauthorized without network calls',
  async () => {
    const handler = await loadHandler()

    await withMockedFetch(
      () => {
        throw new Error('fetch should not be called when Authorization is missing')
      },
      async (calls) => {
        const response = await handler(new Request('http://localhost', { method: 'POST' }))
        const body = await response.json()

        assertEquals(response.status, 401)
        assertEquals(body, { error: 'Unauthorized' })
        assertEquals(calls.length, 0)
      }
    )
  }
)

Deno.test('cron request with no social health issue returns triggered false', async () => {
  const handler = await loadHandler()

  await withMockedFetch(
    (call) => {
      const table = tableName(call)

      if (table === 'social_connections') {
        assertEquals(call.method, 'GET')
        return jsonResponse([])
      }

      if (table === 'social_sync_runs') {
        assertEquals(call.method, 'HEAD')
        return countResponse(0)
      }

      if (table === 'social_scheduled_posts') {
        assertEquals(call.method, 'HEAD')
        return countResponse(0)
      }

      throw new Error(`unexpected fetch to ${call.method} ${call.url}`)
    },
    async (calls) => {
      const response = await handler(
        new Request('http://localhost', {
          method: 'POST',
          headers: { 'x-cron-secret': 'test-cron-secret' },
        })
      )

      assertEquals(response.status, 200)
      assertEquals(await response.json(), { ok: true, triggered: false })
      assertEquals(calls.map(tableName), [
        'social_connections',
        'social_sync_runs',
        'social_scheduled_posts',
      ])
    }
  )
})

Deno.test(
  'cron request builds social health alert notifications for unique admin recipients',
  async () => {
    const handler = await loadHandler()
    let insertedRows: Array<Record<string, unknown>> | undefined

    await withMockedFetch(
      (call) => {
        const table = tableName(call)

        if (table === 'social_connections') {
          assertEquals(call.method, 'GET')
          return jsonResponse([
            {
              id: 'conn-1',
              platform: 'facebook',
              brand_id: 'brand-1',
              last_error: 'expired token',
            },
            {
              id: 'conn-2',
              platform: 'instagram',
              brand_id: 'brand-2',
              last_error: 'api error',
            },
          ])
        }

        if (table === 'social_sync_runs') {
          assertEquals(call.method, 'HEAD')
          return countResponse(3)
        }

        if (table === 'social_scheduled_posts') {
          assertEquals(call.method, 'HEAD')
          return countResponse(1)
        }

        if (table === 'user_roles') {
          assertEquals(call.method, 'GET')
          return jsonResponse([{ user_id: 'user-1' }, { user_id: 'user-2' }, { user_id: 'user-1' }])
        }

        if (table === 'notifications') {
          assertEquals(call.method, 'POST')
          assertExists(call.body)
          insertedRows = JSON.parse(call.body)
          return jsonResponse([], 201)
        }

        throw new Error(`unexpected fetch to ${call.method} ${call.url}`)
      },
      async (calls) => {
        const response = await handler(
          new Request('http://localhost', {
            method: 'POST',
            headers: { 'x-cron-secret': 'test-cron-secret' },
          })
        )

        const body = await response.json()

        assertEquals(response.status, 200)
        assertEquals(body, {
          ok: true,
          triggered: true,
          reasons: [
            '2 connexion(s) sociale(s) en erreur',
            '3 échec(s) de synchronisation (24h)',
            '1 post(s) planifié(s) en échec (24h)',
          ],
          recipients: 2,
        })

        assertEquals(calls.map(tableName), [
          'social_connections',
          'social_sync_runs',
          'social_scheduled_posts',
          'user_roles',
          'notifications',
        ])

        assertEquals(insertedRows, [
          {
            user_id: 'user-1',
            type: 'social_health_alert',
            title: 'Alerte Réseaux sociaux',
            message:
              '⚠️ Santé Réseaux sociaux : 2 connexion(s) sociale(s) en erreur · 3 échec(s) de synchronisation (24h) · 1 post(s) planifié(s) en échec (24h)',
            link: '/parametres/social',
            is_read: false,
          },
          {
            user_id: 'user-2',
            type: 'social_health_alert',
            title: 'Alerte Réseaux sociaux',
            message:
              '⚠️ Santé Réseaux sociaux : 2 connexion(s) sociale(s) en erreur · 3 échec(s) de synchronisation (24h) · 1 post(s) planifié(s) en échec (24h)',
            link: '/parametres/social',
            is_read: false,
          },
        ])
      }
    )
  }
)

Deno.test('cron request with issues but no recipients does not insert notifications', async () => {
  const handler = await loadHandler()

  await withMockedFetch(
    (call) => {
      const table = tableName(call)

      if (table === 'social_connections') return jsonResponse([])
      if (table === 'social_sync_runs') return countResponse(1)
      if (table === 'social_scheduled_posts') return countResponse(0)
      if (table === 'user_roles') return jsonResponse([])

      if (table === 'notifications') {
        throw new Error('notifications must not be inserted when there are no recipients')
      }

      throw new Error(`unexpected fetch to ${call.method} ${call.url}`)
    },
    async (calls) => {
      const response = await handler(
        new Request('http://localhost', {
          method: 'POST',
          headers: { 'x-cron-secret': 'test-cron-secret' },
        })
      )

      assertEquals(response.status, 200)
      assertEquals(await response.json(), {
        ok: true,
        triggered: false,
        note: 'no recipients',
      })
      assertEquals(calls.map(tableName), [
        'social_connections',
        'social_sync_runs',
        'social_scheduled_posts',
        'user_roles',
      ])
    }
  )
})
