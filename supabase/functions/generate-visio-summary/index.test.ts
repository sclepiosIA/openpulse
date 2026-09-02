import { assertEquals, assertExists, assertNotEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts'

const JSON_HEADERS = { 'content-type': 'application/json' }

type FetchCall = {
  url: string
  init?: RequestInit
  body: AzureRequestBody | null
}

type AzureRequestBody = {
  max_completion_tokens: number
  reasoning_effort: string
  verbosity: string
  response_format: { type: string }
  messages: Array<{ role: string; content: string }>
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: JSON_HEADERS,
  })
}

function getUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input
  if (input instanceof URL) return input.toString()
  return input.url
}

function makeAuthEnv(secret: string): Record<string, string> {
  return {
    INTERNAL_EDGE_SECRET: secret,
    EDGE_INTERNAL_SECRET: secret,
    INTERNAL_SECRET: secret,
    SUPABASE_SERVICE_ROLE_KEY: secret,
    SUPABASE_ANON_KEY: secret,
    SUPABASE_URL: 'http://supabase.test',
  }
}

function makeAuthorizedHeaders(secret: string): HeadersInit {
  return {
    'content-type': 'application/json',
    authorization: `Bearer ${secret}`,
    apikey: secret,
    'x-internal-secret': secret,
  }
}

function makeFetchStub(
  options: {
    azureEndpoint?: string
    azureBody?: unknown
    azureStatus?: number
    azureThrows?: Error
    calls?: FetchCall[]
  } = {}
): typeof fetch {
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    await Promise.resolve()
    const url = getUrl(input)

    if (options.azureEndpoint && url === options.azureEndpoint) {
      let parsedBody: AzureRequestBody | null = null
      if (typeof init?.body === 'string') {
        parsedBody = JSON.parse(init.body) as AzureRequestBody
      }

      options.calls?.push({ url, init, body: parsedBody })

      if (options.azureThrows) {
        throw options.azureThrows
      }

      return jsonResponse(
        options.azureBody ?? {
          choices: [
            {
              message: {
                content: JSON.stringify({
                  summary: 'Résumé généré pour la visioconférence.',
                  suggestedTitle: 'Réunion de cadrage',
                  suggestedDate: '2025-03-14',
                  suggestedTime: '14:00',
                }),
              },
            },
          ],
          usage: {
            prompt_tokens: 12,
            completion_tokens: 8,
            total_tokens: 20,
          },
        },
        options.azureStatus ?? 200
      )
    }

    if (url.includes('/auth/v1/user')) {
      return jsonResponse({
        id: '00000000-0000-4000-8000-000000000001',
        aud: 'authenticated',
        role: 'authenticated',
        email: 'user@example.test',
        app_metadata: {},
        user_metadata: {},
        created_at: '2025-01-01T00:00:00.000Z',
      })
    }

    if (url.includes('/rest/v1/')) {
      return jsonResponse([], 201)
    }

    return jsonResponse({})
  }) as typeof fetch
}

function replaceProperty(target: Record<string, unknown>, key: string, value: unknown): () => void {
  const descriptor = Object.getOwnPropertyDescriptor(target, key)

  try {
    Object.defineProperty(target, key, {
      configurable: true,
      writable: true,
      value,
    })
  } catch {
    target[key] = value
  }

  return () => {
    if (descriptor) {
      Object.defineProperty(target, key, descriptor)
    } else {
      delete target[key]
    }
  }
}

async function withEnv<T>(
  values: Record<string, string | undefined>,
  fn: () => Promise<T>
): Promise<T> {
  const keys = new Set([
    ...Object.keys(values),
    'AZURE_OPENAI_ENDPOINT',
    'AZURE_OPENAI_API_KEY',
    'INTERNAL_EDGE_SECRET',
    'EDGE_INTERNAL_SECRET',
    'INTERNAL_SECRET',
    'SUPABASE_SERVICE_ROLE_KEY',
    'SUPABASE_ANON_KEY',
    'SUPABASE_URL',
  ])

  const previous = new Map<string, string | undefined>()
  for (const key of keys) {
    previous.set(key, Deno.env.get(key))
  }

  for (const [key, value] of Object.entries(values)) {
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

function withTimeout<T>(promise: Promise<T>, ms = 3000): Promise<T> {
  let timeoutId: number | undefined

  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`Timed out waiting for served response after ${ms}ms`))
    }, ms)
  })

  return Promise.race([promise, timeout]).finally(() => {
    if (timeoutId !== undefined) clearTimeout(timeoutId)
  })
}

