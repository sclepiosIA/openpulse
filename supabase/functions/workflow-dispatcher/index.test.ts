import {
  assertEquals,
  assertExists,
  assertThrows,
  assertRejects, assertNotEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts'

type DispatcherHandler = (req: Request) => Response | Promise<Response>

type FetchCall = {
  url: string
  method: string
  body: string | null
}

type FetchStubConfig = {
  queue?: unknown[]
  workflowsByTrigger?: Record<string, unknown[]>
  failQueueSelect?: boolean
}

const TEST_SUPABASE_URL = 'https://unit-test-project.supabase.co'
const TEST_SERVICE_ROLE = 'unit-test-service-role-key'
const TEST_INTERNAL_SECRET = 'unit-test-internal-secret'

let handlerPromise: Promise<DispatcherHandler> | undefined

function getDenoServeDescriptor(): PropertyDescriptor | undefined {
  return Object.getOwnPropertyDescriptor(Deno, 'serve')
}

function setDenoServe(stub: unknown): void {
  Object.defineProperty(Deno, 'serve', { value: stub, configurable: true, writable: true })
}

function restoreDenoServe(descriptor: PropertyDescriptor | undefined): void {
  if (descriptor) Object.defineProperty(Deno, 'serve', descriptor)
}

async function withEnv<T>(
  updates: Record<string, string | undefined>,
  fn: () => Promise<T> | T
): Promise<T> {
  const previous: Record<string, string | undefined> = {}
  for (const key of Object.keys(updates)) {
    previous[key] = Deno.env.get(key)
    const value = updates[key]
    if (value === undefined) Deno.env.delete(key)
    else Deno.env.set(key, value)
  }

  try {
    return await fn()
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) Deno.env.delete(key)
      else Deno.env.set(key, value)
    }
  }
}

async function loadDispatcherHandler(): Promise<DispatcherHandler> {
  if (!handlerPromise) {
    handlerPromise = (async () => {
      const originalServeDescriptor = getDenoServeDescriptor()
      let capturedHandler: DispatcherHandler | undefined

      const fakeServe = ((...args: unknown[]) => {
        capturedHandler = (typeof args[0] === 'function' ? args[0] : args[1]) as DispatcherHandler
        return {
          addr: { transport: 'tcp', hostname: '127.0.0.1', port: 0 },
          finished: Promise.resolve(),
          shutdown: () => {},
          ref: () => {},
          unref: () => {},
        }
      }) as typeof Deno.serve

      const previousUrl = Deno.env.get('SUPABASE_URL')
      const previousServiceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

      try {
        Deno.env.set('SUPABASE_URL', TEST_SUPABASE_URL)
        Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', TEST_SERVICE_ROLE)
        setDenoServe(fakeServe)
        await import('./index.ts')
      } finally {
        restoreDenoServe(originalServeDescriptor)
        if (previousUrl === undefined) Deno.env.delete('SUPABASE_URL')
        else Deno.env.set('SUPABASE_URL', previousUrl)
        if (previousServiceRole === undefined) Deno.env.delete('SUPABASE_SERVICE_ROLE_KEY')
        else Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', previousServiceRole)
      }

      assertExists(capturedHandler)
      return capturedHandler
    })()
  }

  return handlerPromise
}

function jsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

async function bodyTextFrom(input: RequestInfo | URL, init?: RequestInit): Promise<string | null> {
  if (typeof init?.body === 'string') return init.body
  if (init?.body instanceof Uint8Array) return new TextDecoder().decode(init.body)
  if (input instanceof Request) {
    try {
      const text = await input.clone().text()
      return text.length ? text : null
    } catch {
      return null
    }
  }
  return null
}

function installFetchStub(config: FetchStubConfig = {}) {
  const originalFetch = globalThis.fetch
  const calls: FetchCall[] = []
  const invocations: unknown[] = []

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const rawUrl =
      typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
    const url = new URL(rawUrl)
    const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase()
    const body = await bodyTextFrom(input, init)

    calls.push({ url: url.toString(), method, body })

    if (url.pathname.endsWith('/functions/v1/workflow-engine')) {
      if (body) invocations.push(JSON.parse(body))
      return jsonResponse({ ok: true })
    }

    if (url.pathname.endsWith('/rest/v1/workflow_trigger_queue') && method === 'GET') {
      if (config.failQueueSelect) {
        return jsonResponse(
          {
            code: 'XX000',
            message: 'queue unavailable',
            details: null,
            hint: null,
          },
          500
        )
      }
      return jsonResponse(config.queue ?? [])
    }

    if (url.pathname.endsWith('/rest/v1/workflow_trigger_queue') && method === 'PATCH') {
      return jsonResponse([])
    }

    if (url.pathname.endsWith('/rest/v1/workflows') && method === 'GET') {
      const triggerParam = url.searchParams.get('trigger_type') ?? ''
      const triggerType = triggerParam.startsWith('eq.') ? triggerParam.slice(3) : triggerParam
      return jsonResponse(config.workflowsByTrigger?.[triggerType] ?? [])
    }

    return jsonResponse({ message: `unexpected mocked request: ${method} ${url.pathname}` }, 404)
  }) as typeof fetch

  return {
    calls,
    invocations,
    restore: () => {
      globalThis.fetch = originalFetch
    },
  }
}

async function invokeDispatcher(request: Request): Promise<Response> {
  const handler = await loadDispatcherHandler()
  return await handler(request)
}

Deno.test(
  'module loads and registers a Deno.serve handler without opening a real server',
  async () => {
    const handler = await loadDispatcherHandler()
    assertExists(handler)
  }
)

