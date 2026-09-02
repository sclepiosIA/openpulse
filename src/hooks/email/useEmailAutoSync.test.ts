import { renderHook, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement, type ReactNode } from 'react'

const {
  ROWS,
  SUCCESS_RESPONSE,
  ERROR_RESPONSE,
  NOT_FOUND_RESPONSE,
  invokeState,
  mockFrom,
  mockInvoke,
  mockDebugLog,
  mockDebugWarn,
  mockDebugError,
  builderFns,
} = vi.hoisted(() => {
  type Row = { id: string }
  type QueryResult = { data: Row[]; error: null }
  type InvokeError = { message: string; status?: number; context?: { status?: number } }
  type InvokeResponse = { data: { accepted: boolean } | null; error: InvokeError | null }
  type MockFn = ReturnType<typeof vi.fn>
  type Builder = {
    select: MockFn
    eq: MockFn
    neq: MockFn
    gte: MockFn
    lte: MockFn
    gt: MockFn
    lt: MockFn
    in: MockFn
    is: MockFn
    order: MockFn
    limit: MockFn
    insert: MockFn
    update: MockFn
    upsert: MockFn
    delete: MockFn
    single: MockFn
    maybeSingle: MockFn
    then: (
      onfulfilled?: ((value: QueryResult) => unknown) | null,
      onrejected?: ((reason: unknown) => unknown) | null
    ) => Promise<unknown>
    catch: (onrejected?: ((reason: unknown) => unknown) | null) => Promise<unknown>
  }

  const ROWS: Row[] = [{ id: 'row-1' }]
  const QUERY_RESULT: QueryResult = { data: ROWS, error: null }
  const SUCCESS_RESPONSE: InvokeResponse = { data: { accepted: true }, error: null }
  const ERROR_RESPONSE: InvokeResponse = { data: null, error: { message: 'x' } }
  const NOT_FOUND_RESPONSE: InvokeResponse = {
    data: null,
    error: { message: 'missing account', context: { status: 404 } },
  }
  const invokeState: { current: InvokeResponse } = { current: SUCCESS_RESPONSE }

  const builder = {} as Builder
  builder.select = vi.fn(() => builder)
  builder.eq = vi.fn(() => builder)
  builder.neq = vi.fn(() => builder)
  builder.gte = vi.fn(() => builder)
  builder.lte = vi.fn(() => builder)
  builder.gt = vi.fn(() => builder)
  builder.lt = vi.fn(() => builder)
  builder.in = vi.fn(() => builder)
  builder.is = vi.fn(() => builder)
  builder.order = vi.fn(() => builder)
  builder.limit = vi.fn(() => builder)
  builder.insert = vi.fn(() => builder)
  builder.update = vi.fn(() => builder)
  builder.upsert = vi.fn(() => builder)
  builder.delete = vi.fn(() => builder)
  builder.single = vi.fn(() => Promise.resolve({ data: ROWS[0], error: null }))
  builder.maybeSingle = vi.fn(() => Promise.resolve({ data: ROWS[0], error: null }))
  builder.then = (onfulfilled, onrejected) =>
    Promise.resolve(QUERY_RESULT).then(onfulfilled ?? undefined, onrejected ?? undefined)
  builder.catch = (onrejected) => Promise.resolve(QUERY_RESULT).catch(onrejected ?? undefined)

  const mockFrom = vi.fn(() => builder)
  const mockInvoke = vi.fn(() => Promise.resolve(invokeState.current))
  const mockDebugLog = vi.fn()
  const mockDebugWarn = vi.fn()
  const mockDebugError = vi.fn()

  return {
    ROWS,
    SUCCESS_RESPONSE,
    ERROR_RESPONSE,
    NOT_FOUND_RESPONSE,
    invokeState,
    mockFrom,
    mockInvoke,
    mockDebugLog,
    mockDebugWarn,
    mockDebugError,
    builderFns: [
      builder.select,
      builder.eq,
      builder.neq,
      builder.gte,
      builder.lte,
      builder.gt,
      builder.lt,
      builder.in,
      builder.is,
      builder.order,
      builder.limit,
      builder.insert,
      builder.update,
      builder.upsert,
      builder.delete,
      builder.single,
      builder.maybeSingle,
    ],
  }
})

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
    functions: {
      invoke: mockInvoke,
    },
  },
}))

vi.mock('@/lib/debug', () => ({
  debug: {
    log: mockDebugLog,
    warn: mockDebugWarn,
    error: mockDebugError,
  },
}))

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  })

  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children)
  }
}

async function flushPromises() {
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
  })
}

async function loadHook() {
  const module = await import('./useEmailAutoSync')
  return module.useEmailAutoSync
}

