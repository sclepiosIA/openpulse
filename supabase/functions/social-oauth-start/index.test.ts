import { assertEquals, assertExists } from 'https://deno.land/std@0.224.0/assert/mod.ts'

type CapturedHandler = (req: Request) => Response | Promise<Response>

let handlerPromise: Promise<CapturedHandler> | undefined

async function withEnvAsync<T>(vars: Record<string, string>, fn: () => Promise<T>): Promise<T> {
  const previous = new Map<string, string | undefined>()

  for (const [key, value] of Object.entries(vars)) {
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

async function withRuntimeEnv<T>(vars: Record<string, string>, fn: () => Promise<T>): Promise<T> {
  return await withEnvAsync(
    {
      SUPABASE_ANON_KEY: 'anon-test-key',
      ...vars,
    },
    fn
  )
}

async function withFetchStub<T>(stub: typeof fetch, fn: () => Promise<T>): Promise<T> {
  const originalFetch = globalThis.fetch
  globalThis.fetch = stub

  try {
    return await fn()
  } finally {
    globalThis.fetch = originalFetch
  }
}

async function getHandler(): Promise<CapturedHandler> {
  if (handlerPromise) return await handlerPromise

  handlerPromise = (async () => {
    let capturedHandler: CapturedHandler | undefined
    const originalServeDescriptor = Object.getOwnPropertyDescriptor(Deno, 'serve')

    const fakeServer = {
      addr: { transport: 'tcp', hostname: '127.0.0.1', port: 0 },
      finished: Promise.resolve(),
      shutdown: () => {},
      ref: () => {},
      unref: () => {},
      [Symbol.asyncIterator]: async function* () {},
    }

    Object.defineProperty(Deno, 'serve', {
      configurable: true,
      writable: true,
      value: (...args: unknown[]) => {
        const candidate = args.find((arg) => typeof arg === 'function')
        if (typeof candidate !== 'function') {
          throw new Error('Deno.serve called without a handler')
        }
        capturedHandler = candidate as CapturedHandler
        return fakeServer
      },
    })

    try {
      await withEnvAsync(
        {
          SUPABASE_URL: 'http://supabase.test',
          SUPABASE_SERVICE_ROLE_KEY: 'service-role-test-key',
          SUPABASE_ANON_KEY: 'anon-test-key',
        },
        async () => {
          await import('./index.ts')
        }
      )
    } finally {
      if (originalServeDescriptor) {
        Object.defineProperty(Deno, 'serve', originalServeDescriptor)
      }
    }

    assertExists(capturedHandler)
    return capturedHandler
  })()

  return await handlerPromise
}

type FetchCall = {
  url: string
  pathname: string
  method: string
  body: unknown
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

async function requestBody(input: RequestInfo | URL, init?: RequestInit): Promise<unknown> {
  const raw = init?.body ?? (input instanceof Request ? await input.clone().text() : undefined)

  if (raw === undefined || raw === null || raw === '') return undefined
  if (typeof raw === 'string') return JSON.parse(raw)
  if (raw instanceof URLSearchParams) return Object.fromEntries(raw.entries())
  return raw
}

function createSupabaseFetchStub(
  options: {
    admin?: boolean
    authenticated?: boolean
    insertError?: boolean
  } = {}
): { fetch: typeof fetch; calls: FetchCall[] } {
  const calls: FetchCall[] = []

  const stub = (async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = input instanceof Request ? input.url : String(input)
    const parsedUrl = new URL(url)
    const method = init?.method ?? (input instanceof Request ? input.method : 'GET')
    const body = await requestBody(input, init)

    calls.push({
      url,
      pathname: parsedUrl.pathname,
      method,
      body,
    })

    if (parsedUrl.pathname === '/auth/v1/user') {
      if (options.authenticated === false) {
        return jsonResponse({ message: 'Invalid JWT' }, 401)
      }

      return jsonResponse({
        id: 'user-123',
        aud: 'authenticated',
        role: 'authenticated',
        email: 'admin@example.test',
      })
    }

    if (parsedUrl.pathname === '/rest/v1/rpc/is_social_admin') {
      return jsonResponse(options.admin === false ? false : true)
    }

    if (parsedUrl.pathname === '/rest/v1/social_oauth_states') {
      if (options.insertError) {
        return jsonResponse(
          {
            code: '23505',
            message: 'duplicate key value violates unique constraint',
          },
          409
        )
      }

      return jsonResponse([], 201)
    }

    return jsonResponse({ message: `Unexpected fetch call: ${method} ${parsedUrl.pathname}` }, 599)
  }) as typeof fetch

  return { fetch: stub, calls }
}

function oauthRequest(body: unknown, authorization = 'Bearer test-token'): Request {
  return new Request('http://localhost/social-oauth-start', {
    method: 'POST',
    headers: {
      authorization,
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  })
}

Deno.test('module registers a Deno.serve HTTP handler without starting a real server', async () => {
  const handler = await getHandler()
  assertExists(handler)
})

Deno.test('importing the module twice returns the cached module without throwing', async () => {
  await getHandler()
  const module = await import('./index.ts')
  assertExists(module)
})

Deno.test('OPTIONS request returns ok with CORS headers and no Supabase call', async () => {
  const handler = await getHandler()
  const { fetch, calls } = createSupabaseFetchStub()

  await withFetchStub(fetch, async () => {
    const response = await handler(
      new Request('http://localhost/social-oauth-start', {
        method: 'OPTIONS',
      })
    )

    assertEquals(response.status, 200)
    assertEquals(await response.text(), 'ok')
    assertExists(response.headers.get('Access-Control-Allow-Origin'))
    assertEquals(calls.length, 0)
  })
})

Deno.test('POST without Authorization returns 401 and does not call Supabase', async () => {
  const handler = await getHandler()
  const { fetch, calls } = createSupabaseFetchStub()

  await withRuntimeEnv({}, async () => {
    await withFetchStub(fetch, async () => {
      const response = await handler(
        new Request('http://localhost/social-oauth-start', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ brand_id: 'brand-123', platform: 'facebook' }),
        })
      )

      assertEquals(response.status, 401)
      assertEquals(response.headers.get('Content-Type'), 'application/json')
      assertEquals(await response.json(), { error: 'Unauthorized' })
      assertEquals(calls.length, 0)
    })
  })
})

