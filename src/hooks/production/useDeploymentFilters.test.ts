// @vitest-environment jsdom

import React from 'react'
import { renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  useDeploymentFilters,
  type DeploymentFilters,
  type SortConfig,
} from './useDeploymentFilters'

type EtablissementLike = {
  id: string
  nom: string
  ville: string
  region: string
  type: string
  statut: string
  commercial_id?: string | null
  chef_projet_id?: string | null
  csm_id?: string | null
  progression?: number | null
  date_signature?: string | null
}

const { ETABLISSEMENTS, HEALTH_SCORES } = vi.hoisted(() => {
  const etablissements: EtablissementLike[] = [
    {
      id: 'e1',
      nom: 'Alpha Clinic',
      ville: 'Lyon',
      region: 'ARA',
      type: 'Hopital',
      statut: 'signed',
      commercial_id: 'tm1',
      chef_projet_id: 'cp1',
      csm_id: 'csm1',
      progression: 80,
      date_signature: '2024-01-15',
    },
    {
      id: 'e2',
      nom: 'Beta Center',
      ville: 'Paris',
      region: 'IDF',
      type: 'Clinique',
      statut: 'pending',
      commercial_id: 'tm2',
      chef_projet_id: 'cp2',
      csm_id: 'csm2',
      progression: 35,
      date_signature: '2024-03-10',
    },
    {
      id: 'e3',
      nom: 'Gamma Lab',
      ville: 'Marseille',
      region: 'PACA',
      type: 'Laboratoire',
      statut: 'blocked',
      commercial_id: 'tm3',
      chef_projet_id: 'cp3',
      csm_id: 'csm3',
      progression: 10,
      date_signature: '2023-12-20',
    },
    {
      id: 'e4',
      nom: 'Delta Hospital',
      ville: 'Nice',
      region: 'PACA',
      type: 'Hopital',
      statut: 'signed',
      commercial_id: 'tm1',
      chef_projet_id: 'cp4',
      csm_id: 'csm4',
      progression: 65,
      date_signature: '2024-02-05',
    },
    {
      id: 'e5',
      nom: 'Epsilon Care',
      ville: 'Bordeaux',
      region: 'NAQ',
      type: 'Clinique',
      statut: 'signed',
      commercial_id: null,
      chef_projet_id: null,
      csm_id: 'csm1',
      progression: null,
      date_signature: null,
    },
  ]

  const healthScores = new Map<
    string,
    { score: number; status: 'healthy' | 'at-risk' | 'delayed' | 'blocked' }
  >([
    ['e1', { score: 20, status: 'healthy' }],
    ['e2', { score: 65, status: 'at-risk' }],
    ['e3', { score: 95, status: 'blocked' }],
    ['e4', { score: 75, status: 'delayed' }],
  ])

  return {
    ETABLISSEMENTS: etablissements,
    HEALTH_SCORES: healthScores,
  }
})

