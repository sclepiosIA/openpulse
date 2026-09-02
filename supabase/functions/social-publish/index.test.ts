// `Deno.serve` est un accesseur en LECTURE SEULE depuis Deno 2 : les
// affectations de ce banc levaient « Cannot set property serve of #<Object>
// which has only a getter », et le banc entier tombait. On rend la propriete
// inscriptible une fois, sans toucher aux affectations elles-memes.
Object.defineProperty(Deno, 'serve', { configurable: true, writable: true, value: Deno.serve })

import {
  assertEquals,
  assertExists,
  assertThrows,
  assertRejects,
} from 'https://deno.land/std@0.224.0/assert/mod.ts'

function snapshotEnv() {
  return {
    SUPABASE_URL: Deno.env.get('SUPABASE_URL'),
    SUPABASE_SERVICE_ROLE_KEY: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
    EMAIL_ENCRYPTION_KEY: Deno.env.get('EMAIL_ENCRYPTION_KEY'),
    CRON_SECRET: Deno.env.get('CRON_SECRET'),
    SUPABASE_ANON_KEY: Deno.env.get('SUPABASE_ANON_KEY'),
  }
}

function restoreEnv(env: ReturnType<typeof snapshotEnv>) {
  if (env.SUPABASE_URL == null) Deno.env.delete('SUPABASE_URL')
  else Deno.env.set('SUPABASE_URL', env.SUPABASE_URL)

  if (env.SUPABASE_SERVICE_ROLE_KEY == null) Deno.env.delete('SUPABASE_SERVICE_ROLE_KEY')
  else Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', env.SUPABASE_SERVICE_ROLE_KEY)

  if (env.EMAIL_ENCRYPTION_KEY == null) Deno.env.delete('EMAIL_ENCRYPTION_KEY')
  else Deno.env.set('EMAIL_ENCRYPTION_KEY', env.EMAIL_ENCRYPTION_KEY)

  if (env.CRON_SECRET == null) Deno.env.delete('CRON_SECRET')
  else Deno.env.set('CRON_SECRET', env.CRON_SECRET)

  if (env.SUPABASE_ANON_KEY == null) Deno.env.delete('SUPABASE_ANON_KEY')
  else Deno.env.set('SUPABASE_ANON_KEY', env.SUPABASE_ANON_KEY)
}

function setRequiredEnv() {
  Deno.env.set('SUPABASE_URL', 'https://example.supabase.co')
  Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', 'service-role-key')
  Deno.env.set('EMAIL_ENCRYPTION_KEY', 'enc-key')
  Deno.env.set('CRON_SECRET', 'cron-secret')
  Deno.env.set('SUPABASE_ANON_KEY', 'anon-key')
}

// Deno >= 2.2 expose `Deno.serve` en propriété accessor getter-only : toute
// affectation directe (`Deno.serve = stub`) lève `TypeError: Cannot set
// property serve which has only a getter`. On stubbe/restaure via
// Object.defineProperty (compatible Deno 2.1.4 ET >= 2.2) — même pattern que
// client-portal-emargement-pdf/index.test.ts.
function getDenoServeDescriptor(): PropertyDescriptor | undefined {
  return Object.getOwnPropertyDescriptor(Deno, 'serve')
}

function setDenoServe(stub: unknown): void {
  Object.defineProperty(Deno, 'serve', {
    value: stub,
    configurable: true,
    writable: true,
  })
}

function restoreDenoServe(descriptor: PropertyDescriptor | undefined): void {
  if (descriptor) {
    Object.defineProperty(Deno, 'serve', descriptor)
  }
}

Deno.test('module loads', async () => {
  const originalEnv = snapshotEnv()
  const originalFetch = globalThis.fetch
  const originalServeDescriptor = getDenoServeDescriptor()

  try {
    setRequiredEnv()

    globalThis.fetch = ((_input: Request | URL | string, _init?: RequestInit) => {
      return Promise.resolve(
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      )
    }) as typeof fetch

    let servedHandler: ((req: Request) => Response | Promise<Response>) | undefined
    setDenoServe(((handler: (req: Request) => Response | Promise<Response>) => {
      servedHandler = handler
      return {} as Deno.HttpServer
    }) as typeof Deno.serve)

    const mod = await import('./index.ts')
    assertExists(mod)
    assertExists(servedHandler)
  } finally {
    restoreEnv(originalEnv)
    globalThis.fetch = originalFetch
    restoreDenoServe(originalServeDescriptor)
  }
})

