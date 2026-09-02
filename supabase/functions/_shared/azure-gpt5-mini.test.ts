import {
  assertEquals,
  assertExists,
  assertThrows,
  assertRejects,
} from 'https://deno.land/std@0.224.0/assert/mod.ts'
import {
  callGpt5Mini,
  AZURE_GPT5_MINI_CONFIG,
  AZURE_GPT54_CONFIG,
  AZURE_GPT52_CONFIG,
} from './azure-gpt5-mini.ts'

type EnvSnapshot = Record<string, string | undefined>

const ENV_KEYS = [
  'AZURE_GPT5_MINI_ENDPOINT',
  'AZURE_GPT5_MINI_API_KEY',
  'AZURE_GPT52_ENDPOINT',
  'AZURE_GPT52_API_KEY',
  'AZURE_OPENAI_ENDPOINT',
  'AZURE_OPENAI_API_KEY',
] as const

function snapshotEnv(): EnvSnapshot {
  const out: EnvSnapshot = {}
  for (const key of ENV_KEYS) out[key] = Deno.env.get(key)
  return out
}

function restoreEnv(snapshot: EnvSnapshot) {
  for (const key of ENV_KEYS) {
    const value = snapshot[key]
    if (value === undefined) Deno.env.delete(key)
    else Deno.env.set(key, value)
  }
}

function clearTestEnv() {
  for (const key of ENV_KEYS) Deno.env.delete(key)
}

Deno.test("config getters lisent les variables d'environnement attendues", () => {
  const snap = snapshotEnv()
  try {
    clearTestEnv()
    Deno.env.set('AZURE_GPT5_MINI_ENDPOINT', 'https://mini.example.test')
    Deno.env.set('AZURE_GPT5_MINI_API_KEY', 'mini-key')
    Deno.env.set('AZURE_GPT52_ENDPOINT', 'https://gpt52.example.test')
    Deno.env.set('AZURE_GPT52_API_KEY', 'gpt52-key')
    Deno.env.set('AZURE_OPENAI_ENDPOINT', 'https://gpt54.example.test')
    Deno.env.set('AZURE_OPENAI_API_KEY', 'gpt54-key')

    assertEquals(AZURE_GPT5_MINI_CONFIG.endpoint(), 'https://mini.example.test')
    assertEquals(AZURE_GPT5_MINI_CONFIG.apiKey(), 'mini-key')
    assertEquals(AZURE_GPT52_CONFIG.endpoint(), 'https://gpt52.example.test')
    assertEquals(AZURE_GPT52_CONFIG.apiKey(), 'gpt52-key')
    assertEquals(AZURE_GPT54_CONFIG.endpoint(), 'https://gpt54.example.test')
    assertEquals(AZURE_GPT54_CONFIG.apiKey(), 'gpt54-key')
    assertEquals(AZURE_GPT5_MINI_CONFIG.timeout, 30000)
    assertEquals(AZURE_GPT5_MINI_CONFIG.defaultParams.max_completion_tokens, 2000)
    assertEquals(AZURE_GPT5_MINI_CONFIG.defaultParams.reasoning_effort, 'low')
    assertEquals(AZURE_GPT5_MINI_CONFIG.defaultParams.verbosity, 'low')
  } finally {
    restoreEnv(snap)
  }
})

Deno.test("callGpt5Mini throw si aucun provider n'est configuré", async () => {
  const snap = snapshotEnv()
  try {
    clearTestEnv()
    await assertRejects(() => callGpt5Mini('sys', 'user'), Error, 'Azure OpenAI not configured')
  } finally {
    restoreEnv(snap)
  }
})

