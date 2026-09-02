import { assertEquals, assertExists, assertNotEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts'
import { importEdgeModuleOffline } from '../_shared/module-load-test-harness.ts'

const SERVICE_ROLE_KEY = 'test-service-role-key'
const SUPABASE_URL = 'http://127.0.0.1:54321'
const JSON_HEADERS = { 'content-type': 'application/json' }

async function withEnv<T>(values: Record<string, string>, fn: () => Promise<T> | T): Promise<T> {
  const previous = new Map<string, string | undefined>()

  for (const [key, value] of Object.entries(values)) {
    previous.set(key, Deno.env.get(key))
    Deno.env.set(key, value)
  }

  try {
    return await fn()
  } finally {
    for (const [key, value] of previous.entries()) {
      if (value === undefined) {
        Deno.env.delete(key)
      } else {
        Deno.env.set(key, value)
      }
    }
  }
}

async function withFetchStub<T>(stub: typeof fetch, fn: () => Promise<T> | T): Promise<T> {
  const originalFetch = globalThis.fetch
  globalThis.fetch = stub

  try {
    return await fn()
  } finally {
    globalThis.fetch = originalFetch
  }
}

async function responseTimeout<T>(promise: Promise<T>, ms = 2_000): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined

  const timeout = new Promise<T>((_, reject) => {
    timeoutId = setTimeout(
      () => reject(new Error('Timed out waiting for edge handler response')),
      ms
    )
  })

  try {
    return await Promise.race([promise, timeout])
  } finally {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId)
    }
  }
}

async function invokeEdgeFunction(request: Request): Promise<Response> {
  const { module, stats } = await importEdgeModuleOffline(new URL('./index.ts', import.meta.url))
  assertEquals(stats.listenCalls, 1)
  assertEquals(stats.serveHttpCalls, 0)
  assertEquals(stats.fetchCalls, 0)
  const handler = module.handler as (request: Request) => Promise<Response>
  return await responseTimeout(handler(request))
}

function authHeaders(extra: Record<string, string> = {}): HeadersInit {
  return {
    Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json',
    ...extra,
  }
}

function validPayload(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    user_id: '11111111-1111-4111-8111-111111111111',
    title: 'Nouvelle tâche assignée',
    message: 'Une tâche vous a été assignée dans votre espace de suivi.',
    type: 'task_assignment',
    related_id: '22222222-2222-4222-8222-222222222222',
    related_type: 'tache',
    ...overrides,
  }
}

async function readRequestBody(input: RequestInfo | URL, init?: RequestInit): Promise<unknown> {
  const body = init?.body ?? (input instanceof Request ? await input.clone().text() : undefined)

  if (body === undefined || body === null) {
    return undefined
  }

  if (typeof body === 'string') {
    return body.length > 0 ? JSON.parse(body) : undefined
  }

  return JSON.parse(String(body))
}

Deno.test('OPTIONS request returns CORS headers without requiring authorization', async () => {
  const response = await invokeEdgeFunction(
    new Request('http://localhost/create-in-app-notification', {
      method: 'OPTIONS',
    })
  )

  assertEquals(response.status, 200)
  assertNotEquals(response.headers.get('Access-Control-Allow-Origin'), '*')
  assertEquals(
    response.headers.get('Access-Control-Allow-Headers'),
    'authorization, x-client-info, apikey, content-type, x-internal-secret'
  )
})

Deno.test('POST without service role authorization is rejected', async () => {
  await withEnv(
    {
      SUPABASE_SERVICE_ROLE_KEY: SERVICE_ROLE_KEY,
      SUPABASE_URL,
    },
    async () => {
      const response = await invokeEdgeFunction(
        new Request('http://localhost/create-in-app-notification', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(validPayload()),
        })
      )

      const body = await response.json()

      assertEquals(response.status, 401)
      assertEquals(body.error, 'Unauthorized: Service role key required')
      assertEquals(response.headers.get('Content-Type'), 'application/json')
      assertNotEquals(response.headers.get('Access-Control-Allow-Origin'), '*')
    }
  )
})

Deno.test('invalid notification payload returns 400 with validation error', async () => {
  await withEnv(
    {
      SUPABASE_SERVICE_ROLE_KEY: SERVICE_ROLE_KEY,
      SUPABASE_URL,
    },
    async () => {
      await withFetchStub(
        (() => {
          throw new Error('fetch should not be called for invalid payloads')
        }) as unknown as typeof fetch,
        async () => {
          const response = await invokeEdgeFunction(
            new Request('http://localhost/create-in-app-notification', {
              method: 'POST',
              headers: authHeaders({ 'x-forwarded-for': '203.0.113.10' }),
              body: JSON.stringify({
                user_id: 'not-a-uuid',
                title: '',
                message: '',
                type: 'unsupported-type',
              }),
            })
          )

          const body = await response.json()

          assertEquals(response.status, 400)
          assertEquals(body.error, 'Invalid input')
          assertExists(body.details)
          assertEquals(Array.isArray(body.details), true)
          assertEquals(response.headers.get('Content-Type'), 'application/json')
        }
      )
    }
  )
})

