/* @vitest-environment jsdom */

import { createElement, type ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import {
  useAllEtablissements,
  useCsmDashboardEtablissements,
  useProspects,
  useProspectStats,
} from './useProspects'

type MockFn = ReturnType<typeof vi.fn>

type BuilderForAssertions = {
  select: MockFn
  eq: MockFn
  gte: MockFn
  lte: MockFn
  in: MockFn
  order: MockFn
  limit: MockFn
  insert: MockFn
  update: MockFn
  delete: MockFn
  single: MockFn
  maybeSingle: MockFn
}

const {
  AUTH_STATE,
  toastSpy,
  calculateEtablissementValueSpy,
  QUERY_PRESETS,
  PROSPECT_ROWS,
  STATS_ROWS,
  ALL_ETABS_ROWS,
  LINKS_ROWS,
  GROUPS_ROWS,
  CSM_ROWS,
  errorResponse,
  builderState,
  mockFrom,
} = vi.hoisted(() => {
  const PROSPECT_ROWS = [
    {
      id: 'e2',
      nom: 'Clinique Beta',
      ville: 'Lyon',
      region: 'ARA',
      type: 'Clinique',
      statut: 'Contacté',
      progression: 25,
      created_at: '2024-02-02',
      updated_at: '2024-02-03',
    },
    {
      id: 'e1',
      nom: 'Hopital Alpha',
      ville: 'Paris',
      region: 'IDF',
      type: 'Hopital',
      statut: 'Prospect',
      progression: 10,
      created_at: '2024-01-01',
      updated_at: '2024-01-02',
    },
  ]

  const STATS_ROWS = [
    {
      id: 's1',
      nom: 'Alpha',
      statut: 'Prospect',
      commercial_id: 'com-1',
      created_at: '2024-01-01',
      pallier_vise: 2,
      pallier_realise: 1,
      modele_statique_succes: 'A',
      nombre_passages_urgences_annuel: 1000,
      type_offre: 'Premium',
      tarifs_palliers: { p1: 100 },
      taches: [
        { id: 't1', statut: 'Terminé', categorie: { nom: 'Commercial' } },
        { id: 't2', statut: 'À faire', categorie: { nom: 'Commercial' } },
        { id: 't3', statut: 'Terminé', categorie: { nom: 'Technique' } },
      ],
    },
    {
      id: 's2',
      nom: 'Beta',
      statut: 'RDV pris',
      commercial_id: null,
      created_at: '2024-01-05',
      pallier_vise: 3,
      pallier_realise: 2,
      modele_statique_succes: 'B',
      nombre_passages_urgences_annuel: 2000,
      type_offre: 'Standard',
      tarifs_palliers: { p1: 200 },
      taches: [
        { id: 't4', statut: 'Terminé', categorie: { nom: 'Commercial' } },
        { id: 't5', statut: 'Terminé', categorie: { nom: 'Commercial' } },
      ],
    },
  ]

  const ALL_ETABS_ROWS = [
    {
      id: 'a1',
      nom: 'Etab One',
      ville: 'Paris',
      region: 'IDF',
      type: 'Hopital',
      statut: 'Production',
      dpi: 'DxCare',
      progression: 80,
      created_at: '2024-01-10',
      updated_at: '2024-01-11',
    },
    {
      id: 'a2',
      nom: 'Etab Two',
      ville: 'Lille',
      region: 'HDF',
      type: 'Clinique',
      statut: 'Prospect',
      dpi: 'HM',
      progression: 20,
      created_at: '2024-01-09',
      updated_at: '2024-01-10',
    },
  ]

  const LINKS_ROWS = [
    { etablissement_id: 'a1', groupe_id: 'g1' },
    { etablissement_id: 'a2', groupe_id: 'g2' },
  ]

  const GROUPS_ROWS = [
    { id: 'g1', logo_url: 'logo-a1.png' },
    { id: 'g2', logo_url: null },
  ]

  const CSM_ROWS = [
    {
      id: 'c1',
      nom: 'Alpha Prod',
      ville: 'Paris',
      statut: 'Production',
      date_fin_contrat: '2026-12-31',
    },
    {
      id: 'c2',
      nom: 'Beta Prod',
      ville: null,
      statut: 'Production',
      date_fin_contrat: null,
    },
  ]

  const AUTH_STATE = {
    loading: false,
    user: { id: 'u1', email: 'user@test.co' },
  }

  const toastSpy = vi.fn()
  const calculateEtablissementValueSpy = vi.fn((etablissement: { id: string }) =>
    etablissement.id === 's1' ? 1111 : 2222,
  )

  const QUERY_PRESETS = {
    standard: {
      staleTime: 120000,
    },
  }

  const builderState = {
    responseByTable: new Map<string, { data: unknown; error: unknown }>(),
  }

  const errorResponse = { data: null, error: { message: 'x' } }

  const createBuilder = (table: string) => {
    const getResponse = () => builderState.responseByTable.get(table) ?? { data: null, error: null }

    const builder = {
      table,
      select: vi.fn(() => builder),
      eq: vi.fn(() => builder),
      gte: vi.fn(() => builder),
      lte: vi.fn(() => builder),
      in: vi.fn(() => builder),
      order: vi.fn(() => builder),
      limit: vi.fn(() => builder),
      range: vi.fn(() => builder),
      neq: vi.fn(() => builder),
      is: vi.fn(() => builder),
      not: vi.fn(() => builder),
      ilike: vi.fn(() => builder),
      insert: vi.fn(() => builder),
      update: vi.fn(() => builder),
      upsert: vi.fn(() => builder),
      delete: vi.fn(() => builder),
      returns: vi.fn(() => builder),
      throwOnError: vi.fn(() => builder),
      single: vi.fn(async () => getResponse()),
      maybeSingle: vi.fn(async () => getResponse()),
      then: (
        onFulfilled: (value: { data: unknown; error: unknown }) => unknown,
        onRejected?: (reason: unknown) => unknown,
      ) => Promise.resolve(getResponse()).then(onFulfilled, onRejected),
      catch: (onRejected: (reason: unknown) => unknown) => Promise.resolve(getResponse()).catch(onRejected),
    }

    return builder
  }

  const mockFrom = vi.fn((table: string) => createBuilder(table))

  return {
    AUTH_STATE,
    toastSpy,
    calculateEtablissementValueSpy,
    QUERY_PRESETS,
    PROSPECT_ROWS,
    STATS_ROWS,
    ALL_ETABS_ROWS,
    LINKS_ROWS,
    GROUPS_ROWS,
    CSM_ROWS,
    errorResponse,
    builderState,
    mockFrom,
  }
})

vi.mock('@/lib/supabaseBrowser', () => ({
  supabase: {
    from: mockFrom,
  },
}))

vi.mock('@/hooks/shared/use-toast', () => ({
  useToast: () => ({
    toast: toastSpy,
  }),
}))

vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => AUTH_STATE,
}))

