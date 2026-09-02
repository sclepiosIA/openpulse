// @ts-nocheck
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import React from 'react'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useRapportsData } from './useRapportsData'

const {
  ETABLISSEMENTS,
  TACHES,
  PROFILES,
  FILTERS,
  EMPTY_FILTERS,
  mockUseAllEtablissements,
  mockUseTaches,
  mockUseProfiles,
  mockCalculateEtablissementValue,
} = vi.hoisted(() => ({
  ETABLISSEMENTS: [
    {
      id: 'e1',
      created_at: '2024-01-10T10:00:00.000Z',
      commercial_id: 'r1',
      statut: 'Prospect',
      type_offre: 'Premium',
      pallier_vise: 'P1',
      nombre_passages_urgences_annuel: 1000,
      progression: 20,
    },
    {
      id: 'e2',
      created_at: '2024-02-15T10:00:00.000Z',
      commercial_id: 'r1',
      statut: 'Production',
      type_offre: 'Premium',
      pallier_vise: 'P1',
      nombre_passages_urgences_annuel: 5000,
      progression: 80,
    },
    {
      id: 'e3',
      created_at: '2024-03-20T10:00:00.000Z',
      commercial_id: 'r2',
      statut: 'Go-Live',
      type_offre: 'Standard',
      pallier_vise: 'P2',
      nombre_passages_urgences_annuel: 4000,
      progression: 100,
    },
    {
      id: 'e4',
      created_at: '2024-04-05T10:00:00.000Z',
      commercial_id: 'r2',
      statut: 'Déploiement',
      type_offre: 'Standard',
      pallier_vise: 'P2',
      nombre_passages_urgences_annuel: 2000,
      progression: 60,
    },
  ],
  TACHES: [
    { id: 't1', etablissement_id: 'e1', statut: 'Ouvert', archive: false },
    { id: 't2', etablissement_id: 'e2', statut: 'Terminé', archive: false },
    { id: 't3', etablissement_id: 'e2', statut: 'Ouvert', archive: true },
    { id: 't4', etablissement_id: 'e4', statut: 'Ouvert', archive: false },
    { id: 't5', etablissement_id: 'other', statut: 'Terminé', archive: false },
  ],
  PROFILES: [
    { id: 'r1', first_name: 'Alice' },
    { id: 'r2', first_name: 'Bob' },
  ],
  FILTERS: {
    startDate: new Date('2024-01-01T00:00:00.000Z'),
    endDate: new Date('2024-12-31T23:59:59.999Z'),
    periodPreset: 'year',
    selectedEtablissements: [],
    selectedResponsables: [],
    selectedStatuts: [],
    selectedTypesOffre: [],
    selectedPalliers: [],
    minValue: 0,
    maxValue: 100000,
    minPassages: 0,
    maxPassages: 100000,
    productionOnly: false,
    includeProspects: true,
  },
  EMPTY_FILTERS: {
    startDate: new Date('2024-01-01T00:00:00.000Z'),
    endDate: new Date('2024-12-31T23:59:59.999Z'),
    periodPreset: 'year',
    selectedEtablissements: [],
    selectedResponsables: [],
    selectedStatuts: [],
    selectedTypesOffre: [],
    selectedPalliers: [],
    minValue: 0,
    maxValue: 0,
    minPassages: 0,
    maxPassages: 0,
    productionOnly: false,
    includeProspects: true,
  },
  mockUseAllEtablissements: vi.fn(),
  mockUseTaches: vi.fn(),
  mockUseProfiles: vi.fn(),
  mockCalculateEtablissementValue: vi.fn(),
}))

vi.mock('@/hooks/crm/useProspects', () => ({
  useAllEtablissements: mockUseAllEtablissements,
}))

vi.mock('@/hooks/tasks/useTaches', () => ({
  useTaches: mockUseTaches,
}))

vi.mock('@/hooks/profile/useProfiles', () => ({
  useProfiles: mockUseProfiles,
}))

vi.mock('@/lib/valueCalculations', () => ({
  calculateEtablissementValue: mockCalculateEtablissementValue,
}))

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  })

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children)
  }
}

