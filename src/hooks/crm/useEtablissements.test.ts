import React, { type ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import {
  etablissementKeys,
  useCreateEtablissement,
  useEtablissement,
  useEtablissements,
  useEtablissementsInfinite,
  useEtablissementStats,
} from './useEtablissements'

const mocks = vi.hoisted(() => {
  type DbError = { message: string }
  type QueryResult = { data: unknown; error: DbError | null; count?: number | null }
  type Scenario = 'success' | 'error' | 'pending' | 'statsError'
  type Operation = 'select' | 'insert' | 'update' | 'delete'
  type ChainFn = (...args: unknown[]) => Builder
  type Builder = {
    select: ChainFn
    eq: ChainFn
    neq: ChainFn
    gte: ChainFn
    lte: ChainFn
    in: ChainFn
    or: ChainFn
    order: ChainFn
    limit: ChainFn
    range: ChainFn
    insert: ChainFn
    update: ChainFn
    delete: ChainFn
    single: () => Promise<QueryResult>
    maybeSingle: () => Promise<QueryResult>
    then: <TResult1 = QueryResult, TResult2 = never>(
      onfulfilled?: ((value: QueryResult) => TResult1 | PromiseLike<TResult1>) | null,
      onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
    ) => Promise<TResult1 | TResult2>
    catch: <TResult = never>(
      onrejected?: ((reason: unknown) => TResult | PromiseLike<TResult>) | null,
    ) => Promise<QueryResult | TResult>
  }

  const ROWS = [
    {
      id: 'e1',
      nom: 'CHU Nord',
      ville: 'Paris',
      region: 'Ile-de-France',
      pays: 'France',
      statut: 'Client',
      type: 'CHU',
      progression: 75,
      commercial_id: 'u1',
      created_at: '2024-01-02',
    },
    {
      id: 'e2',
      nom: 'Clinique Sud',
      ville: 'Lyon',
      region: 'Auvergne-Rhone-Alpes',
      pays: 'France',
      statut: 'En cours',
      type: 'Clinique',
      progression: 40,
      commercial_id: 'u2',
      created_at: '2024-01-01',
    },
  ]

  const LINKS = [{ etablissement_id: 'e1', groupe_id: 'g1' }]
  const GROUPES = [{ id: 'g1', logo_url: 'logo-a.svg' }]
  const DETAIL_ROW = {
    id: 'e1',
    nom: 'CHU Nord',
    ville: 'Paris',
    region: 'Ile-de-France',
    pays: 'France',
    statut: 'Client',
    type: 'CHU',
    progression: 75,
  }
  const CREATED_ROW = {
    id: 'e3',
    nom: 'Clinique Nouvelle',
    ville: 'Lyon',
    statut: 'Prospect',
    type: 'Clinique',
    progression: 0,
  }
  const STATS_ROW = {
    total: 2,
    byStatus: { Client: 1, 'En cours': 1 },
    byType: { CHU: 1, Clinique: 1 },
    avgProgression: 57.5,
  }
  const ERROR_ROW = { message: 'x' }

  const state: {
    scenario: Scenario
    table: string
    operation: Operation
    pendingPromise: Promise<QueryResult> | null
    rangeUsed: boolean
  } = {
    scenario: 'success',
    table: '',
    operation: 'select',
    pendingPromise: null,
    rangeUsed: false,
  }

  let pendingResolve: ((value: QueryResult) => void) | null = null
  let builder: Builder

  const resolveResult = (): Promise<QueryResult> => {
    if (state.scenario === 'pending' && state.pendingPromise) {
      return state.pendingPromise
    }

    if (state.scenario === 'error') {
      return Promise.resolve({ data: null, error: ERROR_ROW, count: null })
    }

    if (state.table === 'etablissements' && state.operation === 'insert') {
      return Promise.resolve({ data: CREATED_ROW, error: null })
    }

    if (state.table === 'etablissements' && state.rangeUsed) {
      return Promise.resolve({ data: ROWS, error: null, count: ROWS.length })
    }

    if (state.table === 'etablissements') {
      return Promise.resolve({ data: ROWS, error: null, count: ROWS.length })
    }

    if (state.table === 'etablissements_groupes') {
      return Promise.resolve({ data: LINKS, error: null })
    }

    if (state.table === 'groupes_etablissements') {
      return Promise.resolve({ data: GROUPES, error: null })
    }

    return Promise.resolve({ data: [], error: null, count: 0 })
  }

  const makeChain = (method: string) =>
    vi.fn((..._args: unknown[]) => {
      if (method === 'insert') state.operation = 'insert'
      if (method === 'update') state.operation = 'update'
      if (method === 'delete') state.operation = 'delete'
      if (method === 'range') state.rangeUsed = true
      return builder
    })

  const mockSelect = makeChain('select')
  const mockEq = makeChain('eq')
  const mockNeq = makeChain('neq')
  const mockGte = makeChain('gte')
  const mockLte = makeChain('lte')
  const mockIn = makeChain('in')
  const mockOr = makeChain('or')
  const mockOrder = makeChain('order')
  const mockLimit = makeChain('limit')
  const mockRange = makeChain('range')
  const mockInsert = makeChain('insert')
  const mockUpdate = makeChain('update')
  const mockDelete = makeChain('delete')

  const mockSingle = vi.fn(() => {
    if (state.scenario === 'error') return Promise.resolve({ data: null, error: ERROR_ROW })
    if (state.operation === 'insert') return Promise.resolve({ data: CREATED_ROW, error: null })
    return Promise.resolve({ data: DETAIL_ROW, error: null })
  })

  const mockMaybeSingle = vi.fn(() => {
    if (state.scenario === 'error') return Promise.resolve({ data: null, error: ERROR_ROW })
    return Promise.resolve({ data: DETAIL_ROW, error: null })
  })

  builder = {
    select: mockSelect,
    eq: mockEq,
    neq: mockNeq,
    gte: mockGte,
    lte: mockLte,
    in: mockIn,
    or: mockOr,
    order: mockOrder,
    limit: mockLimit,
    range: mockRange,
    insert: mockInsert,
    update: mockUpdate,
    delete: mockDelete,
    single: mockSingle,
    maybeSingle: mockMaybeSingle,
    then: (onfulfilled, onrejected) => resolveResult().then(onfulfilled, onrejected),
    catch: (onrejected) => resolveResult().catch(onrejected),
  }

  const mockFrom = vi.fn((table: string) => {
    state.table = table
    state.operation = 'select'
    state.rangeUsed = false
    return builder
  })

  const mockRpc = vi.fn((name: string) => {
    if (name === 'get_etablissement_stats' && state.scenario !== 'statsError') {
      return Promise.resolve({ data: STATS_ROW, error: null })
    }
    return Promise.resolve({ data: null, error: ERROR_ROW })
  })

  const toastFn = vi.fn()
  const mockUseToast = vi.fn(() => ({ toast: toastFn }))
  const debugError = vi.fn()
  const mockSanitize = vi.fn((value: string) => value.replaceAll('%', '').replaceAll(',', ''))
  const mockRemoveUndefinedFields = vi.fn((value: Record<string, unknown>) =>
    Object.fromEntries(Object.entries(value).filter((entry) => entry[1] !== undefined)),
  )

  const reset = () => {
    state.scenario = 'success'
    state.table = ''
    state.operation = 'select'
    state.pendingPromise = null
    state.rangeUsed = false
    pendingResolve = null

    mockFrom.mockClear()
    mockRpc.mockClear()
    mockSelect.mockClear()
    mockEq.mockClear()
    mockNeq.mockClear()
    mockGte.mockClear()
    mockLte.mockClear()
    mockIn.mockClear()
    mockOr.mockClear()
    mockOrder.mockClear()
    mockLimit.mockClear()
    mockRange.mockClear()
    mockInsert.mockClear()
    mockUpdate.mockClear()
    mockDelete.mockClear()
    mockSingle.mockClear()
    mockMaybeSingle.mockClear()
    toastFn.mockClear()
    mockUseToast.mockClear()
    debugError.mockClear()
    mockSanitize.mockClear()
    mockRemoveUndefinedFields.mockClear()
  }

  const setError = () => {
    state.scenario = 'error'
  }

  const setPending = () => {
    state.scenario = 'pending'
    state.pendingPromise = new Promise<QueryResult>((resolve) => {
      pendingResolve = resolve
    })
  }

  const resolvePending = () => {
    const resolve = pendingResolve
    if (resolve) {
      resolve({ data: ROWS, error: null, count: ROWS.length })
    }
    state.scenario = 'success'
    pendingResolve = null
  }

  return {
    ROWS,
    LINKS,
    GROUPES,
    DETAIL_ROW,
    CREATED_ROW,
    STATS_ROW,
    ERROR_ROW,
    mockFrom,
    mockRpc,
    mockSelect,
    mockEq,
    mockNeq,
    mockIn,
    mockOr,
    mockOrder,
    mockLimit,
    mockRange,
    mockInsert,
    mockSingle,
    mockMaybeSingle,
    toastFn,
    mockUseToast,
    debugError,
    mockSanitize,
    mockRemoveUndefinedFields,
    reset,
    setError,
    setPending,
    resolvePending,
  }
})

vi.mock('@/lib/supabaseBrowser', () => ({
  supabase: {
    from: mocks.mockFrom,
    rpc: mocks.mockRpc,
  },
}))

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mocks.mockFrom,
    rpc: mocks.mockRpc,
  },
}))