vi.mock('@/lib/valueCalculations', () => ({
  calculateEtablissementValue: calculateEtablissementValueSpy,
}))

vi.mock('@/lib/queryPresets', () => ({
  queryPresets: QUERY_PRESETS,
}))

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  })

  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children)
  }
}

function resetStableState() {
  vi.clearAllMocks()
  AUTH_STATE.loading = false
  AUTH_STATE.user = { id: 'u1', email: 'user@test.co' }
  builderState.responseByTable.clear()
}

function getBuilderFromCall(index: number): BuilderForAssertions {
  const value = mockFrom.mock.results[index]?.value
  expect(value).toBeDefined()
  return value as BuilderForAssertions
}

describe('useProspects', () => {
  beforeEach(() => {
    resetStableState()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('charge les prospects commerciaux avec le filtre de statuts et le tri attendu', async () => {
    builderState.responseByTable.set('etablissements', { data: PROSPECT_ROWS, error: null })

    const { result } = renderHook(() => useProspects(), {
      wrapper: createWrapper(),
    })

    expect(result.current.isLoading).toBe(true)

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(mockFrom).toHaveBeenCalledWith('etablissements')

    const etabBuilder = getBuilderFromCall(0)

    expect(etabBuilder.select).toHaveBeenCalledTimes(1)
    expect(etabBuilder.in).toHaveBeenCalledWith('statut', [
      'Prospect',
      'Contacté',
      'Attente RDV',
      'RDV pris',
      'Attente post RDV',
      'Dans les RDV',
      'Etude émise',
      'Dans les RDV post EME',
      'Négociation',
      'Contractualisation',
      'Contractuel',
      'Conformité',
      'Déploiement',
      'Formation',
      'Go-Live',
      'Production',
      'Vendu',
      'Reporté',
      'Refus',
      'Autre compte / GHT',
    ])
    expect(etabBuilder.order).toHaveBeenCalledWith('created_at', { ascending: false })

    expect(result.current.data).toEqual(PROSPECT_ROWS)
    expect(result.current.data?.[0]?.nom).toBe('Clinique Beta')
    expect(result.current.data?.[1]?.statut).toBe('Prospect')
  })

  it('passe en erreur et déclenche un toast si le chargement des prospects échoue', async () => {
    vi.useFakeTimers()
    builderState.responseByTable.set('etablissements', errorResponse)

    const { result } = renderHook(() => useProspects(), {
      wrapper: createWrapper(),
    })

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000)
    })

    vi.useRealTimers()

    await waitFor(() => expect(result.current.isError).toBe(true))

    expect(toastSpy).toHaveBeenCalledWith({
      title: 'Erreur',
      description: 'Impossible de charger les établissements commerciaux',
      variant: 'destructive',
    })
    expect(result.current.error).toEqual(errorResponse.error)
  })
})

