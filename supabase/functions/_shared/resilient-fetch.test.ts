import {
  assertEquals,
  assertExists,
  assertThrows,
  assertRejects,
} from 'https://deno.land/std@0.224.0/assert/mod.ts'
import {
  RETRY_CONFIGS,
  resilientFetch,
  executeWithFallback,
  resilientAzureCall,
  withRetry,
} from './resilient-fetch.ts'

Deno.test('RETRY_CONFIGS exposes expected endpoint presets', () => {
  assertExists(RETRY_CONFIGS['azure-openai'])
  assertExists(RETRY_CONFIGS['database'])
  assertExists(RETRY_CONFIGS['external-api'])
  assertExists(RETRY_CONFIGS['email'])

  assertEquals(RETRY_CONFIGS['azure-openai'].maxRetries, 3)
  assertEquals(RETRY_CONFIGS['azure-openai'].baseDelayMs, 1000)
  assertEquals(RETRY_CONFIGS['azure-openai'].timeoutMs, 90000)

  assertEquals(RETRY_CONFIGS['database'].maxRetries, 2)
  assertEquals(RETRY_CONFIGS['database'].baseDelayMs, 500)
  assertEquals(RETRY_CONFIGS['database'].retryableStatuses, [500, 503])

  assertEquals(RETRY_CONFIGS['external-api'].retryableStatuses, [429, 500, 502, 503, 504])
  assertEquals(RETRY_CONFIGS['email'].timeoutMs, 60000)
})

