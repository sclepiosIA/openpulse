/// <reference types="vitest" />
/* @vitest-environment jsdom */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor, act } from '@testing-library/react'

const { GROUPES_ROWS, GROUPE_ROW, CREATED_ROW, UPDATED_ROW, toastMock, mockFrom, mockBuilder, state } =
  vi.hoisted(() => {
    type SupabaseError = { message: string } | null
    type StateMode =
      | 'list-success'
      | 'list-error'
      | 'detail-success'
      | 'detail-error'
      | 'create-success'
      | 'create-error'
      | 'update-success'
      | 'update-error'
      | 'delete-success'
      | 'delete-error'

    const GROUPES_ROWS = [
      {
        id: 'g1',
        nom: 'Alpha',
        type: 'GHT' as const,
        description: 'Desc A',
        adresse_siege: '1 rue A',
        code_postal_siege: '75001',
        ville_siege: 'Paris',
        region: 'IDF',
        telephone: '0100000000',
        email: 'alpha@ex.co',
        email_domains: ['ex.co'],
        responsable_commercial_id: 'u1',
        responsable_csm_id: 'u2',
        nombre_etablissements: 3,
        progression_moyenne: 42,
        total_passages_urgences_annuel: 1000,
        modules_deployes: ['m1'],
        notes: 'n1',
        logo_url: null,
        created_at: '2024-01-01T00:00:00.000Z',
        updated_at: '2024-01-02T00:00:00.000Z',
        created_by: 'u1',
        updated_by: 'u1',
      },
      {
        id: 'g2',
        nom: 'Beta',
        type: 'Autre' as const,
        description: 'Desc B',
        adresse_siege: '2 rue B',
        code_postal_siege: '69001',
        ville_siege: 'Lyon',
        region: 'ARA',
        telephone: '0200000000',
        email: 'beta@ex.co',
        email_domains: ['ex.co'],
        responsable_commercial_id: 'u3',
        responsable_csm_id: 'u4',
        nombre_etablissements: 1,
        progression_moyenne: 10,
        total_passages_urgences_annuel: 200,
        modules_deployes: ['m2'],
        notes: 'n2',
        logo_url: 'https://example.invalid/logo.png',
        created_at: '2024-02-01T00:00:00.000Z',
        updated_at: '2024-02-02T00:00:00.000Z',
        created_by: 'u3',
        updated_by: 'u3',
      },
    ] as const

    const GROUPE_ROW = GROUPES_ROWS[0]

    const CREATED_ROW = {
      ...GROUPE_ROW,
      id: 'g3',
      nom: 'Gamma',
      type: 'Consortium' as const,
      created_at: '2024-03-01T00:00:00.000Z',
      updated_at: '2024-03-01T00:00:00.000Z',
    } as const

    const UPDATED_ROW = {
      ...GROUPE_ROW,
      nom: 'Alpha Updated',
      updated_at: '2024-04-01T00:00:00.000Z',
    } as const

    const toastMock = vi.fn()

    const state: {
      mode: StateMode
      lastInsert: unknown
      lastUpdate: unknown
      lastDeleteEq: { column: string; value: unknown } | null
      lastFilters: { eq: Array<{ column: string; value: unknown }> }
      lastOrder: { column: string; opts?: unknown } | null
      lastSelect: string | null
      lastTable: string | null
    } = {
      mode: 'list-success',
      lastInsert: null,
      lastUpdate: null,
      lastDeleteEq: null,
      lastFilters: { eq: [] },
      lastOrder: null,
      lastSelect: null,
      lastTable: null,
    }

    const settle = async (): Promise<{ data: unknown; error: SupabaseError }> => {
      switch (state.mode) {
        case 'list-success':
          return { data: GROUPES_ROWS, error: null }
        case 'list-error':
          return { data: null, error: { message: 'list-error' } }
        case 'detail-success':
          return { data: GROUPE_ROW, error: null }
        case 'detail-error':
          return { data: null, error: { message: 'detail-error' } }
        case 'create-success':
          return { data: CREATED_ROW, error: null }
        case 'create-error':
          return { data: null, error: { message: 'create-error' } }
        case 'update-success':
          return { data: UPDATED_ROW, error: null }
        case 'update-error':
          return { data: null, error: { message: 'update-error' } }
        case 'delete-success':
          return { data: null, error: null }
        case 'delete-error':
          return { data: null, error: { message: 'delete-error' } }
        default:
          return { data: null, error: { message: 'unknown-mode' } }
      }
    }

    type Builder = {
      select: ReturnType<typeof vi.fn>
      eq: ReturnType<typeof vi.fn>
      gte: ReturnType<typeof vi.fn>
      lte: ReturnType<typeof vi.fn>
      in: ReturnType<typeof vi.fn>
      order: ReturnType<typeof vi.fn>
      limit: ReturnType<typeof vi.fn>
      insert: ReturnType<typeof vi.fn>
      update: ReturnType<typeof vi.fn>
      delete: ReturnType<typeof vi.fn>
      single: ReturnType<typeof vi.fn>
      maybeSingle: ReturnType<typeof vi.fn>
      then: (onFulfilled: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) => Promise<unknown>
      catch: (onRejected: (e: unknown) => unknown) => Promise<unknown>
      finally: (onFinally: () => void) => Promise<unknown>
    }

    const mockBuilder = {} as Builder

    mockBuilder.select = vi.fn((columns?: string) => {
      state.lastSelect = typeof columns === 'string' ? columns : null
      return mockBuilder
    })
    mockBuilder.eq = vi.fn((column: string, value: unknown) => {
      state.lastFilters.eq.push({ column, value })
      state.lastDeleteEq = { column, value }
      return mockBuilder
    })
    mockBuilder.gte = vi.fn(() => mockBuilder)
    mockBuilder.lte = vi.fn(() => mockBuilder)
    mockBuilder.in = vi.fn(() => mockBuilder)
    mockBuilder.order = vi.fn((column: string, opts?: unknown) => {
      state.lastOrder = { column, opts }
      return mockBuilder
    })
    mockBuilder.limit = vi.fn(() => mockBuilder)
    mockBuilder.insert = vi.fn((payload: unknown) => {
      state.lastInsert = payload
      return mockBuilder
    })
    mockBuilder.update = vi.fn((payload: unknown) => {
      state.lastUpdate = payload
      return mockBuilder
    })
    mockBuilder.delete = vi.fn(() => mockBuilder)
    mockBuilder.single = vi.fn(async () => settle())
    mockBuilder.maybeSingle = vi.fn(async () => settle())
    mockBuilder.then = (onFulfilled, onRejected) => Promise.resolve().then(settle).then(onFulfilled, onRejected)
    mockBuilder.catch = (onRejected) => Promise.resolve().then(settle).catch(onRejected)
    mockBuilder.finally = (onFinally) => Promise.resolve().then(settle).finally(onFinally)

    const mockFrom = vi.fn((table: string) => {
      state.lastTable = table
      state.lastFilters.eq = []
      state.lastDeleteEq = null
      state.lastOrder = null
      state.lastSelect = null
      return mockBuilder
    })

    return { GROUPES_ROWS, GROUPE_ROW, CREATED_ROW, UPDATED_ROW, toastMock, mockFrom, mockBuilder, state }
  })

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
  },
}))

