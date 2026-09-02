import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'

const {
  AUTH_IP_ROWS,
  PROFILE_ROW,
  INSERTED_ROW,
  stableUser,
  toastSuccess,
  toastError,
  sanitizeSupabaseError,
  debugError,
  mockFrom,
  resetSupabaseResponses,
  setSupabaseResponse,
  getLastCallStateFor,
  getCallStatesForTable,
  clearAllMocks,
} = vi.hoisted(() => {
  type AuthorizedIPRow = {
    id: string
    ip_address: string
    description: string
    created_at: string
    updated_at: string
    created_by: string
  }

  const AUTH_IP_ROWS: readonly AuthorizedIPRow[] = [
    {
      id: 'ip1',
      ip_address: '192.168.0.10',
      description: 'Office',
      created_at: '2024-01-02T10:00:00Z',
      updated_at: '2024-01-02T10:00:00Z',
      created_by: 'p1',
    },
    {
      id: 'ip2',
      ip_address: '10.0.0.5',
      description: 'VPN',
      created_at: '2024-01-01T10:00:00Z',
      updated_at: '2024-01-01T10:00:00Z',
      created_by: 'p1',
    },
  ] as const

  const PROFILE_ROW = { id: 'p1' } as const

  const INSERTED_ROW: AuthorizedIPRow = {
    id: 'ip3',
    ip_address: '203.0.113.9',
    description: 'New',
    created_at: '2024-01-03T10:00:00Z',
    updated_at: '2024-01-03T10:00:00Z',
    created_by: 'p1',
  } as const

  const stableUser = { id: 'u1', email: 't@t.co' } as const

  const toastSuccess = vi.fn()
  const toastError = vi.fn()
  const sanitizeSupabaseError = vi.fn((e: unknown) => {
    if (e && typeof e === 'object' && 'message' in e && typeof (e as { message?: unknown }).message === 'string') {
      return (e as { message: string }).message
    }
    return 'error'
  })
  const debugError = vi.fn()

  type Table = 'authorized_ips' | 'profiles'
  type ResponseKey =
    | 'authorized_ips:selectList'
    | 'profiles:maybeSingle'
    | 'authorized_ips:insertSingle'
    | 'authorized_ips:delete'

  const defaultResponses: Record<ResponseKey, unknown> = {
    'authorized_ips:selectList': { data: AUTH_IP_ROWS, error: null },
    'profiles:maybeSingle': { data: PROFILE_ROW, error: null },
    'authorized_ips:insertSingle': { data: INSERTED_ROW, error: null },
    'authorized_ips:delete': { error: null },
  }

  const responses: Record<ResponseKey, unknown> = { ...defaultResponses }

  const resetSupabaseResponses = () => {
    ;(Object.keys(defaultResponses) as ResponseKey[]).forEach((k) => {
      responses[k] = defaultResponses[k]
    })
  }

  const setSupabaseResponse = (key: ResponseKey, value: unknown) => {
    responses[key] = value
  }

  type BuilderState = {
    table: Table | null
    select?: string
    order?: { column: string; ascending?: boolean }
    limit?: number
    filter?: { column: string; value: unknown }
    insertPayload?: unknown
    deleteCalled?: boolean
  }

  const callStates: BuilderState[] = []
  let current: BuilderState = { table: null }

  const clearAllMocks = () => {
    toastSuccess.mockClear()
    toastError.mockClear()
    sanitizeSupabaseError.mockClear()
    debugError.mockClear()
    mockFrom.mockClear()
    callStates.length = 0
    current = { table: null }
  }

  const getLastCallStateFor = (table: Table) => {
    for (let i = callStates.length - 1; i >= 0; i -= 1) {
      if (callStates[i]?.table === table) return callStates[i]
    }
    return undefined
  }

  const getCallStatesForTable = (table: Table) => callStates.filter((s) => s.table === table)

  const createThenable = <T,>(value: T) => {
    const promise = Promise.resolve(value)
    return {
      then: promise.then.bind(promise),
      catch: promise.catch.bind(promise),
      finally: promise.finally.bind(promise),
    }
  }

  const resolveFromCurrent = () => {
    if (current.table === 'profiles') return responses['profiles:maybeSingle']
    if (current.table === 'authorized_ips') {
      if (current.insertPayload) return responses['authorized_ips:insertSingle']
      if (current.deleteCalled) return responses['authorized_ips:delete']
      return responses['authorized_ips:selectList']
    }
    return { data: null, error: { message: 'unknown' } }
  }

  const builder = {
    select: (columns?: string) => {
      current.select = columns
      return builder
    },
    eq: (column: string, value: unknown) => {
      current.filter = { column, value }
      return builder
    },
    gte: (_column: string, _value: unknown) => builder,
    lte: (_column: string, _value: unknown) => builder,
    in: (_column: string, _value: unknown[]) => builder,
    order: (column: string, options?: { ascending?: boolean }) => {
      current.order = { column, ascending: options?.ascending }
      return builder
    },
    limit: (count: number) => {
      current.limit = count
      return createThenable(resolveFromCurrent())
    },
    insert: (payload: unknown) => {
      current.insertPayload = payload
      return builder
    },
    update: (_payload: unknown) => builder,
    delete: () => {
      current.deleteCalled = true
      return builder
    },
    single: () => createThenable(resolveFromCurrent()),
    maybeSingle: () => createThenable(resolveFromCurrent()),
    then: (onFulfilled: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) => {
      return Promise.resolve(resolveFromCurrent()).then(onFulfilled, onRejected)
    },
    catch: (onRejected: (e: unknown) => unknown) => {
      return Promise.resolve(resolveFromCurrent()).catch(onRejected)
    },
  }

  const mockFrom = vi.fn((table: string) => {
    current = { table: table as Table }
    callStates.push(current)
    return builder
  })

  return {
    AUTH_IP_ROWS,
    PROFILE_ROW,
    INSERTED_ROW,
    stableUser,
    toastSuccess,
    toastError,
    sanitizeSupabaseError,
    debugError,
    mockFrom,
    resetSupabaseResponses,
    setSupabaseResponse,
    getLastCallStateFor,
    getCallStatesForTable,
    clearAllMocks,
  }
})

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
  },
}))

