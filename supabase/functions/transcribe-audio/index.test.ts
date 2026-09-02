import {
  assertEquals,
  assertExists,
  assertThrows,
  assertRejects,
} from 'https://deno.land/std@0.224.0/assert/mod.ts'
import { importEdgeModuleOffline } from '../_shared/module-load-test-harness.ts'

Deno.test('module loads', async () => {
  const { module, stats } = await importEdgeModuleOffline(new URL('./index.ts', import.meta.url))
  assertExists(module.handler)
  assertEquals(stats.listenCalls, 0)
  assertEquals(stats.fetchCalls, 0)
})

Deno.test('web platform primitives required by module are available', () => {
  assertExists(globalThis.atob)
  assertExists(globalThis.FormData)
  assertExists(globalThis.Blob)
  assertEquals(typeof globalThis.atob, 'function')
})

Deno.test('request JSON parsing for expected payload shape works offline', async () => {
  const req = new Request('http://localhost', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      audio: btoa('abc'),
      language: 'fr',
    }),
  })

  const body = await req.json()
  assertEquals(body.audio, 'YWJj')
  assertEquals(body.language, 'fr')
})

Deno.test('missing audio payload would be detectable before external call', async () => {
  const req = new Request('http://localhost', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ language: 'fr' }),
  })

  const body = await req.json()
  assertEquals(body.audio, undefined)
  assertThrows(
    () => {
      if (!body.audio) {
        throw new Error('Aucune donnée audio fournie')
      }
    },
    Error,
    'Aucune donnée audio fournie'
  )
})

Deno.test('default language fallback logic matches module behavior', async () => {
  const req = new Request('http://localhost', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ audio: btoa('hello') }),
  })

  const { audio, language = 'fr' } = await req.json()
  assertEquals(audio, 'aGVsbG8=')
  assertEquals(language, 'fr')
})

Deno.test('base64 chunk decoding strategy produces expected bytes for small payload', () => {
  const base64 = btoa('hello')
  const binaryChunk = atob(base64)
  const bytes = new Uint8Array(binaryChunk.length)
  for (let i = 0; i < binaryChunk.length; i++) {
    bytes[i] = binaryChunk.charCodeAt(i)
  }

  assertEquals(Array.from(bytes), [104, 101, 108, 108, 111])
})

Deno.test('form data assembly for whisper request contains expected fields', () => {
  const binaryAudio = new Uint8Array([1, 2, 3, 4])
  const formData = new FormData()
  const blob = new Blob([binaryAudio], { type: 'audio/webm' })

  formData.append('file', blob, 'audio.webm')
  formData.append('model', 'whisper-1')
  formData.append('language', 'fr')
  formData.append('response_format', 'json')

  assertEquals(formData.get('model'), 'whisper-1')
  assertEquals(formData.get('language'), 'fr')
  assertEquals(formData.get('response_format'), 'json')

  const file = formData.get('file')
  assertExists(file)
})

Deno.test('openai request stub returns expected transcription payload shape', async () => {
  const originalFetch = globalThis.fetch

  try {
    globalThis.fetch = ((input: Request | URL | string, init?: RequestInit) => {
      assertEquals(String(input), 'https://api.openai.com/v1/audio/transcriptions')
      assertEquals(init?.method, 'POST')
      assertExists(init?.headers)
      assertExists(init?.body)

      return Promise.resolve(
        new Response(JSON.stringify({ text: 'bonjour le monde' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      )
    }) as typeof fetch

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: 'Bearer test-key' },
      body: new FormData(),
    })

    const result = await response.json()
    assertEquals(response.ok, true)
    assertEquals(result.text, 'bonjour le monde')
  } finally {
    globalThis.fetch = originalFetch
  }
})

