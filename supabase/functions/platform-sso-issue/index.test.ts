import { assertEquals, assertRejects } from 'https://deno.land/std@0.224.0/assert/mod.ts'
import { createPlatformSsoIssueHandler, type PlatformSsoIssueDeps } from './index.ts'

const VALID_ETABLISSEMENT_ID = '123e4567-e89b-12d3-a456-426614174000'

type State = {
  etab: { id: string; statut: string } | null
  issueResult: { token: string; exp: number }
  issueError?: Error
  issuePayloads: unknown[]
  queries: unknown[]
}

function buildRequest(method: string, body?: unknown): Request {
  const init: RequestInit = {
    method,
    headers: { 'content-type': 'application/json' },
  }
  if (body !== undefined) {
    init.body = typeof body === 'string' ? body : JSON.stringify(body)
  }
  return new Request('http://localhost/platform-sso-issue', init)
}

function makeHandler(
  stateOverrides: Partial<State> = {},
  scope = 'platform:site_web',
  productApiUrl?: string
): { handler: (req: Request) => Promise<Response>; state: State } {
  const state: State = {
    etab: { id: VALID_ETABLISSEMENT_ID, statut: 'production' },
    issueResult: { token: 'stub.jwt.token', exp: 1710000000 },
    issuePayloads: [],
    queries: [],
    ...stateOverrides,
  }
  const deps: PlatformSsoIssueDeps = {
    withApiKey: async (_req, next) => await next({ api_key_id: 'test-key', scope }),
    errorResponse: (message, status, code) =>
      Response.json({ error: { message, code } }, { status }),
    jsonResponse: (body) => Response.json(body),
    serviceClient: () => ({
      from(table: string) {
        const query = {
          table,
          select: undefined as string | undefined,
          eq: [] as [string, string][],
        }
        state.queries.push(query)
        return {
          select(columns: string) {
            query.select = columns
            return this
          },
          eq(column: string, value: string) {
            query.eq.push([column, value])
            return this
          },
          maybeSingle: () => Promise.resolve({ data: state.etab, error: null }),
        }
      },
    }),
    issueSsoJwt: (payload) => {
      state.issuePayloads.push(payload)
      if (state.issueError) return Promise.reject(state.issueError)
      return Promise.resolve(state.issueResult)
    },
    getProductApiUrl: () => productApiUrl,
  }
  return { handler: createPlatformSsoIssueHandler(deps), state }
}

async function body(response: Response): Promise<Record<string, unknown>> {
  return await response.json()
}

