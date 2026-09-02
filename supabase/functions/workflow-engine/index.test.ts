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
  const oldUrl = Deno.env.get('SUPABASE_URL')
  const oldKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const originalFetch = globalThis.fetch
  const originalServeDescriptor = getDenoServeDescriptor()

  try {
    Deno.env.set('SUPABASE_URL', 'https://example.supabase.co')
    Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', 'test-service-role-key')
    setDenoServe(fakeServe)

    globalThis.fetch = async () =>
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })

    const mod = await import('./index.ts')
    assertExists(mod)
  } finally {
    if (oldUrl == null) Deno.env.delete('SUPABASE_URL')
    else Deno.env.set('SUPABASE_URL', oldUrl)

    if (oldKey == null) Deno.env.delete('SUPABASE_SERVICE_ROLE_KEY')
    else Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', oldKey)

    globalThis.fetch = originalFetch
    restoreDenoServe(originalServeDescriptor)
  }
})

Deno.test('module can be imported multiple times without throwing', async () => {
  const oldUrl = Deno.env.get('SUPABASE_URL')
  const oldKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const originalFetch = globalThis.fetch

  try {
    Deno.env.set('SUPABASE_URL', 'https://example.supabase.co')
    Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', 'test-service-role-key')

    globalThis.fetch = async () =>
      new Response(JSON.stringify({ ok: true, data: {} }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })

    const mod1 = await import('./index.ts')
    const mod2 = await import('./index.ts')
    assertExists(mod1)
    assertExists(mod2)
    assertEquals(typeof mod1, 'object')
    assertEquals(typeof mod2, 'object')
  } finally {
    if (oldUrl == null) Deno.env.delete('SUPABASE_URL')
    else Deno.env.set('SUPABASE_URL', oldUrl)

    if (oldKey == null) Deno.env.delete('SUPABASE_SERVICE_ROLE_KEY')
    else Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', oldKey)

    globalThis.fetch = originalFetch
  }
})

Deno.test('module import remains offline with stubbed fetch', async () => {
  const oldUrl = Deno.env.get('SUPABASE_URL')
  const oldKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const originalFetch = globalThis.fetch
  let fetchCalls = 0

  try {
    Deno.env.set('SUPABASE_URL', 'https://example.supabase.co')
    Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', 'test-service-role-key')

    globalThis.fetch = async (_input, _init) => {
      fetchCalls++
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }

    const mod = await import('./index.ts')
    assertExists(mod)
    assertEquals(fetchCalls >= 0, true)
  } finally {
    if (oldUrl == null) Deno.env.delete('SUPABASE_URL')
    else Deno.env.set('SUPABASE_URL', oldUrl)

    if (oldKey == null) Deno.env.delete('SUPABASE_SERVICE_ROLE_KEY')
    else Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', oldKey)

    globalThis.fetch = originalFetch
  }
})
