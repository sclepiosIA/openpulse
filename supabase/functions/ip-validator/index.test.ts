import { assertEquals, assertExists } from 'https://deno.land/std@0.224.0/assert/mod.ts'
import { importEdgeModuleOffline } from '../_shared/module-load-test-harness.ts'
import { _resetRateLimitBucketsForTests } from '../_shared/rate-limit.ts'

type Handler = (req: Request) => Response | Promise<Response>

let moduleImportPromise: Promise<Record<string, unknown>> | undefined

async function getHandler(): Promise<Handler> {
  if (!moduleImportPromise) {
    moduleImportPromise = importEdgeModuleOffline(new URL('./index.ts', import.meta.url)).then(
      ({ module, stats }) => {
        assertEquals(stats.listenCalls, 0)
        assertEquals(stats.serveHttpCalls, 0)
        assertEquals(stats.serveCalls, 1)
        assertEquals(stats.fetchCalls, 0)
        return module
      }
    )
  }

  const module = await moduleImportPromise
  const handler = module.handler
  assertEquals(typeof handler, 'function')
  _resetRateLimitBucketsForTests()
  return handler as Handler
}

async function withEnv<T>(
  vars: Record<string, string | undefined>,
  fn: () => Promise<T> | T
): Promise<T> {
  const previous = new Map<string, string | undefined>()

  for (const key of Object.keys(vars)) {
    previous.set(key, Deno.env.get(key))
  }

  try {
    for (const [key, value] of Object.entries(vars)) {
      if (value === undefined) {
        Deno.env.delete(key)
      } else {
        Deno.env.set(key, value)
      }
    }

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
  headers: Headers
  bodyText: string | null
}

type SupabaseScenario = {
  whitelistEnabled: boolean
  authorizedIps?: string[]
  configError?: boolean
  authorizedIpsError?: boolean
}

async function bodyToText(body: BodyInit | null | undefined): Promise<string | null> {
  if (body == null) return null
  if (typeof body === 'string') return body
  if (body instanceof URLSearchParams) return body.toString()
  if (body instanceof Blob) return await body.text()
  if (body instanceof Uint8Array) return new TextDecoder().decode(body)
  return String(body)
}

async function withMockedSupabaseFetch<T>(
  scenario: SupabaseScenario,
  fn: (calls: FetchCall[]) => Promise<T> | T
): Promise<T> {
  const originalFetch = globalThis.fetch
  const calls: FetchCall[] = []

  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url =
      input instanceof Request ? input.url : input instanceof URL ? input.toString() : String(input)

    const method = init?.method ?? (input instanceof Request ? input.method : 'GET')
    const headers = new Headers(
      init?.headers ?? (input instanceof Request ? input.headers : undefined)
    )
    const bodyText =
      init?.body !== undefined
        ? await bodyToText(init.body)
        : input instanceof Request
          ? await input.clone().text()
          : null

    calls.push({ url, method, headers, bodyText })

    if (url.includes('/rest/v1/security_config')) {
      if (scenario.configError) {
        return new Response(
          JSON.stringify({
            code: 'CONFIG_ERROR',
            message: 'failed to read security configuration',
          }),
          {
            status: 500,
            headers: { 'content-type': 'application/json' },
          }
        )
      }

      return new Response(JSON.stringify({ ip_whitelist_enabled: scenario.whitelistEnabled }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }

    if (url.includes('/rest/v1/authorized_ips')) {
      if (scenario.authorizedIpsError) {
        return new Response(
          JSON.stringify({
            code: 'AUTHORIZED_IPS_ERROR',
            message: 'failed to read authorized IPs',
          }),
          {
            status: 500,
            headers: { 'content-type': 'application/json' },
          }
        )
      }

      return new Response(
        JSON.stringify((scenario.authorizedIps ?? []).map((ip) => ({ ip_address: ip }))),
        {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }
      )
    }

    if (url.includes('/rest/v1/rpc/log_unauthorized_access')) {
      return new Response(JSON.stringify({ logged: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }

    throw new Error(`Unexpected fetch call: ${method} ${url}`)
  }

  try {
    return await fn(calls)
  } finally {
    globalThis.fetch = originalFetch
  }
}

async function withUnexpectedFetchGuard<T>(fn: () => Promise<T> | T): Promise<T> {
  const originalFetch = globalThis.fetch

  globalThis.fetch = async (): Promise<Response> => {
    throw new Error('fetch should not have been called')
  }

  try {
    return await fn()
  } finally {
    globalThis.fetch = originalFetch
  }
}

async function readJson(response: Response): Promise<Record<string, unknown>> {
  return await response.json()
}

const validEnv = {
  SUPABASE_URL: 'http://supabase.test',
  SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
  IP_VALIDATOR_SECRET: 'test-validator-secret',
}

Deno.test('module loads and registers an HTTP handler', async () => {
  const handler = await getHandler()
  assertExists(handler)
  assertEquals(typeof handler, 'function')
})

Deno.test('OPTIONS preflight returns CORS headers without database access', async () => {
  const handler = await getHandler()

  await withUnexpectedFetchGuard(async () => {
    const response = await handler(
      new Request('http://localhost/ip-validator', { method: 'OPTIONS' })
    )

    assertEquals(response.status, 200)
    assertEquals(
      response.headers.get('Access-Control-Allow-Origin'),
      'https://gestion-marque-ia.apercu.example.org'
    )
    // Cette fonction ne passe PAS par le socle partage : son objet CORS local
    // porte ses propres en-tetes (x-forwarded-for, cf-connecting-ip,
    // x-validator-secret) et elle ne lit jamais x-internal-secret. La liste
    // attendue est donc celle d'index.ts, sans le suffixe ajoute par la regle
    // cors-bancs-liste-en-tetes-partagee.
    assertEquals(
      response.headers.get('Access-Control-Allow-Headers'),
      'authorization, x-client-info, apikey, content-type, x-forwarded-for, cf-connecting-ip, x-validator-secret'
    )
    assertEquals(await response.text(), '')
  })
})

Deno.test('invalid client IP is rejected with 400 before querying Supabase', async () => {
  const handler = await getHandler()

  await withEnv(validEnv, async () => {
    await withUnexpectedFetchGuard(async () => {
      const response = await handler(
        new Request('http://localhost/ip-validator', {
          method: 'POST',
          headers: {
            'cf-connecting-ip': 'not-an-ip',
            'user-agent': 'deno-test',
          },
        })
      )

      const body = await readJson(response)

      assertEquals(response.status, 400)
      assertEquals(body.authorized, false)
      assertEquals(body.error, 'Invalid IP address format')
      assertEquals(response.headers.get('Content-Type'), 'application/json')
    })
  })
})

Deno.test('when whitelist is disabled, a valid IP is authorized without secret', async () => {
  const handler = await getHandler()

  await withEnv(validEnv, async () => {
    await withMockedSupabaseFetch({ whitelistEnabled: false }, async (calls) => {
      const response = await handler(
        new Request('http://localhost/ip-validator', {
          method: 'POST',
          headers: {
            'x-forwarded-for': '203.0.113.10, 198.51.100.20',
            'user-agent': 'deno-test',
          },
        })
      )

      const body = await readJson(response)

      assertEquals(response.status, 200)
      assertEquals(body.authorized, true)
      assertEquals(body.message, 'Accès autorisé (filtrage IP désactivé)')
      assertEquals(body.whitelist_enabled, false)
      assertEquals(calls.length, 1)
      assertEquals(calls[0].url.includes('/rest/v1/security_config'), true)
    })
  })
})

Deno.test(
  'when whitelist is enabled, missing validator secret is rejected before authorized IP lookup',
  async () => {
    const handler = await getHandler()

    await withEnv(validEnv, async () => {
      await withMockedSupabaseFetch(
        { whitelistEnabled: true, authorizedIps: ['203.0.113.10'] },
        async (calls) => {
          const response = await handler(
            new Request('http://localhost/ip-validator', {
              method: 'POST',
              headers: {
                'x-real-ip': '203.0.113.10',
                'user-agent': 'deno-test',
              },
            })
          )

          const body = await readJson(response)

          assertEquals(response.status, 401)
          assertEquals(body.authorized, false)
          assertEquals(body.error, 'Unauthorized - invalid secret')
          assertEquals(calls.length, 1)
          assertEquals(calls[0].url.includes('/rest/v1/security_config'), true)
        }
      )
    })
  }
)

Deno.test('when whitelist is enabled, invalid validator secret is rejected', async () => {
  const handler = await getHandler()

  await withEnv(validEnv, async () => {
    await withMockedSupabaseFetch(
      { whitelistEnabled: true, authorizedIps: ['203.0.113.10'] },
      async () => {
        const response = await handler(
          new Request('http://localhost/ip-validator', {
            method: 'POST',
            headers: {
              'cf-connecting-ip': '203.0.113.10',
              'x-validator-secret': 'wrong-secret',
              'user-agent': 'deno-test',
            },
          })
        )

        const body = await readJson(response)

        assertEquals(response.status, 401)
        assertEquals(body.authorized, false)
        assertEquals(body.error, 'Unauthorized - invalid secret')
      }
    )
  })
})

Deno.test('authorized whitelisted IP returns successful response', async () => {
  const handler = await getHandler()
  const clientIp = '203.0.113.42'

  await withEnv(validEnv, async () => {
    await withMockedSupabaseFetch(
      { whitelistEnabled: true, authorizedIps: [clientIp] },
      async (calls) => {
        const response = await handler(
          new Request('http://localhost/ip-validator', {
            method: 'POST',
            headers: {
              'cf-connecting-ip': clientIp,
              'x-validator-secret': 'test-validator-secret',
              'user-agent': 'deno-test',
            },
          })
        )

        const body = await readJson(response)

        assertEquals(response.status, 200)
        assertEquals(body.authorized, true)
        assertEquals(body.message, 'Accès autorisé')
        assertEquals(body.whitelist_enabled, true)
        assertEquals(calls.length, 2)
        assertEquals(calls[0].url.includes('/rest/v1/security_config'), true)
        assertEquals(calls[1].url.includes('/rest/v1/authorized_ips'), true)
        assertEquals(decodeURIComponent(calls[1].url).includes(`ip_address=eq.${clientIp}`), true)
      }
    )
  })
})

Deno.test(
  'non-whitelisted IP is blocked and unauthorized attempt is logged with sanitized metadata',
  async () => {
    const handler = await getHandler()
    const clientIp = '198.51.100.77'
    const longUserAgent = 'A'.repeat(600)
    const longPath = 'p'.repeat(2100)

    await withEnv(validEnv, async () => {
      await withMockedSupabaseFetch(
        { whitelistEnabled: true, authorizedIps: [] },
        async (calls) => {
          const response = await handler(
            new Request(`http://localhost/${longPath}`, {
              method: 'POST',
              headers: {
                'x-forwarded-for': `${clientIp}, 203.0.113.10`,
                'x-validator-secret': 'test-validator-secret',
                'user-agent': longUserAgent,
              },
            })
          )

          const body = await readJson(response)
          const rpcCall = calls.find((call) =>
            call.url.includes('/rest/v1/rpc/log_unauthorized_access')
          )

          assertEquals(response.status, 403)
          assertEquals(body.authorized, false)
          assertEquals(body.message, 'Accès non autorisé')
          assertExists(rpcCall)
          assertEquals(rpcCall.method, 'POST')

          const rpcPayload = JSON.parse(rpcCall.bodyText ?? '{}')

          assertEquals(rpcPayload.client_ip, clientIp)
          assertEquals(rpcPayload.user_agent.length, 512)
          assertEquals(rpcPayload.user_agent, 'A'.repeat(512))
          assertEquals(rpcPayload.path.length, 2048)
          assertEquals(rpcPayload.path.startsWith('http://localhost/'), true)
        }
      )
    })
  }
)

Deno.test('configuration database error returns sanitized 500 response', async () => {
  const handler = await getHandler()

  await withEnv(validEnv, async () => {
    await withMockedSupabaseFetch({ whitelistEnabled: true, configError: true }, async () => {
      const response = await handler(
        new Request('http://localhost/ip-validator', {
          method: 'POST',
          headers: {
            'cf-connecting-ip': '203.0.113.15',
            'x-validator-secret': 'test-validator-secret',
          },
        })
      )

      const body = await readJson(response)

      assertEquals(response.status, 500)
      assertEquals(body.authorized, false)
      assertEquals(body.error, 'Configuration error')
    })
  })
})

Deno.test('authorized IP lookup database error returns 500 response', async () => {
  const handler = await getHandler()

  await withEnv(validEnv, async () => {
    await withMockedSupabaseFetch(
      { whitelistEnabled: true, authorizedIpsError: true },
      async () => {
        const response = await handler(
          new Request('http://localhost/ip-validator', {
            method: 'POST',
            headers: {
              'cf-connecting-ip': '203.0.113.16',
              'x-validator-secret': 'test-validator-secret',
            },
          })
        )

        const body = await readJson(response)

        assertEquals(response.status, 500)
        assertEquals(body.authorized, false)
        assertEquals(body.error, 'Database validation error')
      }
    )
  })
})
