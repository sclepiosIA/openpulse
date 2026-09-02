/// <reference types="vitest" />
/**
 * @vitest-environment jsdom
 */

import React, { type PropsWithChildren } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor, act } from '@testing-library/react'

const { STABLE_USER, toastMock, mockNavigate, stableNow } = vi.hoisted(() => ({
  STABLE_USER: { id: 'u1', email: 't@t.co' },
  toastMock: { success: vi.fn(), error: vi.fn() },
  mockNavigate: vi.fn(),
  stableNow: 1700000,
}))

vi.mock('sonner', () => ({
  toast: toastMock,
}))

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useLocation: () => ({ pathname: '/' }),
  useParams: () => ({}),
}))

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    user: STABLE_USER,
    session: { user: STABLE_USER },
    isLoading: false,
  }),
}))

vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => ({
    user: STABLE_USER,
    session: { user: STABLE_USER },
    isLoading: false,
  }),
  AuthProvider: ({ children }: PropsWithChildren) => React.createElement(React.Fragment, null, children),
}))

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: STABLE_USER,
    session: { user: STABLE_USER },
    isLoading: false,
  }),
}))

const { supabaseMock } = vi.hoisted(() => {
  const state = {
    mode: 'success' as 'success' | 'error',
    data: null as unknown,
    errorMessage: 'x',
  }

  type ResultShape = { data: unknown | null; error: { message: string } | null }

  const builderProto = {
    _table: '' as string,
    _payload: undefined as unknown,
    _filters: [] as Array<[string, unknown]>,
    select: vi.fn(function (this: typeof builderProto) {
      return this
    }),
    eq: vi.fn(function (this: typeof builderProto, col: string, val: unknown) {
      this._filters.push([col, val])
      return this
    }),
    gte: vi.fn(function (this: typeof builderProto) {
      return this
    }),
    lte: vi.fn(function (this: typeof builderProto) {
      return this
    }),
    in: vi.fn(function (this: typeof builderProto) {
      return this
    }),
    order: vi.fn(function (this: typeof builderProto) {
      return this
    }),
    limit: vi.fn(function (this: typeof builderProto) {
      return this
    }),
    insert: vi.fn(function (this: typeof builderProto, payload: unknown) {
      this._payload = payload
      return this
    }),
    update: vi.fn(function (this: typeof builderProto, payload: unknown) {
      this._payload = payload
      return this
    }),
    delete: vi.fn(function (this: typeof builderProto) {
      return this
    }),
    upsert: vi.fn(function (this: typeof builderProto, payload: unknown) {
      this._payload = payload
      return this
    }),
    single: vi.fn(async function (this: typeof builderProto): Promise<ResultShape> {
      return state.mode === 'error'
        ? { data: null, error: { message: state.errorMessage } }
        : { data: state.data, error: null }
    }),
    maybeSingle: vi.fn(async function (this: typeof builderProto): Promise<ResultShape> {
      return state.mode === 'error'
        ? { data: null, error: { message: state.errorMessage } }
        : { data: state.data, error: null }
    }),
    then: function <TResult1 = ResultShape, TResult2 = never>(
      this: typeof builderProto,
      onfulfilled?: ((value: ResultShape) => TResult1 | PromiseLike<TResult1>) | null,
      onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
    ) {
      const res: ResultShape =
        state.mode === 'error' ? { data: null, error: { message: state.errorMessage } } : { data: state.data, error: null }
      return Promise.resolve(res).then(onfulfilled as never, onrejected as never)
    },
    catch: function <TResult = never>(
      this: typeof builderProto,
      onrejected?: ((reason: unknown) => TResult | PromiseLike<TResult>) | null
    ) {
      const res: ResultShape =
        state.mode === 'error' ? { data: null, error: { message: state.errorMessage } } : { data: state.data, error: null }
      return Promise.resolve(res).catch(onrejected as never)
    },
  }

  const mockFrom = vi.fn((table: string) => {
    const b = Object.create(builderProto) as typeof builderProto
    b._table = table
    b._payload = undefined
    b._filters = []
    return b
  })

  const supabase = {
    from: mockFrom,
    auth: {
      getSession: vi.fn(async () => ({ data: { session: { user: STABLE_USER } }, error: null })),
      getUser: vi.fn(async () => ({ data: { user: STABLE_USER }, error: null })),
    },
    rpc: vi.fn(() => {
      const b = Object.create(builderProto) as typeof builderProto
      b._table = 'rpc'
      b._payload = undefined
      b._filters = []
      return b
    }),
    storage: {
      from: vi.fn(() => ({
        upload: vi.fn(async () => ({ data: null, error: null })),
        download: vi.fn(async () => ({ data: null, error: null })),
        remove: vi.fn(async () => ({ data: null, error: null })),
      })),
    },
    __setMockMode: (mode: 'success' | 'error', data: unknown, errorMessage?: string) => {
      state.mode = mode
      state.data = data
      if (errorMessage) state.errorMessage = errorMessage
    },
    __builderProto: builderProto,
    __state: state,
    __mockFrom: mockFrom,
  }

  return { supabaseMock: supabase }
})

