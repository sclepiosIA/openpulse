/* @vitest-environment jsdom */

import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor, act } from '@testing-library/react'
import { useRegenerateTasks } from './useRegenerateTasks'

const {
  AUTH_STATE,
  toastFn,
  mockUseToast,
  mockDebugError,
  mockRpc,
  mockFrom,
  RPC_SUCCESS,
  RPC_ERROR,
} = vi.hoisted(() => {
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    gte: vi.fn(() => builder),
    lte: vi.fn(() => builder),
    in: vi.fn(() => builder),
    order: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    insert: vi.fn(() => builder),
    update: vi.fn(() => builder),
    delete: vi.fn(() => builder),
    single: vi.fn(async () => ({ data: null, error: null })),
    maybeSingle: vi.fn(async () => ({ data: null, error: null })),
    then: (onFulfilled: (value: { data: null; error: null }) => unknown) =>
      Promise.resolve({ data: null, error: null }).then(onFulfilled),
    catch: (onRejected: (reason: unknown) => unknown) =>
      Promise.resolve({ data: null, error: null }).catch(onRejected),
  }

  return {
    AUTH_STATE: {
      user: { id: 'u1', email: 't@t.co' },
      session: { user: { id: 'u1' } },
      isLoading: false,
    },
    toastFn: vi.fn(),
    mockUseToast: vi.fn(),
    mockDebugError: vi.fn(),
    mockRpc: vi.fn(),
    mockFrom: vi.fn(() => builder),
    RPC_SUCCESS: { data: 3, error: null },
    RPC_ERROR: { data: null, error: { message: 'x' } },
  }
})

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
    rpc: mockRpc,
  },
}))

vi.mock('@/hooks/shared/use-toast', () => ({
  useToast: mockUseToast,
}))

vi.mock('@/lib/debug', () => ({
  debug: {
    error: mockDebugError,
  },
}))

vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => AUTH_STATE,
}))

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => AUTH_STATE,
}))

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => AUTH_STATE,
}))

describe('useRegenerateTasks', () => {
  function createWrapper() {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: 0, gcTime: 0 },
        mutations: { retry: 0 },
      },
    })

    const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries')

    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: queryClient }, children)

    return { wrapper, invalidateQueriesSpy }
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockUseToast.mockReturnValue({ toast: toastFn })
  })

  it('réussit et applique les effets métier attendus', async () => {
    mockRpc.mockResolvedValueOnce(RPC_SUCCESS)

    const { wrapper, invalidateQueriesSpy } = createWrapper()
    const { result } = renderHook(() => useRegenerateTasks(), { wrapper })

    expect(result.current.isPending).toBe(false)
    expect(result.current.isSuccess).toBe(false)
    expect(result.current.isError).toBe(false)

    let returned: number | undefined

    await act(async () => {
      returned = await result.current.mutateAsync('eta-1')
    })

    expect(returned).toBe(3)

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(mockRpc).toHaveBeenCalledTimes(1)
    expect(mockRpc).toHaveBeenCalledWith('regenerate_missing_tasks', {
      p_etablissement_id: 'eta-1',
    })
    expect(result.current.data).toBe(3)
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ['taches'] })
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({
      queryKey: ['etablissement', 'eta-1'],
    })
    expect(toastFn).toHaveBeenCalledWith({
      title: 'Tâches régénérées',
      description: '3 tâche(s) manquante(s) créée(s) avec succès',
    })
    expect(mockDebugError).not.toHaveBeenCalled()
  })

  it('retourne une erreur et déclenche le toast destructif ainsi que le log debug', async () => {
    mockRpc.mockResolvedValueOnce(RPC_ERROR)

    const { wrapper, invalidateQueriesSpy } = createWrapper()
    const { result } = renderHook(() => useRegenerateTasks(), { wrapper })

    let caught: unknown

    await act(async () => {
      try {
        await result.current.mutateAsync('eta-err')
      } catch (error) {
        caught = error
      }
    })

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })

    expect(caught).toEqual({ message: 'x' })
    expect(mockRpc).toHaveBeenCalledTimes(1)
    expect(mockRpc).toHaveBeenCalledWith('regenerate_missing_tasks', {
      p_etablissement_id: 'eta-err',
    })
    expect(result.current.error).toEqual({ message: 'x' })
    expect(mockDebugError).toHaveBeenCalledWith('Error regenerating tasks:', { message: 'x' })
    expect(toastFn).toHaveBeenCalledWith({
      title: 'Erreur',
      description: 'Impossible de régénérer les tâches',
      variant: 'destructive',
    })
    expect(invalidateQueriesSpy).not.toHaveBeenCalledWith({ queryKey: ['taches'] })
    expect(invalidateQueriesSpy).not.toHaveBeenCalledWith({
      queryKey: ['etablissement', 'eta-err'],
    })
  })
})