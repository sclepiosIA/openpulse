import { assertEquals, assertExists, assertNotEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts'
import { handler } from './index.ts'
import { _resetRateLimitBucketsForTests } from '../_shared/rate-limit.ts'

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

Deno.test('send-booking-reminder returns CORS headers directly', async () => {
  const response = await handler(
    new Request('http://localhost/send-booking-reminder', {
      method: 'OPTIONS',
    })
  )
  assertEquals(response.status, 200)
  assertNotEquals(response.headers.get('Access-Control-Allow-Origin'), '*')
  assertEquals(
    response.headers.get('Access-Control-Allow-Headers'),
    'authorization, x-client-info, apikey, content-type, x-internal-secret'
  )
})

Deno.test('send-booking-reminder completes an empty 24h run without calling Resend', async () => {
  _resetRateLimitBucketsForTests()
  const originalFetch = globalThis.fetch
  const calls: string[] = []

  await withEnv(
    {
      SUPABASE_URL: 'http://supabase.test',
      SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
      RESEND_API_KEY: 'test-resend-key',
    },
    async () => {
      globalThis.fetch = (input: RequestInfo | URL) => {
        const url = input instanceof Request ? input.url : String(input)
        calls.push(url)
        if (url.includes('/rest/v1/bookings')) {
          return Promise.resolve(
            new Response(JSON.stringify([]), {
              status: 200,
              headers: {
                'content-type': 'application/json',
                'content-range': '0-0/0',
              },
            })
          )
        }
        throw new Error(`Unexpected network request: ${url}`)
      }

      try {
        const response = await handler(
          new Request('http://localhost/send-booking-reminder', {
            method: 'POST',
            headers: {
              'content-type': 'application/json',
              'x-forwarded-for': '198.51.100.10',
            },
            body: JSON.stringify({ reminderType: '24h' }),
          })
        )

        assertEquals(response.status, 200)
        assertEquals(await response.json(), {
          success: true,
          reminderType: '24h',
          processedCount: 0,
          results: [],
        })
        const bookingRequest = calls.find((url) => url.includes('/rest/v1/bookings'))
        assertExists(bookingRequest)
        assertEquals(bookingRequest.includes('status=eq.confirmed'), true)
        assertEquals(bookingRequest.includes('reminder_sent_24h=eq.false'), true)
        assertEquals(
          calls.some((url) => url.includes('api.resend.com')),
          false
        )
      } finally {
        globalThis.fetch = originalFetch
      }
    }
  )
})