async function invokeImportedServe(options: {
  request: Request
  env?: Record<string, string | undefined>
  fetchStub?: typeof fetch
}): Promise<Response> {
  let resolveResponse!: (response: Response) => void
  let rejectResponse!: (error: unknown) => void

  const responsePromise = new Promise<Response>((resolve, reject) => {
    resolveResponse = resolve
    rejectResponse = reject
  })

  let eventReturned = false
  let connectionReturned = false

  const requestEvent = {
    request: options.request,
    respondWith(responseOrPromise: Response | Promise<Response>) {
      Promise.resolve(responseOrPromise).then(resolveResponse, rejectResponse)
      return Promise.resolve()
    },
  }

  const fakeHttpConn = {
    rid: 101,
    close() {},
    async nextRequest() {
      await Promise.resolve()
      if (eventReturned) return null
      eventReturned = true
      return requestEvent
    },
    [Symbol.asyncIterator]() {
      return {
        async next() {
          await Promise.resolve()
          if (eventReturned) return { done: true, value: undefined }
          eventReturned = true
          return { done: false, value: requestEvent }
        },
      }
    },
  }

  const localAddr = {
    transport: 'tcp',
    hostname: '127.0.0.1',
    port: 0,
  }

  const remoteAddr = {
    transport: 'tcp',
    hostname: '127.0.0.1',
    port: 54321,
  }

  const fakeConn = {
    rid: 100,
    localAddr,
    remoteAddr,
    readable: new ReadableStream(),
    writable: new WritableStream(),
    close() {},
  }

  const fakeListener = {
    rid: 99,
    addr: localAddr,
    close() {},
    ref() {},
    unref() {},
    async accept() {
      if (connectionReturned) {
        return await new Promise(() => {})
      }
      connectionReturned = true
      return fakeConn
    },
    [Symbol.asyncIterator]() {
      return {
        async next() {
          await Promise.resolve()
          if (connectionReturned) return { done: true, value: undefined }
          connectionReturned = true
          return { done: false, value: fakeConn }
        },
      }
    },
  }

  const restoreListen = replaceProperty(
    Deno as unknown as Record<string, unknown>,
    'listen',
    () => fakeListener
  )
  const restoreServeHttp = replaceProperty(
    Deno as unknown as Record<string, unknown>,
    'serveHttp',
    () => fakeHttpConn
  )
  const restoreDenoServe = replaceProperty(
    Deno as unknown as Record<string, unknown>,
    'serve',
    (...args: unknown[]) => {
      const handler = typeof args[0] === 'function' ? args[0] : args[1]

      queueMicrotask(async () => {
        try {
          const response = await (handler as (req: Request) => Response | Promise<Response>)(
            options.request
          )
          resolveResponse(response)
        } catch (error) {
          rejectResponse(error)
        }
      })

      return {
        finished: Promise.resolve(),
        shutdown() {},
        ref() {},
        unref() {},
      }
    }
  )

  const originalFetch = globalThis.fetch
  globalThis.fetch = options.fetchStub ?? makeFetchStub()

  try {
    return await withEnv(options.env ?? {}, async () => {
      await import(`./index.ts?test=${crypto.randomUUID()}`)
      return await withTimeout(responsePromise)
    })
  } finally {
    globalThis.fetch = originalFetch
    restoreDenoServe()
    restoreServeHttp()
    restoreListen()
  }
}

Deno.test('OPTIONS preflight returns CORS headers without authentication', async () => {
  const response = await invokeImportedServe({
    request: new Request('http://localhost', { method: 'OPTIONS' }),
  })

  assertEquals(response.status, 200)
  assertNotEquals(response.headers.get('Access-Control-Allow-Origin'), '*')
  assertEquals(
    response.headers.get('Access-Control-Allow-Headers'),
    'authorization, x-client-info, apikey, content-type, x-internal-secret'
  )
  assertEquals(await response.text(), '')
})

