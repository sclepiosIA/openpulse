import { assertEquals, assertExists } from 'https://deno.land/std@0.224.0/assert/mod.ts'

type EdgeHandler = (request: Request) => Response | Promise<Response>

function installServeStub(): {
  restore: () => void
  handler: () => EdgeHandler | undefined
} {
  const descriptor = Object.getOwnPropertyDescriptor(Deno, 'serve')
  let registeredHandler: EdgeHandler | undefined

  Object.defineProperty(Deno, 'serve', {
    configurable: true,
    writable: true,
    value: (...args: unknown[]) => {
      registeredHandler = args.find((arg) => typeof arg === 'function') as EdgeHandler | undefined
      return {
        addr: { transport: 'tcp', hostname: '127.0.0.1', port: 0 },
        finished: new Promise<void>(() => {}),
        ref() {},
        unref() {},
        shutdown: async () => {},
      }
    },
  })

  return {
    handler: () => registeredHandler,
    restore: () => {
      if (descriptor) Object.defineProperty(Deno, 'serve', descriptor)
      else delete (Deno as unknown as Record<string, unknown>).serve
    },
  }
}

Deno.test('module loads and registers a Deno.serve handler without opening a port', async () => {
  const serve = installServeStub()
  try {
    const mod = await import(`./index.ts?test=${crypto.randomUUID()}`)
    assertExists(mod)
    assertEquals(typeof serve.handler(), 'function')
  } finally {
    serve.restore()
  }
})
