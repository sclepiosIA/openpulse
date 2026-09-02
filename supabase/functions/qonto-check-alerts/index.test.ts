import { assertEquals, assertStringIncludes, assertNotEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts'

type Handler = (request: Request) => Promise<Response>
type FetchStub = (input: string | URL | Request, init?: RequestInit) => Promise<Response> | Response

async function loadHandler(): Promise<Handler> {
  const originalServeDescriptor = Object.getOwnPropertyDescriptor(Deno, 'serve')
  let registeredHandler: Handler | undefined
  try {
    Object.defineProperty(Deno, 'serve', {
      configurable: true,
      writable: true,
      value: (handler: Handler) => {
        registeredHandler = handler
        return { shutdown: () => Promise.resolve() } as Deno.HttpServer
      },
    })
    const mod = await import(`./index.ts?deno-test=${crypto.randomUUID()}`)
    if (registeredHandler !== mod.handler) throw new Error('Qonto handler was not registered')
    return mod.handler
  } finally {
    if (originalServeDescriptor) Object.defineProperty(Deno, 'serve', originalServeDescriptor)
    else delete (Deno as { serve?: unknown }).serve
  }
}

function applyEnv(env: Record<string, string | undefined>): () => void {
  const previous = new Map<string, string | undefined>()
  for (const [key, value] of Object.entries(env)) {
    previous.set(key, Deno.env.get(key))
    if (value === undefined) Deno.env.delete(key)
    else Deno.env.set(key, value)
  }
  return () => {
    for (const [key, value] of previous.entries()) {
      if (value === undefined) Deno.env.delete(key)
      else Deno.env.set(key, value)
    }
  }
}

async function invokeHandler(
  request: Request,
  options: { env?: Record<string, string | undefined>; fetch?: FetchStub } = {}
): Promise<Response> {
  const restoreEnv = applyEnv(options.env ?? {})
  const originalFetch = globalThis.fetch
  globalThis.fetch = (options.fetch ??
    (() => Promise.reject(new Error('Unexpected fetch call')))) as typeof fetch
  try {
    return await (
      await loadHandler()
    )(request)
  } finally {
    globalThis.fetch = originalFetch
    restoreEnv()
  }
}

const testPermissions = { read: true, env: true }
const validEnvironment = (internalSecret: string, serviceRoleKey: string) => ({
  INTERNAL_FUNCTION_SECRET: internalSecret,
  SUPABASE_SERVICE_ROLE_KEY: serviceRoleKey,
  SUPABASE_URL: 'https://unit-test.supabase.co',
})

Deno.test({
  name: 'OPTIONS returns CORS preflight response without authentication',
  permissions: testPermissions,
  async fn() {
    const response = await invokeHandler(new Request('http://localhost', { method: 'OPTIONS' }))
    assertEquals(response.status, 200)
    assertNotEquals(response.headers.get('Access-Control-Allow-Origin'), '*')
    assertEquals(
      response.headers.get('Access-Control-Allow-Headers'),
      'authorization, x-client-info, apikey, content-type, x-internal-secret'
    )
    assertEquals(await response.text(), '')
  },
})

Deno.test({
  name: 'rejects unauthorized requests before external I/O',
  permissions: testPermissions,
  async fn() {
    const internalSecret = `internal-${crypto.randomUUID()}`
    const serviceRoleKey = `service-role-${crypto.randomUUID()}`
    let fetchCalls = 0
    const response = await invokeHandler(new Request('http://localhost', { method: 'POST' }), {
      env: validEnvironment(internalSecret, serviceRoleKey),
      fetch: () => {
        fetchCalls++
        return new Response()
      },
    })
    assertEquals(response.status, 401)
    assertEquals(await response.json(), { error: 'Unauthorized' })
    assertEquals(fetchCalls, 0)
  },
})

Deno.test({
  name: 'accepts internal secret and reports no active alert connections',
  permissions: testPermissions,
  async fn() {
    const internalSecret = `internal-${crypto.randomUUID()}`
    const serviceRoleKey = `service-role-${crypto.randomUUID()}`
    let capturedUrl = ''
    const response = await invokeHandler(
      new Request('http://localhost', {
        method: 'POST',
        headers: { 'x-internal-secret': internalSecret },
      }),
      {
        env: validEnvironment(internalSecret, serviceRoleKey),
        fetch: (input) => {
          capturedUrl = input instanceof Request ? input.url : String(input)
          return new Response(JSON.stringify([]), {
            headers: { 'content-type': 'application/json', 'content-range': '0-0/0' },
          })
        },
      }
    )
    assertEquals(response.status, 200)
    assertEquals(await response.json(), {
      success: true,
      message: 'Aucune connexion avec alertes activées',
      alerts_sent: 0,
    })
    assertStringIncludes(capturedUrl, '/rest/v1/tresorerie_qonto_connections')
    assertStringIncludes(capturedUrl, 'is_active=eq.true')
    assertStringIncludes(capturedUrl, 'alert_enabled=eq.true')
  },
})

Deno.test({
  name: 'accepts service-role bearer token and reports no active alert connections',
  permissions: testPermissions,
  async fn() {
    const internalSecret = `internal-${crypto.randomUUID()}`
    const serviceRoleKey = `service-role-${crypto.randomUUID()}`
    let capturedAuthorization = ''
    const response = await invokeHandler(
      new Request('http://localhost', {
        method: 'POST',
        headers: { Authorization: `Bearer ${serviceRoleKey}` },
      }),
      {
        env: validEnvironment(internalSecret, serviceRoleKey),
        fetch: (_input, init) => {
          capturedAuthorization = new Headers(init?.headers).get('authorization') ?? ''
          return new Response(JSON.stringify([]), {
            headers: { 'content-type': 'application/json', 'content-range': '0-0/0' },
          })
        },
      }
    )
    assertEquals(response.status, 200)
    assertEquals(await response.json(), {
      success: true,
      message: 'Aucune connexion avec alertes activées',
      alerts_sent: 0,
    })
    assertEquals(capturedAuthorization, `Bearer ${serviceRoleKey}`)
  },
})

Deno.test({
  name: 'returns a sanitized 500 response when Supabase connection query fails',
  permissions: testPermissions,
  async fn() {
    const internalSecret = `internal-${crypto.randomUUID()}`
    const serviceRoleKey = `service-role-${crypto.randomUUID()}`
    const response = await invokeHandler(
      new Request('http://localhost', {
        method: 'POST',
        headers: { 'x-internal-secret': internalSecret },
      }),
      {
        env: validEnvironment(internalSecret, serviceRoleKey),
        fetch: () =>
          new Response(
            JSON.stringify({
              message: 'database unavailable',
              details: 'unit-test simulated PostgREST failure',
              hint: '',
              code: 'PGRST000',
            }),
            { status: 500, headers: { 'content-type': 'application/json' } }
          ),
      }
    )
    const body = await response.json()
    assertEquals(response.status, 500)
    assertEquals(body, { success: false, error: 'An unexpected error occurred. Please try again.' })
    assertEquals(JSON.stringify(body).includes('database unavailable'), false)
  },
})