Deno.test('unauthorized POST returns 401 and does not call Azure', async () => {
  let fetchCalls = 0

  const response = await invokeImportedServe({
    request: new Request('http://localhost', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        subject: 'Planification',
        messages: 'Bonjour, pouvons-nous organiser une visioconférence ?',
        participants: 'alice@example.test, bob@example.test',
      }),
    }),
    fetchStub: (async () => {
      await Promise.resolve()
      fetchCalls++
      return jsonResponse({})
    }) as typeof fetch,
  })

  assertEquals(response.status, 401)
  assertEquals(await response.json(), { error: 'Unauthorized' })
  assertEquals(fetchCalls, 0)
})

Deno.test('empty messages return an empty summary payload without Azure call', async () => {
  const secret = crypto.randomUUID()
  let azureCalls = 0

  const response = await invokeImportedServe({
    request: new Request('http://localhost', {
      method: 'POST',
      headers: makeAuthorizedHeaders(secret),
      body: JSON.stringify({
        subject: 'Point commercial',
        messages: '   ',
        participants: 'alice@example.test',
      }),
    }),
    env: {
      ...makeAuthEnv(secret),
      AZURE_OPENAI_ENDPOINT: 'http://azure.test/openai/deployments/test/chat/completions',
      AZURE_OPENAI_API_KEY: crypto.randomUUID(),
    },
    fetchStub: (async (input: RequestInfo | URL) => {
      await Promise.resolve()
      if (getUrl(input).includes('azure.test')) azureCalls++
      return jsonResponse({})
    }) as typeof fetch,
  })

  assertEquals(response.status, 200)
  assertEquals(await response.json(), {
    summary: '',
    suggestedTitle: null,
    suggestedDate: null,
    suggestedTime: null,
  })
  assertEquals(azureCalls, 0)
})

Deno.test('missing Azure credentials return the safe empty payload', async () => {
  const secret = crypto.randomUUID()
  let azureCalls = 0

  const response = await invokeImportedServe({
    request: new Request('http://localhost', {
      method: 'POST',
      headers: makeAuthorizedHeaders(secret),
      body: JSON.stringify({
        subject: 'Démo produit',
        messages: 'Bonjour, une démo produit est demandée la semaine prochaine.',
        participants: 'client@example.test, sales@example.test',
      }),
    }),
    env: {
      ...makeAuthEnv(secret),
      AZURE_OPENAI_ENDPOINT: undefined,
      AZURE_OPENAI_API_KEY: undefined,
    },
    fetchStub: (async (input: RequestInfo | URL) => {
      await Promise.resolve()
      if (getUrl(input).includes('azure')) azureCalls++
      return jsonResponse({})
    }) as typeof fetch,
  })

  assertEquals(response.status, 200)
  assertEquals(await response.json(), {
    summary: '',
    suggestedTitle: null,
    suggestedDate: null,
    suggestedTime: null,
  })
  assertEquals(azureCalls, 0)
})

Deno.test('successful Azure JSON response is parsed into summary fields', async () => {
  const secret = crypto.randomUUID()
  const azureEndpoint = `http://azure.test/${crypto.randomUUID()}`
  const azureCalls: FetchCall[] = []

  const response = await invokeImportedServe({
    request: new Request('http://localhost', {
      method: 'POST',
      headers: makeAuthorizedHeaders(secret),
      body: JSON.stringify({
        subject: 'Comité produit',
        messages:
          'Bonjour, retrouvons-nous le 2025-03-14 à 14:00 pour valider la feuille de route.',
        participants: 'alice@example.test, bob@example.test',
      }),
    }),
    env: {
      ...makeAuthEnv(secret),
      AZURE_OPENAI_ENDPOINT: azureEndpoint,
      AZURE_OPENAI_API_KEY: crypto.randomUUID(),
    },
    fetchStub: makeFetchStub({
      azureEndpoint,
      calls: azureCalls,
      azureBody: {
        choices: [
          {
            message: {
              content: JSON.stringify({
                summary:
                  'Les participants souhaitent valider la feuille de route produit. Une visioconférence est nécessaire pour arbitrer les priorités.',
                suggestedTitle: 'Validation feuille de route',
                suggestedDate: '2025-03-14',
                suggestedTime: '14:00',
              }),
            },
          },
        ],
        usage: {
          prompt_tokens: 31,
          completion_tokens: 17,
          total_tokens: 48,
        },
      },
    }),
  })

  assertEquals(response.status, 200)
  assertEquals(await response.json(), {
    summary:
      'Les participants souhaitent valider la feuille de route produit. Une visioconférence est nécessaire pour arbitrer les priorités.',
    suggestedTitle: 'Validation feuille de route',
    suggestedDate: '2025-03-14',
    suggestedTime: '14:00',
  })

  assertEquals(azureCalls.length, 1)
  const azureRequest = azureCalls[0]?.body
  assertExists(azureRequest)
  assertEquals(azureRequest.max_completion_tokens, 500)
  assertEquals(azureRequest.reasoning_effort, 'low')
  assertEquals(azureRequest.verbosity, 'low')
  assertEquals(azureRequest.response_format, { type: 'json_object' })
  assertEquals(azureRequest.messages[0].role, 'system')
  assertEquals(azureRequest.messages[1].role, 'user')
  assertEquals(azureRequest.messages[1].content.includes('Comité produit'), true)
  assertEquals(azureRequest.messages[1].content.includes('2025-03-14'), true)
})

