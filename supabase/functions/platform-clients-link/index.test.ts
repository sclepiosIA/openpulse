import {
  assertEquals,
  assertExists,
  assertRejects,
  assertThrows,
} from 'https://deno.land/std@0.224.0/assert/mod.ts'

type Handler = (req: Request) => Response | Promise<Response>
type CreateHandler = (deps: never) => Handler

type UpsertCall = {
  table: string
  values: {
    etablissement_id: string
    system: string
    external_id: string
    metadata: Record<string, unknown>
    updated_at: string
  }
  options: Record<string, unknown>
}

type MockState = {
  apiKey: string
  scope: 'platform:site_web' | 'platform:product'
  idempotency: Map<string, { body: unknown; status: number }>
  upserts: UpsertCall[]
  dbError: { message: string } | null
}

const API_KEY = 'test-platform-api-key'
const ETAB_ID = '123e4567-e89b-12d3-a456-426614174000'

let state: MockState
let createHandlerPromise: Promise<CreateHandler> | undefined
let registeredHandler: Handler | undefined

function resetMockState() {
  state = {
    apiKey: API_KEY,
    scope: 'platform:site_web',
    idempotency: new Map(),
    upserts: [],
    dbError: null,
  }
}

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

function errorResponse(message: string, status: number, code: string) {
  return jsonResponse({ error: message, code }, status)
}

function mockDependencies() {
  return {
    async withApiKey(req: Request, fn: (ctx: { scope: MockState['scope'] }) => Promise<Response>) {
      if (req.headers.get('x-api-key') !== state.apiKey) {
        return errorResponse('Invalid or missing x-api-key', 401, 'invalid_api_key')
      }
      return await fn({ scope: state.scope })
    },
    jsonResponse,
    errorResponse,
    serviceClient() {
      return {
        from(table: string) {
          return {
            upsert(values: UpsertCall['values'], options: UpsertCall['options']) {
              state.upserts.push({ table, values, options })
              return Promise.resolve({ data: null, error: state.dbError })
            },
          }
        },
      }
    },
    checkIdempotency(req: Request, endpoint: string) {
      const key = req.headers.get('idempotency-key')
      if (!key) return Promise.resolve({ key: null, cached: null })
      const cached = state.idempotency.get(`${endpoint}:${key}`)
      return Promise.resolve({
        key,
        cached: cached ? jsonResponse(cached.body, cached.status) : null,
      })
    },
    storeIdempotency(key: string, endpoint: string, body: unknown, status: number) {
      state.idempotency.set(`${endpoint}:${key}`, { body, status })
      return Promise.resolve()
    },
  }
}

async function loadCreateHandler(): Promise<CreateHandler> {
  if (!createHandlerPromise) {
    createHandlerPromise = (async () => {
      const originalServe = Object.getOwnPropertyDescriptor(Deno, 'serve')
      const originalFetch = globalThis.fetch
      let fetchCalls = 0
      const fakeServer = {
        finished: new Promise<void>(() => {}),
        shutdown: () => Promise.resolve(),
        ref: () => fakeServer,
        unref: () => fakeServer,
        addr: { transport: 'tcp' as const, hostname: '127.0.0.1', port: 0 },
      }

      Object.defineProperty(Deno, 'serve', {
        configurable: true,
        writable: true,
        value: (...args: unknown[]) => {
          const candidate = typeof args[0] === 'function' ? args[0] : args[1]
          if (typeof candidate !== 'function') {
            throw new TypeError('Deno.serve handler was not provided')
          }
          registeredHandler = candidate as Handler
          return fakeServer
        },
      })
      globalThis.fetch = ((..._args: Parameters<typeof fetch>) => {
        fetchCalls += 1
        return Promise.reject(new Error('Unexpected module-load fetch'))
      }) as typeof fetch

      try {
        const module = await import(`./index.ts?platform-clients-link-test=${crypto.randomUUID()}`)
        assertEquals(fetchCalls, 0, 'module loading must not perform fetches')
        return module.createHandler as CreateHandler
      } finally {
        if (originalServe) Object.defineProperty(Deno, 'serve', originalServe)
        globalThis.fetch = originalFetch
      }
    })()
  }
  return await createHandlerPromise
}

async function handler(): Promise<Handler> {
  const createHandler = await loadCreateHandler()
  return createHandler(mockDependencies() as never)
}

function makeRequest(
  options: {
    method?: string
    etabId?: string | null
    body?: unknown
    rawBody?: string
    headers?: Record<string, string>
    authenticated?: boolean
  } = {}
): Request {
  const method = options.method ?? 'POST'
  const etabId = options.etabId === undefined ? ETAB_ID : options.etabId
  const url =
    etabId === null
      ? 'http://localhost/platform-clients-link'
      : `http://localhost/platform-clients-link?etab_id=${encodeURIComponent(etabId)}`
  const headers = new Headers(options.headers ?? {})
  if (options.authenticated !== false) headers.set('x-api-key', API_KEY)

  const init: RequestInit = { method, headers }
  if (options.rawBody !== undefined) {
    init.body = options.rawBody
    if (!headers.has('content-type')) {
      headers.set('content-type', 'application/json')
    }
  } else if (options.body !== undefined) {
    init.body = JSON.stringify(options.body)
    if (!headers.has('content-type')) {
      headers.set('content-type', 'application/json')
    }
  }
  return new Request(url, init)
}

async function assertErrorResponse(
  response: Response,
  status: number,
  code: string,
  error: string
) {
  assertEquals(response.status, status)
  assertEquals(response.headers.get('content-type')?.includes('application/json'), true)
  assertEquals(await response.json(), { error, code })
}