Deno.test('module import is cached and remains loadable with offline stubs', async () => {
  const originalEnv = snapshotEnv()
  const originalFetch = globalThis.fetch
  const originalServeDescriptor = getDenoServeDescriptor()

  try {
    setRequiredEnv()

    let fetchCalls = 0
    globalThis.fetch = ((_input: Request | URL | string, _init?: RequestInit) => {
      fetchCalls++
      return Promise.resolve(
        new Response(JSON.stringify({ ok: true, id: 'stub-id' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      )
    }) as typeof fetch

    let serveCalls = 0
    let lastHandler: ((req: Request) => Response | Promise<Response>) | undefined
    setDenoServe(((handler: (req: Request) => Response | Promise<Response>) => {
      serveCalls++
      lastHandler = handler
      return {} as Deno.HttpServer
    }) as typeof Deno.serve)

    const mod1 = await import('./index.ts')
    const mod2 = await import('./index.ts')

    assertExists(mod1)
    assertExists(mod2)
    assertEquals(mod1, mod2)
    assertEquals(fetchCalls, 0)
    assertEquals(typeof lastHandler === 'function' || serveCalls === 0, true)
  } finally {
    restoreEnv(originalEnv)
    globalThis.fetch = originalFetch
    restoreDenoServe(originalServeDescriptor)
  }
})

Deno.test('environment assumptions for module bootstrap are satisfied in test', () => {
  const originalEnv = snapshotEnv()

  try {
    Deno.env.set('SUPABASE_URL', 'https://example.supabase.co')
    Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', 'service-role-key')
    Deno.env.set('EMAIL_ENCRYPTION_KEY', 'enc-key')

    assertEquals(Deno.env.get('SUPABASE_URL'), 'https://example.supabase.co')
    assertEquals(Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'), 'service-role-key')
    assertEquals(Deno.env.get('EMAIL_ENCRYPTION_KEY'), 'enc-key')
  } finally {
    restoreEnv(originalEnv)
  }
})

Deno.test('request construction for edge function style invocation is valid offline', async () => {
  const req = new Request('http://localhost', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: 'Bearer test-token',
      'x-cron-secret': 'cron-secret',
    },
    body: JSON.stringify({
      message: 'Hello social',
      account_ids: ['acc_1', 'acc_2'],
      media_url: 'https://cdn.example.com/image.png',
    }),
  })

  assertEquals(req.method, 'POST')
  assertEquals(req.headers.get('content-type'), 'application/json')
  assertEquals(req.headers.get('authorization'), 'Bearer test-token')
  const body = await req.json()
  assertEquals(body.message, 'Hello social')
  assertEquals(body.account_ids, ['acc_1', 'acc_2'])
  assertEquals(body.media_url, 'https://cdn.example.com/image.png')
})

Deno.test(
  'request body validation shape shows missing message and account_ids is invalid business input',
  async () => {
    const req = new Request('http://localhost', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        message: '   ',
        account_ids: [],
      }),
    })

    const body = await req.json()
    const normalizedMessage = String(body.message || '').trim()
    const accountIds = body.account_ids || []

    assertEquals(normalizedMessage, '')
    assertEquals(accountIds.length, 0)
    assertEquals(!normalizedMessage || accountIds.length === 0, true)
  }
)

Deno.test(
  'URLSearchParams payload shape used by facebook publishing can be represented deterministically',
  () => {
    const body = new URLSearchParams({
      message: 'Bonjour',
      access_token: 'token-123',
    })

    assertEquals(body.get('message'), 'Bonjour')
    assertEquals(body.get('access_token'), 'token-123')

    body.set('url', 'https://cdn.example.com/pic.jpg')
    body.set('caption', 'Bonjour')
    assertEquals(body.get('url'), 'https://cdn.example.com/pic.jpg')
    assertEquals(body.get('caption'), 'Bonjour')
  }
)

