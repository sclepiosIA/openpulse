// @vitest-environment jsdom
import React from 'react'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  useDashboardNotes,
  useCreateNote,
  useUpdateNote,
  useDeleteNote,
  useReorderNotes,
} from './useDashboardNotes'

const {
  AUTH_STATE,
  NOTES_LIST,
  MAX_ORDER_ROWS,
  CREATED_NOTE,
  UPDATED_NOTE,
  mockUseAuth,
  mockToastSuccess,
  mockToastError,
  mockDebugError,
  mockFromExtended,
} = vi.hoisted(() => ({
  AUTH_STATE: {
    user: { id: 'u1', email: 't@t.co' },
    session: { user: { id: 'u1' } },
    isLoading: false,
  },
  NOTES_LIST: [
    {
      id: 'n1',
      user_id: 'u1',
      tab_name: 'Alpha',
      content: 'Contenu A',
      tab_order: 0,
      created_at: '2024-01-01',
      updated_at: '2024-01-02',
    },
    {
      id: 'n2',
      user_id: 'u1',
      tab_name: 'Beta',
      content: 'Contenu B',
      tab_order: 1,
      created_at: '2024-01-03',
      updated_at: '2024-01-04',
    },
  ],
  MAX_ORDER_ROWS: [{ tab_order: 3 }],
  CREATED_NOTE: {
    id: 'n3',
    user_id: 'u1',
    tab_name: 'Nouvelle note',
    content: '',
    tab_order: 4,
    created_at: '2024-01-05',
    updated_at: '2024-01-05',
  },
  UPDATED_NOTE: {
    id: 'n1',
    user_id: 'u1',
    tab_name: 'Alpha modifiée',
    content: 'Texte modifié',
    tab_order: 0,
    created_at: '2024-01-01',
    updated_at: '2024-01-06',
  },
  mockUseAuth: vi.fn(),
  mockToastSuccess: vi.fn(),
  mockToastError: vi.fn(),
  mockDebugError: vi.fn(),
  mockFromExtended: vi.fn(),
}))

vi.mock('@/hooks/shared/useAuth', () => ({
  useAuth: mockUseAuth,
}))

vi.mock('sonner', () => ({
  toast: {
    success: mockToastSuccess,
    error: mockToastError,
  },
}))

vi.mock('@/lib/debug', () => ({
  debug: {
    error: mockDebugError,
  },
}))

vi.mock('@/lib/supabaseTyped', () => ({
  fromExtended: mockFromExtended,
}))

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFromExtended,
  },
}))

const WAIT_OPTIONS = { timeout: 5000 }

const queryClients: QueryClient[] = []

function freshAuthState() {
  return {
    user: { ...AUTH_STATE.user },
    session: { user: { ...AUTH_STATE.session.user } },
    isLoading: AUTH_STATE.isLoading,
  }
}

function createThenableBuilder(result: { data: unknown; error: unknown }) {
  const builder: any = {
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
    single: vi.fn(async () => result),
    maybeSingle: vi.fn(async () => result),
    then: (
      onFulfilled: (value: { data: unknown; error: unknown }) => unknown,
      onRejected?: (reason: unknown) => unknown
    ) => Promise.resolve(result).then(onFulfilled, onRejected),
    catch: (onRejected: (reason: unknown) => unknown) => Promise.resolve(result).catch(onRejected),
  }

  return builder
}

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: Infinity,
        staleTime: 0,
      },
      mutations: {
        retry: false,
        gcTime: Infinity,
      },
    },
  })

  queryClients.push(queryClient)

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children)
  }
}

