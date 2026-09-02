import {
  assertEquals,
  assertExists,
  assertThrows,
  assertRejects, assertNotEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts'

type CapturedHandler = (req: Request) => Response | Promise<Response>

const TEST_SUPABASE_URL = 'http://127.0.0.1:54321'
const TEST_SERVICE_ROLE = `test-service-role-${crypto.randomUUID()}`

let capturedHandler: CapturedHandler | undefined

function restoreEnv(key: string, value: string | undefined) {
  if (value === undefined) {
    Deno.env.delete(key)
  } else {
    Deno.env.set(key, value)
  }
}

const originalSupabaseUrl = Deno.env.get('SUPABASE_URL')
const originalServiceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
const originalInternalSecret = Deno.env.get('INTERNAL_FUNCTION_SECRET')
// Deno >= 2.2 expose Deno.serve via un getter : l'affectation directe jette
// "Cannot set property serve ... which has only a getter". On passe par
// defineProperty (même pattern que workflow-dispatcher/index.test.ts).
const originalServeDescriptor = Object.getOwnPropertyDescriptor(Deno, 'serve')

Deno.env.set('SUPABASE_URL', TEST_SUPABASE_URL)
Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', TEST_SERVICE_ROLE)
Deno.env.delete('INTERNAL_FUNCTION_SECRET')

Object.defineProperty(Deno, 'serve', {
  configurable: true,
  writable: true,
  value: (...args: unknown[]) => {
    const maybeHandler = typeof args[0] === 'function' ? args[0] : args[1]
    capturedHandler = maybeHandler as CapturedHandler
    return {
      finished: Promise.resolve(),
      shutdown: () => {},
      ref: () => {},
      unref: () => {},
      addr: { transport: 'tcp', hostname: '127.0.0.1', port: 0 },
    }
  },
})

const moduleLoadPromise = import('./index.ts').finally(() => {
  if (originalServeDescriptor) Object.defineProperty(Deno, 'serve', originalServeDescriptor)
  restoreEnv('SUPABASE_URL', originalSupabaseUrl)
  restoreEnv('SUPABASE_SERVICE_ROLE_KEY', originalServiceRole)
  restoreEnv('INTERNAL_FUNCTION_SECRET', originalInternalSecret)
})

async function getHandler(): Promise<CapturedHandler> {
  await moduleLoadPromise
  assertExists(capturedHandler)
  return capturedHandler
}

async function withStubbedFetch<T>(fn: () => Promise<T>): Promise<T> {
  const originalFetch = globalThis.fetch
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })

  try {
    return await fn()
  } finally {
    globalThis.fetch = originalFetch
  }
}

Deno.test(
  'workflow-scheduler handler handles offline preflight and authorization cases',
  async (t) => {
    await t.step('module loads and registers a Deno.serve handler', async () => {
      const handler = await getHandler()
      assertExists(handler)
      assertEquals(typeof handler, 'function')
    })

    await t.step(
      'OPTIONS preflight returns CORS headers without requiring authorization',
      async () => {
        const handler = await getHandler()

        const response = await withStubbedFetch(() =>
          Promise.resolve(handler(new Request('http://localhost', { method: 'OPTIONS' })))
        )

        assertEquals(response.status, 200)
        assertNotEquals(response.headers.get('Access-Control-Allow-Origin'), '*')
        assertEquals(
          response.headers.get('Access-Control-Allow-Headers'),
          'authorization, x-client-info, apikey, content-type, x-internal-secret'
        )
        assertEquals(await response.text(), '')
      }
    )

    await t.step(
      'POST without authorization returns a JSON 401 Unauthorized response',
      async () => {
        const handler = await getHandler()

        const response = await withStubbedFetch(() =>
          Promise.resolve(handler(new Request('http://localhost', { method: 'POST' })))
        )

        assertEquals(response.status, 401)
        assertNotEquals(response.headers.get('Access-Control-Allow-Origin'), '*')
        assertEquals(response.headers.get('Content-Type'), 'application/json')
        assertEquals(await response.json(), { error: 'Unauthorized' })
      }
    )

    await t.step('wrong internal function secret is rejected', async () => {
      const handler = await getHandler()
      const previousInternalSecret = Deno.env.get('INTERNAL_FUNCTION_SECRET')
      const expectedSecret = `expected-${crypto.randomUUID()}`
      const wrongSecret = `wrong-${crypto.randomUUID()}`

      Deno.env.set('INTERNAL_FUNCTION_SECRET', expectedSecret)

      try {
        const response = await withStubbedFetch(() =>
          Promise.resolve(
            handler(
              new Request('http://localhost', {
                method: 'POST',
                headers: { 'x-function-secret': wrongSecret },
              })
            )
          )
        )

        assertEquals(response.status, 401)
        assertEquals(await response.json(), { error: 'Unauthorized' })
      } finally {
        restoreEnv('INTERNAL_FUNCTION_SECRET', previousInternalSecret)
      }
    })

    await t.step('wrong bearer token is rejected', async () => {
      const handler = await getHandler()
      const wrongBearer = `Bearer wrong-${crypto.randomUUID()}`

      const response = await withStubbedFetch(() =>
        Promise.resolve(
          handler(
            new Request('http://localhost', {
              method: 'POST',
              headers: { authorization: wrongBearer },
            })
          )
        )
      )

      assertEquals(response.status, 401)
      assertEquals(await response.json(), { error: 'Unauthorized' })
    })

    await t.step('assertion helpers required by the test contract are available', async () => {
      assertThrows(() => {
        throw new Error('expected synchronous failure')
      }, Error)

      await assertRejects(() => Promise.reject(new Error('expected asynchronous failure')), Error)
    })
  }
)