vi.mock('sonner', () => ({
  toast: {
    success: toastSuccess,
    error: toastError,
  },
}))

vi.mock('@/lib/supabaseErrorSanitizer', () => ({
  sanitizeSupabaseError,
}))

vi.mock('@/lib/debug', () => ({
  debug: {
    error: debugError,
  },
}))

vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => ({
    user: stableUser,
    session: { user: stableUser },
    isLoading: false,
  }),
}))

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  })

  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children)
}

describe('useAuthorizedIPs', () => {
  beforeEach(() => {
    clearAllMocks()
    resetSupabaseResponses()
  })

  it('charge puis retourne la liste des IPs autorisées (succès)', async () => {
    const mod = await import('./useAuthorizedIPs')
    const wrapper = createWrapper()

    const { result } = renderHook(() => mod.useAuthorizedIPs(), { wrapper })

    expect(result.current.isLoading).toBe(true)

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(mockFrom).toHaveBeenCalledWith('authorized_ips')
    expect(result.current.data).toEqual(AUTH_IP_ROWS)

    const state = getLastCallStateFor('authorized_ips')
    expect(state?.select).toBe('id, ip_address, description, created_at, updated_at, created_by')
    expect(state?.order).toEqual({ column: 'created_at', ascending: false })
    expect(state?.limit).toBe(500)

    expect(result.current.data?.[0]?.ip_address).toBe('192.168.0.10')
    expect(result.current.data?.[0]?.description).toBe('Office')
  })

  it("passe en erreur si Supabase renvoie une erreur (useAuthorizedIPs) et log l'erreur", async () => {
    setSupabaseResponse('authorized_ips:selectList', { data: null, error: { message: 'x' } })

    const mod = await import('./useAuthorizedIPs')
    const wrapper = createWrapper()

    const { result } = renderHook(() => mod.useAuthorizedIPs(), { wrapper })

    await waitFor(() => expect(result.current.isError).toBe(true))

    expect(debugError).toHaveBeenCalledTimes(1)
    expect(toastError).not.toHaveBeenCalled()
  })
})