Deno.test(
  'callGpt5Mini utilise GPT-5.4 en priorité avec body chat completions correct',
  async () => {
    const snap = snapshotEnv()
    const originalFetch = globalThis.fetch
    try {
      clearTestEnv()
      Deno.env.set('AZURE_OPENAI_ENDPOINT', 'https://gpt54.example.test/chat/completions')
      Deno.env.set('AZURE_OPENAI_API_KEY', 'gpt54-key')
      Deno.env.set('AZURE_GPT5_MINI_ENDPOINT', 'https://mini.example.test/chat/completions')
      Deno.env.set('AZURE_GPT5_MINI_API_KEY', 'mini-key')

      let calls = 0
      let capturedUrl = ''
      let capturedInit: RequestInit | undefined

      globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
        calls++
        capturedUrl = input instanceof Request ? input.url : String(input)
        capturedInit = init
        return new Response(
          JSON.stringify({
            choices: [{ message: { content: '  Réponse GPT-5.4  ' } }],
            usage: { prompt_tokens: 11, completion_tokens: 7, total_tokens: 18 },
          }),
          {
            status: 200,
            headers: { 'content-type': 'application/json' },
          }
        )
      }) as typeof fetch

      const result = await callGpt5Mini('SYSTEM', 'USER', {
        maxTokens: 321,
        jsonOutput: true,
        timeout: 1234,
      })

      assertEquals(calls, 1)
      assertEquals(capturedUrl, 'https://gpt54.example.test/chat/completions')
      assertExists(capturedInit)
      assertEquals(capturedInit?.method, 'POST')
      assertEquals((capturedInit?.headers as Record<string, string>)['api-key'], 'gpt54-key')
      assertEquals(
        (capturedInit?.headers as Record<string, string>)['Content-Type'],
        'application/json'
      )

      const parsedBody = JSON.parse(String(capturedInit?.body))
      assertEquals(parsedBody.messages, [
        { role: 'system', content: 'SYSTEM' },
        { role: 'user', content: 'USER' },
      ])
      assertEquals(parsedBody.max_completion_tokens, 321)
      assertEquals(parsedBody.reasoning_effort, 'low')
      assertEquals(parsedBody.verbosity, 'low')
      assertEquals(parsedBody.response_format, { type: 'json_object' })

      assertEquals(result, {
        content: 'Réponse GPT-5.4',
        usage: { prompt_tokens: 11, completion_tokens: 7, total_tokens: 18 },
        model: 'gpt-5.4',
      })
    } finally {
      globalThis.fetch = originalFetch
      restoreEnv(snap)
    }
  }
)

Deno.test('callGpt5Mini fallback vers GPT-5 Mini si GPT-5.4 échoue', async () => {
  const snap = snapshotEnv()
  const originalFetch = globalThis.fetch
  try {
    clearTestEnv()
    Deno.env.set('AZURE_OPENAI_ENDPOINT', 'https://gpt54.example.test/chat/completions')
    Deno.env.set('AZURE_OPENAI_API_KEY', 'gpt54-key')
    Deno.env.set('AZURE_GPT5_MINI_ENDPOINT', 'https://mini.example.test/chat/completions')
    Deno.env.set('AZURE_GPT5_MINI_API_KEY', 'mini-key')

    const urls: string[] = []
    const apiKeys: string[] = []

    globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
      const url = input instanceof Request ? input.url : String(input)
      urls.push(url)
      apiKeys.push((init?.headers as Record<string, string>)['api-key'])

      if (url.includes('gpt54')) {
        return new Response('upstream error', { status: 500 })
      }

      return new Response(
        JSON.stringify({
          choices: [{ message: { content: 'Mini success' } }],
          usage: { prompt_tokens: 3, completion_tokens: 4, total_tokens: 7 },
        }),
        {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }
      )
    }) as typeof fetch

    const result = await callGpt5Mini('sys', 'user')

    assertEquals(urls, [
      'https://gpt54.example.test/chat/completions',
      'https://mini.example.test/chat/completions',
    ])
    assertEquals(apiKeys, ['gpt54-key', 'mini-key'])
    assertEquals(result, {
      content: 'Mini success',
      usage: { prompt_tokens: 3, completion_tokens: 4, total_tokens: 7 },
      model: 'gpt-5-mini',
    })
  } finally {
    globalThis.fetch = originalFetch
    restoreEnv(snap)
  }
})

