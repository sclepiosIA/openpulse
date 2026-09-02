import React from 'react'
import { renderHook, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useEmailSync } from './useEmailSync'

const {
  mockInvoke,
  setInvokeResponses,
  clearInvokeResponses,
  mockFrom,
  setFromResponse,
  clearFromResponse,
  toast,
  debug,
  handleErrorMock,
} = vi.hoisted(() => {
  // Mutable queue for invoke responses
  const invokeQueue: Array<any> = []
  const mockInvoke = vi.fn(() => {
    const next = invokeQueue.shift()
    return Promise.resolve(next ?? { data: null, error: null })
  })
  const setInvokeResponses = (arr: Array<any>) => {
    invokeQueue.length = 0
    arr.forEach((v) => invokeQueue.push(v))
  }
  const clearInvokeResponses = () => {
    invokeQueue.length = 0
  }

  // fromExtended builder
  let fromResponse: any = { data: null }
  const setFromResponse = (val: any) => {
    fromResponse = val
  }
  const clearFromResponse = () => {
    fromResponse = { data: null }
  }
  const mockFrom = vi.fn(() => {
    const builder: any = {
      select: () => builder,
      eq: () => builder,
      maybeSingle: () => Promise.resolve(fromResponse),
    }
    return builder
  })

  // toast
  const toast = {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  }

  const debug = {
    log: vi.fn(),
    error: vi.fn(),
  }

  const handleErrorMock = vi.fn()

  return {
    mockInvoke,
    setInvokeResponses,
    clearInvokeResponses,
    mockFrom,
    setFromResponse,
    clearFromResponse,
    toast,
    debug,
    handleErrorMock,
  }
})

vi.mock('@/integrations/supabase/client', () => {
  return {
    supabase: {
      from: mockFrom,
      functions: {
        invoke: mockInvoke,
      },
    },
  }
})

vi.mock('sonner', () => {
  return {
    toast,
  }
})

vi.mock('@/lib/debug', () => {
  return {
    debug,
  }
})

vi.mock('../shared/useErrorHandler', () => {
  return {
    useErrorHandler: () => ({ handleError: handleErrorMock }),
  }
})

vi.mock('@/lib/supabaseTyped', () => {
  return {
    fromExtended: (arg: string) => {
      // delegate to mockFrom for consistent behavior
      return mockFrom(arg)
    },
  }
})