vi.mock('@/hooks/shared/use-toast', () => ({
  useToast: () => ({ toast: toastMock }),
}))

import {
  useGroupes,
  useGroupe,
  useCreateGroupe,
  useUpdateGroupe,
  useDeleteGroupe,
  groupeKeys,
  type Groupe,
} from './useGroupes'

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  })
}

function createWrapper(queryClient: QueryClient) {
  return function Wrapper(props: { children: import('react').ReactNode }) {
    return QueryClientProvider({ client: queryClient, children: props.children })
  }
}

describe('useGroupes.ts', () => {
  it('useGroupes: isLoading -> success (sans filtres) et order(nom)', async () => {
    state.mode = 'list-success'
    toastMock.mockClear()
    mockFrom.mockClear()
    mockBuilder.select.mockClear()
    mockBuilder.order.mockClear()
    mockBuilder.eq.mockClear()

    const queryClient = createQueryClient()
    const { result } = renderHook(() => useGroupes(), { wrapper: createWrapper(queryClient) })

    expect(result.current.isLoading || result.current.isPending).toBe(true)

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(result.current.data).toEqual(GROUPES_ROWS)
    expect(result.current.data?.[0]?.nom).toBe('Alpha')
    expect(result.current.data?.[1]?.nom).toBe('Beta')
    expect(mockFrom).toHaveBeenCalledWith('groupes_etablissements')
    expect(mockBuilder.order).toHaveBeenCalledWith('nom')
    expect(state.lastFilters.eq).toEqual([])
    expect(toastMock).not.toHaveBeenCalled()
  })

  it('useGroupes: applique filtres type et region via eq', async () => {
    state.mode = 'list-success'
    toastMock.mockClear()
    mockFrom.mockClear()
    mockBuilder.eq.mockClear()

    const queryClient = createQueryClient()
    const filters = { type: 'GHT', region: 'IDF' }
    const { result } = renderHook(() => useGroupes(filters), { wrapper: createWrapper(queryClient) })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(result.current.data?.map((g) => g.id)).toEqual(['g1', 'g2'])
    expect(mockBuilder.eq).toHaveBeenCalledWith('type', 'GHT')
    expect(mockBuilder.eq).toHaveBeenCalledWith('region', 'IDF')
    expect(toastMock).not.toHaveBeenCalled()
  })

  it('useGroupes: erreur -> isError (toast géré via meta, non déclenché en test unitaire)', async () => {
    state.mode = 'list-error'
    toastMock.mockClear()

    const queryClient = createQueryClient()
    const { result } = renderHook(() => useGroupes(), { wrapper: createWrapper(queryClient) })

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })

    expect(result.current.error).toBeTruthy()
  })

  it('useGroupe: enabled=false si id vide (pas d’appel supabase)', async () => {
    state.mode = 'detail-success'
    mockFrom.mockClear()

    const queryClient = createQueryClient()
    const { result } = renderHook(() => useGroupe(''), { wrapper: createWrapper(queryClient) })

    await waitFor(() => {
      expect(result.current.fetchStatus).toBe('idle')
    })
    expect(result.current.data).toBeUndefined()
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it('useGroupe: succès -> retourne le groupe et filtre eq(id)', async () => {
    state.mode = 'detail-success'
    toastMock.mockClear()
    mockFrom.mockClear()
    mockBuilder.eq.mockClear()
    mockBuilder.maybeSingle.mockClear()

    const queryClient = createQueryClient()
    const { result } = renderHook(() => useGroupe('g1'), { wrapper: createWrapper(queryClient) })

    expect(result.current.isLoading || result.current.isPending).toBe(true)

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(mockFrom).toHaveBeenCalledWith('groupes_etablissements')
    expect(mockBuilder.eq).toHaveBeenCalledWith('id', 'g1')
    expect(mockBuilder.maybeSingle).toHaveBeenCalledTimes(1)
    expect(result.current.data).toEqual(GROUPE_ROW)
    expect(result.current.data?.nom).toBe('Alpha')
  })

  it('useGroupe: erreur -> isError', async () => {
    state.mode = 'detail-error'
    toastMock.mockClear()

    const queryClient = createQueryClient()
    const { result } = renderHook(() => useGroupe('g1'), { wrapper: createWrapper(queryClient) })

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })

    expect(result.current.error).toBeTruthy()
  })

  it('useCreateGroupe: succès -> insert(payload), select + single, invalide all', async () => {
    state.mode = 'create-success'
    toastMock.mockClear()
    mockFrom.mockClear()
    mockBuilder.insert.mockClear()
    mockBuilder.select.mockClear()
    mockBuilder.single.mockClear()

    const queryClient = createQueryClient()
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    const { result } = renderHook(() => useCreateGroupe(), { wrapper: createWrapper(queryClient) })

    const payload: Omit<
      Groupe,
      'id' | 'created_at' | 'updated_at' | 'nombre_etablissements' | 'progression_moyenne'
    > = {
      nom: 'Gamma',
      type: 'Consortium',
      description: 'Desc G',
      adresse_siege: '3 rue C',
      code_postal_siege: '33000',
      ville_siege: 'Bordeaux',
      region: 'NAQ',
      telephone: '0300000000',
      email: 'gamma@ex.co',
      email_domains: ['ex.co'],
      responsable_commercial_id: 'u5',
      responsable_csm_id: 'u6',
      total_passages_urgences_annuel: 300,
      modules_deployes: ['m3'],
      notes: 'n3',
      logo_url: null,
      created_by: 'u5',
      updated_by: 'u5',
    }

    await act(async () => {
      const res = await result.current.mutateAsync(payload)
      expect(res).toEqual(CREATED_ROW)
    })

    expect(mockFrom).toHaveBeenCalledWith('groupes_etablissements')
    expect(mockBuilder.insert).toHaveBeenCalledWith(payload)
    expect(mockBuilder.select).toHaveBeenCalledTimes(1)
    expect(mockBuilder.single).toHaveBeenCalledTimes(1)
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: groupeKeys.all })
  })

  it('useCreateGroupe: erreur -> rejette', async () => {
    state.mode = 'create-error'
    toastMock.mockClear()

    const queryClient = createQueryClient()
    const { result } = renderHook(() => useCreateGroupe(), { wrapper: createWrapper(queryClient) })

    const payload: Omit<
      Groupe,
      'id' | 'created_at' | 'updated_at' | 'nombre_etablissements' | 'progression_moyenne'
    > = {
      nom: 'Gamma',
      type: 'Consortium',
      description: 'Desc G',
      adresse_siege: '3 rue C',
      code_postal_siege: '33000',
      ville_siege: 'Bordeaux',
      region: 'NAQ',
      telephone: '0300000000',
      email: 'gamma@ex.co',
      email_domains: ['ex.co'],
      responsable_commercial_id: 'u5',
      responsable_csm_id: 'u6',
      total_passages_urgences_annuel: 300,
      modules_deployes: ['m3'],
      notes: 'n3',
      logo_url: null,
      created_by: 'u5',
      updated_by: 'u5',
    }

    await act(async () => {
      await expect(result.current.mutateAsync(payload)).rejects.toBeTruthy()
    })
  })

  it('useUpdateGroupe: succès -> update(data) + eq(id), invalide detail + lists', async () => {
    state.mode = 'update-success'
    toastMock.mockClear()
    mockFrom.mockClear()
    mockBuilder.update.mockClear()
    mockBuilder.eq.mockClear()
    mockBuilder.single.mockClear()

    const queryClient = createQueryClient()
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    const { result } = renderHook(() => useUpdateGroupe(), { wrapper: createWrapper(queryClient) })

    const variables = { id: 'g1', data: { nom: 'Alpha Updated' } }

    await act(async () => {
      const res = await result.current.mutateAsync(variables)
      expect(res).toEqual(UPDATED_ROW)
    })

    expect(mockFrom).toHaveBeenCalledWith('groupes_etablissements')
    expect(mockBuilder.update).toHaveBeenCalledWith(variables.data)
    expect(mockBuilder.eq).toHaveBeenCalledWith('id', 'g1')
    expect(mockBuilder.single).toHaveBeenCalledTimes(1)
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: groupeKeys.detail('g1') })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: groupeKeys.lists() })
  })

  it('useUpdateGroupe: erreur -> rejette', async () => {
    state.mode = 'update-error'
    toastMock.mockClear()

    const queryClient = createQueryClient()
    const { result } = renderHook(() => useUpdateGroupe(), { wrapper: createWrapper(queryClient) })

    await act(async () => {
      await expect(result.current.mutateAsync({ id: 'g1', data: { nom: 'X' } })).rejects.toBeTruthy()
    })
  })

  it('useDeleteGroupe: succès -> delete + eq(id), invalide all', async () => {
    state.mode = 'delete-success'
    toastMock.mockClear()
    mockFrom.mockClear()
    mockBuilder.delete.mockClear()
    mockBuilder.eq.mockClear()

    const queryClient = createQueryClient()
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    const { result } = renderHook(() => useDeleteGroupe(), { wrapper: createWrapper(queryClient) })

    await act(async () => {
      await result.current.mutateAsync('g2')
    })

    expect(mockFrom).toHaveBeenCalledWith('groupes_etablissements')
    expect(mockBuilder.delete).toHaveBeenCalledTimes(1)
    expect(mockBuilder.eq).toHaveBeenCalledWith('id', 'g2')
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: groupeKeys.all })
  })

  it('useDeleteGroupe: erreur -> rejette', async () => {
    state.mode = 'delete-error'
    toastMock.mockClear()

    const queryClient = createQueryClient()
    const { result } = renderHook(() => useDeleteGroupe(), { wrapper: createWrapper(queryClient) })

    await act(async () => {
      await expect(result.current.mutateAsync('g2')).rejects.toBeTruthy()
    })
  })
})