vi.mock('@/hooks/shared/use-toast', () => ({
  useToast: mocks.mockUseToast,
}))

vi.mock('@/lib/sanitize', () => ({
  sanitizePostgrestValue: mocks.mockSanitize,
}))

vi.mock('@/lib/utils/objectHelpers', () => ({
  removeUndefinedFields: mocks.mockRemoveUndefinedFields,
}))

vi.mock('@/lib/queryPresets', () => ({
  queryPresets: {
    standard: {
      staleTime: 0,
      gcTime: 0,
      retry: 0,
    },
  },
}))

vi.mock('@/lib/debug', () => ({
  debug: {
    error: mocks.debugError,
  },
}))

vi.mock('@/lib/validations', () => ({
  CreateEtablissementData: undefined,
  UpdateEtablissementData: undefined,
  EtablissementData: undefined,
}))

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  })

  return function Wrapper({ children }: { children: ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children)
  }
}

describe('useEtablissements', () => {
  beforeEach(() => {
    mocks.reset()
  })

  it('expose des clés de cache stables et structurées', () => {
    expect(etablissementKeys.all).toEqual(['etablissements'])
    expect(etablissementKeys.lists()).toEqual(['etablissements', 'list'])
    expect(etablissementKeys.detail('e1')).toEqual(['etablissements', 'detail', 'e1'])
    expect(etablissementKeys.stats()).toEqual(['etablissements', 'stats'])
    expect(etablissementKeys.infinite('paris', true, 'u1')).toEqual([
      'etablissements',
      'list',
      'infinite',
      'paris',
      true,
      'u1',
    ])
  })

  it('retourne isLoading pendant le chargement initial', async () => {
    mocks.setPending()

    const { result } = renderHook(() => useEtablissements(), {
      wrapper: createWrapper(),
    })

    expect(result.current.isLoading).toBe(true)
    expect(result.current.data).toBeUndefined()
    expect(mocks.mockFrom).toHaveBeenCalledWith('etablissements')

    mocks.resolvePending()

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })
  })

  it('charge les établissements et enrichit le logo du groupe parent', async () => {
    const { result } = renderHook(() => useEtablissements(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(result.current.data).toEqual([
      {
        ...mocks.ROWS[0],
        groupe_logo_url: 'logo-a.svg',
      },
      {
        ...mocks.ROWS[1],
        groupe_logo_url: null,
      },
    ])
    expect(result.current.data?.[0]?.nom).toBe('CHU Nord')
    expect(result.current.data?.[0]?.progression).toBe(75)
    expect(result.current.data?.[1]?.ville).toBe('Lyon')
    expect(mocks.mockFrom).toHaveBeenCalledWith('etablissements')
    expect(mocks.mockFrom).toHaveBeenCalledWith('etablissements_groupes')
    expect(mocks.mockFrom).toHaveBeenCalledWith('groupes_etablissements')
    expect(mocks.mockOrder).toHaveBeenCalledWith('created_at', { ascending: false })
    expect(mocks.mockLimit).toHaveBeenCalledWith(5000)
    expect(mocks.mockIn).toHaveBeenCalledWith('etablissement_id', ['e1', 'e2'])
    expect(mocks.mockIn).toHaveBeenCalledWith('id', ['g1'])
  })

  it('charge le détail d’un établissement', async () => {
    const { result } = renderHook(() => useEtablissement('e1'), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(result.current.data).toEqual(mocks.DETAIL_ROW)
    expect(result.current.data?.nom).toBe('CHU Nord')
    expect(mocks.mockFrom).toHaveBeenCalledWith('etablissements')
    expect(mocks.mockEq).toHaveBeenCalledWith('id', 'e1')
    expect(mocks.mockMaybeSingle).toHaveBeenCalledTimes(1)
  })

  it('charge les statistiques via la RPC dédiée', async () => {
    const { result } = renderHook(() => useEtablissementStats(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(result.current.data).toEqual({
      total: 2,
      byStatus: { Client: 1, 'En cours': 1 },
      byType: { CHU: 1, Clinique: 1 },
      avgProgression: 57.5,
    })
    expect(mocks.mockRpc).toHaveBeenCalledWith('get_etablissement_stats')
  })

  it('passe en erreur sur la pagination infinie quand Supabase renvoie une erreur', async () => {
    mocks.setError()

    const { result } = renderHook(
      () => useEtablissementsInfinite('Paris%', true, { id: 'u1', role: 'commercial' }),
      { wrapper: createWrapper() },
    )

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })

    expect(result.current.error).toEqual(mocks.ERROR_ROW)
    expect(mocks.mockNeq).toHaveBeenCalledWith('statut', 'Prospect')
    expect(mocks.mockEq).toHaveBeenCalledWith('commercial_id', 'u1')
    expect(mocks.mockRange).toHaveBeenCalledWith(0, 19)
    expect(mocks.mockSanitize).toHaveBeenCalledWith('Paris%')
    expect(mocks.mockOr).toHaveBeenCalledWith(
      'nom.ilike.%Paris%,ville.ilike.%Paris%,region.ilike.%Paris%,type.ilike.%Paris%',
    )
    expect(mocks.toastFn).toHaveBeenCalledWith({
      title: 'Erreur',
      description: 'Impossible de charger les établissements',
      variant: 'destructive',
    })
  })

  it('crée un établissement avec les champs nettoyés puis notifie le succès', async () => {
    type CreatePayload = Parameters<ReturnType<typeof useCreateEtablissement>['mutateAsync']>[0]

    const payload = {
      nom: 'Clinique Nouvelle',
      ville: 'Lyon',
      statut: 'Prospect',
      type: 'Clinique',
      commercial_id: 'none',
      chef_projet_id: 'unassigned',
      csm_id: '',
      date_signature: '',
      adresse: '',
      email: '',
      dpi: '',
      nombre_passages_urgences_annuel: null,
      progression: 0,
    } as CreatePayload

    const { result } = renderHook(() => useCreateEtablissement(), {
      wrapper: createWrapper(),
    })

    let createdName = ''
    await act(async () => {
      const created = await result.current.mutateAsync(payload)
      createdName = created.nom
    })

    expect(createdName).toBe('Clinique Nouvelle')
    expect(mocks.mockFrom).toHaveBeenCalledWith('etablissements')
    expect(mocks.mockInsert).toHaveBeenCalledWith([
      {
        nom: 'Clinique Nouvelle',
        ville: 'Lyon',
        statut: 'Prospect',
        type: 'Clinique',
        progression: 0,
      },
    ])
    expect(mocks.mockSelect).toHaveBeenCalled()
    expect(mocks.mockSingle).toHaveBeenCalledTimes(1)
    expect(mocks.toastFn).toHaveBeenCalledWith({
      title: 'Succès',
      description: 'Établissement créé avec succès',
    })
  })
})