Deno.test('invalid authenticated user returns 401', async () => {
  const handler = await getHandler()
  const { fetch, calls } = createSupabaseFetchStub({ authenticated: false })

  await withRuntimeEnv({}, async () => {
    await withFetchStub(fetch, async () => {
      const response = await handler(
        oauthRequest({
          brand_id: 'brand-123',
          platform: 'facebook',
        })
      )

      assertEquals(response.status, 401)
      assertEquals(await response.json(), { error: 'Unauthorized' })
      assertEquals(
        calls.map((call) => call.pathname),
        ['/auth/v1/user']
      )
    })
  })
})

Deno.test('non social admin user returns 403 before inserting OAuth state', async () => {
  const handler = await getHandler()
  const { fetch, calls } = createSupabaseFetchStub({ admin: false })

  await withRuntimeEnv({}, async () => {
    await withFetchStub(fetch, async () => {
      const response = await handler(
        oauthRequest({
          brand_id: 'brand-123',
          platform: 'facebook',
        })
      )

      assertEquals(response.status, 403)
      assertEquals(await response.json(), { error: 'Forbidden' })
      assertEquals(
        calls.map((call) => call.pathname),
        ['/auth/v1/user', '/rest/v1/rpc/is_social_admin']
      )
      assertEquals(calls[1].body, { _user_id: 'user-123' })
    })
  })
})

Deno.test('missing brand_id returns 400 and does not insert OAuth state', async () => {
  const handler = await getHandler()
  const { fetch, calls } = createSupabaseFetchStub()

  await withRuntimeEnv({}, async () => {
    await withFetchStub(fetch, async () => {
      const response = await handler(
        oauthRequest({
          brand_id: '',
          platform: 'facebook',
        })
      )

      assertEquals(response.status, 400)
      assertEquals(await response.json(), { error: 'Invalid brand_id or platform' })
      assertEquals(
        calls.map((call) => call.pathname),
        ['/auth/v1/user', '/rest/v1/rpc/is_social_admin']
      )
    })
  })
})

