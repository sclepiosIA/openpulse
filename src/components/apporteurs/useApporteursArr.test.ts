const {
  PROSPECTS,
  APPORTERS,
  LOADING_QUERY,
  SUCCESS_QUERY,
  ERROR_QUERY,
  mockUseProspects,
  mockCalculateEtablissementValue,
} = vi.hoisted(() => {
  const PROSPECTS = [
    { id: 'e1', statut: 'Vendu', apporteurs_affaires_ids: ['pa'], arrValue: 100 },
    { id: 'e2', statut: 'Production', apporteurs_affaires_ids: ['pa', 'pb'], arrValue: 200 },
    { id: 'e3', statut: 'Go-Live', apporteurs_affaires_ids: ['pb'], arrValue: 300 },
    { id: 'e4', statut: 'Prospect', apporteurs_affaires_ids: ['pa'], arrValue: 900 },
    { id: 'e5', statut: 'Formation', apporteurs_affaires_ids: null, arrValue: 400 },
    { id: 'e6', statut: 'Déploiement', apporteurs_affaires_ids: ['pc'], arrValue: 500 },
    { id: 'e7', statut: 'Perdu', apporteurs_affaires_ids: ['pb'], arrValue: 600 },
  ]

  const APPORTERS = [
    { id: 'a1', partenaireId: 'pa' },
    { id: 'a2', partenaireId: 'pb' },
    { id: 'a3', partenaireId: null },
    { id: 'a4', partenaireId: 'pz' },
  ]

  const LOADING_QUERY = {
    data: undefined,
    isLoading: true,
    isError: false,
    error: null,
  }

  const SUCCESS_QUERY = {
    data: PROSPECTS,
    isLoading: false,
    isError: false,
    error: null,
  }

  const ERROR_QUERY = {
    data: null,
    isLoading: false,
    isError: true,
    error: { message: 'x' },
  }

  const mockUseProspects = vi.fn()
  const mockCalculateEtablissementValue = vi.fn((etablissement: unknown) => {
    if (
      typeof etablissement !== 'object' ||
      etablissement === null ||
      !('arrValue' in etablissement)
    ) {
      return 0
    }

    const value = (etablissement as { arrValue?: unknown }).arrValue
    return typeof value === 'number' ? value : 0
  })

  return {
    PROSPECTS,
    APPORTERS,
    LOADING_QUERY,
    SUCCESS_QUERY,
    ERROR_QUERY,
    mockUseProspects,
    mockCalculateEtablissementValue,
  }
})

vi.mock('@/hooks/crm/useProspects', () => ({
  useProspects: mockUseProspects,
  useProspectStats: vi.fn(),
  useAllEtablissements: vi.fn(),
  useCsmDashboardEtablissements: vi.fn(),
}))

vi.mock('@/lib/valueCalculations', () => ({
  calculateEtablissementValue: mockCalculateEtablissementValue,
}))

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'
import { APPORTEUR_CLIENT_STATUTS, useApporteursArr } from './useApporteursArr'
import type { Apporteur } from './types'

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

describe('useApporteursArr', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('expose les statuts client utilisés pour le calcul ARR', () => {
    expect(APPORTEUR_CLIENT_STATUTS).toEqual([
      'Vendu',
      'Production',
      'Go-Live',
      'Formation',
      'Déploiement',
    ])
  })

  it('retourne un état de chargement puis calcule l’ARR par apporteur et le total', () => {
    mockUseProspects.mockReturnValue(LOADING_QUERY)

    const { result, rerender } = renderHook(() => useApporteursArr(APPORTERS as Apporteur[]), {
      wrapper: createWrapper(),
    })

    expect(result.current.isLoading).toBe(true)
    expect(result.current.isReady).toBe(false)
    expect(result.current.totalArr).toBe(0)
    expect(result.current.arrByApporteurId).toEqual({})
    expect(mockCalculateEtablissementValue).not.toHaveBeenCalled()

    mockUseProspects.mockReturnValue(SUCCESS_QUERY)
    rerender()

    expect(result.current.isLoading).toBe(false)
    expect(result.current.isReady).toBe(true)
    expect(result.current.arrByApporteurId).toEqual({
      a1: 300,
      a2: 500,
      a3: 0,
      a4: 0,
    })
    expect(result.current.totalArr).toBe(800)
    expect(mockCalculateEtablissementValue).toHaveBeenCalledTimes(4)
    expect(mockCalculateEtablissementValue).toHaveBeenCalledWith(PROSPECTS[0])
    expect(mockCalculateEtablissementValue).toHaveBeenCalledWith(PROSPECTS[1])
    expect(mockCalculateEtablissementValue).toHaveBeenCalledWith(PROSPECTS[2])
    expect(mockCalculateEtablissementValue).not.toHaveBeenCalledWith(PROSPECTS[3])
    expect(mockCalculateEtablissementValue).not.toHaveBeenCalledWith(PROSPECTS[4])
    expect(mockCalculateEtablissementValue).not.toHaveBeenCalledWith(PROSPECTS[5])
    expect(mockCalculateEtablissementValue).not.toHaveBeenCalledWith(PROSPECTS[6])
  })

  it('reste non prêt et ne calcule rien lorsque useProspects retourne une erreur', () => {
    mockUseProspects.mockReturnValue(ERROR_QUERY)

    const { result } = renderHook(() => useApporteursArr(APPORTERS as Apporteur[]), {
      wrapper: createWrapper(),
    })

    expect(result.current.isLoading).toBe(false)
    expect(result.current.isReady).toBe(false)
    expect(result.current.totalArr).toBe(0)
    expect(result.current.arrByApporteurId).toEqual({})
    expect(mockCalculateEtablissementValue).not.toHaveBeenCalled()
  })
})