describe('useRapportsData', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    mockUseAllEtablissements.mockReturnValue({
      data: ETABLISSEMENTS,
      isLoading: false,
      isError: false,
      error: null,
    })

    mockUseTaches.mockReturnValue({
      data: TACHES,
      isLoading: false,
      isError: false,
      error: null,
    })

    mockUseProfiles.mockReturnValue({
      data: PROFILES,
      isLoading: false,
      isError: false,
      error: null,
    })

    mockCalculateEtablissementValue.mockImplementation((etablissement: { id: string }) => {
      const values: Record<string, number> = {
        e1: 100,
        e2: 200,
        e3: 300,
        e4: 400,
      }
      return values[etablissement.id] ?? 0
    })
  })

  it('retourne les données filtrées et calcule les statistiques métier correctement', async () => {
    const wrapper = createWrapper()

    const { result } = renderHook(() => useRapportsData(FILTERS), { wrapper })

    await waitFor(() => {
      expect(result.current.etablissements).toHaveLength(4)
    })

    expect(result.current.profiles).toEqual(PROFILES)
    expect(result.current.etablissements.map((e) => e.id)).toEqual(['e1', 'e2', 'e3', 'e4'])

    expect(result.current.stats).toEqual({
      totalEtablissements: 4,
      prospects: 1,
      enProduction: 2,
      enDeploiement: 1,
      totalTaches: 4,
      tachesTerminees: 2,
      tachesArchivees: 1,
      progressionMoyenne: 65,
      totalPassages: 12000,
      totalValeur: 1000,
      caRealise: 500,
      caPrevisionnel: 1000,
      tauxConversion: 67,
      pipelineValue: 500,
      passagesProduction: 9000,
      partMarcheActuelle: 0.0375,
      partMarchePotentielle: 0.05,
      passagesRestants: 23991000,
      potentielMarcheRestant: 59977500,
      passagesNationaux: 24000000,
    })

    expect(mockCalculateEtablissementValue).toHaveBeenCalled()
  })

  it('applique les filtres spécifiques sur responsables, statuts, types, palliers, valeur, passages et production', async () => {
    const wrapper = createWrapper()

    const filtered = {
      ...FILTERS,
      selectedResponsables: ['r1'],
      selectedStatuts: ['Production'],
      selectedTypesOffre: ['Premium'],
      selectedPalliers: ['P1'],
      minValue: 150,
      maxValue: 250,
      minPassages: 4000,
      maxPassages: 6000,
      productionOnly: true,
      includeProspects: false,
    }

    const { result } = renderHook(() => useRapportsData(filtered), { wrapper })

    await waitFor(() => {
      expect(result.current.etablissements).toHaveLength(1)
    })

    expect(result.current.etablissements[0]?.id).toBe('e2')
    expect(result.current.stats.totalEtablissements).toBe(1)
    expect(result.current.stats.enProduction).toBe(1)
    expect(result.current.stats.totalTaches).toBe(2)
    expect(result.current.stats.tachesTerminees).toBe(2)
    expect(result.current.stats.totalValeur).toBe(200)
    expect(result.current.stats.caRealise).toBe(200)
    expect(result.current.stats.pipelineValue).toBe(0)
    expect(result.current.stats.totalPassages).toBe(5000)
  })

  it('retourne des statistiques nulles quand aucun établissement ne correspond', async () => {
    const wrapper = createWrapper()

    const { result } = renderHook(() => useRapportsData(EMPTY_FILTERS), { wrapper })

    await waitFor(() => {
      expect(result.current.etablissements).toEqual([])
    })

    expect(result.current.stats).toEqual({
      totalEtablissements: 0,
      prospects: 0,
      enProduction: 0,
      enDeploiement: 0,
      totalTaches: 0,
      tachesTerminees: 0,
      tachesArchivees: 0,
      progressionMoyenne: 0,
      totalPassages: 0,
      totalValeur: 0,
      caRealise: 0,
      caPrevisionnel: 0,
      tauxConversion: 0,
      pipelineValue: 0,
      passagesProduction: 0,
      partMarcheActuelle: 0,
      partMarchePotentielle: 0,
      passagesRestants: 24000000,
      potentielMarcheRestant: 60000000,
      passagesNationaux: 24000000,
    })
  })

  it('gère le chargement initial des hooks de dépendance puis le succès', async () => {
    const wrapper = createWrapper()

    mockUseAllEtablissements
      .mockReturnValueOnce({ data: undefined, isLoading: true, isError: false, error: null })
      .mockReturnValue({ data: ETABLISSEMENTS, isLoading: false, isError: false, error: null })

    mockUseTaches
      .mockReturnValueOnce({ data: undefined, isLoading: true, isError: false, error: null })
      .mockReturnValue({ data: TACHES, isLoading: false, isError: false, error: null })

    mockUseProfiles
      .mockReturnValueOnce({ data: undefined, isLoading: true, isError: false, error: null })
      .mockReturnValue({ data: PROFILES, isLoading: false, isError: false, error: null })

    const { result, rerender } = renderHook(() => useRapportsData(FILTERS), { wrapper })

    expect(result.current.etablissements).toEqual([])
    expect(result.current.stats.totalEtablissements).toBe(0)
    expect(result.current.profiles).toBeUndefined()

    rerender()

    await waitFor(() => {
      expect(result.current.etablissements).toHaveLength(4)
    })

    expect(result.current.stats.totalValeur).toBe(1000)
    expect(result.current.profiles).toEqual(PROFILES)
  })

  it('tolère une erreur dune dépendance en exposant un résultat vide cohérent', async () => {
    const wrapper = createWrapper()

    mockUseAllEtablissements.mockReturnValue({
      data: null,
      isLoading: false,
      isError: true,
      error: { message: 'x' },
    })

    const { result } = renderHook(() => useRapportsData(FILTERS), { wrapper })

    await waitFor(() => {
      expect(result.current.etablissements).toEqual([])
    })

    expect(result.current.stats.totalEtablissements).toBe(0)
    expect(result.current.stats.totalValeur).toBe(0)
    expect(result.current.stats.passagesRestants).toBe(24000000)
    expect(result.current.profiles).toEqual(PROFILES)
  })
})