Deno.test(
  'callGpt5Mini applique les paramètres par défaut quand maxTokens/jsonOutput sont absents',
  async () => {
    const snap = snapshotEnv()
    const originalFetch = globalThis.fetch
    try {
      clearTestEnv()
      Deno.env.set('AZURE_GPT5_MINI_ENDPOINT', 'https://mini.example.test/chat/completions')
      Deno.env.set('AZURE_GPT5_MINI_API_KEY', 'mini-key')

      let capturedBody: Record<string, unknown> | undefined

      globalThis.fetch = (async (_input: string | URL | Request, init?: RequestInit) => {
        capturedBody = JSON.parse(String(init?.body))
        return new Response(
          JSON.stringify({
            choices: [{ message: { content: 'ok' } }],
            usage: {},
          }),
          {
            status: 200,
            headers: { 'content-type': 'application/json' },
          }
        )
      }) as typeof fetch

      const result = await callGpt5Mini('sys-default', 'user-default')

      assertExists(capturedBody)
      assertEquals(capturedBody?.['messages'], [
        { role: 'system', content: 'sys-default' },
        { role: 'user', content: 'user-default' },
      ])
      assertEquals(capturedBody?.['max_completion_tokens'], 2000)
      assertEquals(capturedBody?.['reasoning_effort'], 'low')
      assertEquals(capturedBody?.['verbosity'], 'low')
      assertEquals('response_format' in capturedBody!, false)
      assertEquals(result.model, 'gpt-5-mini')
      assertEquals(result.content, 'ok')
    } finally {
      globalThis.fetch = originalFetch
      restoreEnv(snap)
    }
  }
)

Deno.test('callGpt5Mini retry sur 429 puis succès sur le même provider', async () => {
  const snap = snapshotEnv()
  const originalFetch = globalThis.fetch
  const originalSetTimeout = globalThis.setTimeout
  try {
    clearTestEnv()
    Deno.env.set('AZURE_GPT5_MINI_ENDPOINT', 'https://mini.example.test/chat/completions')
    Deno.env.set('AZURE_GPT5_MINI_API_KEY', 'mini-key')

    let attempts = 0
    const requestedDelays: number[] = []

    globalThis.setTimeout = ((
      cb: (...args: unknown[]) => void,
      delay?: number,
      ...args: unknown[]
    ) => {
      requestedDelays.push(Number(delay ?? 0))
      if (typeof cb === 'function') {
        cb(...args)
      }
      return 1 as unknown as number
    }) as unknown as typeof setTimeout

    globalThis.fetch = (async () => {
      attempts++
      if (attempts <= 2) {
        return new Response('rate limited', { status: 429 })
      }
      return new Response(
        JSON.stringify({
          choices: [{ message: { content: 'after retry' } }],
          usage: { prompt_tokens: 1, completion_tokens: 2, total_tokens: 3 },
        }),
        {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }
      )
    }) as typeof fetch

    const result = await callGpt5Mini('sys', 'user', { timeout: 50 })

    assertEquals(attempts, 3)
    assertEquals(result.content, 'after retry')
    assertEquals(result.model, 'gpt-5-mini')
    assertEquals(result.usage.total_tokens, 3)
    assertEquals(requestedDelays.includes(500), true)
    assertEquals(requestedDelays.includes(1000), true)
  } finally {
    globalThis.fetch = originalFetch
    globalThis.setTimeout = originalSetTimeout
    restoreEnv(snap)
  }
})

Deno.test(
  'callGpt5Mini fallback vers provider suivant après dépassement des retries 429',
  async () => {
    const snap = snapshotEnv()
    const originalFetch = globalThis.fetch
    const originalSetTimeout = globalThis.setTimeout
    try {
      clearTestEnv()
      Deno.env.set('AZURE_OPENAI_ENDPOINT', 'https://gpt54.example.test/chat/completions')
      Deno.env.set('AZURE_OPENAI_API_KEY', 'gpt54-key')
      Deno.env.set('AZURE_GPT5_MINI_ENDPOINT', 'https://mini.example.test/chat/completions')
      Deno.env.set('AZURE_GPT5_MINI_API_KEY', 'mini-key')

      const urls: string[] = []
      globalThis.setTimeout = ((
        cb: (...args: unknown[]) => void,
        _delay?: number,
        ...args: unknown[]
      ) => {
        if (typeof cb === 'function') cb(...args)
        return 1 as unknown as number
      }) as unknown as typeof setTimeout

      let gpt54Attempts = 0

      globalThis.fetch = (async (input: string | URL | Request) => {
        const url = input instanceof Request ? input.url : String(input)
        urls.push(url)

        if (url.includes('gpt54')) {
          gpt54Attempts++
          return new Response('rate limited', { status: 429 })
        }

        return new Response(
          JSON.stringify({
            choices: [{ message: { content: 'mini fallback ok' } }],
            usage: { prompt_tokens: 10, completion_tokens: 1, total_tokens: 11 },
          }),
          {
            status: 200,
            headers: { 'content-type': 'application/json' },
          }
        )
      }) as typeof fetch

      const result = await callGpt5Mini('sys', 'user')

      assertEquals(gpt54Attempts, 4)
      assertEquals(urls.slice(0, 4), [
        'https://gpt54.example.test/chat/completions',
        'https://gpt54.example.test/chat/completions',
        'https://gpt54.example.test/chat/completions',
        'https://gpt54.example.test/chat/completions',
      ])
      assertEquals(urls[4], 'https://mini.example.test/chat/completions')
      assertEquals(result.model, 'gpt-5-mini')
      assertEquals(result.content, 'mini fallback ok')
    } finally {
      globalThis.fetch = originalFetch
      globalThis.setTimeout = originalSetTimeout
      restoreEnv(snap)
    }
  }
)