Deno.test('resilientFetch returns parsed data on first successful response', async () => {
  const originalFetch = globalThis.fetch
  let calls = 0

  try {
    globalThis.fetch = async (_input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      calls++
      assertEquals(init?.method, 'GET')
      return new Response(JSON.stringify({ ok: true, value: 42 }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }

    const result = await resilientFetch<{ ok: boolean; value: number }>(
      'http://localhost/test',
      { method: 'GET' },
      { maxRetries: 0, timeoutMs: 50, jitterMs: 0, baseDelayMs: 0 },
      async (response) => await response.json()
    )

    assertEquals(calls, 1)
    assertEquals(result.success, true)
    assertEquals(result.attempts, 1)
    assertExists(result.data)
    assertEquals(result.data, { ok: true, value: 42 })
  } finally {
    globalThis.fetch = originalFetch
  }
})

Deno.test('resilientFetch retries retryable HTTP statuses then succeeds', async () => {
  const originalFetch = globalThis.fetch
  let calls = 0

  try {
    globalThis.fetch = async (): Promise<Response> => {
      calls++
      if (calls < 3) {
        return new Response('temporary failure', { status: 503 })
      }
      return new Response(JSON.stringify({ final: 'ok' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }

    const result = await resilientFetch<{ final: string }>(
      'http://localhost/retry',
      undefined,
      {
        maxRetries: 3,
        baseDelayMs: 0,
        jitterMs: 0,
        maxDelayMs: 0,
        timeoutMs: 50,
        retryableStatuses: [503],
      },
      async (response) => await response.json()
    )

    assertEquals(calls, 3)
    assertEquals(result.success, true)
    assertEquals(result.attempts, 3)
    assertEquals(result.data, { final: 'ok' })
  } finally {
    globalThis.fetch = originalFetch
  }
})

Deno.test(
  'resilientFetch does not retry non-retryable HTTP status and returns detailed error',
  async () => {
    const originalFetch = globalThis.fetch
    let calls = 0

    try {
      globalThis.fetch = async (): Promise<Response> => {
        calls++
        return new Response('bad request payload', { status: 400 })
      }

      const result = await resilientFetch('http://localhost/non-retryable', undefined, {
        maxRetries: 3,
        baseDelayMs: 0,
        jitterMs: 0,
        maxDelayMs: 0,
        timeoutMs: 50,
      })

      assertEquals(calls, 1)
      assertEquals(result.success, false)
      assertEquals(result.attempts, 1)
      assertEquals(result.error, 'HTTP 400: bad request payload')
    } finally {
      globalThis.fetch = originalFetch
    }
  }
)

Deno.test('resilientFetch retries fetch TypeError and eventually succeeds', async () => {
  const originalFetch = globalThis.fetch
  let calls = 0

  try {
    globalThis.fetch = async (): Promise<Response> => {
      calls++
      if (calls < 3) {
        throw new TypeError('fetch failed')
      }
      return new Response(JSON.stringify({ recovered: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }

    const result = await resilientFetch<{ recovered: boolean }>(
      'http://localhost/network',
      undefined,
      {
        maxRetries: 3,
        baseDelayMs: 0,
        jitterMs: 0,
        maxDelayMs: 0,
        timeoutMs: 50,
      },
      async (response) => await response.json()
    )

    assertEquals(calls, 3)
    assertEquals(result.success, true)
    assertEquals(result.attempts, 3)
    assertEquals(result.data, { recovered: true })
  } finally {
    globalThis.fetch = originalFetch
  }
})

Deno.test('resilientFetch returns exhausted error after retryable failures', async () => {
  const originalFetch = globalThis.fetch
  let calls = 0

  try {
    globalThis.fetch = async (): Promise<Response> => {
      calls++
      throw new TypeError('fetch failed')
    }

    const result = await resilientFetch('http://localhost/fail', undefined, {
      maxRetries: 2,
      baseDelayMs: 0,
      jitterMs: 0,
      maxDelayMs: 0,
      timeoutMs: 50,
    })

    assertEquals(calls, 3)
    assertEquals(result.success, false)
    assertEquals(result.attempts, 3)
    assertEquals(result.error, 'All 3 attempts failed: fetch failed')
  } finally {
    globalThis.fetch = originalFetch
  }
})

Deno.test('resilientFetch handles aborted fetch as retryable and succeeds', async () => {
  const originalFetch = globalThis.fetch
  let calls = 0

  try {
    globalThis.fetch = async (): Promise<Response> => {
      calls++
      if (calls === 1) {
        const err = new Error('The operation was aborted')
        err.name = 'AbortError'
        throw err
      }
      return new Response(JSON.stringify({ afterAbort: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }

    const result = await resilientFetch<{ afterAbort: boolean }>(
      'http://localhost/abort',
      undefined,
      {
        maxRetries: 1,
        baseDelayMs: 0,
        jitterMs: 0,
        maxDelayMs: 0,
        timeoutMs: 50,
      },
      async (response) => await response.json()
    )

    assertEquals(calls, 2)
    assertEquals(result.success, true)
    assertEquals(result.attempts, 2)
    assertEquals(result.data, { afterAbort: true })
  } finally {
    globalThis.fetch = originalFetch
  }
})

Deno.test('resilientAzureCall sends correct POST request and parses JSON', async () => {
  const originalFetch = globalThis.fetch
  let calls = 0

  try {
    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      calls++
      assertEquals(String(input), 'http://localhost/azure')
      assertEquals(init?.method, 'POST')
      const headers = init?.headers as Record<string, string>
      assertEquals(headers['Content-Type'], 'application/json')
      assertEquals(headers['api-key'], 'test-key')
      assertEquals(init?.body, JSON.stringify({ prompt: 'hello' }))

      return new Response(JSON.stringify({ id: 'resp-1', content: 'hi' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }

    const result = await resilientAzureCall<{ id: string; content: string }>(
      'http://localhost/azure',
      'test-key',
      { prompt: 'hello' },
      { maxRetries: 0, timeoutMs: 50, baseDelayMs: 0, jitterMs: 0 }
    )

    assertEquals(calls, 1)
    assertEquals(result.success, true)
    assertEquals(result.attempts, 1)
    assertEquals(result.data, { id: 'resp-1', content: 'hi' })
  } finally {
    globalThis.fetch = originalFetch
  }
})

Deno.test('executeWithFallback returns primary result when primary succeeds', async () => {
  let fallbackCalled = false

  const result = await executeWithFallback(
    'primary',
    async () => 'primary-ok',
    [
      {
        name: 'fallback-1',
        execute: async () => {
          fallbackCalled = true
          return 'fallback'
        },
      },
    ],
    { maxRetries: 0, timeoutMs: 20, baseDelayMs: 0, jitterMs: 0 }
  )

  assertEquals(result.success, true)
  assertEquals(result.data, 'primary-ok')
  assertEquals(result.attempts, 1)
  assertEquals(result.fallbackUsed, undefined)
  assertEquals(fallbackCalled, false)
})

Deno.test('executeWithFallback uses first successful fallback after primary failure', async () => {
  let primaryCalls = 0
  let fallback1Calls = 0
  let fallback2Calls = 0

  const result = await executeWithFallback(
    'primary',
    async () => {
      primaryCalls++
      throw new Error('primary down')
    },
    [
      {
        name: 'fallback-1',
        execute: async () => {
          fallback1Calls++
          throw new Error('fallback 1 down')
        },
      },
      {
        name: 'fallback-2',
        execute: async () => {
          fallback2Calls++
          return 'fallback-2-ok'
        },
      },
    ],
    { maxRetries: 0, timeoutMs: 20, baseDelayMs: 0, jitterMs: 0 }
  )

  assertEquals(primaryCalls, 1)
  assertEquals(fallback1Calls, 1)
  assertEquals(fallback2Calls, 1)
  assertEquals(result.success, true)
  assertEquals(result.data, 'fallback-2-ok')
  assertEquals(result.attempts, 3)
  assertEquals(result.fallbackUsed, 'fallback-2')
})

Deno.test(
  'executeWithFallback retries primary on retryable error before using fallback',
  async () => {
    let primaryCalls = 0
    let fallbackCalls = 0

    const result = await executeWithFallback(
      'primary',
      async () => {
        primaryCalls++
        const err = new TypeError('fetch failed')
        throw err
      },
      [
        {
          name: 'fallback-ok',
          execute: async () => {
            fallbackCalls++
            return 'done'
          },
        },
      ],
      { maxRetries: 2, timeoutMs: 20, baseDelayMs: 0, jitterMs: 0, maxDelayMs: 0 }
    )

    assertEquals(primaryCalls, 3)
    assertEquals(fallbackCalls, 1)
    assertEquals(result.success, true)
    assertEquals(result.data, 'done')
    assertEquals(result.attempts, 4)
    assertEquals(result.fallbackUsed, 'fallback-ok')
  }
)

Deno.test('executeWithFallback returns failure when all providers fail', async () => {
  const result = await executeWithFallback(
    'primary',
    async () => {
      throw new Error('primary failed')
    },
    [
      {
        name: 'fb1',
        execute: async () => {
          throw new Error('fb1 failed')
        },
      },
      {
        name: 'fb2',
        execute: async () => {
          throw new Error('fb2 failed')
        },
      },
    ],
    { maxRetries: 0, timeoutMs: 20, baseDelayMs: 0, jitterMs: 0 }
  )

  assertEquals(result.success, false)
  assertEquals(result.attempts, 3)
  assertEquals(result.error, 'All providers failed after 3 attempts')
})

Deno.test('withRetry returns success on first attempt and forwards arguments', async () => {
  let calls = 0

  const wrapped = withRetry(
    async (a: number, b: number) => {
      calls++
      return a + b
    },
    { maxRetries: 2, timeoutMs: 20, baseDelayMs: 0, jitterMs: 0, maxDelayMs: 0 }
  )

  const result = await wrapped(2, 5)

  assertEquals(calls, 1)
  assertEquals(result.success, true)
  assertEquals(result.data, 7)
  assertEquals(result.attempts, 1)
})

Deno.test('withRetry retries failures and eventually succeeds', async () => {
  let calls = 0

  const wrapped = withRetry(
    async () => {
      calls++
      if (calls < 3) {
        throw new Error('temporary')
      }
      return 'ok'
    },
    { maxRetries: 3, timeoutMs: 20, baseDelayMs: 0, jitterMs: 0, maxDelayMs: 0 }
  )

  const result = await wrapped()

  assertEquals(calls, 3)
  assertEquals(result.success, true)
  assertEquals(result.data, 'ok')
  assertEquals(result.attempts, 3)
})

Deno.test('withRetry returns final error after exhausting retries', async () => {
  let calls = 0

  const wrapped = withRetry(
    async () => {
      calls++
      throw new Error('always fails')
    },
    { maxRetries: 2, timeoutMs: 20, baseDelayMs: 0, jitterMs: 0, maxDelayMs: 0 }
  )

  const result = await wrapped()

  assertEquals(calls, 3)
  assertEquals(result.success, false)
  assertEquals(result.attempts, 3)
  assertEquals(result.error, 'All 3 attempts failed: always fails')
})

Deno.test('withRetry times out long-running function and returns timeout error', async () => {
  let calls = 0

  const wrapped = withRetry(
    async () => {
      calls++
      await new Promise<never>(() => {})
      return 'late'
    },
    { maxRetries: 0, timeoutMs: 5, baseDelayMs: 0, jitterMs: 0, maxDelayMs: 0 }
  )

  const result = await wrapped()

  assertEquals(calls, 1)
  assertEquals(result.success, false)
  assertEquals(result.attempts, 1)
  assertEquals(result.error, 'All 1 attempts failed: Timeout')
})

Deno.test('assert helpers imports are available', async () => {
  assertThrows(
    () => {
      throw new Error('boom')
    },
    Error,
    'boom'
  )

  await assertRejects(
    async () => {
      throw new Error('reject')
    },
    Error,
    'reject'
  )
})
