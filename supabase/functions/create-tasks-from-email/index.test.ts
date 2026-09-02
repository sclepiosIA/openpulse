import { assertEquals, assertExists } from 'https://deno.land/std@0.224.0/assert/mod.ts'

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

async function withEnv<T>(fn: () => Promise<T>): Promise<T> {
  const backup = {
    INTERNAL_FUNCTION_SECRET: Deno.env.get('INTERNAL_FUNCTION_SECRET'),
    SUPABASE_SERVICE_ROLE_KEY: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
    SUPABASE_URL: Deno.env.get('SUPABASE_URL'),
  }

  try {
    Deno.env.set('INTERNAL_FUNCTION_SECRET', 'test-secret')
    Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', 'test-service-role')
    Deno.env.set('SUPABASE_URL', 'https://example.supabase.co')
    return await fn()
  } finally {
    for (const [key, value] of Object.entries(backup)) {
      if (value === undefined) Deno.env.delete(key)
      else Deno.env.set(key, value)
    }
  }
}

async function importModuleFresh() {
  const restoreListener = installNoopListener()
  try {
    return await import(`./index.ts?test=${crypto.randomUUID()}`)
  } finally {
    restoreListener()
  }
}

Deno.test('module loads with test environment without opening a port', async () => {
  await withEnv(async () => {
    const mod = await importModuleFresh()
    assertExists(mod)
  })
})

Deno.test('fresh module imports independently with isolated server listeners', async () => {
  await withEnv(async () => {
    const mod1 = await importModuleFresh()
    const mod2 = await importModuleFresh()
    assertExists(mod1)
    assertExists(mod2)
    assertEquals(typeof mod1, 'object')
    assertEquals(typeof mod2, 'object')
  })
})

Deno.test(
  'module import defers missing environment validation until request handling',
  async () => {
    const backup = {
      INTERNAL_FUNCTION_SECRET: Deno.env.get('INTERNAL_FUNCTION_SECRET'),
      SUPABASE_SERVICE_ROLE_KEY: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
      SUPABASE_URL: Deno.env.get('SUPABASE_URL'),
    }

    try {
      Deno.env.delete('INTERNAL_FUNCTION_SECRET')
      Deno.env.delete('SUPABASE_SERVICE_ROLE_KEY')
      Deno.env.delete('SUPABASE_URL')
      const mod = await importModuleFresh()
      assertExists(mod)
    } finally {
      for (const [key, value] of Object.entries(backup)) {
        if (value === undefined) Deno.env.delete(key)
        else Deno.env.set(key, value)
      }
    }
  }
)