describe('useProspectStats', () => {
  beforeEach(() => {
    resetStableState()
  })

  it('calcule les statistiques métier du pipeline commercial', async () => {
    builderState.responseByTable.set('etablissements', { data: STATS_ROWS, error: null })

    const { result } = renderHook(() => useProspectStats(), {
      wrapper: createWrapper(),
    })

    expect(result.current.isLoading).toBe(true)

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    const etabBuilder = getBuilderFromCall(0)

    expect(etabBuilder.in).toHaveBeenCalledWith('statut', [
      'Prospect',
      'Contacté',
      'Attente RDV',
      'RDV pris',
      'Attente post RDV',
      'Dans les RDV',
      'Etude émise',
      'Dans les RDV post EME',
      'Négociation',
      'Contractualisation',
      'Contractuel',
      'Conformité',
      'Déploiement',
      'Formation',
      'Go-Live',
      'Production',
      'Vendu',
      'Reporté',
      'Refus',
      'Autre compte / GHT',
    ])
    expect(calculateEtablissementValueSpy).toHaveBeenCalledTimes(2)
    expect(calculateEtablissementValueSpy).toHaveBeenNthCalledWith(1, STATS_ROWS[0])
    expect(calculateEtablissementValueSpy).toHaveBeenNthCalledWith(2, STATS_ROWS[1])

    expect(result.current.data).toEqual({
      totalProspects: 2,
      prospectsByCommercial: {
        'com-1': 1,
        'Non assigné': 1,
      },
      prospectsPipelineProgress: [
        {
          id: 's1',
          nom: 'Alpha',
          progress: 50,
          totalTasks: 2,
          completedTasks: 1,
          potentialValue: 1111,
        },
        {
          id: 's2',
          nom: 'Beta',
          progress: 100,
          totalTasks: 2,
          completedTasks: 2,
          potentialValue: 2222,
        },
      ],
    })
  })

  it('passe en erreur et déclenche un toast si le chargement des statistiques échoue', async () => {
    builderState.responseByTable.set('etablissements', errorResponse)

    const { result } = renderHook(() => useProspectStats(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.isError).toBe(true))

    expect(toastSpy).toHaveBeenCalledWith({
      title: 'Erreur',
      description: 'Impossible de charger les statistiques commerciales',
      variant: 'destructive',
    })
    expect(result.current.error).toEqual(errorResponse.error)
  })
})

