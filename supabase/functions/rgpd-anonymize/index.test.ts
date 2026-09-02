import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts'
import { handler } from './index.ts'

Deno.test('rgpd-anonymize returns configured CORS headers for an allowed origin', async () => {
  const origin = 'https://gestion.exploitant.example.org'
  const response = await withEnv({ OPENPULSE_ORIGINES_AUTORISEES: origin }, () =>
    handler(
      new Request('http://localhost/rgpd-anonymize', {
        method: 'OPTIONS',
        headers: { origin },
      })
    )
  )

  assertEquals(response.status, 200)
  assertEquals(response.headers.get('Access-Control-Allow-Origin'), origin)
  assertEquals(
    response.headers.get('Access-Control-Allow-Methods'),
    'GET, POST, PUT, PATCH, DELETE, OPTIONS'
  )
})

Deno.test('rgpd-anonymize rejects unauthenticated requests before accessing Supabase', async () => {
  const response = await handler(
    new Request('http://localhost/rgpd-anonymize', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ personEmail: 'person@example.invalid' }),
    })
  )

  assertEquals(response.status, 401)
  assertEquals(await response.json(), { error: 'Authentication required' })
})

async function withEnv<T>(values: Record<string, string>, fn: () => Promise<T>): Promise<T> {
  const previous = new Map(Object.keys(values).map((key) => [key, Deno.env.get(key)]))
  for (const [key, value] of Object.entries(values)) Deno.env.set(key, value)
  try {
    return await fn()
  } finally {
    for (const [key, value] of previous) {
      if (value === undefined) Deno.env.delete(key)
      else Deno.env.set(key, value)
    }
  }
}

Deno.test('rgpd-anonymize rejects malformed bearer tokens without modifying data', async () => {
  const originalFetch = globalThis.fetch
  await withEnv(
    {
      SUPABASE_URL: 'http://supabase.test',
      SUPABASE_ANON_KEY: 'test-anon-key',
    },
    async () => {
      globalThis.fetch = () =>
        Promise.resolve(
          new Response(JSON.stringify({ message: 'invalid JWT' }), {
            status: 401,
            headers: { 'content-type': 'application/json' },
          })
        )
      try {
        const response = await handler(
          new Request('http://localhost/rgpd-anonymize', {
            method: 'POST',
            headers: {
              'content-type': 'application/json',
              authorization: 'Bearer malformed.token',
            },
            body: JSON.stringify({ personEmail: 'person@example.invalid' }),
          })
        )

        assertEquals(response.status, 401)
        assertEquals(await response.json(), { error: 'Invalid token' })
      } finally {
        globalThis.fetch = originalFetch
      }
    }
  )
})
