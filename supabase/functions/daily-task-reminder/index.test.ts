import {
  assertEquals,
  assertExists,
  assertRejects,
  assertThrows,
} from 'https://deno.land/std@0.224.0/assert/mod.ts'

function snapshotEnv(keys: string[]) {
  return Object.fromEntries(keys.map((k) => [k, Deno.env.get(k)]))
}

function restoreEnv(snapshot: Record<string, string | undefined>) {
  for (const [k, v] of Object.entries(snapshot)) {
    if (v === undefined) Deno.env.delete(k)
    else Deno.env.set(k, v)
  }
}

function installNoopListener(): () => void {
  const listenDescriptor = Object.getOwnPropertyDescriptor(Deno, 'listen')
  const listenTlsDescriptor = Object.getOwnPropertyDescriptor(Deno, 'listenTls')
  const pending = <T>() => new Promise<T>(() => {})
  const listener = {
    addr: { transport: 'tcp', hostname: '127.0.0.1', port: 0 },
    rid: -1,
    close() {},
    accept: () => pending<Deno.Conn>(),
    [Symbol.asyncIterator]: () => ({
      next: () => pending<IteratorResult<Deno.Conn>>(),
    }),
  } as unknown as Deno.Listener

  Object.defineProperty(Deno, 'listen', {
    configurable: true,
    writable: true,
    value: () => listener,
  })
  Object.defineProperty(Deno, 'listenTls', {
    configurable: true,
    writable: true,
    value: () => listener,
  })

  return () => {
    if (listenDescriptor) {
      Object.defineProperty(Deno, 'listen', listenDescriptor)
    } else delete (Deno as unknown as Record<string, unknown>).listen
    if (listenTlsDescriptor) {
      Object.defineProperty(Deno, 'listenTls', listenTlsDescriptor)
    } else delete (Deno as unknown as Record<string, unknown>).listenTls
  }
}

async function importModuleFresh(suffix: string) {
  const restoreListener = installNoopListener()
  try {
    return await import(`./index.ts?test=${suffix}-${crypto.randomUUID()}`)
  } finally {
    restoreListener()
  }
}

Deno.test('module loads offline when required env is preset', async () => {
  const env = snapshotEnv([
    'RESEND_API_KEY',
    'CRON_SECRET',
    'INTERNAL_INVOCATION_SECRET',
    'SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
  ])

  try {
    Deno.env.set('RESEND_API_KEY', 're_test_key')
    Deno.env.set('CRON_SECRET', 'cron-secret')
    Deno.env.set('INTERNAL_INVOCATION_SECRET', 'internal-secret')
    Deno.env.set('SUPABASE_URL', 'https://example.supabase.co')
    Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', 'service-role-key')

    const mod = await importModuleFresh('loads')
    assertExists(mod)
  } finally {
    restoreEnv(env)
  }
})

Deno.test("le module s'importe meme sans transport de messagerie configure", async () => {
  const env = snapshotEnv(['RESEND_API_KEY'])
  try {
    Deno.env.delete('RESEND_API_KEY')
    const moduleSansTransport = await importModuleFresh('missing-resend-key')
    assertExists(moduleSansTransport)
  } finally {
    restoreEnv(env)
  }
})

Deno.test('environment variables can be set and restored for offline setup', () => {
  const env = snapshotEnv(['RESEND_API_KEY'])
  try {
    Deno.env.set('RESEND_API_KEY', 're_local_test')
    assertEquals(Deno.env.get('RESEND_API_KEY'), 're_local_test')
  } finally {
    restoreEnv(env)
  }
})

Deno.test('fetch can be stubbed offline and restored', async () => {
  const originalFetch = globalThis.fetch
  try {
    globalThis.fetch = ((_input: Request | URL | string, _init?: RequestInit) =>
      Promise.resolve(
        new Response(JSON.stringify({ ok: true, source: 'stub' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      )) as typeof fetch

    const response = await fetch('http://localhost/test')
    const json = await response.json()
    assertEquals(response.status, 200)
    assertEquals(json, { ok: true, source: 'stub' })
  } finally {
    globalThis.fetch = originalFetch
  }
})

Deno.test('assertThrows is usable in this test file', () => {
  assertThrows(
    () => {
      throw new Error('expected')
    },
    Error,
    'expected'
  )
})

Deno.test('assertRejects is usable in this test file', async () => {
  await assertRejects(
    async () => {
      throw new Error('async expected')
    },
    Error,
    'async expected'
  )
})
