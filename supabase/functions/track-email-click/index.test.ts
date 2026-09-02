import {
  assertEquals,
  assertExists,
  assertThrows,
  assertRejects, assertNotEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts'
import { importEdgeModuleOffline } from '../_shared/module-load-test-harness.ts'

type ServeHandler = (req: Request) => Response | Promise<Response>

let capturedHandler: ServeHandler | undefined

async function loadHandler(): Promise<ServeHandler> {
  if (capturedHandler) return capturedHandler

  const { module, stats } = await importEdgeModuleOffline(new URL('./index.ts', import.meta.url))
  assertEquals(stats.listenCalls, 0)
  assertEquals(stats.fetchCalls, 0)
  assertExists(module.handler)
  assertEquals(typeof module.handler, 'function')
  capturedHandler = module.handler as ServeHandler
  return capturedHandler
}

function b64urlEncode(value: string): string {
  const bytes = new TextEncoder().encode(value)
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '')
}

function b64urlFromBytes(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '')
}

async function signTrackingPayload(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )

  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload))
  return b64urlFromBytes(new Uint8Array(signature))
}

async function withEnv<T>(
  values: Record<string, string | undefined>,
  fn: () => Promise<T> | T
): Promise<T> {
  const previous = new Map<string, string | undefined>()

  for (const [key, value] of Object.entries(values)) {
    previous.set(key, Deno.env.get(key))
    if (value === undefined) {
      Deno.env.delete(key)
    } else {
      Deno.env.set(key, value)
    }
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

type FetchCall = {
  url: string
  method: string
  body: string
  headers: Record<string, string>
}

async function withFetchStub<T>(fn: (calls: FetchCall[]) => Promise<T> | T): Promise<T> {
  const originalFetch = globalThis.fetch
  const calls: FetchCall[] = []

  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const request = input instanceof Request ? input : new Request(input, init)
    const body =
      request.method === 'GET' || request.method === 'HEAD' ? '' : await request.clone().text()

    calls.push({
      url: request.url,
      method: request.method,
      body,
      headers: Object.fromEntries(request.headers.entries()),
    })

    let responseBody: unknown = {}

    if (request.url.includes('/rest/v1/email_threads')) {
      responseBody = { etablissement_id: 'etab_123' }
    } else if (request.url.includes('/rest/v1/email_link_clicks')) {
      responseBody = { id: 'click_456' }
    } else if (request.url.includes('/rest/v1/rpc/record_behavioral_event')) {
      responseBody = {}
    }

    return new Response(JSON.stringify(responseBody), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  }

  try {
    return await fn(calls)
  } finally {
    globalThis.fetch = originalFetch
  }
}

async function waitFor(predicate: () => boolean, timeoutMs = 1000): Promise<void> {
  const start = Date.now()

  while (Date.now() - start < timeoutMs) {
    if (predicate()) return
    await new Promise((resolve) => setTimeout(resolve, 10))
  }

  throw new Error('Timed out waiting for condition')
}

async function signedUrlParams(
  target: string,
  secret: string,
  threadId = '',
  messageId = ''
): Promise<URLSearchParams> {
  const encoded = b64urlEncode(target)
  const payload = `${encoded}|${threadId}|${messageId}`
  const signature = await signTrackingPayload(secret, payload)

  const params = new URLSearchParams()
  params.set('u', encoded)
  if (threadId) params.set('t', threadId)
  if (messageId) params.set('m', messageId)
  params.set('s', signature)
  return params
}

Deno.test('module loads and registers the Supabase Edge Function handler', async () => {
  const handler = await loadHandler()
  assertExists(handler)
  assertEquals(typeof handler, 'function')
})

Deno.test('OPTIONS preflight returns CORS headers without requiring tracking params', async () => {
  const handler = await loadHandler()

  const response = await handler(new Request('http://localhost/track', { method: 'OPTIONS' }))

  assertEquals(response.status, 200)
  assertNotEquals(response.headers.get('Access-Control-Allow-Origin'), '*')
  assertEquals(
    response.headers.get('Access-Control-Allow-Headers'),
    'authorization, x-client-info, apikey, content-type, x-internal-secret'
  )
  assertEquals(await response.text(), '')
})

Deno.test('rejects a malformed base64url redirect URL', async () => {
  const handler = await loadHandler()

  const response = await handler(new Request('http://localhost/track?u=%%%&s=ignored'))

  assertEquals(response.status, 400)
  assertEquals(await response.text(), 'Invalid redirect URL')
  assertNotEquals(response.headers.get('Access-Control-Allow-Origin'), '*')
})

Deno.test('rejects a decoded redirect URL with a non-http protocol', async () => {
  const handler = await loadHandler()
  const encodedUnsafeTarget = b64urlEncode('javascript:alert(1)')

  const response = await handler(
    new Request(`http://localhost/track?u=${encodedUnsafeTarget}&s=ignored`)
  )

  assertEquals(response.status, 400)
  assertEquals(await response.text(), 'Invalid redirect URL')
})

Deno.test('returns 500 when HMAC secret is not configured', async () => {
  const handler = await loadHandler()
  const target = 'https://example.com/welcome'
  const encoded = b64urlEncode(target)

  await withEnv({ EMAIL_TRACKING_HMAC_SECRET: undefined }, async () => {
    const response = await handler(new Request(`http://localhost/track?u=${encoded}&s=anything`))

    assertEquals(response.status, 500)
    assertEquals(await response.text(), 'Tracking misconfigured')
  })
})

Deno.test('rejects a valid redirect URL when signature is missing', async () => {
  const handler = await loadHandler()
  const target = 'https://example.com/pricing?plan=pro'
  const encoded = b64urlEncode(target)

  await withEnv({ EMAIL_TRACKING_HMAC_SECRET: 'test-secret' }, async () => {
    const response = await handler(new Request(`http://localhost/track?u=${encoded}`))

    assertEquals(response.status, 400)
    assertEquals(await response.text(), 'Missing signature')
  })
})

Deno.test('rejects a valid redirect URL when signature does not match payload', async () => {
  const handler = await loadHandler()
  const target = 'https://example.com/docs'
  const encoded = b64urlEncode(target)

  await withEnv({ EMAIL_TRACKING_HMAC_SECRET: 'test-secret' }, async () => {
    const response = await handler(
      new Request(`http://localhost/track?u=${encoded}&t=thread_123&m=message_123&s=invalid`)
    )

    assertEquals(response.status, 403)
    assertEquals(await response.text(), 'Invalid signature')
  })
})

Deno.test(
  'redirects to the original URL and logs the click through mocked Supabase fetch calls',
  async () => {
    const handler = await loadHandler()

    const secret = 'local-hmac-secret'
    const target = 'https://example.com/offre?utm_source=email&name=%C3%89cole'
    const params = await signedUrlParams(target, secret, 'thread_123', 'message_789')

    await withEnv(
      {
        EMAIL_TRACKING_HMAC_SECRET: secret,
        SUPABASE_URL: 'https://supabase.local.test',
        SUPABASE_SERVICE_ROLE_KEY: 'local-service-role-key',
      },
      async () => {
        await withFetchStub(async (calls) => {
          const response = await handler(
            new Request(`http://localhost/track?${params.toString()}`, {
              headers: {
                'x-forwarded-for': '203.0.113.7, 198.51.100.4',
                'user-agent': 'DenoTest/1.0',
              },
            })
          )

          assertEquals(response.status, 302)
          assertEquals(response.headers.get('Location'), target)
          assertEquals(response.headers.get('Cache-Control'), 'no-store')
          assertNotEquals(response.headers.get('Access-Control-Allow-Origin'), '*')
          assertEquals(await response.text(), '')

          await waitFor(() => calls.length >= 3)

          const threadCall = calls.find((call) => call.url.includes('/rest/v1/email_threads'))
          assertExists(threadCall)
          assertEquals(threadCall.method, 'GET')

          const insertCall = calls.find((call) => call.url.includes('/rest/v1/email_link_clicks'))
          assertExists(insertCall)
          assertEquals(insertCall.method, 'POST')

          const insertBody = JSON.parse(insertCall.body)
          assertEquals(insertBody.thread_id, 'thread_123')
          assertEquals(insertBody.message_id, 'message_789')
          assertEquals(insertBody.etablissement_id, 'etab_123')
          assertEquals(insertBody.url, target)
          assertEquals(insertBody.ip, '203.0.113.7')
          assertEquals(insertBody.user_agent, 'DenoTest/1.0')

          const rpcCall = calls.find((call) =>
            call.url.includes('/rest/v1/rpc/record_behavioral_event')
          )
          assertExists(rpcCall)
          assertEquals(rpcCall.method, 'POST')

          const rpcBody = JSON.parse(rpcCall.body)
          assertEquals(rpcBody._etablissement_id, 'etab_123')
          assertEquals(rpcBody._event_type, 'email_clicked')
          assertEquals(rpcBody._weight, 3)
          assertEquals(rpcBody._source_id, 'click_456')
          assertEquals(rpcBody._source_type, 'email_link_click')
          assertEquals(rpcBody._metadata, {
            url: target,
            thread_id: 'thread_123',
          })
        })
      }
    )
  }
)

Deno.test(
  'test helpers fail explicitly on invalid synchronous and asynchronous operations',
  async () => {
    assertThrows(() => new URL('http://[invalid-host]'))
    await assertRejects(
      () => Promise.reject(new Error('expected rejection')),
      Error,
      'expected rejection'
    )
  }
)