Deno.test('module loads and registers the Edge Function handler', async () => {
  resetMockState()
  await loadCreateHandler()
  assertExists(registeredHandler)
  assertEquals(typeof registeredHandler, 'function')
})

Deno.test('rejects requests without a valid platform API key', async () => {
  resetMockState()
  const response = await (await handler())(makeRequest({ authenticated: false }))
  await assertErrorResponse(response, 401, 'invalid_api_key', 'Invalid or missing x-api-key')
  assertEquals(state.upserts.length, 0)
})

Deno.test('rejects non-POST methods before touching persistence', async () => {
  resetMockState()
  const response = await (await handler())(makeRequest({ method: 'GET' }))
  await assertErrorResponse(response, 405, 'method', 'Method not allowed')
  assertEquals(state.upserts.length, 0)
})

Deno.test('rejects missing etab_id query parameter', async () => {
  resetMockState()
  const response = await (await handler())(makeRequest({ etabId: null }))
  await assertErrorResponse(response, 400, 'invalid_param', 'Invalid etab_id')
  assertEquals(state.upserts.length, 0)
})

Deno.test('rejects malformed etab_id query parameter', async () => {
  resetMockState()
  const response = await (await handler())(makeRequest({ etabId: 'not-a-uuid' }))
  await assertErrorResponse(response, 400, 'invalid_param', 'Invalid etab_id')
  assertEquals(state.upserts.length, 0)
})

Deno.test('rejects invalid JSON request bodies', async () => {
  resetMockState()
  const response = await (await handler())(makeRequest({ rawBody: '{not valid json' }))
  await assertErrorResponse(response, 400, 'invalid_body', 'Invalid JSON')
  assertEquals(state.upserts.length, 0)
})

Deno.test('rejects unsupported system values', async () => {
  resetMockState()
  const response = await (
    await handler()
  )(makeRequest({ body: { system: 'crm', external_id: 'external-123' } }))
  await assertErrorResponse(response, 400, 'invalid_system', 'Invalid system')
  assertEquals(state.upserts.length, 0)
})

Deno.test('rejects missing external_id', async () => {
  resetMockState()
  const response = await (await handler())(makeRequest({ body: { system: 'site_web' } }))
  await assertErrorResponse(response, 400, 'invalid_external_id', 'Invalid external_id')
  assertEquals(state.upserts.length, 0)
})

Deno.test('rejects non-string external_id', async () => {
  resetMockState()
  const response = await (
    await handler()
  )(makeRequest({ body: { system: 'product', external_id: 12345 } }))
  await assertErrorResponse(response, 400, 'invalid_external_id', 'Invalid external_id')
  assertEquals(state.upserts.length, 0)
})

Deno.test('upserts a site_web external id mapping with default metadata', async () => {
  resetMockState()
  const response = await (
    await handler()
  )(
    makeRequest({
      body: { system: 'site_web', external_id: 'website-client-42' },
    })
  )
  assertEquals(response.status, 200)
  assertEquals(await response.json(), {
    ok: true,
    etablissement_id: ETAB_ID,
    system: 'site_web',
  })
  assertEquals(state.upserts.length, 1)
  assertEquals(state.upserts[0].table, 'client_external_ids')
  assertEquals(state.upserts[0].options, {
    onConflict: 'etablissement_id,system',
  })
  assertEquals(state.upserts[0].values.etablissement_id, ETAB_ID)
  assertEquals(state.upserts[0].values.system, 'site_web')
  assertEquals(state.upserts[0].values.external_id, 'website-client-42')
  assertEquals(state.upserts[0].values.metadata, {})
  assertEquals(Number.isNaN(Date.parse(state.upserts[0].values.updated_at)), false)
})

Deno.test('upserts a product external id mapping with provided metadata', async () => {
  resetMockState()
  state.scope = 'platform:product'
  const metadata = { source: 'catalog', active: true, rank: 7 }
  const response = await (
    await handler()
  )(
    makeRequest({
      body: { system: 'product', external_id: 'product-client-99', metadata },
    })
  )
  assertEquals(response.status, 200)
  assertEquals(await response.json(), {
    ok: true,
    etablissement_id: ETAB_ID,
    system: 'product',
  })
  assertEquals(state.upserts.length, 1)
  assertEquals(state.upserts[0].values.metadata, metadata)
})

Deno.test('returns a database error response when the upsert fails', async () => {
  resetMockState()
  state.dbError = { message: 'upsert failed' }
  const response = await (
    await handler()
  )(makeRequest({ body: { system: 'site_web', external_id: 'site-123' } }))
  await assertErrorResponse(response, 500, 'db_error', 'Link failed')
  assertEquals(state.upserts.length, 1)
})

Deno.test('stores and reuses successful idempotency responses', async () => {
  resetMockState()
  const request = { headers: { 'idempotency-key': 'same-operation' } }
  const firstResponse = await (
    await handler()
  )(
    makeRequest({
      ...request,
      body: { system: 'site_web', external_id: 'first-external-id' },
    })
  )
  assertEquals(firstResponse.status, 200)
  assertEquals(state.upserts.length, 1)
  const secondResponse = await (
    await handler()
  )(
    makeRequest({
      ...request,
      body: { system: 'site_web', external_id: 'second-external-id' },
    })
  )
  assertEquals(secondResponse.status, 200)
  assertEquals(await secondResponse.json(), {
    ok: true,
    etablissement_id: ETAB_ID,
    system: 'site_web',
  })
  assertEquals(state.upserts.length, 1)
})

Deno.test('test harness sanity checks assertion helpers', async () => {
  assertThrows(
    () => {
      throw new TypeError('sync failure')
    },
    TypeError,
    'sync failure'
  )
  await assertRejects(
    () => Promise.reject(new TypeError('async failure')),
    TypeError,
    'async failure'
  )
})