Deno.test(
  "callGpt5Mini throw une erreur explicite si la réponse Azure n'a pas de content",
  async () => {
    const snap = snapshotEnv()
    const originalFetch = globalThis.fetch
    try {
      clearTestEnv()
      Deno.env.set('AZURE_GPT5_MINI_ENDPOINT', 'https://mini.example.test/chat/completions')
      Deno.env.set('AZURE_GPT5_MINI_API_KEY', 'mini-key')

      globalThis.fetch = (async () => {
        return new Response(
          JSON.stringify({
            choices: [{ message: { content: null } }],
            usage: {},
          }),
          {
            status: 200,
            headers: { 'content-type': 'application/json' },
          }
        )
      }) as typeof fetch

      await assertRejects(() => callGpt5Mini('sys', 'user'), Error, 'No content in Azure response')
    } finally {
      globalThis.fetch = originalFetch
      restoreEnv(snap)
    }
  }
)

Deno.test('callGpt5Mini convertit AbortError en timeout explicite', async () => {
  const snap = snapshotEnv()
  const originalFetch = globalThis.fetch
  try {
    clearTestEnv()
    Deno.env.set('AZURE_GPT5_MINI_ENDPOINT', 'https://mini.example.test/chat/completions')
    Deno.env.set('AZURE_GPT5_MINI_API_KEY', 'mini-key')

    globalThis.fetch = (async () => {
      const err = new Error('aborted')
      err.name = 'AbortError'
      throw err
    }) as typeof fetch

    await assertRejects(
      () => callGpt5Mini('sys', 'user', { timeout: 1500 }),
      Error,
      '[gpt-5-mini] Azure request timeout (1.5s)'
    )
  } finally {
    globalThis.fetch = originalFetch
    restoreEnv(snap)
  }
})

Deno.test('callGpt5Mini propage la dernière erreur si tous les providers échouent', async () => {
  const snap = snapshotEnv()
  const originalFetch = globalThis.fetch
  try {
    clearTestEnv()
    Deno.env.set('AZURE_OPENAI_ENDPOINT', 'https://gpt54.example.test/chat/completions')
    Deno.env.set('AZURE_OPENAI_API_KEY', 'gpt54-key')
    Deno.env.set('AZURE_GPT5_MINI_ENDPOINT', 'https://mini.example.test/chat/completions')
    Deno.env.set('AZURE_GPT5_MINI_API_KEY', 'mini-key')

    globalThis.fetch = (async () => {
      return new Response('bad gateway', { status: 502 })
    }) as typeof fetch

    await assertRejects(() => callGpt5Mini('sys', 'user'), Error, 'Azure OpenAI API error: 502')
  } finally {
    globalThis.fetch = originalFetch
    restoreEnv(snap)
  }
})

Deno.test('assertThrows est disponible et les constantes exportées existent', () => {
  assertThrows(
    () => {
      throw new Error('boom')
    },
    Error,
    'boom'
  )
  assertExists(AZURE_GPT5_MINI_CONFIG)
  assertExists(AZURE_GPT54_CONFIG)
  assertExists(AZURE_GPT52_CONFIG)
})