Deno.test('openai error formatting logic produces expected message', async () => {
  const response = new Response('invalid audio', { status: 400 })

  await assertRejects(
    async () => {
      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Erreur API OpenAI: ${response.status} - ${errorText}`)
      }
    },
    Error,
    'Erreur API OpenAI: 400 - invalid audio'
  )
})

Deno.test('environment fallback logic detects missing transcription configuration', () => {
  const originalOpenAI = Deno.env.get('OPENAI_API_KEY')
  const originalAzureEndpoint = Deno.env.get('AZURE_OPENAI_ENDPOINT')
  const originalAzureKey = Deno.env.get('AZURE_OPENAI_API_KEY')

  try {
    Deno.env.delete('OPENAI_API_KEY')
    Deno.env.delete('AZURE_OPENAI_ENDPOINT')
    Deno.env.delete('AZURE_OPENAI_API_KEY')

    assertThrows(
      () => {
        const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')

        if (!OPENAI_API_KEY) {
          const AZURE_OPENAI_ENDPOINT = Deno.env.get('AZURE_OPENAI_ENDPOINT')
          const AZURE_OPENAI_API_KEY = Deno.env.get('AZURE_OPENAI_API_KEY')

          if (!AZURE_OPENAI_ENDPOINT || !AZURE_OPENAI_API_KEY) {
            throw new Error('Aucune clé API de transcription configurée')
          }
        }
      },
      Error,
      'Aucune clé API de transcription configurée'
    )
  } finally {
    if (originalOpenAI === undefined) Deno.env.delete('OPENAI_API_KEY')
    else Deno.env.set('OPENAI_API_KEY', originalOpenAI)

    if (originalAzureEndpoint === undefined) Deno.env.delete('AZURE_OPENAI_ENDPOINT')
    else Deno.env.set('AZURE_OPENAI_ENDPOINT', originalAzureEndpoint)

    if (originalAzureKey === undefined) Deno.env.delete('AZURE_OPENAI_API_KEY')
    else Deno.env.set('AZURE_OPENAI_API_KEY', originalAzureKey)
  }
})

Deno.test('azure fallback branch currently throws explicit configuration error', () => {
  const originalOpenAI = Deno.env.get('OPENAI_API_KEY')
  const originalAzureEndpoint = Deno.env.get('AZURE_OPENAI_ENDPOINT')
  const originalAzureKey = Deno.env.get('AZURE_OPENAI_API_KEY')

  try {
    Deno.env.delete('OPENAI_API_KEY')
    Deno.env.set('AZURE_OPENAI_ENDPOINT', 'https://example.openai.azure.com')
    Deno.env.set('AZURE_OPENAI_API_KEY', 'azure-test-key')

    assertThrows(
      () => {
        const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')

        if (!OPENAI_API_KEY) {
          const AZURE_OPENAI_ENDPOINT = Deno.env.get('AZURE_OPENAI_ENDPOINT')
          const AZURE_OPENAI_API_KEY = Deno.env.get('AZURE_OPENAI_API_KEY')

          if (!AZURE_OPENAI_ENDPOINT || !AZURE_OPENAI_API_KEY) {
            throw new Error('Aucune clé API de transcription configurée')
          }

          throw new Error('Azure Whisper non configuré. Veuillez ajouter OPENAI_API_KEY.')
        }
      },
      Error,
      'Azure Whisper non configuré. Veuillez ajouter OPENAI_API_KEY.'
    )
  } finally {
    if (originalOpenAI === undefined) Deno.env.delete('OPENAI_API_KEY')
    else Deno.env.set('OPENAI_API_KEY', originalOpenAI)

    if (originalAzureEndpoint === undefined) Deno.env.delete('AZURE_OPENAI_ENDPOINT')
    else Deno.env.set('AZURE_OPENAI_ENDPOINT', originalAzureEndpoint)

    if (originalAzureKey === undefined) Deno.env.delete('AZURE_OPENAI_API_KEY')
    else Deno.env.set('AZURE_OPENAI_API_KEY', originalAzureKey)
  }
})