Deno.test(
  'OPTIONS request returns CORS headers without authentication or database access',
  async () => {
    const fetchStub = installFetchStub()

    try {
      const response = await invokeDispatcher(
        new Request('http://localhost', { method: 'OPTIONS' })
      )

      assertEquals(response.status, 200)
      assertNotEquals(response.headers.get('Access-Control-Allow-Origin'), '*')
      assertEquals(
        response.headers.get('Access-Control-Allow-Headers'),
        'authorization, x-client-info, apikey, content-type, x-internal-secret'
      )
      assertEquals(await response.text(), '')
      assertEquals(fetchStub.calls.length, 0)
    } finally {
      fetchStub.restore()
    }
  }
)

Deno.test(
  'POST request without internal secret or service role bearer token is rejected',
  async () => {
    const fetchStub = installFetchStub()

    try {
      await withEnv({ INTERNAL_FUNCTION_SECRET: TEST_INTERNAL_SECRET }, async () => {
        const response = await invokeDispatcher(new Request('http://localhost', { method: 'POST' }))
        const body = await response.json()

        assertEquals(response.status, 401)
        assertEquals(body, { error: 'Unauthorized' })
        assertEquals(fetchStub.calls.length, 0)
      })
    } finally {
      fetchStub.restore()
    }
  }
)

Deno.test(
  'dispatches only email workflows whose keyword filter matches subject or sender',
  async () => {
    const fetchStub = installFetchStub({
      queue: [
        {
          id: 'queue-email-1',
          trigger_type: 'email.received',
          attempts: 2,
          payload: {
            subject: 'Quarterly Invoice',
            sender_email: 'billing@example.com',
          },
        },
      ],
      workflowsByTrigger: {
        'email.received': [
          {
            id: 'wf-keyword-subject',
            trigger_config: { keywords: ['invoice'] },
          },
          {
            id: 'wf-keyword-sender',
            trigger_config: { keywords: ['EXAMPLE.COM'] },
          },
          {
            id: 'wf-skipped',
            trigger_config: { keywords: ['support'] },
          },
        ],
      },
    })

    try {
      await withEnv({ INTERNAL_FUNCTION_SECRET: TEST_INTERNAL_SECRET }, async () => {
        const response = await invokeDispatcher(
          new Request('http://localhost', {
            method: 'POST',
            headers: { 'x-function-secret': TEST_INTERNAL_SECRET },
          })
        )
        const body = await response.json()

        assertEquals(response.status, 200)
        assertEquals(body, { processed: 1, dispatched: 2 })

        assertEquals(fetchStub.invocations, [
          {
            workflow_id: 'wf-keyword-subject',
            trigger_payload: {
              subject: 'Quarterly Invoice',
              sender_email: 'billing@example.com',
            },
          },
          {
            workflow_id: 'wf-keyword-sender',
            trigger_payload: {
              subject: 'Quarterly Invoice',
              sender_email: 'billing@example.com',
            },
          },
        ])

        const queueUpdates = fetchStub.calls
          .filter(
            (call) =>
              call.method === 'PATCH' && call.url.includes('/rest/v1/workflow_trigger_queue')
          )
          .map((call) => JSON.parse(call.body ?? '{}'))

        assertEquals(queueUpdates[0], { status: 'processing', attempts: 3 })
        assertEquals(queueUpdates[1].status, 'done')
        assertExists(queueUpdates[1].processed_at)
      })
    } finally {
      fetchStub.restore()
    }
  }
)

Deno.test(
  'dispatches etablissement statut_changed workflows with case-insensitive statut filter using service role auth',
  async () => {
    const fetchStub = installFetchStub({
      queue: [
        {
          id: 'queue-etab-1',
          trigger_type: 'etablissement.statut_changed',
          payload: {
            etablissement_id: 'etab-123',
            statut_new: 'VALIDÉ',
          },
        },
      ],
      workflowsByTrigger: {
        'etablissement.statut_changed': [
          {
            id: 'wf-status-match',
            trigger_config: { statut_target: 'validé' },
          },
          {
            id: 'wf-status-skipped',
            trigger_config: { statut_target: 'refusé' },
          },
        ],
      },
    })

    try {
      await withEnv({ INTERNAL_FUNCTION_SECRET: undefined }, async () => {
        const response = await invokeDispatcher(
          new Request('http://localhost', {
            method: 'POST',
            headers: { authorization: `Bearer ${TEST_SERVICE_ROLE}` },
          })
        )
        const body = await response.json()

        assertEquals(response.status, 200)
        assertEquals(body, { processed: 1, dispatched: 1 })
        assertEquals(fetchStub.invocations, [
          {
            workflow_id: 'wf-status-match',
            trigger_payload: {
              etablissement_id: 'etab-123',
              statut_new: 'VALIDÉ',
            },
          },
        ])

        const processingUpdate = fetchStub.calls
          .filter(
            (call) =>
              call.method === 'PATCH' && call.url.includes('/rest/v1/workflow_trigger_queue')
          )
          .map((call) => JSON.parse(call.body ?? '{}'))[0]

        assertEquals(processingUpdate, { status: 'processing', attempts: 1 })
      })
    } finally {
      fetchStub.restore()
    }
  }
)

Deno.test('returns sanitized 500 response when pending queue query fails', async () => {
  const fetchStub = installFetchStub({ failQueueSelect: true })

  try {
    await withEnv({ INTERNAL_FUNCTION_SECRET: TEST_INTERNAL_SECRET }, async () => {
      const response = await invokeDispatcher(
        new Request('http://localhost', {
          method: 'POST',
          headers: { 'x-function-secret': TEST_INTERNAL_SECRET },
        })
      )
      const body = await response.json()

      assertEquals(response.status, 500)
      assertExists(body.error)
      assertEquals(fetchStub.invocations.length, 0)
    })
  } finally {
    fetchStub.restore()
  }
})
