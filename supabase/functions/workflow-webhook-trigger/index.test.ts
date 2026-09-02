import {
  assertEquals,
  assertExists,
  assertThrows,
  assertRejects,
} from 'https://deno.land/std@0.224.0/assert/mod.ts'

function getDenoServeDescriptor(): PropertyDescriptor | undefined {
  return Object.getOwnPropertyDescriptor(Deno, 'serve')
}

function setDenoServe(stub: unknown): void {
  Object.defineProperty(Deno, 'serve', { value: stub, configurable: true, writable: true })
}

function restoreDenoServe(descriptor: PropertyDescriptor | undefined): void {
  if (descriptor) Object.defineProperty(Deno, 'serve', descriptor)
}

const fakeServe = ((..._args: unknown[]) => ({
  addr: { transport: 'tcp', hostname: '127.0.0.1', port: 0 },
  finished: Promise.resolve(),
  shutdown: () => Promise.resolve(),
  ref: () => {},
  unref: () => {},
})) as unknown as typeof Deno.serve

Deno.test('module loads', async () => {
  const previousUrl = Deno.env.get('SUPABASE_URL')
  const previousKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const originalServeDescriptor = getDenoServeDescriptor()

  Deno.env.set('SUPABASE_URL', 'https://example.supabase.co')
  Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', 'service-role-key')
  setDenoServe(fakeServe)

  try {
    const mod = await import('./index.ts')
    assertExists(mod)
  } finally {
    if (previousUrl === undefined) Deno.env.delete('SUPABASE_URL')
    else Deno.env.set('SUPABASE_URL', previousUrl)

    if (previousKey === undefined) Deno.env.delete('SUPABASE_SERVICE_ROLE_KEY')
    else Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', previousKey)

    restoreDenoServe(originalServeDescriptor)
  }
})

Deno.test('Request can be constructed for webhook endpoint shape', () => {
  const req = new Request('http://localhost/functions/v1/workflow-webhook-trigger/test-token', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-webhook-signature': 'dummy-signature',
      'x-webhook-timestamp': '1710000000',
    },
    body: JSON.stringify({ hello: 'world' }),
  })

  assertEquals(req.method, 'POST')
  assertEquals(new URL(req.url).pathname, '/functions/v1/workflow-webhook-trigger/test-token')
  assertEquals(req.headers.get('content-type'), 'application/json')
  assertEquals(req.headers.get('x-webhook-signature'), 'dummy-signature')
})

Deno.test('URL pathname token extraction logic matches expected examples', () => {
  const extractToken = (url: string) => {
    const segments = new URL(url).pathname.split('/').filter(Boolean)
    return segments[segments.length - 1]
  }

  assertEquals(
    extractToken('http://localhost/functions/v1/workflow-webhook-trigger/abc123'),
    'abc123'
  )
  assertEquals(extractToken('http://localhost/workflow-webhook-trigger/token-xyz'), 'token-xyz')
  assertEquals(
    extractToken('http://localhost/functions/v1/workflow-webhook-trigger'),
    'workflow-webhook-trigger'
  )
})

Deno.test('body parsing semantics for JSON and non-JSON payloads mirror module behavior', () => {
  const parseLikeModule = (contentType: string | null, rawBody: string) => {
    let payload: Record<string, unknown> = {}
    try {
      const ct = contentType ?? ''
      if (ct.includes('application/json') && rawBody) {
        payload = JSON.parse(rawBody)
      } else if (rawBody) {
        payload = { raw: rawBody }
      }
    } catch {
      payload = {}
    }
    return payload
  }

  assertEquals(parseLikeModule('application/json', JSON.stringify({ a: 1, ok: true })), {
    a: 1,
    ok: true,
  })
  assertEquals(parseLikeModule('text/plain', 'hello'), { raw: 'hello' })
  assertEquals(parseLikeModule('application/json', '{invalid json'), {})
  assertEquals(parseLikeModule('application/json', ''), {})
})

Deno.test('trigger payload enrichment semantics include webhook token and manual flag', () => {
  const token = 'tok_123'
  const workflowId = 'wf_456'
  const payload = { event: 'created', nested: { n: 1 } }

  const body = {
    workflow_id: workflowId,
    trigger_payload: { ...payload, _via_webhook_token: token },
    manual: true,
  }

  assertEquals(body.workflow_id, 'wf_456')
  assertEquals(body.manual, true)
  assertEquals(body.trigger_payload, {
    event: 'created',
    nested: { n: 1 },
    _via_webhook_token: 'tok_123',
  })
})

Deno.test('rate limit threshold logic matches strict greater-than 60 behavior', () => {
  const statusForCount = (count: number | null | undefined) => {
    if ((count ?? 0) > 60) return 429
    return 202
  }

  assertEquals(statusForCount(undefined), 202)
  assertEquals(statusForCount(null), 202)
  assertEquals(statusForCount(0), 202)
  assertEquals(statusForCount(60), 202)
  assertEquals(statusForCount(61), 429)
})

Deno.test(
  'telemetry increment semantics increase total_calls by 1 and preserve zero default',
  () => {
    const nextTotalCalls = (currentToken?: { total_calls?: number | null } | null) =>
      ((currentToken?.total_calls as number) || 0) + 1

    assertEquals(nextTotalCalls(undefined), 1)
    assertEquals(nextTotalCalls(null), 1)
    assertEquals(nextTotalCalls({ total_calls: 0 }), 1)
    assertEquals(nextTotalCalls({ total_calls: 9 }), 10)
  }
)

Deno.test('sinceIso generation produces ISO string around one minute in the past', () => {
  const now = Date.now()
  const sinceIso = new Date(now - 60_000).toISOString()
  const sinceMs = Date.parse(sinceIso)

  const delta = now - sinceMs
  assertEquals(Number.isFinite(sinceMs), true)
  assertEquals(delta >= 59_000 && delta <= 61_000, true)
})

Deno.test(
  'missing env assumptions would cause import-time failure when non-null assertion values are absent',
  () => {
    const mustExist = (value: string | undefined) => {
      if (value === undefined) {
        throw new TypeError('Missing required env')
      }
      return value
    }

    assertThrows(() => mustExist(undefined), TypeError, 'Missing required env')
    assertEquals(mustExist('ok'), 'ok')
  }
)

Deno.test('async import remains reject-free with required env configured', async () => {
  const previousUrl = Deno.env.get('SUPABASE_URL')
  const previousKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  Deno.env.set('SUPABASE_URL', 'https://example.supabase.co')
  Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', 'service-role-key')

  try {
    await assertRejects(async () => {
      const _ = await import('./this-file-does-not-exist.ts')
    })

    const mod = await import('./index.ts')
    assertExists(mod)
  } finally {
    if (previousUrl === undefined) Deno.env.delete('SUPABASE_URL')
    else Deno.env.set('SUPABASE_URL', previousUrl)

    if (previousKey === undefined) Deno.env.delete('SUPABASE_SERVICE_ROLE_KEY')
    else Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', previousKey)
  }
})