describe('useEmailSync', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    clearInvokeResponses()
    clearFromResponse()
  })

  const createQueryClient = () =>
    new QueryClient({
      defaultOptions: { queries: { retry: 0, gcTime: 0 }, mutations: { retry: 0 } },
    })

  const createWrapper = (client: QueryClient) => {
    return ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client }, children)
  }

  it('reconcileEmails returns deleted count on success and calls supabase functions.invoke with correct payload', async () => {
    setInvokeResponses([{ data: { deleted_count: 5 }, error: null }])

    const client = createQueryClient()
    const wrapper = createWrapper(client)

    const { result } = renderHook(() => useEmailSync('acct-1'), { wrapper })

    let deleted = -1
    await act(async () => {
      deleted = await result.current.reconcileEmails('acct-1')
    })

    expect(deleted).toBe(5)
    expect(mockInvoke).toHaveBeenCalledTimes(1)
    expect(mockInvoke).toHaveBeenCalledWith('sync-emails', {
      body: { account_id: 'acct-1', reconcile_only: true },
    })
    expect(debug.log).toHaveBeenCalledWith('🔄 Starting email reconciliation (deletion detection)...')
    expect(debug.log).toHaveBeenCalledWith('✅ Reconciliation completed:', { deleted: 5 })
  })

  it('reconcileEmails returns 0 and logs error when supabase returns an error', async () => {
    setInvokeResponses([{ data: null, error: { message: 'boom' } }])

    const client = createQueryClient()
    const wrapper = createWrapper(client)

    const { result } = renderHook(() => useEmailSync('acct-2'), { wrapper })

    let deleted = -1
    await act(async () => {
      deleted = await result.current.reconcileEmails('acct-2')
    })

    expect(deleted).toBe(0)
    expect(mockInvoke).toHaveBeenCalledTimes(1)
    expect(debug.error).toHaveBeenCalled()
  })

  it('syncNow performs multiple iterations and reports totals, sets deletedCount, dispatches event and invalidates queries', async () => {
    // syncSingleAccount will call invoke twice (two iterations), then reconcile once.
    setInvokeResponses([
      { data: { messages_synced: 2, has_more: true }, error: null },
      { data: { messages_synced: 3, has_more: false }, error: null },
      { data: { deleted_count: 2 }, error: null },
    ])

    const client = createQueryClient()
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries')
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent')

    const wrapper = createWrapper(client)
    const { result } = renderHook(() => useEmailSync('acct-3'), { wrapper })

    await act(async () => {
      await result.current.syncNow()
    })

    // Total synced = 2 + 3 = 5
    expect(toast.success).toHaveBeenCalledWith('5 nouveaux emails synchronisés')
    // Deleted count set and info toast called
    expect(result.current.deletedCount).toBe(2)
    expect(toast.info).toHaveBeenCalledWith('2 emails supprimés depuis votre client mail')
    // dispatch event and invalidateQueries called
    expect(dispatchSpy).toHaveBeenCalled()
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['email-counts'] })
    // progress resets to 0 after completion
    expect(result.current.syncProgress).toBe(0)
    expect(result.current.isSyncing).toBe(false)
  })

  it('fullSync for all accounts iterates accounts and shows success message when none fail', async () => {
    // Two accounts: each sync returns 1 message and no has_more; each reconcile returns 0 deleted
    // For each account we need one invoke for sync (data.messages_synced), and one for reconcile
    setInvokeResponses([
      { data: { messages_synced: 1, has_more: false }, error: null }, // account 1 sync
      { data: { deleted_count: 0 }, error: null }, // account 1 reconcile
      { data: { messages_synced: 2, has_more: false }, error: null }, // account 2 sync
      { data: { deleted_count: 1 }, error: null }, // account 2 reconcile
    ])

    const accounts = [
      { id: 'a-1', email_address: 'one@example.com' },
      { id: 'a-2', email_address: 'two@example.com' },
    ]

    const client = createQueryClient()
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries')
    const wrapper = createWrapper(client)

    const { result } = renderHook(() => useEmailSync('all', accounts), { wrapper })

    await act(async () => {
      await result.current.fullSync()
    })

    // Total synced = 1 + 2 = 3
    expect(toast.success).toHaveBeenCalledWith('Synchronisation complète : 3 emails sur 2 comptes')
    // Total deleted = 0 + 1 = 1 => info toast about 1 deleted
    expect(toast.info).toHaveBeenCalledWith('1 email supprimé')
    expect(result.current.deletedCount).toBe(1)
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['email-counts'] })
  })

  it('getLastSyncDate returns null when accountId is missing or "all", otherwise returns date string from fromExtended', async () => {
    const dateStr = '2025-01-01T12:00:00Z'
    setFromResponse({ data: { last_sync_at: dateStr } })

    const client = createQueryClient()
    const wrapper = createWrapper(client)

    // Case accountId undefined
    const { result: r1 } = renderHook(() => useEmailSync(undefined), { wrapper })
    let res1 = undefined
    await act(async () => {
      res1 = await r1.current.getLastSyncDate()
    })
    expect(res1).toBeNull()

    // Case accountId 'all'
    const { result: r2 } = renderHook(() => useEmailSync('all'), { wrapper })
    let res2 = undefined
    await act(async () => {
      res2 = await r2.current.getLastSyncDate()
    })
    expect(res2).toBeNull()

    // Case accountId provided -> should call fromExtended and return the date
    const { result: r3 } = renderHook(() => useEmailSync('acct-4'), { wrapper })
    let res3 = undefined
    await act(async () => {
      res3 = await r3.current.getLastSyncDate()
    })
    expect(res3).toBe(dateStr)
    // ensure our mockFrom (fromExtended) was called
    expect(mockFrom).toHaveBeenCalled()
  })
})