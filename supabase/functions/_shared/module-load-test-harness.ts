export type ModuleLoadStats = {
  listenCalls: number
  serveCalls: number
  serveHttpCalls: number
  fetchCalls: number
}

export type EdgeHandler = (request: Request) => Response | Promise<Response>

type DenoProperty = 'listen' | 'serve' | 'serveHttp'

type Restore = () => void

function replaceDenoProperty(name: DenoProperty, value: unknown): Restore {
  const descriptor = Object.getOwnPropertyDescriptor(Deno, name)
  Object.defineProperty(Deno, name, {
    configurable: true,
    writable: true,
    value,
  })

  return () => {
    if (descriptor) Object.defineProperty(Deno, name, descriptor)
    else delete (Deno as unknown as Record<string, unknown>)[name]
  }
}

/**
 * Imports an Edge Function while replacing all server entry points with inert
 * implementations. This covers both legacy std/http `serve` (listen +
 * serveHttp) and native Deno.serve functions without opening a TCP listener.
 */
export async function importEdgeModuleOffline(moduleUrl: URL): Promise<{
  module: Record<string, unknown>
  stats: ModuleLoadStats
  serveHandler?: EdgeHandler
}> {
  const stats: ModuleLoadStats = {
    listenCalls: 0,
    serveCalls: 0,
    serveHttpCalls: 0,
    fetchCalls: 0,
  }
  const restores: Restore[] = []

  const never = <T>() => new Promise<T>(() => {})
  const fakeListener = {
    addr: { transport: 'tcp', hostname: '127.0.0.1', port: 0 },
    close() {},
    ref() {},
    unref() {},
    accept: () => never<Deno.Conn>(),
    [Symbol.asyncIterator]() {
      return { next: () => never<IteratorResult<Deno.Conn>>() }
    },
  } as unknown as Deno.Listener
  const fakeServer = {
    finished: never<void>(),
    shutdown: async () => {},
    ref() {},
    unref() {},
    addr: { transport: 'tcp', hostname: '127.0.0.1', port: 0 },
  }

  const originalFetch = globalThis.fetch
  const originalConsoleLog = console.log
  let serveHandler: EdgeHandler | undefined
  try {
    restores.push(
      replaceDenoProperty('listen', () => {
        stats.listenCalls += 1
        return fakeListener
      })
    )
    restores.push(
      replaceDenoProperty('serveHttp', () => {
        stats.serveHttpCalls += 1
        return { nextRequest: () => never<null>(), close() {} }
      })
    )
    restores.push(
      replaceDenoProperty('serve', (arg1: unknown, arg2?: unknown) => {
        stats.serveCalls += 1
        const candidate = typeof arg1 === 'function' ? arg1 : arg2
        if (typeof candidate === 'function') {
          serveHandler = candidate as EdgeHandler
        }
        return fakeServer
      })
    )
    globalThis.fetch = (() => {
      stats.fetchCalls += 1
      throw new Error('Unexpected fetch while loading Edge Function module')
    }) as typeof fetch
    console.log = () => {}

    const module = await import(`${moduleUrl.href}?module-load-test=${crypto.randomUUID()}`)
    return { module, stats, serveHandler }
  } finally {
    console.log = originalConsoleLog
    globalThis.fetch = originalFetch
    for (const restore of restores.reverse()) restore()
  }
}
