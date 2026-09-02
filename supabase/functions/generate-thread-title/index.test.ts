import { assertEquals, assertNotEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts'
import { handler } from './index.ts'

async function withInternalSecret<T>(fn: () => Promise<T>): Promise<T> {
  const key = 'INTERNAL_INVOCATION_SECRET'
  const previous = Deno.env.get(key)
  Deno.env.set(key, 'test-internal-secret')
  try {
    return await fn()
  } finally {
    if (previous === undefined) Deno.env.delete(key)
    else Deno.env.set(key, previous)
  }
}

function post(body: unknown): Request {
  return new Request('http://localhost/generate-thread-title', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-internal-secret': 'test-internal-secret',
    },
    body: JSON.stringify(body),
  })
}

Deno.test('generate-thread-title rejects a payload without required fields', async () => {
  await withInternalSecret(async () => {
    const response = await handler(post({}))
    assertEquals(response.status, 400)
    assertEquals(await response.json(), {
      error: 'thread_id and subject are required',
    })
  })
})

Deno.test('generate-thread-title rejects a payload without subject', async () => {
  await withInternalSecret(async () => {
    const response = await handler(post({ thread_id: '00000000-0000-0000-0000-000000000000' }))
    assertEquals(response.status, 400)
    assertEquals(await response.json(), {
      error: 'thread_id and subject are required',
    })
  })
})

Deno.test(
  'generate-thread-title handles CORS preflight without contacting AI services',
  async () => {
    const response = await handler(
      new Request('http://localhost/generate-thread-title', {
        method: 'OPTIONS',
      })
    )
    assertEquals(response.status, 200)
    assertNotEquals(response.headers.get('Access-Control-Allow-Origin'), '*')
  }
)