Deno.test('unsupported platform returns 400 and does not insert OAuth state', async () => {
  const handler = await getHandler()
  const { fetch, calls } = createSupabaseFetchStub()

  await withRuntimeEnv({}, async () => {
    await withFetchStub(fetch, async () => {
      const response = await handler(
        oauthRequest({
          brand_id: 'brand-123',
          platform: 'youtube',
        })
      )

      assertEquals(response.status, 400)
      assertEquals(await response.json(), { error: 'Invalid brand_id or platform' })
      assertEquals(
        calls.map((call) => call.pathname),
        ['/auth/v1/user', '/rest/v1/rpc/is_social_admin']
      )
    })
  })
})

Deno.test('facebook start inserts OAuth state and returns Meta authorization URL', async () => {
  const handler = await getHandler()
  const { fetch, calls } = createSupabaseFetchStub()

  await withRuntimeEnv(
    {
      META_APP_ID: 'meta-client-id',
    },
    async () => {
      await withFetchStub(fetch, async () => {
        const response = await handler(
          oauthRequest({
            brand_id: 'brand-facebook',
            platform: 'facebook',
            return_to: '/parametres/social/facebook',
          })
        )

        assertEquals(response.status, 200)

        const payload = await response.json()
        assertExists(payload.auth_url)
        assertExists(payload.state)
        assertEquals(typeof payload.state, 'string')
        assertEquals(payload.state.length, 64)
        assertEquals(/^[0-9a-f]{64}$/.test(payload.state), true)

        const authUrl = new URL(payload.auth_url)
        assertEquals(authUrl.origin, 'https://www.facebook.com')
        assertEquals(authUrl.pathname, '/v21.0/dialog/oauth')
        assertEquals(authUrl.searchParams.get('client_id'), 'meta-client-id')
        assertEquals(
          authUrl.searchParams.get('redirect_uri'),
          'http://supabase.test/functions/v1/social-oauth-callback'
        )
        assertEquals(authUrl.searchParams.get('state'), payload.state)
        assertEquals(authUrl.searchParams.get('response_type'), 'code')
        assertEquals(authUrl.searchParams.get('auth_type'), 'rerequest')
        assertEquals(
          authUrl.searchParams.get('scope'),
          'pages_show_list,pages_read_engagement,pages_manage_posts,pages_read_user_content,business_management'
        )

        assertEquals(
          calls.map((call) => call.pathname),
          ['/auth/v1/user', '/rest/v1/rpc/is_social_admin', '/rest/v1/social_oauth_states']
        )
        assertEquals(calls[2].method, 'POST')
        assertEquals(calls[2].body, {
          state: payload.state,
          brand_id: 'brand-facebook',
          platform: 'facebook',
          user_id: 'user-123',
          redirect_uri: '/parametres/social/facebook',
        })
      })
    }
  )
})

Deno.test('instagram start uses the Meta OAuth endpoint with Instagram scopes', async () => {
  const handler = await getHandler()
  const { fetch, calls } = createSupabaseFetchStub()

  await withRuntimeEnv(
    {
      META_APP_ID: 'meta-client-id',
    },
    async () => {
      await withFetchStub(fetch, async () => {
        const response = await handler(
          oauthRequest({
            brand_id: 'brand-instagram',
            platform: 'instagram',
          })
        )

        assertEquals(response.status, 200)

        const payload = await response.json()
        assertEquals(payload.state.length, 64)

        const authUrl = new URL(payload.auth_url)
        assertEquals(authUrl.origin, 'https://www.facebook.com')
        assertEquals(authUrl.pathname, '/v21.0/dialog/oauth')
        assertEquals(authUrl.searchParams.get('client_id'), 'meta-client-id')
        assertEquals(authUrl.searchParams.get('state'), payload.state)
        assertEquals(
          authUrl.searchParams.get('scope'),
          'instagram_basic,instagram_content_publish,instagram_manage_comments,instagram_manage_insights,pages_show_list,business_management'
        )

        assertEquals(
          calls.map((call) => call.pathname),
          ['/auth/v1/user', '/rest/v1/rpc/is_social_admin', '/rest/v1/social_oauth_states']
        )
        assertEquals(calls[2].body, {
          state: payload.state,
          brand_id: 'brand-instagram',
          platform: 'instagram',
          user_id: 'user-123',
          redirect_uri: '/parametres/social',
        })
      })
    }
  )
})