vi.mock('@/integrations/supabase/client', () => ({
  supabase: supabaseMock,
}))

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: 0, gcTime: 0 }, mutations: { retry: 0 } },
  })
  return function Wrapper({ children }: PropsWithChildren) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children)
  }
}

describe('classification.ts', () => {
  it('exports nothing at runtime (types-only module)', async () => {
    const mod = await import('./classification')
    expect(typeof mod).toBe('object')
    expect(Object.keys(mod)).toEqual([])
  })

  it('does not touch supabase/toast/router at import time', async () => {
    supabaseMock.__mockFrom.mockClear()
    toastMock.success.mockClear()
    toastMock.error.mockClear()
    mockNavigate.mockClear()

    await import('./classification')

    expect(supabaseMock.__mockFrom).not.toHaveBeenCalled()
    expect(toastMock.success).not.toHaveBeenCalled()
    expect(toastMock.error).not.toHaveBeenCalled()
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it('renderHook works with QueryClientProvider wrapper (stable reference, no hang)', async () => {
    const wrapper = createWrapper()
    const { result } = renderHook(() => ({ ok: true, userId: STABLE_USER.id, now: stableNow }), { wrapper })

    await waitFor(() => {
      expect(result.current).toEqual({ ok: true, userId: 'u1', now: stableNow })
    })
  })

  it('simulates a thenable supabase query success + asserts chained calls', async () => {
    const { ROW } = vi.hoisted(() => ({
      ROW: { id: 'thr1', etablissement_id: 'e1', partenaire_id: null, groupe_id: 'g1' as string | null },
    }))
    supabaseMock.__setMockMode('success', ROW)

    const wrapper = createWrapper()
    const { result } = renderHook(
      () => ({
        run: async () => {
          const q = supabaseMock.from('email_threads').select('*').eq('id', 'thr1')
          const res = await q
          return res
        },
      }),
      { wrapper }
    )

    const resolved = await result.current.run()
    expect(resolved.error).toBeNull()
    expect(resolved.data).toEqual(ROW)

    expect(supabaseMock.__mockFrom).toHaveBeenCalledWith('email_threads')
    expect(supabaseMock.__builderProto.select).toHaveBeenCalledWith('*')
    expect(supabaseMock.__builderProto.eq).toHaveBeenCalledWith('id', 'thr1')
  })

  it('simulates a thenable supabase query error (data:null + error.message) and can be observed', async () => {
    supabaseMock.__setMockMode('error', null, 'x')

    const wrapper = createWrapper()
    const { result } = renderHook(
      () => ({
        run: async () => {
          const q = supabaseMock.from('email_threads').select('*').eq('id', 'thr1')
          const res = await q
          return res
        },
      }),
      { wrapper }
    )

    const resolved = await result.current.run()
    expect(resolved.data).toBeNull()
    expect(resolved.error).toEqual({ message: 'x' })
  })

  it('mutation-like flow: update payload is passed to builder.update and filtered with eq inside act', async () => {
    const { UPDATED_ROW, UPDATE_PAYLOAD } = vi.hoisted(() => ({
      UPDATED_ROW: { id: 'thr2', etablissement_id: null, partenaire_id: 'p1', groupe_id: null },
      UPDATE_PAYLOAD: { etablissement_id: null, partenaire_id: 'p1', groupe_id: null } as {
        etablissement_id: string | null
        partenaire_id: string | null
        groupe_id: string | null
      },
    }))
    supabaseMock.__setMockMode('success', UPDATED_ROW)

    supabaseMock.__builderProto.update.mockClear()
    supabaseMock.__builderProto.eq.mockClear()
    supabaseMock.__builderProto.single.mockClear()

    const wrapper = createWrapper()
    const { result } = renderHook(
      () => ({
        classify: async (threadId: string) => {
          return supabaseMock.from('email_threads').update(UPDATE_PAYLOAD).eq('id', threadId).single()
        },
      }),
      { wrapper }
    )

    await act(async () => {
      const res = await result.current.classify('thr2')
      expect(res.error).toBeNull()
      expect(res.data).toEqual(UPDATED_ROW)
    })

    expect(supabaseMock.__builderProto.update).toHaveBeenCalledWith(UPDATE_PAYLOAD)
    expect(supabaseMock.__builderProto.eq).toHaveBeenCalledWith('id', 'thr2')
    expect(supabaseMock.__builderProto.single).toHaveBeenCalled()
  })
})