Deno.test(
  'creates an in-app notification when payload is valid and preferences allow it',
  async () => {
    await withEnv(
      {
        SUPABASE_SERVICE_ROLE_KEY: SERVICE_ROLE_KEY,
        SUPABASE_URL,
      },
      async () => {
        const payload = validPayload()
        let profileQueries = 0
        let insertQueries = 0

        await withFetchStub(
          (async (input: RequestInfo | URL, init?: RequestInit) => {
            const url = new URL(input instanceof Request ? input.url : input.toString())

            if (url.pathname.endsWith('/rest/v1/profiles')) {
              profileQueries++
              assertEquals(url.searchParams.get('select'), 'preferences')
              assertEquals(url.searchParams.get('user_id'), `eq.${payload.user_id}`)

              return new Response(
                JSON.stringify({
                  preferences: {
                    in_app_notifications: {
                      task_assignment: true,
                    },
                  },
                }),
                {
                  status: 200,
                  headers: JSON_HEADERS,
                }
              )
            }

            if (url.pathname.endsWith('/rest/v1/in_app_notifications')) {
              insertQueries++
              const insertedRaw = await readRequestBody(input, init)
              const inserted = (
                Array.isArray(insertedRaw) ? insertedRaw[0] : insertedRaw
              ) as Record<string, unknown>

              assertEquals(inserted.user_id, payload.user_id)
              assertEquals(inserted.title, payload.title)
              assertEquals(inserted.message, payload.message)
              assertEquals(inserted.type, payload.type)
              assertEquals(inserted.related_id, payload.related_id)
              assertEquals(inserted.related_type, payload.related_type)
              assertEquals(inserted.is_read, false)

              return new Response(
                JSON.stringify({
                  id: '33333333-3333-4333-8333-333333333333',
                  created_at: '2024-01-01T00:00:00.000Z',
                  ...inserted,
                }),
                {
                  status: 201,
                  headers: JSON_HEADERS,
                }
              )
            }

            throw new Error(`Unexpected fetch URL: ${url.href}`)
          }) as unknown as typeof fetch,
          async () => {
            const response = await invokeEdgeFunction(
              new Request('http://localhost/create-in-app-notification', {
                method: 'POST',
                headers: authHeaders({ 'x-forwarded-for': '203.0.113.20' }),
                body: JSON.stringify(payload),
              })
            )

            const body = await response.json()

            assertEquals(response.status, 200)
            assertEquals(body.success, true)
            assertEquals(body.notification.id, '33333333-3333-4333-8333-333333333333')
            assertEquals(body.notification.user_id, payload.user_id)
            assertEquals(body.notification.title, payload.title)
            assertEquals(body.notification.is_read, false)
            assertEquals(profileQueries, 1)
            assertEquals(insertQueries, 1)
          }
        )
      }
    )
  }
)

Deno.test(
  'skips notification creation when user preferences disable the notification type',
  async () => {
    await withEnv(
      {
        SUPABASE_SERVICE_ROLE_KEY: SERVICE_ROLE_KEY,
        SUPABASE_URL,
      },
      async () => {
        const payload = validPayload({
          type: 'ai_suggestion',
          title: 'Suggestion IA disponible',
          message: 'Une nouvelle suggestion IA est disponible.',
          related_type: 'ai_suggestion',
        })
        let profileQueries = 0
        let insertQueries = 0

        await withFetchStub(
          ((input: RequestInfo | URL) => {
            const url = new URL(input instanceof Request ? input.url : input.toString())

            if (url.pathname.endsWith('/rest/v1/profiles')) {
              profileQueries++
              return new Response(
                JSON.stringify({
                  preferences: {
                    in_app_notifications: {
                      ai_suggestions: false,
                    },
                  },
                }),
                {
                  status: 200,
                  headers: JSON_HEADERS,
                }
              )
            }

            if (url.pathname.endsWith('/rest/v1/in_app_notifications')) {
              insertQueries++
            }

            throw new Error(`Unexpected fetch URL: ${url.href}`)
          }) as unknown as typeof fetch,
          async () => {
            const response = await invokeEdgeFunction(
              new Request('http://localhost/create-in-app-notification', {
                method: 'POST',
                headers: authHeaders({ 'x-forwarded-for': '203.0.113.30' }),
                body: JSON.stringify(payload),
              })
            )

            const body = await response.json()

            assertEquals(response.status, 200)
            assertEquals(body.success, true)
            assertEquals(body.message, 'Notification skipped due to user preferences')
            assertEquals(profileQueries, 1)
            assertEquals(insertQueries, 0)
          }
        )
      }
    )
  }
)

Deno.test('insert failure returns 500 with database error detail', async () => {
  await withEnv(
    {
      SUPABASE_SERVICE_ROLE_KEY: SERVICE_ROLE_KEY,
      SUPABASE_URL,
    },
    async () => {
      await withFetchStub(
        ((input: RequestInfo | URL) => {
          const url = new URL(input instanceof Request ? input.url : input.toString())

          if (url.pathname.endsWith('/rest/v1/profiles')) {
            return new Response(
              JSON.stringify({
                preferences: {
                  in_app_notifications: {
                    task_completion: true,
                  },
                },
              }),
              {
                status: 200,
                headers: JSON_HEADERS,
              }
            )
          }

          if (url.pathname.endsWith('/rest/v1/in_app_notifications')) {
            return new Response(
              JSON.stringify({
                message: 'insert failed',
                details: 'simulated database failure',
                code: '23505',
              }),
              {
                status: 409,
                headers: JSON_HEADERS,
              }
            )
          }

          throw new Error(`Unexpected fetch URL: ${url.href}`)
        }) as unknown as typeof fetch,
        async () => {
          const response = await invokeEdgeFunction(
            new Request('http://localhost/create-in-app-notification', {
              method: 'POST',
              headers: authHeaders({ 'x-forwarded-for': '203.0.113.40' }),
              body: JSON.stringify(validPayload({ type: 'task_completion' })),
            })
          )

          const body = await response.json()

          assertEquals(response.status, 500)
          assertEquals(body.error, 'Failed to create notification')
          assertExists(body.details)
        }
      )
    }
  )
})