describe('useDashboardNotes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseAuth.mockReset()
    mockToastSuccess.mockReset()
    mockToastError.mockReset()
    mockDebugError.mockReset()
    mockFromExtended.mockReset()
    mockUseAuth.mockImplementation(() => freshAuthState())
  })

  afterEach(() => {
    cleanup()
    queryClients.splice(0).forEach((queryClient) => queryClient.clear())
    vi.restoreAllMocks()
    vi.clearAllTimers()
    vi.useRealTimers()
    vi.unstubAllGlobals?.()
    vi.unstubAllEnvs?.()
  })

  it('charge les notes puis retourne les valeurs métier attendues', async () => {
    const listBuilder = createThenableBuilder({ data: NOTES_LIST, error: null })
    mockFromExtended.mockReturnValue(listBuilder)

    const { result } = renderHook(() => useDashboardNotes(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
      expect(result.current.data).toEqual(NOTES_LIST)
    }, WAIT_OPTIONS)

    expect(mockFromExtended).toHaveBeenCalledWith('dashboard_notes')
    expect(listBuilder.select).toHaveBeenCalledWith(
      'id, user_id, tab_name, content, tab_order, created_at, updated_at, drawings, color'
    )
    expect(listBuilder.eq).toHaveBeenCalledWith('user_id', 'u1')
    expect(listBuilder.order).toHaveBeenCalledWith('tab_order', { ascending: true })

    expect(result.current.data?.map((n) => n.tab_name)).toEqual(['Alpha', 'Beta'])
    expect(result.current.data?.[0]?.content).toBe('Contenu A')
    expect(result.current.data?.[1]?.tab_order).toBe(1)
  })

  it('retourne une liste vide quand la requête renvoie une erreur Supabase', async () => {
    const listBuilder = createThenableBuilder({
      data: null,
      error: { message: 'x' },
    })
    mockFromExtended.mockReturnValue(listBuilder)

    const { result } = renderHook(() => useDashboardNotes(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
      expect(result.current.data).toEqual([])
    }, WAIT_OPTIONS)

    expect(mockDebugError).toHaveBeenCalledWith('Error fetching notes:', { message: 'x' })
  })

  it('crée une note et envoie les bons paramètres à insert', async () => {
    const orderBuilder = createThenableBuilder({ data: MAX_ORDER_ROWS, error: null })
    const insertBuilder = createThenableBuilder({ data: CREATED_NOTE, error: null })
    mockFromExtended.mockReturnValueOnce(orderBuilder).mockReturnValueOnce(insertBuilder)

    const { result } = renderHook(() => useCreateNote(), {
      wrapper: createWrapper(),
    })

    let createdNote: unknown
    await act(async () => {
      createdNote = await result.current.mutateAsync('Nouvelle note')
    })

    expect(createdNote).toEqual(CREATED_NOTE)

    expect(mockFromExtended).toHaveBeenNthCalledWith(1, 'dashboard_notes')
    expect(mockFromExtended).toHaveBeenNthCalledWith(2, 'dashboard_notes')
    expect(orderBuilder.select).toHaveBeenCalledWith('tab_order')
    expect(orderBuilder.eq).toHaveBeenCalledWith('user_id', 'u1')
    expect(orderBuilder.order).toHaveBeenCalledWith('tab_order', { ascending: false })
    expect(orderBuilder.limit).toHaveBeenCalledWith(1)
    expect(insertBuilder.insert).toHaveBeenCalledWith({
      user_id: 'u1',
      tab_name: 'Nouvelle note',
      content: '',
      tab_order: 4,
    })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
      expect(result.current.data).toEqual(CREATED_NOTE)
    }, WAIT_OPTIONS)
  })

  it('passe en erreur si la création échoue et affiche le toast', async () => {
    const orderBuilder = createThenableBuilder({ data: MAX_ORDER_ROWS, error: null })
    const insertBuilder = createThenableBuilder({
      data: null,
      error: { message: 'x' },
    })
    mockFromExtended.mockReturnValueOnce(orderBuilder).mockReturnValueOnce(insertBuilder)

    const { result } = renderHook(() => useCreateNote(), {
      wrapper: createWrapper(),
    })

    await act(async () => {
      await expect(result.current.mutateAsync('Nouvelle note')).rejects.toEqual({ message: 'x' })
    })

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
      expect(mockToastError).toHaveBeenCalledWith('Erreur lors de la création de la note')
      expect(mockDebugError).toHaveBeenCalledWith('Error creating note:', { message: 'x' })
    }, WAIT_OPTIONS)
  })

  it('met à jour une note avec les champs attendus', async () => {
    const updateBuilder = createThenableBuilder({ data: UPDATED_NOTE, error: null })
    mockFromExtended.mockReturnValue(updateBuilder)

    const { result } = renderHook(() => useUpdateNote(), {
      wrapper: createWrapper(),
    })

    let updatedNote: unknown
    await act(async () => {
      updatedNote = await result.current.mutateAsync({
        id: 'n1',
        tab_name: 'Alpha modifiée',
        content: 'Texte modifié',
      })
    })

    expect(updatedNote).toEqual(UPDATED_NOTE)
    expect(mockFromExtended).toHaveBeenCalledWith('dashboard_notes')
    expect(updateBuilder.update).toHaveBeenCalledWith({
      tab_name: 'Alpha modifiée',
      content: 'Texte modifié',
    })
    expect(updateBuilder.eq).toHaveBeenCalledWith('id', 'n1')

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
      expect(result.current.data).toEqual(UPDATED_NOTE)
    }, WAIT_OPTIONS)
  })

  it('déclenche la mise à jour debounced une seule fois avec le dernier payload', async () => {
    vi.useFakeTimers()

    const updateBuilder = createThenableBuilder({ data: UPDATED_NOTE, error: null })
    mockFromExtended.mockReturnValue(updateBuilder)

    const { result } = renderHook(() => useUpdateNote(), {
      wrapper: createWrapper(),
    })

    act(() => {
      result.current.debouncedUpdate({ id: 'n1', content: 'A' })
      result.current.debouncedUpdate({ id: 'n1', content: 'B' })
    })

    expect(mockFromExtended).not.toHaveBeenCalled()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(500)
    })

    await act(async () => {
      await Promise.resolve()
    })

    vi.useRealTimers()

    await waitFor(() => {
      expect(mockFromExtended).toHaveBeenCalledTimes(1)
      expect(mockFromExtended).toHaveBeenCalledWith('dashboard_notes')
      expect(updateBuilder.update).toHaveBeenCalledTimes(1)
      expect(updateBuilder.update).toHaveBeenCalledWith({ content: 'B' })
      expect(updateBuilder.eq).toHaveBeenCalledWith('id', 'n1')
    }, WAIT_OPTIONS)
  })

  it('supprime une note et affiche le toast de succès', async () => {
    const deleteBuilder = createThenableBuilder({ data: null, error: null })
    mockFromExtended.mockReturnValue(deleteBuilder)

    const { result } = renderHook(() => useDeleteNote(), {
      wrapper: createWrapper(),
    })

    await act(async () => {
      await result.current.mutateAsync('n2')
    })

    expect(mockFromExtended).toHaveBeenCalledWith('dashboard_notes')
    expect(deleteBuilder.delete).toHaveBeenCalledTimes(1)
    expect(deleteBuilder.eq).toHaveBeenCalledWith('id', 'n2')

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
      expect(mockToastSuccess).toHaveBeenCalledWith('Note supprimée')
    }, WAIT_OPTIONS)
  })

  it('passe en erreur si la suppression échoue', async () => {
    const deleteBuilder = createThenableBuilder({
      data: null,
      error: { message: 'x' },
    })
    mockFromExtended.mockReturnValue(deleteBuilder)

    const { result } = renderHook(() => useDeleteNote(), {
      wrapper: createWrapper(),
    })

    await act(async () => {
      await expect(result.current.mutateAsync('n2')).rejects.toEqual({ message: 'x' })
    })

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
      expect(mockToastError).toHaveBeenCalledWith('Erreur lors de la suppression')
      expect(mockDebugError).toHaveBeenCalledWith('Error deleting note:', { message: 'x' })
    }, WAIT_OPTIONS)
  })

  it('réorganise les notes en envoyant un update par id avec le bon tab_order', async () => {
    const builder1 = createThenableBuilder({ data: null, error: null })
    const builder2 = createThenableBuilder({ data: null, error: null })
    const builder3 = createThenableBuilder({ data: null, error: null })

    mockFromExtended
      .mockReturnValueOnce(builder1)
      .mockReturnValueOnce(builder2)
      .mockReturnValueOnce(builder3)

    const { result } = renderHook(() => useReorderNotes(), {
      wrapper: createWrapper(),
    })

    await act(async () => {
      await result.current.mutateAsync(['n3', 'n1', 'n2'])
    })

    expect(mockFromExtended).toHaveBeenNthCalledWith(1, 'dashboard_notes')
    expect(mockFromExtended).toHaveBeenNthCalledWith(2, 'dashboard_notes')
    expect(mockFromExtended).toHaveBeenNthCalledWith(3, 'dashboard_notes')

    expect(builder1.update).toHaveBeenCalledWith({ tab_order: 0 })
    expect(builder1.eq).toHaveBeenCalledWith('id', 'n3')
    expect(builder2.update).toHaveBeenCalledWith({ tab_order: 1 })
    expect(builder2.eq).toHaveBeenCalledWith('id', 'n1')
    expect(builder3.update).toHaveBeenCalledWith({ tab_order: 2 })
    expect(builder3.eq).toHaveBeenCalledWith('id', 'n2')

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    }, WAIT_OPTIONS)
  })

  it('passe en erreur si la réorganisation est appelée sans utilisateur', async () => {
    mockUseAuth.mockReturnValue({
      user: null,
      session: null,
      isLoading: false,
    })

    const { result } = renderHook(() => useReorderNotes(), {
      wrapper: createWrapper(),
    })

    await act(async () => {
      await expect(result.current.mutateAsync(['n1', 'n2'])).rejects.toThrow(
        'User not authenticated'
      )
    })

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
      expect(mockToastError).toHaveBeenCalledWith('Erreur lors de la réorganisation')
    }, WAIT_OPTIONS)
  })
})