import {
  assertEquals,
  assertExists,
  assertThrows,
  assertRejects,
} from 'https://deno.land/std@0.224.0/assert/mod.ts'
import {
  AZURE_GPT52_CONFIG,
  AZURE_GPT54_PRIMARY_CONFIG,
  callGpt52,
  callGpt52WithMessages,
} from './azure-gpt52.ts'

const AZURE_ENV_KEYS = [
  'AZURE_OPENAI_ENDPOINT',
  'AZURE_OPENAI_API_KEY',
  'AZURE_GPT52_ENDPOINT',
  'AZURE_GPT52_API_KEY',
]

const GPT52_CHAT_ENDPOINT =
  'https://azure-unit.test/openai/deployments/gpt-52/chat/completions?api-version=2024-02-15'
const GPT54_CHAT_ENDPOINT =
  'https://azure-unit.test/openai/deployments/gpt-54/chat/completions?api-version=2024-02-15'

function snapshotEnv(): Record<string, string | undefined> {
  const snapshot: Record<string, string | undefined> = {}
  for (const key of AZURE_ENV_KEYS) {
    snapshot[key] = Deno.env.get(key)
  }
  return snapshot
}

function restoreEnv(snapshot: Record<string, string | undefined>): void {
  for (const [key, value] of Object.entries(snapshot)) {
    if (value === undefined) {
      Deno.env.delete(key)
    } else {
      Deno.env.set(key, value)
    }
  }
}

function applyIsolatedEnv(env: Record<string, string>): void {
  for (const key of AZURE_ENV_KEYS) {
    Deno.env.delete(key)
  }
  for (const [key, value] of Object.entries(env)) {
    Deno.env.set(key, value)
  }
}