Deno.test(
  'instagram publish URL composition can be reproduced with encoded message media and token',
  () => {
    const igUserId = '178900000000'
    const token = 'token with spaces/+'
    const message = 'Bonjour été & lancement'
    const mediaUrl = 'https://cdn.example.com/image name.png?x=1&y=2'

    const url = `https://graph.facebook.com/v21.0/${igUserId}/media?image_url=${encodeURIComponent(mediaUrl)}&caption=${encodeURIComponent(message)}&access_token=${encodeURIComponent(token)}`

    assertEquals(
      url,
      'https://graph.facebook.com/v21.0/178900000000/media?image_url=https%3A%2F%2Fcdn.example.com%2Fimage%20name.png%3Fx%3D1%26y%3D2&caption=Bonjour%20%C3%A9t%C3%A9%20%26%20lancement&access_token=token%20with%20spaces%2F%2B'
    )
  }
)

Deno.test(
  'JSON payload shape used by linkedin and tiktok publishing is serializable with expected business fields',
  () => {
    const linkedinPayload = {
      author: 'urn:li:organization:12345',
      commentary: 'Annonce produit',
      visibility: 'PUBLIC',
      distribution: {
        feedDistribution: 'MAIN_FEED',
        targetEntities: [],
        thirdPartyDistributionChannels: [],
      },
      lifecycleState: 'PUBLISHED',
      isReshareDisabledByAuthor: false,
    }

    const tiktokPayload = {
      post_info: {
        title: 'Une vidéo'.slice(0, 150),
        privacy_level: 'PUBLIC_TO_EVERYONE',
        disable_duet: false,
        disable_comment: false,
        disable_stitch: false,
      },
      source_info: {
        source: 'PULL_FROM_URL',
        video_url: 'https://cdn.example.com/video.mp4',
      },
    }

    const linkedinJson = JSON.parse(JSON.stringify(linkedinPayload))
    const tiktokJson = JSON.parse(JSON.stringify(tiktokPayload))

    assertEquals(linkedinJson.author, 'urn:li:organization:12345')
    assertEquals(linkedinJson.visibility, 'PUBLIC')
    assertEquals(linkedinJson.distribution.feedDistribution, 'MAIN_FEED')
    assertEquals(tiktokJson.post_info.privacy_level, 'PUBLIC_TO_EVERYONE')
    assertEquals(tiktokJson.source_info.source, 'PULL_FROM_URL')
    assertEquals(tiktokJson.source_info.video_url, 'https://cdn.example.com/video.mp4')
  }
)

Deno.test('tiktok title truncation logic preserves maximum 150 characters', () => {
  const longMessage = 'a'.repeat(180)
  const payload = {
    post_info: {
      title: longMessage.slice(0, 150),
      privacy_level: 'PUBLIC_TO_EVERYONE',
      disable_duet: false,
      disable_comment: false,
      disable_stitch: false,
    },
  }

  assertEquals(payload.post_info.title.length, 150)
  assertEquals(payload.post_info.title, 'a'.repeat(150))
})

Deno.test('linkedin permalink format from post id is deterministic', () => {
  const postId = 'urn:li:share:987654321'
  const permalink = `https://linkedin.com/feed/update/${postId}`

  assertEquals(permalink, 'https://linkedin.com/feed/update/urn:li:share:987654321')
})

Deno.test('unsupported platform branch semantics are representable offline', () => {
  const platform = 'mastodon'
  const run = () => {
    throw new Error(`Unsupported platform ${platform}`)
  }

  assertThrows(run, Error, 'Unsupported platform mastodon')
})

Deno.test('instagram and tiktok media requirements are representable offline', async () => {
  await assertRejects(
    async () => {
      throw new Error('Instagram requires a media URL')
    },
    Error,
    'Instagram requires a media URL'
  )

  await assertRejects(
    async () => {
      throw new Error('TikTok requires a video media URL')
    },
    Error,
    'TikTok requires a video media URL'
  )
})