describe('useAllEtablissements', () => {
  beforeEach(() => {
    resetStableState()
  })

  it('charge tous les établissements et enrichit avec les logos de groupe', async () => {
    builderState.responseByTable.set('etablissements', { data: ALL_ETABS_ROWS, error: null })
    builderState.responseByTable.set('etablissements_groupes', { data: LINKS_ROWS, error: null })
    builderState.responseByTable.set('groupes_etablissements', { data: GROUPS_ROWS, error: null })

    const { result } = renderHook(() => useAllEtablissements(), {
      wrapper: createWrapper(),
    })

    expect(result.current.isLoading).toBe(true)

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(mockFrom).toHaveBeenCalledWith('etablissements')
    expect(mockFrom).toHaveBeenCalledWith('etablissements_groupes')
    expect(mockFrom).toHaveBeenCalledWith('groupes_etablissements')

    const etabBuilder = getBuilderFromCall(0)
    const linkBuilder = getBuilderFromCall(1)
    const groupBuilder = getBuilderFromCall(2)

    expect(etabBuilder.order).toHaveBeenCalledWith('created_at', { ascending: false })
    expect(linkBuilder.in).toHaveBeenCalledWith('etablissement_id', ['a1', 'a2'])
    expect(groupBuilder.in).toHaveBeenCalledWith('id', ['g1', 'g2'])

    expect(result.current.data).toEqual([
      {
        ...ALL_ETABS_ROWS[0],
        groupe_logo_url: 'logo-a1.png',
      },
      {
        ...ALL_ETABS_ROWS[1],
        groupe_logo_url: null,
      },
    ])
  })

  it('passe en erreur et déclenche un toast si le chargement initial échoue', async () => {
    builderState.responseByTable.set('etablissements', errorResponse)

    const { result } = renderHook(() => useAllEtablissements(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.isError).toBe(true))

    expect(toastSpy).toHaveBeenCalledWith({
      title: 'Erreur',
      description: 'Impossible de charger les établissements',
      variant: 'destructive',
    })
    expect(result.current.error).toEqual(errorResponse.error)
  })
})

describe('useCsmDashboardEtablissements', () => {
  beforeEach(() => {
    resetStableState()
  })

  it('charge les établissements de production pour le dashboard CSM', async () => {
    builderState.responseByTable.set('etablissements', { data: CSM_ROWS, error: null })

    const { result } = renderHook(() => useCsmDashboardEtablissements(), {
      wrapper: createWrapper(),
    })

    expect(result.current.isLoading).toBe(true)

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    const etabBuilder = getBuilderFromCall(0)

    expect(etabBuilder.eq).toHaveBeenCalledWith('statut', 'Production')
    expect(etabBuilder.order).toHaveBeenCalledWith('nom', { ascending: true })
    expect(result.current.data).toEqual(CSM_ROWS)
    expect(result.current.data?.[0]?.nom).toBe('Alpha Prod')
    expect(result.current.data?.[0]?.date_fin_contrat).toBe('2026-12-31')
    expect(result.current.data?.[1]?.ville).toBeNull()
  })

  it('passe en erreur et déclenche un toast si le chargement CSM échoue', async () => {
    builderState.responseByTable.set('etablissements', errorResponse)

    const { result } = renderHook(() => useCsmDashboardEtablissements(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.isError).toBe(true))

    expect(toastSpy).toHaveBeenCalledWith({
      title: 'Erreur',
      description: 'Impossible de charger les indicateurs CSM',
      variant: 'destructive',
    })
    expect(result.current.error).toEqual(errorResponse.error)
  })
})