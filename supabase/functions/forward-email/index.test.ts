import {
  assertEquals,
  assertExists,
  assertThrows,
  assertRejects, assertNotEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts'

type RestoreFn = () => void

function replaceDenoProperty(name: string, value: unknown): RestoreFn {
  const descriptor = Object.getOwnPropertyDescriptor(Deno, name)
  Object.defineProperty(Deno, name, {
    configurable: true,
    writable: true,
    value,
  })

  return () => {
    if (descriptor) {
      Object.defineProperty(Deno, name, descriptor)
    } else {
      delete (Deno as Record<string, unknown>)[name]
    }
  }
}

function installOfflineServeHarness(requests: Request[]) {
  const responses: Response[] = []
  const restores: RestoreFn[] = []
  let listenerIndex = 0
  let serveHttpIndex = 0

  const makeEvent = (request: Request) => ({
    request,
    respondWith: async (responseOrPromise: Response | Promise<Response>) => {
      responses.push(await responseOrPromise)
    },
  })

  const fakeConn = {
    rid: 1,
    localAddr: { transport: 'tcp', hostname: '127.0.0.1', port: 8000 },
    remoteAddr: { transport: 'tcp', hostname: '127.0.0.1', port: 54321 },
    read: async () => null,
    write: async (p: Uint8Array) => p.length,
    close: () => {},
    closeWrite: () => {},
    ref: () => {},
    unref: () => {},
    readable: new ReadableStream<Uint8Array>({
      start(controller) {
        controller.close()
      },
    }),
    writable: new WritableStream<Uint8Array>(),
  }

  const fakeListener = {
    addr: { transport: 'tcp', hostname: '0.0.0.0', port: 8000 },
    close: () => {},
    ref: () => {},
    unref: () => {},
    accept: async () => {
      if (listenerIndex < requests.length) {
        listenerIndex++
        return fakeConn
      }
      // A rejected accept makes the legacy std/http server schedule a backoff
      // timer. Keep this module-load fixture inert after scripted connections.
      return await new Promise<never>(() => {})
    },
    [Symbol.asyncIterator]() {
      return {
        next: async () => {
          if (listenerIndex < requests.length) {
            listenerIndex++
            return { value: fakeConn, done: false }
          }
          return { value: undefined, done: true }
        },
      }
    },
  }

  restores.push(replaceDenoProperty('listen', () => fakeListener))

  restores.push(
    replaceDenoProperty('serveHttp', () => {
      const request = requests[serveHttpIndex++]
      let used = false

      return {
        close: () => {},
        nextRequest: async () => {
          if (used || !request) return null
          used = true
          return makeEvent(request)
        },
        [Symbol.asyncIterator]() {
          return {
            next: async () => {
              if (used || !request) {
                return { value: undefined, done: true }
              }
              used = true
              return { value: makeEvent(request), done: false }
            },
          }
        },
      }
    })
  )

  restores.push(
    replaceDenoProperty('serve', (...args: unknown[]) => {
      const handler = typeof args[0] === 'function' ? args[0] : args[1]

      const finished = (async () => {
        if (typeof handler !== 'function') return
        for (const request of requests) {
          responses.push(await handler(request))
        }
      })()

      return {
        finished,
        shutdown: async () => {},
        ref: () => {},
        unref: () => {},
        addr: { transport: 'tcp', hostname: '0.0.0.0', port: 8000 },
      }
    })
  )

  return {
    responses,
    restore: () => {
      for (const restore of restores.reverse()) restore()
    },
  }
}

async function waitForResponses(responses: Response[], expectedCount: number): Promise<Response[]> {
  for (let i = 0; i < 100; i++) {
    if (responses.length >= expectedCount) return responses
    await new Promise((resolve) => setTimeout(resolve, 10))
  }

  throw new Error(`Expected ${expectedCount} response(s), got ${responses.length}`)
}

Deno.test('source contains expected forwarding email transformations', async () => {
  const source = await Deno.readTextFile(new URL('./index.ts', import.meta.url))

  assertEquals(source.includes("Fwd: ${message.subject || '(Sans objet)'"), true)
  assertEquals(source.includes('---------- Message transféré ----------'), true)
  assertEquals(source.includes("additional_content.replace(/\\n/g, '<br>')"), true)
  assertEquals(source.includes("message.body_text?.replace(/\\n/g, '<br>')"), true)
  assertEquals(source.includes('to_addresses.map((email) => ({ email, name: null }))'), true)
})

Deno.test('source exposes CORS policy for Supabase Edge Function requests', async () => {
  const source = await Deno.readTextFile(new URL('./index.ts', import.meta.url))

  assertEquals(source.includes("origineAutorisee()"), true)
  assertEquals(source.includes("'Access-Control-Allow-Methods': 'POST, OPTIONS'"), true)
  assertEquals(source.includes('authorization, x-client-info, apikey, content-type'), true)
})

Deno.test(
  'module loads offline and handles OPTIONS plus missing authorization without real network',
  async () => {
    const previousSupabaseUrl = Deno.env.get('SUPABASE_URL')
    const previousServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const previousEncryptionKey = Deno.env.get('EMAIL_ENCRYPTION_KEY')
    const originalFetch = globalThis.fetch

    Deno.env.set('SUPABASE_URL', 'http://127.0.0.1:54321')
    Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', 'test-service-role-key')
    Deno.env.set('EMAIL_ENCRYPTION_KEY', 'test-encryption-key')

    globalThis.fetch = (() => {
      throw new Error('Unexpected real network call during offline test')
    }) as typeof fetch

    const harness = installOfflineServeHarness([
      new Request('http://localhost', { method: 'OPTIONS' }),
      new Request('http://localhost', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          message_id: 'msg_test_123',
          to_addresses: ['recipient@example.test'],
        }),
      }),
    ])

    try {
      const mod = await import('./index.ts')
      assertExists(mod)

      const responses = await waitForResponses(harness.responses, 2)
      const optionsResponse = responses.find((response) => response.status === 200)
      const errorResponse = responses.find((response) => response.status === 500)

      assertExists(optionsResponse)
      assertNotEquals(optionsResponse.headers.get('Access-Control-Allow-Origin'), '*')
      assertEquals(optionsResponse.headers.get('Access-Control-Allow-Methods'), 'POST, OPTIONS')

      assertExists(errorResponse)
      assertNotEquals(errorResponse.headers.get('Access-Control-Allow-Origin'), '*')
      assertEquals(errorResponse.headers.get('Content-Type'), 'application/json')

      const errorPayload = await errorResponse.json()
      assertExists(errorPayload.error)
    } finally {
      harness.restore()
      globalThis.fetch = originalFetch

      if (previousSupabaseUrl === undefined) Deno.env.delete('SUPABASE_URL')
      else Deno.env.set('SUPABASE_URL', previousSupabaseUrl)

      if (previousServiceRoleKey === undefined) Deno.env.delete('SUPABASE_SERVICE_ROLE_KEY')
      else Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', previousServiceRoleKey)

      if (previousEncryptionKey === undefined) Deno.env.delete('EMAIL_ENCRYPTION_KEY')
      else Deno.env.set('EMAIL_ENCRYPTION_KEY', previousEncryptionKey)
    }
  }
)

Deno.test('test helpers reject when expected responses are not produced', async () => {
  await assertRejects(() => waitForResponses([], 1), Error, 'Expected 1 response(s), got 0')
})

Deno.test('malformed JSON request fixtures fail before being used', () => {
  assertThrows(() => JSON.parse('{"message_id":"msg_1","to_addresses":['), SyntaxError)
})