async function withIsolatedRuntime(
  env: Record<string, string>,
  fetchStub: typeof fetch,
  fn: () => Promise<void> | void
): Promise<void> {
  const envSnapshot = snapshotEnv()
  const originalFetch = globalThis.fetch

  applyIsolatedEnv(env)
  globalThis.fetch = fetchStub

  try {
    await fn()
  } finally {
    globalThis.fetch = originalFetch
    restoreEnv(envSnapshot)
  }
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

function urlOf(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input
  if (input instanceof URL) return input.toString()
  return input.url
}

function makeFetchStub(
  handler: (input: RequestInfo | URL, init?: RequestInit) => Response | Promise<Response>
): typeof fetch {
  return ((input: RequestInfo | URL, init?: RequestInit) =>
    Promise.resolve(handler(input, init))) as typeof fetch
}

function headerValue(headers: HeadersInit | undefined, name: string): string | null {
  if (!headers) return null
  if (headers instanceof Headers) return headers.get(name)

  if (Array.isArray(headers)) {
    const found = headers.find(([key]) => key.toLowerCase() === name.toLowerCase())
    return found?.[1] ?? null
  }

  const record = headers as Record<string, string>
  return record[name] ?? record[name.toLowerCase()] ?? null
}

Deno.test('configuration getters read current Deno env values dynamically', () => {
  const envSnapshot = snapshotEnv()

  try {
    applyIsolatedEnv({})

    assertEquals(AZURE_GPT54_PRIMARY_CONFIG.endpoint(), undefined)
    assertEquals(AZURE_GPT54_PRIMARY_CONFIG.apiKey(), undefined)
    assertEquals(AZURE_GPT52_CONFIG.endpoint(), undefined)
    assertEquals(AZURE_GPT52_CONFIG.apiKey(), undefined)

    Deno.env.set('AZURE_OPENAI_ENDPOINT', GPT54_CHAT_ENDPOINT)
    Deno.env.set('AZURE_OPENAI_API_KEY', 'unit-key-54')
    Deno.env.set('AZURE_GPT52_ENDPOINT', GPT52_CHAT_ENDPOINT)
    Deno.env.set('AZURE_GPT52_API_KEY', 'unit-key-52')

    assertEquals(AZURE_GPT54_PRIMARY_CONFIG.endpoint(), GPT54_CHAT_ENDPOINT)
    assertEquals(AZURE_GPT54_PRIMARY_CONFIG.apiKey(), 'unit-key-54')
    assertEquals(AZURE_GPT52_CONFIG.endpoint(), GPT52_CHAT_ENDPOINT)
    assertEquals(AZURE_GPT52_CONFIG.apiKey(), 'unit-key-52')
    assertExists(AZURE_GPT54_PRIMARY_CONFIG.apiKey())

    Deno.env.set('AZURE_GPT52_ENDPOINT', 'https://changed-unit.test/chat/completions')
    assertEquals(AZURE_GPT52_CONFIG.endpoint(), 'https://changed-unit.test/chat/completions')
  } finally {
    restoreEnv(envSnapshot)
  }
})

Deno.test('assertThrows import is available for synchronous validation assertions', () => {
  assertThrows(
    () => {
      throw new Error('sync sentinel')
    },
    Error,
    'sync sentinel'
  )
})

Deno.test(
  'callGpt52WithMessages rejects without configured Azure endpoints and does not fetch',
  async () => {
    await withIsolatedRuntime(
      {},
      () => {
        throw new Error('fetch should not be called when Azure is not configured')
      },
      async () => {
        await assertRejects(
          () => callGpt52WithMessages([{ role: 'user', content: 'Bonjour' }]),
          Error,
          'Azure OpenAI not configured'
        )
      }
    )
  }
)

Deno.test(
  'callGpt52WithMessages uses GPT-5.2 chat completions directly and maps response usage',
  async () => {
    let capturedUrl = ''
    let capturedMethod = ''
    let capturedApiKey: string | null = null
    let capturedContentType: string | null = null
    let capturedBody: Record<string, unknown> | undefined

    await withIsolatedRuntime(
      {
        AZURE_GPT52_ENDPOINT: GPT52_CHAT_ENDPOINT,
        AZURE_GPT52_API_KEY: 'unit-key-52',
      },
      makeFetchStub((input, init) => {
        capturedUrl = urlOf(input)
        capturedMethod = init?.method ?? ''
        capturedApiKey = headerValue(init?.headers, 'api-key')
        capturedContentType = headerValue(init?.headers, 'Content-Type')
        capturedBody = JSON.parse(init?.body as string)

        return jsonResponse({
          choices: [
            {
              message: {
                role: 'assistant',
                content: '  Réponse métier GPT-5.2  ',
              },
            },
          ],
          usage: {
            prompt_tokens: 11,
            completion_tokens: 7,
            total_tokens: 18,
          },
        })
      }),
      async () => {
        const result = await callGpt52WithMessages([
          { role: 'system', content: 'Tu es utile.' },
          { role: 'user', content: 'Résume.' },
        ])

        assertEquals(capturedUrl, GPT52_CHAT_ENDPOINT)
        assertEquals(capturedMethod, 'POST')
        assertEquals(capturedApiKey, 'unit-key-52')
        assertEquals(capturedContentType, 'application/json')
        assertEquals(capturedBody?.messages, [
          { role: 'system', content: 'Tu es utile.' },
          { role: 'user', content: 'Résume.' },
        ])
        assertEquals(capturedBody?.max_completion_tokens, 3000)
        assertEquals(capturedBody?.reasoning_effort, 'low')
        assertEquals(capturedBody?.verbosity, 'low')
        assertEquals(capturedBody?.response_format, undefined)

        assertEquals(result.content, 'Réponse métier GPT-5.2')
        assertEquals(result.model, 'gpt-5.2')
        assertEquals(result.usage, {
          prompt_tokens: 11,
          completion_tokens: 7,
          total_tokens: 18,
        })
      }
    )
  }
)

Deno.test(
  'callGpt52 builds system and user messages and serializes JSON output options',
  async () => {
    let capturedBody: Record<string, unknown> | undefined

    await withIsolatedRuntime(
      {
        AZURE_GPT52_ENDPOINT: GPT52_CHAT_ENDPOINT,
        AZURE_GPT52_API_KEY: 'unit-key-52',
      },
      makeFetchStub((_, init) => {
        capturedBody = JSON.parse(init?.body as string)

        return jsonResponse({
          choices: [
            {
              message: {
                role: 'assistant',
                content: '  {"answer":42}  ',
              },
            },
          ],
          usage: {
            prompt_tokens: 20,
            completion_tokens: 5,
            total_tokens: 25,
          },
        })
      }),
      async () => {
        const result = await callGpt52(
          'Réponds uniquement en JSON.',
          'Donne la réponse numérique.',
          {
            maxTokens: 777,
            jsonOutput: true,
            reasoningEffort: 'high',
            verbosity: 'medium',
            timeout: 1000,
          }
        )

        assertEquals(capturedBody?.messages, [
          { role: 'system', content: 'Réponds uniquement en JSON.' },
          { role: 'user', content: 'Donne la réponse numérique.' },
        ])
        assertEquals(capturedBody?.max_completion_tokens, 777)
        assertEquals(capturedBody?.reasoning_effort, 'high')
        assertEquals(capturedBody?.verbosity, 'medium')
        assertEquals(capturedBody?.response_format, { type: 'json_object' })

        assertEquals(result.content, '{"answer":42}')
        assertEquals(result.model, 'gpt-5.2')
        assertEquals(result.usage.total_tokens, 25)
      }
    )
  }
)

Deno.test(
  'callGpt52WithMessages prefers GPT-5.4 primary when both chat endpoints are configured',
  async () => {
    const calledUrls: string[] = []
    let capturedBody: Record<string, unknown> | undefined

    await withIsolatedRuntime(
      {
        AZURE_OPENAI_ENDPOINT: GPT54_CHAT_ENDPOINT,
        AZURE_OPENAI_API_KEY: 'unit-key-54',
        AZURE_GPT52_ENDPOINT: GPT52_CHAT_ENDPOINT,
        AZURE_GPT52_API_KEY: 'unit-key-52',
      },
      makeFetchStub((input, init) => {
        const url = urlOf(input)
        calledUrls.push(url)
        capturedBody = JSON.parse(init?.body as string)

        if (url !== GPT54_CHAT_ENDPOINT) {
          throw new Error('GPT-5.2 fallback should not be called when GPT-5.4 succeeds')
        }

        return jsonResponse({
          choices: [
            {
              message: {
                role: 'assistant',
                content: 'Primary GPT-5.4 answer',
              },
            },
          ],
          usage: {
            prompt_tokens: 13,
            completion_tokens: 4,
            total_tokens: 17,
          },
        })
      }),
      async () => {
        const result = await callGpt52WithMessages(
          [{ role: 'user', content: 'Question prioritaire' }],
          {
            maxTokens: 250,
            reasoningEffort: 'medium',
          }
        )

        assertEquals(calledUrls, [GPT54_CHAT_ENDPOINT])
        assertEquals(capturedBody?.messages, [{ role: 'user', content: 'Question prioritaire' }])
        assertEquals(capturedBody?.max_completion_tokens, 250)
        assertEquals(capturedBody?.reasoning_effort, 'medium')
        assertEquals(result.content, 'Primary GPT-5.4 answer')
        assertEquals(result.model, 'gpt-5.4')
        assertEquals(result.usage.total_tokens, 17)
      }
    )
  }
)

Deno.test(
  'callGpt52WithMessages falls back from GPT-5.4 error to GPT-5.2 chat completions',
  async () => {
    const calledUrls: string[] = []
    const originalWarn = console.warn
    const originalError = console.error

    console.warn = () => {}
    console.error = () => {}

    try {
      await withIsolatedRuntime(
        {
          AZURE_OPENAI_ENDPOINT: GPT54_CHAT_ENDPOINT,
          AZURE_OPENAI_API_KEY: 'unit-key-54',
          AZURE_GPT52_ENDPOINT: GPT52_CHAT_ENDPOINT,
          AZURE_GPT52_API_KEY: 'unit-key-52',
        },
        makeFetchStub((input) => {
          const url = urlOf(input)
          calledUrls.push(url)

          if (url === GPT54_CHAT_ENDPOINT) {
            return new Response('primary unavailable', { status: 500 })
          }

          return jsonResponse({
            choices: [
              {
                message: {
                  role: 'assistant',
                  content: 'Fallback GPT-5.2 answer',
                },
              },
            ],
            usage: {
              prompt_tokens: 21,
              completion_tokens: 6,
              total_tokens: 27,
            },
          })
        }),
        async () => {
          const result = await callGpt52WithMessages([
            { role: 'user', content: 'Utilise le fallback si besoin' },
          ])

          assertEquals(calledUrls, [GPT54_CHAT_ENDPOINT, GPT52_CHAT_ENDPOINT])
          assertEquals(result.content, 'Fallback GPT-5.2 answer')
          assertEquals(result.model, 'gpt-5.2')
          assertEquals(result.usage, {
            prompt_tokens: 21,
            completion_tokens: 6,
            total_tokens: 27,
          })
        }
      )
    } finally {
      console.warn = originalWarn
      console.error = originalError
    }
  }
)

Deno.test(
  'callGpt52WithMessages serializes tools and returns tool calls without text content',
  async () => {
    let capturedBody: Record<string, unknown> | undefined

    const tools = [
      {
        type: 'function',
        function: {
          name: 'lookup_customer',
          description: 'Trouve un client par identifiant.',
          parameters: {
            type: 'object',
            properties: {
              customerId: { type: 'string' },
            },
            required: ['customerId'],
          },
        },
      },
    ]

    await withIsolatedRuntime(
      {
        AZURE_GPT52_ENDPOINT: GPT52_CHAT_ENDPOINT,
        AZURE_GPT52_API_KEY: 'unit-key-52',
      },
      makeFetchStub((_, init) => {
        capturedBody = JSON.parse(init?.body as string)

        return jsonResponse({
          choices: [
            {
              message: {
                role: 'assistant',
                content: null,
                tool_calls: [
                  {
                    id: 'call_123',
                    type: 'function',
                    function: {
                      name: 'lookup_customer',
                      arguments: '{"customerId":"C-42"}',
                    },
                  },
                ],
              },
            },
          ],
          usage: {
            prompt_tokens: 31,
            completion_tokens: 9,
            total_tokens: 40,
          },
        })
      }),
      async () => {
        const result = await callGpt52WithMessages(
          [{ role: 'user', content: 'Cherche le client C-42' }],
          {
            tools,
            toolChoice: {
              type: 'function',
              function: { name: 'lookup_customer' },
            },
          }
        )

        assertEquals(capturedBody?.tools, tools)
        assertEquals(capturedBody?.tool_choice, {
          type: 'function',
          function: { name: 'lookup_customer' },
        })

        assertEquals(result.content, '')
        assertEquals(result.model, 'gpt-5.2')
        assertEquals(result.toolCalls, [
          {
            id: 'call_123',
            type: 'function',
            function: {
              name: 'lookup_customer',
              arguments: '{"customerId":"C-42"}',
            },
          },
        ])
        assertExists(result.rawMessage)
        assertEquals(result.usage.total_tokens, 40)
      }
    )
  }
)

Deno.test(
  'callGpt52WithMessages rejects malformed Azure response with no content and no tool calls',
  async () => {
    const originalError = console.error
    console.error = () => {}

    try {
      await withIsolatedRuntime(
        {
          AZURE_GPT52_ENDPOINT: GPT52_CHAT_ENDPOINT,
          AZURE_GPT52_API_KEY: 'unit-key-52',
        },
        makeFetchStub(() =>
          jsonResponse({
            choices: [
              {
                message: {
                  role: 'assistant',
                },
              },
            ],
            usage: {
              prompt_tokens: 1,
              completion_tokens: 0,
              total_tokens: 1,
            },
          })
        ),
        async () => {
          await assertRejects(
            () => callGpt52WithMessages([{ role: 'user', content: 'Réponse invalide attendue' }]),
            Error,
            'No content or tool_calls in Azure response'
          )
        }
      )
    } finally {
      console.error = originalError
    }
  }
)