Deno.test(
  'platform-sso-issue validates requests and issues scoped SSO tokens without global mocks',
  async (t) => {
    await t.step('rejects non-POST methods before database or JWT work', async () => {
      const { handler, state } = makeHandler()
      const response = await handler(buildRequest('GET'))
      assertEquals(response.status, 405)
      assertEquals(await body(response), {
        error: { message: 'Method not allowed', code: 'method' },
      })
      assertEquals(state.queries, [])
      assertEquals(state.issuePayloads, [])
    })

    await t.step('rejects callers without the exact site_web scope', async () => {
      const { handler, state } = makeHandler({}, 'platform:billing')
      const response = await handler(
        buildRequest('POST', {
          etablissement_id: VALID_ETABLISSEMENT_ID,
          user_email: 'user@example.test',
        })
      )
      assertEquals(response.status, 403)
      assertEquals(await body(response), {
        error: {
          message: 'Forbidden — site_web scope required',
          code: 'forbidden_scope',
        },
      })
      assertEquals(state.queries, [])
      assertEquals(state.issuePayloads, [])
    })

    await t.step('rejects invalid JSON', async () => {
      const { handler, state } = makeHandler()
      const response = await handler(buildRequest('POST', '{not-json'))
      assertEquals(response.status, 400)
      assertEquals(await body(response), {
        error: { message: 'Invalid JSON', code: 'invalid_body' },
      })
      assertEquals(state.queries, [])
      assertEquals(state.issuePayloads, [])
    })

    await t.step('rejects invalid etablissement_id', async () => {
      const { handler, state } = makeHandler()
      const response = await handler(
        buildRequest('POST', {
          etablissement_id: 'not-a-uuid',
          user_email: 'user@example.test',
        })
      )
      assertEquals(response.status, 400)
      assertEquals(await body(response), {
        error: { message: 'Invalid etablissement_id', code: 'invalid_param' },
      })
      assertEquals(state.queries, [])
      assertEquals(state.issuePayloads, [])
    })

    await t.step('rejects invalid user_email', async () => {
      const { handler, state } = makeHandler()
      const response = await handler(
        buildRequest('POST', {
          etablissement_id: VALID_ETABLISSEMENT_ID,
          user_email: 'not-an-email',
        })
      )
      assertEquals(response.status, 400)
      assertEquals(await body(response), {
        error: { message: 'Invalid user_email', code: 'invalid_param' },
      })
      assertEquals(state.queries, [])
      assertEquals(state.issuePayloads, [])
    })

    await t.step('returns not found for an absent etablissement', async () => {
      const { handler, state } = makeHandler({ etab: null })
      const response = await handler(
        buildRequest('POST', {
          etablissement_id: VALID_ETABLISSEMENT_ID,
          user_email: 'user@example.test',
        })
      )
      assertEquals(response.status, 404)
      assertEquals(await body(response), {
        error: { message: 'Etablissement not found', code: 'not_found' },
      })
      assertEquals(state.queries, [
        {
          table: 'etablissements',
          select: 'id, statut',
          eq: [['id', VALID_ETABLISSEMENT_ID]],
        },
      ])
      assertEquals(state.issuePayloads, [])
    })

    await t.step('refuses etablissement not in production', async () => {
      const { handler, state } = makeHandler({
        etab: { id: VALID_ETABLISSEMENT_ID, statut: 'draft' },
      })
      const response = await handler(
        buildRequest('POST', {
          etablissement_id: VALID_ETABLISSEMENT_ID,
          user_email: 'user@example.test',
        })
      )
      assertEquals(response.status, 422)
      assertEquals(await body(response), {
        error: {
          message: 'Etablissement not in production',
          code: 'not_in_production',
        },
      })
      assertEquals(state.issuePayloads, [])
    })

    await t.step('trims product URL and URL-encodes the issued token', async () => {
      const { handler, state } = makeHandler(
        { issueResult: { token: 'tok+/= value', exp: 1710000000 } },
        'platform:site_web',
        'https://product.example.test/'
      )
      const response = await handler(
        buildRequest('POST', {
          etablissement_id: VALID_ETABLISSEMENT_ID,
          user_email: 'owner@example.test',
          target_path: '/dashboard?tab=sso',
        })
      )
      assertEquals(response.status, 200)
      assertEquals(await body(response), {
        token: 'tok+/= value',
        url: 'https://product.example.test/v1/product/sso/exchange?token=tok%2B%2F%3D%20value',
        expires_at: '2024-03-09T16:00:00.000Z',
      })
      assertEquals(state.issuePayloads, [
        {
          etablissement_id: VALID_ETABLISSEMENT_ID,
          user_email: 'owner@example.test',
          target_path: '/dashboard?tab=sso',
        },
      ])
    })

    await t.step('uses safe defaults for target_path and product URL', async () => {
      const { handler, state } = makeHandler({
        issueResult: { token: 'default-token', exp: 1710000060 },
      })
      const response = await handler(
        buildRequest('POST', {
          etablissement_id: VALID_ETABLISSEMENT_ID,
          user_email: 'member@example.test',
        })
      )
      assertEquals(response.status, 200)
      assertEquals(await body(response), {
        token: 'default-token',
        url: 'https://produit.exploitant.example.org/v1/product/sso/exchange?token=default-token',
        expires_at: '2024-03-09T16:01:00.000Z',
      })
      assertEquals(state.issuePayloads, [
        {
          etablissement_id: VALID_ETABLISSEMENT_ID,
          user_email: 'member@example.test',
          target_path: '/',
        },
      ])
    })

    await t.step('does not hide JWT issuer failures', async () => {
      const { handler, state } = makeHandler({
        issueError: new Error('issuer boom'),
      })
      await assertRejects(
        () =>
          handler(
            buildRequest('POST', {
              etablissement_id: VALID_ETABLISSEMENT_ID,
              user_email: 'member@example.test',
            })
          ),
        Error,
        'issuer boom'
      )
      assertEquals(state.issuePayloads, [
        {
          etablissement_id: VALID_ETABLISSEMENT_ID,
          user_email: 'member@example.test',
          target_path: '/',
        },
      ])
    })
  }
)