Deno.test(
  'linkedin start returns LinkedIn authorization URL with space-separated scopes',
  async () => {
    const handler = await getHandler()
    const { fetch, calls } = createSupabaseFetchStub()

    await withRuntimeEnv(
      {
        LINKEDIN_CLIENT_ID: 'linkedin-client-id',
      },
      async () => {
        await withFetchStub(fetch, async () => {
          const response = await handler(
            oauthRequest({
              brand_id: 'brand-linkedin',
              platform: 'linkedin',
              return_to: '/social/linkedin/done',
            })
          )

          assertEquals(response.status, 200)

          const payload = await response.json()
          assertEquals(/^[0-9a-f]{64}$/.test(payload.state), true)

          const authUrl = new URL(payload.auth_url)
          assertEquals(authUrl.origin, 'https://www.linkedin.com')
          assertEquals(authUrl.pathname, '/oauth/v2/authorization')
          assertEquals(authUrl.searchParams.get('response_type'), 'code')
          assertEquals(authUrl.searchParams.get('client_id'), 'linkedin-client-id')
          assertEquals(
            authUrl.searchParams.get('redirect_uri'),
            'http://supabase.test/functions/v1/social-oauth-callback'
          )
          assertEquals(authUrl.searchParams.get('state'), payload.state)
          assertEquals(
            authUrl.searchParams.get('scope'),
            'openid profile email w_member_social r_organization_social w_organization_social rw_organization_admin'
          )

          assertEquals(
            calls.map((call) => call.pathname),
            ['/auth/v1/user', '/rest/v1/rpc/is_social_admin', '/rest/v1/social_oauth_states']
          )
          assertEquals(calls[2].body, {
            state: payload.state,
            brand_id: 'brand-linkedin',
            platform: 'linkedin',
            user_id: 'user-123',
            redirect_uri: '/social/linkedin/done',
          })
        })
      }
    )
  }
)

Deno.test('tiktok start returns TikTok authorization URL with comma-separated scopes', async () => {
  const handler = await getHandler()
  const { fetch, calls } = createSupabaseFetchStub()

  await withRuntimeEnv(
    {
      TIKTOK_CLIENT_KEY: 'tiktok-client-key',
    },
    async () => {
      await withFetchStub(fetch, async () => {
        const response = await handler(
          oauthRequest({
            brand_id: 'brand-tiktok',
            platform: 'tiktok',
            return_to: '/social/tiktok/done',
          })
        )

        assertEquals(response.status, 200)

        const payload = await response.json()
        assertEquals(payload.state.length, 64)

        const authUrl = new URL(payload.auth_url)
        assertEquals(authUrl.origin, 'https://www.tiktok.com')
        assertEquals(authUrl.pathname, '/v2/auth/authorize/')
        assertEquals(authUrl.searchParams.get('client_key'), 'tiktok-client-key')
        assertEquals(
          authUrl.searchParams.get('redirect_uri'),
          'http://supabase.test/functions/v1/social-oauth-callback'
        )
        assertEquals(authUrl.searchParams.get('state'), payload.state)
        assertEquals(authUrl.searchParams.get('response_type'), 'code')
        assertEquals(
          authUrl.searchParams.get('scope'),
          'user.info.basic,user.info.profile,user.info.stats,video.list,video.publish,video.upload'
        )

        assertEquals(
          calls.map((call) => call.pathname),
          ['/auth/v1/user', '/rest/v1/rpc/is_social_admin', '/rest/v1/social_oauth_states']
        )
        assertEquals(calls[2].body, {
          state: payload.state,
          brand_id: 'brand-tiktok',
          platform: 'tiktok',
          user_id: 'user-123',
          redirect_uri: '/social/tiktok/done',
        })
      })
    }
  )
})