describe('useEmailAutoSync', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.useFakeTimers()
    vi.setSystemTime(100_000)
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'visible',
    })

    invokeState.current = SUCCESS_RESPONSE
    mockFrom.mockClear()
    mockInvoke.mockClear()
    mockDebugLog.mockClear()
    mockDebugWarn.mockClear()
    mockDebugError.mockClear()
    builderFns.forEach((fn) => fn.mockClear())
  })

  afterEach(() => {
    vi.clearAllTimers()
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('déclenche une synchronisation au montage et émet un événement realtime en succès', async () => {
    const useEmailAutoSync = await loadHook()
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent')

    renderHook(() => useEmailAutoSync('acc-1'), {
      wrapper: createWrapper(),
    })

    expect(ROWS).toEqual([{ id: 'row-1' }])
    expect(mockInvoke).toHaveBeenCalledTimes(1)
    expect(mockInvoke).toHaveBeenCalledWith('sync-emails', {
      body: {
        account_id: 'acc-1',
        mode: 'auto',
        trigger_source: 'mount',
      },
    })
    expect(mockDebugLog).toHaveBeenCalledWith('[auto-sync] triggered (mount)', {
      accountId: 'acc-1',
    })

    await flushPromises()

    expect(dispatchSpy).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'email-realtime-update' })
    )
    expect(mockDebugError).not.toHaveBeenCalled()
  })

  it('ne déclenche rien quand le hook est désactivé ou que le compte vaut all', async () => {
    const useEmailAutoSync = await loadHook()

    renderHook(() => useEmailAutoSync('acc-1', false), {
      wrapper: createWrapper(),
    })

    await act(async () => {
      window.dispatchEvent(new Event('focus'))
      vi.advanceTimersByTime(90_000)
      await Promise.resolve()
    })

    expect(mockInvoke).not.toHaveBeenCalled()

    renderHook(() => useEmailAutoSync('all'), {
      wrapper: createWrapper(),
    })

    await act(async () => {
      window.dispatchEvent(new Event('focus'))
      vi.advanceTimersByTime(90_000)
      await Promise.resolve()
    })

    expect(mockInvoke).not.toHaveBeenCalled()
  })

  it('respecte le debounce global puis synchronise au focus après trente secondes', async () => {
    const useEmailAutoSync = await loadHook()

    renderHook(() => useEmailAutoSync('acc-2'), {
      wrapper: createWrapper(),
    })

    await flushPromises()

    await act(async () => {
      vi.advanceTimersByTime(29_999)
      window.dispatchEvent(new Event('focus'))
      await Promise.resolve()
    })

    expect(mockInvoke).toHaveBeenCalledTimes(1)

    await act(async () => {
      vi.advanceTimersByTime(1)
      window.dispatchEvent(new Event('focus'))
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(mockInvoke).toHaveBeenCalledTimes(2)
    expect(mockInvoke).toHaveBeenNthCalledWith(2, 'sync-emails', {
      body: {
        account_id: 'acc-2',
        mode: 'auto',
        trigger_source: 'focus',
      },
    })
    expect(mockDebugLog).toHaveBeenNthCalledWith(2, '[auto-sync] triggered (focus)', {
      accountId: 'acc-2',
    })
  })

  it('lance le polling foreground toutes les quarante-cinq secondes quand l’onglet est visible', async () => {
    const useEmailAutoSync = await loadHook()

    renderHook(() => useEmailAutoSync('acc-3'), {
      wrapper: createWrapper(),
    })

    await flushPromises()

    await act(async () => {
      vi.advanceTimersByTime(45_000)
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(mockInvoke).toHaveBeenCalledTimes(2)
    expect(mockInvoke).toHaveBeenNthCalledWith(2, 'sync-emails', {
      body: {
        account_id: 'acc-3',
        mode: 'auto',
        trigger_source: 'interval',
      },
    })
  })

  it('journalise une erreur de fonction sans émettre de mise à jour realtime', async () => {
    const useEmailAutoSync = await loadHook()
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent')
    invokeState.current = ERROR_RESPONSE

    renderHook(() => useEmailAutoSync('acc-err'), {
      wrapper: createWrapper(),
    })

    await flushPromises()

    expect(mockInvoke).toHaveBeenCalledWith('sync-emails', {
      body: {
        account_id: 'acc-err',
        mode: 'auto',
        trigger_source: 'mount',
      },
    })
    expect(mockDebugError).toHaveBeenCalledWith('[auto-sync] error', { message: 'x' })
    expect(dispatchSpy).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: 'email-realtime-update' })
    )
  })

  it('blackliste un compte en erreur HTTP 4xx et évite les appels suivants de la session', async () => {
    const useEmailAutoSync = await loadHook()
    invokeState.current = NOT_FOUND_RESPONSE

    renderHook(() => useEmailAutoSync('acc-blocked'), {
      wrapper: createWrapper(),
    })

    await flushPromises()

    expect(mockInvoke).toHaveBeenCalledTimes(1)
    expect(mockDebugWarn).toHaveBeenCalledWith('[auto-sync] account blacklisted (client-side)', {
      accountId: 'acc-blocked',
      status: 404,
    })

    await act(async () => {
      vi.advanceTimersByTime(45_000)
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(mockInvoke).toHaveBeenCalledTimes(1)
    expect(mockDebugError).not.toHaveBeenCalled()
  })
})
