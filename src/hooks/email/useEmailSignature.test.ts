// @vitest-environment jsdom

import React from 'react'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useEmailSignature } from './useEmailSignature'

const {
  AUTH_STATE,
  PROFILE_ROW,
  CLEANED_SIGNATURE,
  builder,
  mockFrom,
  mockSelect,
  mockEq,
  mockMaybeSingle,
  mockCleanEmailSignature,
  mockDebugWarn,
} = vi.hoisted(() => {
  const AUTH_STATE: {
    user: { id: string; email: string } | null
    session: { user: { id: string } } | null
    isLoading: boolean
  } = {
    user: { id: 'u1', email: 't@t.co' },
    session: { user: { id: 'u1' } },
    isLoading: false,
  }

  const PROFILE_ROW: { email_signature: string } = {
    email_signature: '<div>raw sig</div>',
  }

  const CLEANED_SIGNATURE = '<p>clean sig</p>'

  const builder = {
    select: vi.fn(),
    eq: vi.fn(),
    gte: vi.fn(),
    lte: vi.fn(),
    in: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    single: vi.fn(),
    maybeSingle: vi.fn(),
    then: vi.fn(function (
      onFulfilled?: (value: unknown) => unknown,
      onRejected?: (reason: unknown) => unknown,
    ) {
      return Promise.resolve(builder.maybeSingle()).then(onFulfilled, onRejected)
    }),
    catch: vi.fn(function (onRejected?: (reason: unknown) => unknown) {
      return Promise.resolve(builder.maybeSingle()).catch(onRejected)
    }),
  }

  builder.select.mockReturnValue(builder)
  builder.eq.mockReturnValue(builder)
  builder.gte.mockReturnValue(builder)
  builder.lte.mockReturnValue(builder)
  builder.in.mockReturnValue(builder)
  builder.order.mockReturnValue(builder)
  builder.limit.mockReturnValue(builder)
  builder.insert.mockReturnValue(builder)
  builder.update.mockReturnValue(builder)
  builder.delete.mockReturnValue(builder)
  builder.single.mockResolvedValue({ data: null, error: null })
  builder.maybeSingle.mockResolvedValue({ data: PROFILE_ROW, error: null })

  const mockFrom = vi.fn(() => builder)
  const mockSelect = builder.select
  const mockEq = builder.eq
  const mockMaybeSingle = builder.maybeSingle

  const mockCleanEmailSignature = vi.fn(() => CLEANED_SIGNATURE)
  const mockDebugWarn = vi.fn()

  return {
    AUTH_STATE,
    PROFILE_ROW,
    CLEANED_SIGNATURE,
    builder,
    mockFrom,
    mockSelect,
    mockEq,
    mockMaybeSingle,
    mockCleanEmailSignature,
    mockDebugWarn,
  }
})

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
  },
}))

vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => AUTH_STATE,
}))

vi.mock('@/lib/emailUtils', () => ({
  cleanEmailSignature: mockCleanEmailSignature,
}))

vi.mock('@/lib/debug', () => ({
  debug: {
    warn: mockDebugWarn,
  },
}))

function createWrapper(): React.ComponentType<{ children: React.ReactNode }> {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  })

  return function Wrapper(props: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, props.children)
  }
}

describe('useEmailSignature', () => {
  beforeEach(() => {
    AUTH_STATE.user = { id: 'u1', email: 't@t.co' }
    AUTH_STATE.session = { user: { id: 'u1' } }
    AUTH_STATE.isLoading = false
    PROFILE_ROW.email_signature = '<div>raw sig</div>'

    mockFrom.mockClear()
    mockSelect.mockClear()
    mockEq.mockClear()
    mockMaybeSingle.mockReset()
    mockMaybeSingle.mockResolvedValue({ data: PROFILE_ROW, error: null })
    mockCleanEmailSignature.mockClear()
    mockCleanEmailSignature.mockReturnValue(CLEANED_SIGNATURE)
    mockDebugWarn.mockClear()

    builder.then.mockClear()
    builder.catch.mockClear()
  })

  it('charge la signature utilisateur puis renvoie la signature nettoyée', async () => {
    let resolveQuery:
      | ((value: { data: { email_signature: string } | null; error: null }) => void)
      | undefined

    mockMaybeSingle.mockImplementation(
      () =>
        new Promise<{ data: { email_signature: string } | null; error: null }>((resolve) => {
          resolveQuery = resolve
        }),
    )

    const { result } = renderHook(() => useEmailSignature(), {
      wrapper: createWrapper(),
    })

    expect(result.current.loading).toBe(true)
    expect(result.current.signature).toBe('')

    resolveQuery?.({ data: PROFILE_ROW, error: null })

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(mockFrom).toHaveBeenCalledWith('profiles')
    expect(mockSelect).toHaveBeenCalledWith('email_signature')
    expect(mockEq).toHaveBeenCalledWith('user_id', 'u1')
    expect(mockMaybeSingle).toHaveBeenCalledTimes(1)
    expect(mockCleanEmailSignature).toHaveBeenCalledWith('<div>raw sig</div>')
    expect(result.current.signature).toBe(CLEANED_SIGNATURE)
  })

  it("termine sans requête et sans signature quand il n'y a pas d'utilisateur", async () => {
    AUTH_STATE.user = null
    AUTH_STATE.session = null

    const { result } = renderHook(() => useEmailSignature(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.signature).toBe('')
    expect(mockFrom).not.toHaveBeenCalled()
    expect(mockCleanEmailSignature).not.toHaveBeenCalled()
  })

  it('gère une erreur Supabase en silence et laisse une signature vide', async () => {
    mockMaybeSingle.mockResolvedValue({
      data: null,
      error: { message: 'x' },
    })

    const { result } = renderHook(() => useEmailSignature(), {
      wrapper: createWrapper(),
    })

    expect(result.current.loading).toBe(true)
    expect(result.current.signature).toBe('')

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(mockFrom).toHaveBeenCalledWith('profiles')
    expect(mockSelect).toHaveBeenCalledWith('email_signature')
    expect(mockEq).toHaveBeenCalledWith('user_id', 'u1')
    expect(mockMaybeSingle).toHaveBeenCalledTimes(1)
    expect(mockCleanEmailSignature).not.toHaveBeenCalled()
    expect(result.current.signature).toBe('')
  })

  it('ne nettoie pas la signature quand le profil ne contient pas email_signature', async () => {
    mockMaybeSingle.mockResolvedValue({
      data: { email_signature: '' },
      error: null,
    })

    const { result } = renderHook(() => useEmailSignature(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.signature).toBe('')
    expect(mockCleanEmailSignature).not.toHaveBeenCalled()
  })
})