Deno.test('invalid Azure JSON content falls back to raw summary text', async () => {
  const secret = crypto.randomUUID()
  const azureEndpoint = `http://azure.test/${crypto.randomUUID()}`

  const response = await invokeImportedServe({
    request: new Request('http://localhost', {
      method: 'POST',
      headers: makeAuthorizedHeaders(secret),
      body: JSON.stringify({
        subject: 'Synchronisation projet',
        messages: "Il faut clarifier les prochaines étapes avec toute l'équipe.",
        participants: 'team@example.test',
      }),
    }),
    env: {
      ...makeAuthEnv(secret),
      AZURE_OPENAI_ENDPOINT: azureEndpoint,
      AZURE_OPENAI_API_KEY: crypto.randomUUID(),
    },
    fetchStub: makeFetchStub({
      azureEndpoint,
      azureBody: {
        choices: [
          {
            message: {
              content:
                'Une visioconférence est nécessaire pour clarifier les prochaines étapes du projet.',
            },
          },
        ],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 9,
          total_tokens: 19,
        },
      },
    }),
  })

  assertEquals(response.status, 200)
  assertEquals(await response.json(), {
    summary: 'Une visioconférence est nécessaire pour clarifier les prochaines étapes du projet.',
    suggestedTitle: null,
    suggestedDate: null,
    suggestedTime: null,
  })
})

Deno.test('Azure timeout returns a timeout payload', async () => {
  const secret = crypto.randomUUID()
  const azureEndpoint = `http://azure.test/${crypto.randomUUID()}`

  const response = await invokeImportedServe({
    request: new Request('http://localhost', {
      method: 'POST',
      headers: makeAuthorizedHeaders(secret),
      body: JSON.stringify({
        subject: 'Incident production',
        messages: "Merci d'organiser une réunion urgente pour analyser l'incident.",
        participants: 'ops@example.test',
      }),
    }),
    env: {
      ...makeAuthEnv(secret),
      AZURE_OPENAI_ENDPOINT: azureEndpoint,
      AZURE_OPENAI_API_KEY: crypto.randomUUID(),
    },
    fetchStub: makeFetchStub({
      azureEndpoint,
      azureThrows: new DOMException('The operation was aborted.', 'AbortError'),
    }),
  })

  assertEquals(response.status, 200)
  assertEquals(await response.json(), {
    summary: '',
    suggestedTitle: null,
    suggestedDate: null,
    suggestedTime: null,
    error: 'Timeout',
  })
})

Deno.test('source keeps the expected Azure JSON-object request contract', async () => {
  const source = await Deno.readTextFile(new URL('./index.ts', import.meta.url))

  assertExists(source.match(/response_format:\s*\{\s*type:\s*["']json_object["']\s*\}/))
  assertExists(source.match(/max_completion_tokens:\s*500/))
  assertExists(source.match(/reasoning_effort:\s*["']low["']/))
  assertExists(source.match(/verbosity:\s*["']low["']/))
})
