// @vitest-environment jsdom

import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor, act } from '@testing-library/react'
import { useRHEntretienMutation } from './useRHEntretienMutation'

const {
  authState,
  mockFrom,
  mockInsert,
  mockThen,
  mockCatch,
  toastSuccess,
  toastError,
  sanitizeSupabaseErrorMock,
  debugErrorMock,
} = vi.hoisted(() => {
  const auth = {
    user: { id: 'u1', email: 'user@test.dev' },
    session: { user: { id: 'u1' } },
    isLoading: false,
  }

  const insert = vi.fn()
  const builder = {
    insert,
    then: vi.fn(),
    catch: vi.fn(),
  }

  const from = vi.fn(() => builder)

  return {
    authState: auth,
    mockFrom: from,
    mockInsert: insert,
    mockThen: builder.then,
    mockCatch: builder.catch,
    toastSuccess: vi.fn(),
    toastError: vi.fn(),
    sanitizeSupabaseErrorMock: vi.fn((error: Error) => `Sanitized: ${error.message}`),
    debugErrorMock: vi.fn(),
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
  sanitizeSupabaseError: sanitizeSupabaseErrorMock,
}))

vi.mock('@/lib/debug', () => ({
  debug: {
    error: debugErrorMock,
  },
}))

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => authState,
}))

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children)
  }
}

describe('useRHEntretienMutation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('crée un entretien, invalide la query et affiche un toast de succès', async () => {
    mockInsert.mockResolvedValueOnce({ error: null })

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: 0, gcTime: 0 },
        mutations: { retry: 0 },
      },
    })
    const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries')
    const wrapper = createWrapper(queryClient)

    const { result } = renderHook(() => useRHEntretienMutation(), { wrapper })

    expect(result.current.isIdle).toBe(true)
    expect(result.current.isPending).toBe(false)

    const payload = {
      profile_id: 'p1',
      manager_id: 'm1',
      type: 'annuel',
      date_entretien: '2025-02-10',
    }

    await act(async () => {
      await result.current.mutateAsync(payload)
    })

    expect(mockFrom).toHaveBeenCalledWith('rh_entretiens')
    expect(mockInsert).toHaveBeenCalledWith({
      profile_id: 'p1',
      manager_id: 'm1',
      type: 'annuel',
      date_entretien: '2025-02-10',
      statut: 'planifie',
    })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ['rh-entretiens'] })
    expect(toastSuccess).toHaveBeenCalledWith('Entretien planifié avec succès')
    expect(toastError).not.toHaveBeenCalled()
    expect(debugErrorMock).not.toHaveBeenCalled()
  })

  it('passe par isPending pendant la mutation', async () => {
    let resolveInsert: ((value: { error: null }) => void) | undefined
    mockInsert.mockReturnValueOnce(
      new Promise<{ error: null }>((resolve) => {
        resolveInsert = resolve
      }),
    )

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: 0, gcTime: 0 },
        mutations: { retry: 0 },
      },
    })
    const wrapper = createWrapper(queryClient)

    const { result } = renderHook(() => useRHEntretienMutation(), { wrapper })

    act(() => {
      result.current.mutate({
        profile_id: 'p2',
        manager_id: 'm2',
        type: 'professionnel',
        date_entretien: '2025-03-15',
      })
    })

    await waitFor(() => {
      expect(result.current.isPending).toBe(true)
    })

    await act(async () => {
      if (resolveInsert) {
        resolveInsert({ error: null })
      }
    })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })
  })

  it('gère une erreur Supabase, expose isError et affiche un toast d’erreur', async () => {
    const supabaseError = { message: 'insert failed' }
    mockInsert.mockResolvedValueOnce({ error: supabaseError })

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: 0, gcTime: 0 },
        mutations: { retry: 0 },
      },
    })
    const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries')
    const wrapper = createWrapper(queryClient)

    const { result } = renderHook(() => useRHEntretienMutation(), { wrapper })

    await act(async () => {
      await expect(
        result.current.mutateAsync({
          profile_id: 'p3',
          manager_id: 'm3',
          type: 'retour',
          date_entretien: '2025-04-20',
        }),
      ).rejects.toEqual(supabaseError)
    })

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })

    expect(mockFrom).toHaveBeenCalledWith('rh_entretiens')
    expect(mockInsert).toHaveBeenCalledWith({
      profile_id: 'p3',
      manager_id: 'm3',
      type: 'retour',
      date_entretien: '2025-04-20',
      statut: 'planifie',
    })
    expect(debugErrorMock).toHaveBeenCalledWith('Erreur création entretien:', supabaseError)
    expect(sanitizeSupabaseErrorMock).toHaveBeenCalledWith(supabaseError)
    expect(toastError).toHaveBeenCalledWith('Sanitized: insert failed')
    expect(toastSuccess).not.toHaveBeenCalled()
    expect(invalidateQueriesSpy).not.toHaveBeenCalled()
  })
})