describe('useAddAuthorizedIP', () => {
  beforeEach(() => {
    clearAllMocks()
    resetSupabaseResponses()
  })

  it('insère une IP avec created_by issu du profil, invalide le cache et toast success', async () => {
    const mod = await import('./useAuthorizedIPs')
    const wrapper = createWrapper()

    const { result } = renderHook(() => mod.useAddAuthorizedIP(), { wrapper })

    await act(async () => {
      const created = await result.current.mutateAsync({ ip_address: '203.0.113.9', description: 'New' })
      expect(created).toEqual(INSERTED_ROW)
    })

    expect(mockFrom).toHaveBeenCalledWith('profiles')
    expect(mockFrom).toHaveBeenCalledWith('authorized_ips')

    const lastAuthorizedIpsCall = getLastCallStateFor('authorized_ips')
    expect(lastAuthorizedIpsCall?.insertPayload).toEqual({
      ip_address: '203.0.113.9',
      description: 'New',
      created_by: 'p1',
    })

    const profileCall = getLastCallStateFor('profiles')
    expect(profileCall?.filter).toEqual({ column: 'user_id', value: 'u1' })

    expect(toastSuccess).toHaveBeenCalledWith('IP autorisée ajoutée avec succès')
    expect(toastError).not.toHaveBeenCalled()
  })

  it("toast error et sanitize l'erreur si insertion échoue", async () => {
    setSupabaseResponse('authorized_ips:insertSingle', { data: null, error: { message: 'x' } })

    const mod = await import('./useAuthorizedIPs')
    const wrapper = createWrapper()

    const { result } = renderHook(() => mod.useAddAuthorizedIP(), { wrapper })

    await act(async () => {
      await expect(result.current.mutateAsync({ ip_address: '203.0.113.9' })).rejects.toMatchObject({ message: 'x' })
    })

    expect(sanitizeSupabaseError).toHaveBeenCalledTimes(1)
    expect(toastError).toHaveBeenCalledWith('x')
    expect(debugError).toHaveBeenCalledTimes(1)
  })
})

describe('useDeleteAuthorizedIP', () => {
  beforeEach(() => {
    clearAllMocks()
    resetSupabaseResponses()
  })

  it("supprime une IP, invalide le cache et toast success; l'API reçoit le bon id", async () => {
    const mod = await import('./useAuthorizedIPs')
    const wrapper = createWrapper()

    const { result } = renderHook(() => mod.useDeleteAuthorizedIP(), { wrapper })

    await act(async () => {
      await result.current.mutateAsync('ip2')
    })

    expect(mockFrom).toHaveBeenCalledWith('authorized_ips')

    const lastAuthorizedIpsCall = getLastCallStateFor('authorized_ips')
    expect(lastAuthorizedIpsCall?.deleteCalled).toBe(true)
    expect(lastAuthorizedIpsCall?.filter).toEqual({ column: 'id', value: 'ip2' })

    expect(toastSuccess).toHaveBeenCalledWith('IP autorisée supprimée avec succès')
  })

  it("toast error et sanitize l'erreur si suppression échoue", async () => {
    setSupabaseResponse('authorized_ips:delete', { error: { message: 'x' } })

    const mod = await import('./useAuthorizedIPs')
    const wrapper = createWrapper()

    const { result } = renderHook(() => mod.useDeleteAuthorizedIP(), { wrapper })

    await act(async () => {
      await expect(result.current.mutateAsync('ip1')).rejects.toMatchObject({ message: 'x' })
    })

    expect(sanitizeSupabaseError).toHaveBeenCalledTimes(1)
    expect(toastError).toHaveBeenCalledWith('x')
    expect(debugError).toHaveBeenCalledTimes(1)

    const calls = getCallStatesForTable('authorized_ips')
    expect(calls.some((c) => c.filter?.column === 'id' && c.filter?.value === 'ip1')).toBe(true)
  })
})