function createWrapper() {
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

function baseFilters(): DeploymentFilters {
  return {
    searchTerm: '',
    regions: [],
    types: [],
    statuts: [],
    healthStatuses: [],
    teamMembers: [],
    progressionMin: undefined,
    progressionMax: undefined,
    dateSignatureStart: undefined,
    dateSignatureEnd: undefined,
  }
}

describe('useDeploymentFilters', () => {
  it('retourne tous les établissements triés par nom ascendant sans filtre', () => {
    const filters = baseFilters()
    const sortConfig: SortConfig = { field: 'nom', direction: 'asc' }

    const { result } = renderHook(
      () => useDeploymentFilters(ETABLISSEMENTS, filters, sortConfig, HEALTH_SCORES),
      { wrapper: createWrapper() }
    )

    expect(result.current).toHaveLength(5)
    expect(result.current.map((e) => e.id)).toEqual(['e1', 'e2', 'e4', 'e5', 'e3'])
  })

  it('filtre par recherche textuelle sur nom, ville, région et type', () => {
    const sortConfig: SortConfig = { field: 'nom', direction: 'asc' }

    const { result: byName } = renderHook(
      () =>
        useDeploymentFilters(
          ETABLISSEMENTS,
          { ...baseFilters(), searchTerm: 'alpha' },
          sortConfig,
          HEALTH_SCORES
        ),
      { wrapper: createWrapper() }
    )
    expect(byName.current.map((e) => e.id)).toEqual(['e1'])

    const { result: byCity } = renderHook(
      () =>
        useDeploymentFilters(
          ETABLISSEMENTS,
          { ...baseFilters(), searchTerm: 'paris' },
          sortConfig,
          HEALTH_SCORES
        ),
      { wrapper: createWrapper() }
    )
    expect(byCity.current.map((e) => e.id)).toEqual(['e2'])

    const { result: byRegion } = renderHook(
      () =>
        useDeploymentFilters(
          ETABLISSEMENTS,
          { ...baseFilters(), searchTerm: 'paca' },
          sortConfig,
          HEALTH_SCORES
        ),
      { wrapper: createWrapper() }
    )
    expect(byRegion.current.map((e) => e.id)).toEqual(['e4', 'e3'])

    const { result: byType } = renderHook(
      () =>
        useDeploymentFilters(
          ETABLISSEMENTS,
          { ...baseFilters(), searchTerm: 'clinique' },
          sortConfig,
          HEALTH_SCORES
        ),
      { wrapper: createWrapper() }
    )
    expect(byType.current.map((e) => e.id)).toEqual(['e2', 'e5'])
  })

  it('combine les filtres région, type et statut', () => {
    const filters: DeploymentFilters = {
      ...baseFilters(),
      regions: ['PACA'],
      types: ['Hopital'],
      statuts: ['signed'],
    }
    const sortConfig: SortConfig = { field: 'nom', direction: 'asc' }

    const { result } = renderHook(
      () => useDeploymentFilters(ETABLISSEMENTS, filters, sortConfig, HEALTH_SCORES),
      { wrapper: createWrapper() }
    )

    expect(result.current).toHaveLength(1)
    expect(result.current[0]?.id).toBe('e4')
    expect(result.current[0]?.nom).toBe('Delta Hospital')
  })

  it('filtre par statut de santé à partir de la map healthScores', () => {
    const filters: DeploymentFilters = {
      ...baseFilters(),
      healthStatuses: ['blocked', 'delayed'],
    }
    const sortConfig: SortConfig = { field: 'urgence', direction: 'desc' }

    const { result } = renderHook(
      () => useDeploymentFilters(ETABLISSEMENTS, filters, sortConfig, HEALTH_SCORES),
      { wrapper: createWrapper() }
    )

    expect(result.current.map((e) => e.id)).toEqual(['e4', 'e3'])
  })

  it('filtre par membres d’équipe sur commercial, chef de projet ou csm', () => {
    const sortConfig: SortConfig = { field: 'nom', direction: 'asc' }

    const { result: byCommercial } = renderHook(
      () =>
        useDeploymentFilters(
          ETABLISSEMENTS,
          { ...baseFilters(), teamMembers: ['tm1'] },
          sortConfig,
          HEALTH_SCORES
        ),
      { wrapper: createWrapper() }
    )
    expect(byCommercial.current.map((e) => e.id)).toEqual(['e1', 'e4'])

    const { result: byChefProjet } = renderHook(
      () =>
        useDeploymentFilters(
          ETABLISSEMENTS,
          { ...baseFilters(), teamMembers: ['cp2'] },
          sortConfig,
          HEALTH_SCORES
        ),
      { wrapper: createWrapper() }
    )
    expect(byChefProjet.current.map((e) => e.id)).toEqual(['e2'])

    const { result: byCsm } = renderHook(
      () =>
        useDeploymentFilters(
          ETABLISSEMENTS,
          { ...baseFilters(), teamMembers: ['csm1'] },
          sortConfig,
          HEALTH_SCORES
        ),
      { wrapper: createWrapper() }
    )
    expect(byCsm.current.map((e) => e.id)).toEqual(['e1', 'e5'])
  })

  it('filtre par plage de progression en traitant null comme 0', () => {
    const filters: DeploymentFilters = {
      ...baseFilters(),
      progressionMin: 30,
      progressionMax: 70,
    }
    const sortConfig: SortConfig = { field: 'progression', direction: 'asc' }

    const { result } = renderHook(
      () => useDeploymentFilters(ETABLISSEMENTS, filters, sortConfig, HEALTH_SCORES),
      { wrapper: createWrapper() }
    )

    expect(result.current.map((e) => ({ id: e.id, progression: e.progression ?? 0 }))).toEqual([
      { id: 'e2', progression: 35 },
      { id: 'e4', progression: 65 },
    ])
  })

  it('filtre par plage de dates de signature en excluant les dates manquantes', () => {
    const filters: DeploymentFilters = {
      ...baseFilters(),
      dateSignatureStart: new Date('2024-01-01'),
      dateSignatureEnd: new Date('2024-02-28'),
    }
    const sortConfig: SortConfig = { field: 'date_signature', direction: 'asc' }

    const { result } = renderHook(
      () => useDeploymentFilters(ETABLISSEMENTS, filters, sortConfig, HEALTH_SCORES),
      { wrapper: createWrapper() }
    )

    expect(result.current.map((e) => ({ id: e.id, date: e.date_signature }))).toEqual([
      { id: 'e1', date: '2024-01-15' },
      { id: 'e4', date: '2024-02-05' },
    ])
  })

  it('trie par progression descendante', () => {
    const filters = baseFilters()
    const sortConfig: SortConfig = { field: 'progression', direction: 'desc' }

    const { result } = renderHook(
      () => useDeploymentFilters(ETABLISSEMENTS, filters, sortConfig, HEALTH_SCORES),
      { wrapper: createWrapper() }
    )

    expect(result.current.map((e) => [e.id, e.progression ?? 0])).toEqual([
      ['e1', 80],
      ['e4', 65],
      ['e2', 35],
      ['e3', 10],
      ['e5', 0],
    ])
  })

  it('trie par urgence avec le score le plus élevé en premier quand direction asc', () => {
    const filters = baseFilters()
    const sortConfig: SortConfig = { field: 'urgence', direction: 'asc' }

    const { result } = renderHook(
      () => useDeploymentFilters(ETABLISSEMENTS, filters, sortConfig, HEALTH_SCORES),
      { wrapper: createWrapper() }
    )

    expect(result.current.map((e) => e.id)).toEqual(['e3', 'e4', 'e2', 'e1', 'e5'])
  })

  it('retourne un tableau vide si etablissements est undefined', () => {
    const filters = baseFilters()
    const sortConfig: SortConfig = { field: 'nom', direction: 'asc' }

    const { result } = renderHook(
      () =>
        useDeploymentFilters(
          undefined as unknown as EtablissementLike[],
          filters,
          sortConfig,
          HEALTH_SCORES
        ),
      { wrapper: createWrapper() }
    )

    expect(result.current).toEqual([])
  })

  it('combine plusieurs filtres métier et retourne exactement le résultat attendu', () => {
    const filters: DeploymentFilters = {
      ...baseFilters(),
      searchTerm: 'hospital',
      regions: ['PACA', 'ARA'],
      types: ['Hopital'],
      statuts: ['signed'],
      healthStatuses: ['healthy', 'delayed'],
      teamMembers: ['tm1'],
      progressionMin: 60,
      progressionMax: 90,
      dateSignatureStart: new Date('2024-01-01'),
      dateSignatureEnd: new Date('2024-12-31'),
    }
    const sortConfig: SortConfig = { field: 'date_signature', direction: 'desc' }

    const { result } = renderHook(
      () => useDeploymentFilters(ETABLISSEMENTS, filters, sortConfig, HEALTH_SCORES),
      { wrapper: createWrapper() }
    )

    expect(result.current).toHaveLength(1)
    expect(result.current[0]?.id).toBe('e4')
    expect(result.current[0]?.region).toBe('PACA')
    expect(result.current[0]?.progression).toBe(65)
  })

  it('trie par date de signature descendante en mettant les valeurs nulles à la fin', () => {
    const filters = baseFilters()
    const sortConfig: SortConfig = { field: 'date_signature', direction: 'desc' }

    const { result } = renderHook(
      () => useDeploymentFilters(ETABLISSEMENTS, filters, sortConfig, HEALTH_SCORES),
      { wrapper: createWrapper() }
    )

    expect(result.current.map((e) => e.id)).toEqual(['e2', 'e4', 'e1', 'e3', 'e5'])
  })

  it('trie par statut ascendant', () => {
    const filters = baseFilters()
    const sortConfig: SortConfig = { field: 'statut', direction: 'asc' }

    const { result } = renderHook(
      () => useDeploymentFilters(ETABLISSEMENTS, filters, sortConfig, HEALTH_SCORES),
      { wrapper: createWrapper() }
    )

    expect(result.current.map((e) => [e.id, e.statut])).toEqual([
      ['e3', 'blocked'],
      ['e2', 'pending'],
      ['e1', 'signed'],
      ['e4', 'signed'],
      ['e5', 'signed'],
    ])
  })
})
