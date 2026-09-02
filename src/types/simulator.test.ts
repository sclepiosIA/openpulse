/// <reference types="vitest" />
import React from 'react'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

export const test = {}

const { AUTH_STATE, toast, nav, BUILDER_STATE, mockFrom, mockSupabase, queryState, resetQueryState } = vi.hoisted(() => {
  const AUTH_STATE = {
    user: { id: 'u1', email: 't@t.co' },
    session: { user: { id: 'u1' } },
    isLoading: false,
    isAdmin: true,
    role: 'admin',
  }

  const toast = {
    success: vi.fn(),
    error: vi.fn(),
    message: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
    loading: vi.fn(),
    dismiss: vi.fn(),
    promise: vi.fn(),
  }

  const nav = {
    navigate: vi.fn(),
  }

  type SupabaseError = { message: string }
  type QueryResult<T> = { data: T | null; error: SupabaseError | null }

  const queryState: {
    selectResult: QueryResult<unknown>
    singleResult: QueryResult<unknown>
    maybeSingleResult: QueryResult<unknown>
    insertResult: QueryResult<unknown>
    updateResult: QueryResult<unknown>
    deleteResult: QueryResult<unknown>
  } = {
    selectResult: { data: null, error: null },
    singleResult: { data: null, error: null },
    maybeSingleResult: { data: null, error: null },
    insertResult: { data: null, error: null },
    updateResult: { data: null, error: null },
    deleteResult: { data: null, error: null },
  }

  const resetQueryState = () => {
    queryState.selectResult = { data: null, error: null }
    queryState.singleResult = { data: null, error: null }
    queryState.maybeSingleResult = { data: null, error: null }
    queryState.insertResult = { data: null, error: null }
    queryState.updateResult = { data: null, error: null }
    queryState.deleteResult = { data: null, error: null }
  }

  const BUILDER_STATE = {
    table: '',
    lastSelect: undefined as string | undefined,
    filters: [] as Array<{ method: string; args: unknown[] }>,
    insertPayload: undefined as unknown,
    updatePayload: undefined as unknown,
    deleteCalled: false,
  }

  const makeBuilder = () => {
    const builder: Record<string, unknown> = {}

    const chain = (method: string) => {
      return (...args: unknown[]) => {
        BUILDER_STATE.filters.push({ method, args })
        return builder
      }
    }

    builder.select = (columns?: string) => {
      BUILDER_STATE.lastSelect = columns
      return builder
    }
    builder.eq = chain('eq')
    builder.neq = chain('neq')
    builder.gte = chain('gte')
    builder.lte = chain('lte')
    builder.gt = chain('gt')
    builder.lt = chain('lt')
    builder.in = chain('in')
    builder.contains = chain('contains')
    builder.overlaps = chain('overlaps')
    builder.is = chain('is')
    builder.like = chain('like')
    builder.ilike = chain('ilike')
    builder.order = chain('order')
    builder.limit = chain('limit')
    builder.range = chain('range')
    builder.match = chain('match')

    builder.insert = (payload: unknown) => {
      BUILDER_STATE.insertPayload = payload
      return builder
    }
    builder.update = (payload: unknown) => {
      BUILDER_STATE.updatePayload = payload
      return builder
    }
    builder.delete = () => {
      BUILDER_STATE.deleteCalled = true
      return builder
    }
    builder.upsert = chain('upsert')

    builder.single = async () => queryState.singleResult
    builder.maybeSingle = async () => queryState.maybeSingleResult

    builder.then = (onFulfilled?: ((value: unknown) => unknown) | null, onRejected?: ((reason: unknown) => unknown) | null) => {
      const p = Promise.resolve(queryState.selectResult)
      return p.then(onFulfilled ?? undefined, onRejected ?? undefined)
    }
    builder.catch = (onRejected?: ((reason: unknown) => unknown) | null) => {
      const p = Promise.resolve(queryState.selectResult)
      return p.catch(onRejected ?? undefined)
    }
    builder.finally = (onFinally?: (() => void) | null) => {
      const p = Promise.resolve(queryState.selectResult)
      return p.finally(onFinally ?? undefined)
    }

    return builder
  }

  const mockFrom = vi.fn((table: string) => {
    BUILDER_STATE.table = table
    BUILDER_STATE.lastSelect = undefined
    BUILDER_STATE.filters = []
    BUILDER_STATE.insertPayload = undefined
    BUILDER_STATE.updatePayload = undefined
    BUILDER_STATE.deleteCalled = false
    return makeBuilder()
  })

  const mockSupabase = {
    from: mockFrom,
    auth: {
      getSession: vi.fn(async () => ({ data: { session: AUTH_STATE.session }, error: null })),
      getUser: vi.fn(async () => ({ data: { user: AUTH_STATE.user }, error: null })),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
      signOut: vi.fn(async () => ({ error: null })),
    },
    storage: {
      from: vi.fn(() => ({
        upload: vi.fn(async () => ({ data: { path: 'p' }, error: null })),
        download: vi.fn(async () => ({ data: new Blob(['x']), error: null })),
        getPublicUrl: vi.fn(() => ({ data: { publicUrl: 'http://localhost/x' } })),
        remove: vi.fn(async () => ({ data: [], error: null })),
      })),
    },
    rpc: vi.fn(async () => ({ data: null, error: null })),
  }

  return { AUTH_STATE, toast, nav, BUILDER_STATE, mockFrom, mockSupabase, queryState, resetQueryState }
})

vi.mock('@/integrations/supabase/client', () => ({ supabase: mockSupabase }))
vi.mock('@/lib/supabase', () => ({ supabase: mockSupabase }))
vi.mock('@/lib/supabaseClient', () => ({ supabase: mockSupabase }))
vi.mock('@/services/supabase', () => ({ supabase: mockSupabase }))

vi.mock('sonner', () => ({ toast }))

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return {
    ...actual,
    useNavigate: () => nav.navigate,
    useParams: () => ({}),
    useLocation: () => ({ pathname: '/', search: '', hash: '', state: null, key: 'k' }),
  }
})

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => AUTH_STATE,
}))
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => AUTH_STATE,
  AuthProvider: ({ children }: { children: React.ReactNode }) => React.createElement(React.Fragment, null, children),
}))
vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => AUTH_STATE,
  AuthProvider: ({ children }: { children: React.ReactNode }) => React.createElement(React.Fragment, null, children),
}))
vi.mock('@/hooks/useSession', () => ({
  useSession: () => ({ session: AUTH_STATE.session, user: AUTH_STATE.user, isLoading: false }),
}))
vi.mock('@/hooks/useAdminRole', () => ({
  useAdminRole: () => ({ isAdmin: true, isLoading: false }),
}))

describe('simulator.ts (types-only module)', () => {
  it('should export no runtime values (types-only) and be importable', async () => {
    const mod = await import('./simulator')
    expect(typeof mod).toBe('object')
    expect(Object.keys(mod)).toEqual([])
  })

  it('should not hit supabase during import', async () => {
    resetQueryState()
    await import('./simulator')
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it('renderHook wrapper sanity: does not hang and returns quickly (no queries triggered)', async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: 0, gcTime: 0 },
        mutations: { retry: 0 },
      },
    })
    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: queryClient }, children)

    const { result } = renderHook(() => {
      return { ok: true }
    }, { wrapper })

    await waitFor(() => {
      expect(result.current.ok).toBe(true)
    })
  })
})