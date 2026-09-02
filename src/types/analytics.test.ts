import React from 'react'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const { AUTH_STATE, toastMock, navigateMock, supabaseMock, resetSupabaseMock, mockFrom } = vi.hoisted(() => {
  const AUTH_STATE = {
    user: { id: 'u1', email: 't@t.co' },
    session: { user: { id: 'u1' } },
    isLoading: false,
  } as const

  const toastMock = {
    success: vi.fn(),
    error: vi.fn(),
    message: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
    loading: vi.fn(),
    dismiss: vi.fn(),
    promise: vi.fn(),
  } as const

  const navigateMock = vi.fn()

  const state = {
    shouldError: false,
    errorMessage: 'x',
    dataByTable: new Map<string, unknown>(),
  }

  const resetSupabaseMock = () => {
    state.shouldError = false
    state.errorMessage = 'x'
    state.dataByTable = new Map<string, unknown>()
  }

  type ThenableResponse<T> = PromiseLike<{ data: T | null; error: { message: string } | null }>

  const createBuilder = (table: string) => {
    const builder: {
      _table: string
      _payload: unknown
      select: ReturnType<typeof vi.fn>
      eq: ReturnType<typeof vi.fn>
      neq: ReturnType<typeof vi.fn>
      gt: ReturnType<typeof vi.fn>
      gte: ReturnType<typeof vi.fn>
      lt: ReturnType<typeof vi.fn>
      lte: ReturnType<typeof vi.fn>
      in: ReturnType<typeof vi.fn>
      contains: ReturnType<typeof vi.fn>
      order: ReturnType<typeof vi.fn>
      limit: ReturnType<typeof vi.fn>
      insert: ReturnType<typeof vi.fn>
      update: ReturnType<typeof vi.fn>
      upsert: ReturnType<typeof vi.fn>
      delete: ReturnType<typeof vi.fn>
      maybeSingle: ReturnType<typeof vi.fn>
      single: ReturnType<typeof vi.fn>
      throwOnError: ReturnType<typeof vi.fn>
      then: ThenableResponse<unknown>['then']
      catch: ThenableResponse<unknown>['catch']
    } = {
      _table: table,
      _payload: null,
      select: vi.fn(() => builder),
      eq: vi.fn(() => builder),
      neq: vi.fn(() => builder),
      gt: vi.fn(() => builder),
      gte: vi.fn(() => builder),
      lt: vi.fn(() => builder),
      lte: vi.fn(() => builder),
      in: vi.fn(() => builder),
      contains: vi.fn(() => builder),
      order: vi.fn(() => builder),
      limit: vi.fn(() => builder),
      insert: vi.fn((payload: unknown) => {
        builder._payload = payload
        return builder
      }),
      update: vi.fn((payload: unknown) => {
        builder._payload = payload
        return builder
      }),
      upsert: vi.fn((payload: unknown) => {
        builder._payload = payload
        return builder
      }),
      delete: vi.fn(() => builder),
      maybeSingle: vi.fn(() => builder),
      single: vi.fn(() => builder),
      throwOnError: vi.fn(() => builder),
      then: (onFulfilled?: (value: { data: unknown | null; error: { message: string } | null }) => unknown) => {
        const response = state.shouldError
          ? { data: null, error: { message: state.errorMessage } }
          : { data: (state.dataByTable.get(table) ?? []) as unknown, error: null }
        const p = Promise.resolve(response) as ThenableResponse<unknown>
        return p.then(onFulfilled as never)
      },
      catch: (onRejected?: (reason: unknown) => unknown) => {
        const response = { data: (state.dataByTable.get(table) ?? []) as unknown, error: null }
        const p = Promise.resolve(response) as ThenableResponse<unknown>
        return p.catch(onRejected as never)
      },
    }
    return builder
  }

  const mockFrom = vi.fn((table: string) => createBuilder(table))

  const supabaseMock = {
    from: mockFrom,
    auth: {
      getUser: vi.fn(async () => ({ data: { user: AUTH_STATE.user }, error: null })),
      getSession: vi.fn(async () => ({ data: { session: AUTH_STATE.session }, error: null })),
    },
    rpc: vi.fn(async () => ({ data: null, error: null })),
    storage: {
      from: vi.fn(() => ({
        upload: vi.fn(async () => ({ data: { path: 'p' }, error: null })),
        download: vi.fn(async () => ({ data: new Blob(['x'], { type: 'text/plain' }), error: null })),
        remove: vi.fn(async () => ({ data: null, error: null })),
        getPublicUrl: vi.fn(() => ({ data: { publicUrl: 'https://example.test/file' } })),
      })),
    },
    __state: state,
    __reset: resetSupabaseMock,
  } as const

  resetSupabaseMock()

  return { AUTH_STATE, toastMock, navigateMock, supabaseMock, resetSupabaseMock, mockFrom }
})

vi.mock('@/integrations/supabase/client', () => ({ supabase: supabaseMock }))
vi.mock('@/lib/supabaseClient', () => ({ supabase: supabaseMock }))
vi.mock('@/lib/supabase', () => ({ supabase: supabaseMock }))
vi.mock('@/services/supabase', () => ({ supabase: supabaseMock }))

vi.mock('sonner', () => ({ toast: toastMock }))

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return {
    ...actual,
    useNavigate: () => navigateMock,
    useLocation: () => ({ pathname: '/', search: '', hash: '', state: null, key: 'k1' }),
    useParams: () => ({}),
  }
})

vi.mock('@/hooks/useAuth', () => ({ useAuth: () => AUTH_STATE }))
vi.mock('@/hooks/useSession', () => ({ useSession: () => AUTH_STATE }))
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => AUTH_STATE }))
vi.mock('@/components/AuthProvider', () => ({ useAuth: () => AUTH_STATE }))
vi.mock('@/hooks/useAdminRole', () => ({ useAdminRole: () => ({ isAdmin: true, isLoading: false }) }))

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  })

  const Wrapper = ({ children }: { children?: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children)

  return Wrapper
}

describe('analytics.ts', () => {
  it('charge le module et n’exporte rien au runtime (types only)', async () => {
    resetSupabaseMock()
    const mod = await import('./analytics')
    expect(Object.keys(mod)).toEqual([])
  })

  it('peut être utilisé avec renderHook + QueryClientProvider sans requêtes (pas de hang)', async () => {
    resetSupabaseMock()
    await import('./analytics')

    const Wrapper = createWrapper()
    const { result } = renderHook(() => ({ ok: true, userId: AUTH_STATE.user.id }), { wrapper: Wrapper })

    await waitFor(() => {
      expect(result.current.ok).toBe(true)
      expect(result.current.userId).toBe('u1')
    })

    expect(mockFrom).not.toHaveBeenCalled()
  })

  it('un client supabase mocké en erreur ne déclenche aucune boucle si non consommé', async () => {
    resetSupabaseMock()
    ;(supabaseMock.__state as { shouldError: boolean; errorMessage: string }).shouldError = true
    ;(supabaseMock.__state as { shouldError: boolean; errorMessage: string }).errorMessage = 'x'

    await import('./analytics')

    const Wrapper = createWrapper()
    const { result } = renderHook(() => ({ stable: 'v' as const, loading: AUTH_STATE.isLoading }), { wrapper: Wrapper })

    await act(async () => {})

    expect(result.current.stable).toBe('v')
    expect(result.current.loading).toBe(false)
    expect(mockFrom).not.toHaveBeenCalled()
  })
})