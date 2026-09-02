import { createElement, type ReactNode } from 'react'
import { renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useApporteurProspects } from './useApporteurProspects'

const {
  PROSPECTS,
  LOADING_QUERY,
  SUCCESS_QUERY,
  ERROR_QUERY,
  mockUseProspects,
  mockUseProspectStats,
  mockUseAllEtablissements,
  mockUseCsmDashboardEtablissements,
} = vi.hoisted(() => {
  const PROSPECTS = [
    {
      id: 'prospect-1',
      nom: 'Clinique des Pins',
      statut: 'prospect',
      apporteurs_affaires_ids: ['partner-a', 'partner-b'],
    },
    {
      id: 'prospect-2',
      nom: 'Maison Santé Nord',
      statut: 'prospect',
      apporteurs_affaires_ids: ['partner-b'],
    },
    {
      id: 'prospect-3',
      nom: 'Centre Opale',
      statut: 'prospect',
      apporteurs_affaires_ids: null,
    },
    {
      id: 'prospect-4',
      nom: 'Ehpad Bellevue',
      statut: 'prospect',
      apporteurs_affaires_ids: ['partner-a'],
    },
  ]

  const LOADING_QUERY = {
    data: undefined,
    isLoading: true,
    isFetching: true,
    isError: false,
    isSuccess: false,
    error: null,
  }

  const SUCCESS_QUERY = {
    data: PROSPECTS,
    isLoading: false,
    isFetching: false,
    isError: false,
    isSuccess: true,
    error: null,
  }

  const ERROR_QUERY = {
    data: null,
    isLoading: false,
    isFetching: false,
    isError: true,
    isSuccess: false,
    error: { message: 'x' },
  }

  return {
    PROSPECTS,
    LOADING_QUERY,
    SUCCESS_QUERY,
    ERROR_QUERY,
    mockUseProspects: vi.fn(),
    mockUseProspectStats: vi.fn(),
    mockUseAllEtablissements: vi.fn(),
    mockUseCsmDashboardEtablissements: vi.fn(),
  }
})

vi.mock('@/hooks/crm/useProspects', () => ({
  useProspects: mockUseProspects,
  useProspectStats: mockUseProspectStats,
  useAllEtablissements: mockUseAllEtablissements,
  useCsmDashboardEtablissements: mockUseCsmDashboardEtablissements,
}))

interface TestProspect {
  id: string
  nom: string
  statut: string
  apporteurs_affaires_ids?: string[] | null
}

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

describe('useApporteurProspects', () => {
  beforeEach(() => {
    mockUseProspects.mockReset()
    mockUseProspectStats.mockReset()
    mockUseAllEtablissements.mockReset()
    mockUseCsmDashboardEtablissements.mockReset()
  })

  it('retourne un état de chargement avec une liste de prospects vide', () => {
    mockUseProspects.mockReturnValue(LOADING_QUERY)

    const { result } = renderHook(() => useApporteurProspects('partner-a'), {
      wrapper: createWrapper(),
    })

    expect(mockUseProspects).toHaveBeenCalledTimes(1)
    expect(result.current.isLoading).toBe(true)
    expect(result.current.isFetching).toBe(true)
    expect(result.current.isError).toBe(false)
    expect(result.current.prospects).toEqual([])
  })

  it('filtre les établissements liés au partenaire apporteur demandé', () => {
    mockUseProspects.mockReturnValue(SUCCESS_QUERY)

    const { result } = renderHook(() => useApporteurProspects('partner-a'), {
      wrapper: createWrapper(),
    })

    const prospects = result.current.prospects as unknown as TestProspect[]

    expect(result.current.isSuccess).toBe(true)
    expect(result.current.data).toBe(PROSPECTS)
    expect(prospects).toHaveLength(2)
    expect(prospects.map((prospect) => prospect.id)).toEqual(['prospect-1', 'prospect-4'])
    expect(prospects.map((prospect) => prospect.nom)).toEqual([
      'Clinique des Pins',
      'Ehpad Bellevue',
    ])
    expect(
      prospects.every(
        (prospect) => prospect.apporteurs_affaires_ids?.includes('partner-a') === true
      )
    ).toBe(true)
  })

  it('retourne une liste vide quand aucun partenaire apporteur est fourni', () => {
    mockUseProspects.mockReturnValue(SUCCESS_QUERY)

    const { result } = renderHook(() => useApporteurProspects(), {
      wrapper: createWrapper(),
    })

    expect(result.current.isSuccess).toBe(true)
    expect(result.current.data).toBe(PROSPECTS)
    expect(result.current.prospects).toEqual([])
  })

  it('propage l’erreur de useProspects et garde une liste filtrée vide', () => {
    mockUseProspects.mockReturnValue(ERROR_QUERY)

    const { result } = renderHook(() => useApporteurProspects('partner-a'), {
      wrapper: createWrapper(),
    })

    expect(result.current.isError).toBe(true)
    expect(result.current.isLoading).toBe(false)
    expect(result.current.data).toBeNull()
    expect(result.current.error).toEqual({ message: 'x' })
    expect(result.current.prospects).toEqual([])
  })
})
