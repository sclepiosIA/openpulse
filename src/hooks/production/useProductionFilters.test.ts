import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useProductionFilters, ProductionFilters, ProductionSortConfig } from './useProductionFilters'

// Mock internal utility used by the hook
vi.mock('@/lib/valueCalculations', () => ({
  calculateEtablissementValue: vi.fn((e: any) => e?.value ?? 0)
}))

// Stable data exposed via vi.hoisted to avoid TDZ and re-creation issues
const { ETABLISSEMENTS, HEALTH_SCORES } = vi.hoisted(() => ({
  ETABLISSEMENTS: [
    { id: 'e1', nom: 'Alpha', ville: 'Lyon', region: 'Auvergne', type: 'TypeA', date_signature: '2023-01-01', csm_id: 'csm1', value: 100 },
    { id: 'e2', nom: 'Beta', ville: 'Paris', region: 'Ile-de-France', type: 'TypeB', date_signature: '2021-06-01', csm_id: 'csm2', value: 200 },
    { id: 'e3', nom: 'Gamma', ville: 'Lille', region: 'Hauts-de-France', type: 'TypeA', date_signature: '2020-04-01', csm_id: null, value: 50 }
  ],
  HEALTH_SCORES: new Map<string, { status: string; score: number }>([
    ['e1', { status: 'good', score: 90 }],
    ['e2', { status: 'average', score: 60 }]
  ])
}))

// Wrapper providing the QueryClientProvider as required by the tests
const Wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const client = React.useMemo(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { retry: 0, gcTime: 0 },
          mutations: { retry: 0 }
        }
      }),
    []
  )
  return React.createElement(QueryClientProvider, { client }, children)
}

describe('useProductionFilters', () => {
  const etablissements = ETABLISSEMENTS as any[]
  const healthScores = HEALTH_SCORES as Map<string, { status: string; score: number }>

  it('returns all items sorted by nom ascending when no filters are applied', () => {
    const filters: ProductionFilters = {
      search: '',
      regions: [],
      types: [],
      healthStatuses: [],
      csmIds: [],
      durationRanges: [],
      adoptionRanges: [],
      npsRanges: [],
      supportLevels: [],
      renewalPeriods: []
    }
    const sortConfig: ProductionSortConfig = { field: 'nom', direction: 'asc' }

    const { result } = renderHook(
      () => useProductionFilters(etablissements, filters, sortConfig, healthScores),
      { wrapper: Wrapper }
    )

    const ids = (result.current as any[]).map(e => e.id)
    expect(ids).toEqual(['e1', 'e2', 'e3'])
  })

  it('filters by search string (nom, ville, region, type)', () => {
    const filters: ProductionFilters = {
      search: 'alp',
      regions: [],
      types: [],
      healthStatuses: [],
      csmIds: [],
      durationRanges: [],
      adoptionRanges: [],
      npsRanges: [],
      supportLevels: [],
      renewalPeriods: []
    }
    const sortConfig: ProductionSortConfig = { field: 'nom', direction: 'asc' }

    const { result } = renderHook(
      () => useProductionFilters(etablissements, filters, sortConfig, healthScores),
      { wrapper: Wrapper }
    )

    const ids = (result.current as any[]).map(e => e.id)
    expect(ids).toEqual(['e1'])
  })

  it('filters by region correctly', () => {
    const filters: ProductionFilters = {
      search: '',
      regions: ['Ile-de-France'],
      types: [],
      healthStatuses: [],
      csmIds: [],
      durationRanges: [],
      adoptionRanges: [],
      npsRanges: [],
      supportLevels: [],
      renewalPeriods: []
    }
    const sortConfig: ProductionSortConfig = { field: 'nom', direction: 'asc' }

    const { result } = renderHook(
      () => useProductionFilters(etablissements, filters, sortConfig, healthScores),
      { wrapper: Wrapper }
    )

    const ids = (result.current as any[]).map(e => e.id)
    expect(ids).toEqual(['e2'])
  })

  it('filters by health statuses using provided healthScores', () => {
    const filters: ProductionFilters = {
      search: '',
      regions: [],
      types: [],
      healthStatuses: ['good'],
      csmIds: [],
      durationRanges: [],
      adoptionRanges: [],
      npsRanges: [],
      supportLevels: [],
      renewalPeriods: []
    }
    const sortConfig: ProductionSortConfig = { field: 'nom', direction: 'asc' }

    const { result } = renderHook(
      () => useProductionFilters(etablissements, filters, sortConfig, healthScores),
      { wrapper: Wrapper }
    )

    const ids = (result.current as any[]).map(e => e.id)
    expect(ids).toEqual(['e1'])
  })

  it('sorts by revenue (calculateEtablissementValue) ascending', () => {
    const filters: ProductionFilters = {
      search: '',
      regions: [],
      types: [],
      healthStatuses: [],
      csmIds: [],
      durationRanges: [],
      adoptionRanges: [],
      npsRanges: [],
      supportLevels: [],
      renewalPeriods: []
    }
    const sortConfig: ProductionSortConfig = { field: 'revenue', direction: 'asc' }

    const { result } = renderHook(
      () => useProductionFilters(etablissements, filters, sortConfig, healthScores),
      { wrapper: Wrapper }
    )

    const ids = (result.current as any[]).map(e => e.id)
    // Revenue values: e1=100, e2=200, e3=50 => order: e3, e1, e2
    expect(ids).toEqual(['e3', 'e1', 'e2'])
  })

  it('sorts by date_signature ascending', () => {
    const filters: ProductionFilters = {
      search: '',
      regions: [],
      types: [],
      healthStatuses: [],
      csmIds: [],
      durationRanges: [],
      adoptionRanges: [],
      npsRanges: [],
      supportLevels: [],
      renewalPeriods: []
    }
    const sortConfig: ProductionSortConfig = { field: 'date_signature', direction: 'asc' }

    const { result } = renderHook(
      () => useProductionFilters(etablissements, filters, sortConfig, healthScores),
      { wrapper: Wrapper }
    )

    const ids = (result.current as any[]).map(e => e.id)
    // Dates: e3=2020-04-01, e2=2021-06-01, e1=2023-01-01
    expect(ids).toEqual(['e3', 'e2', 'e1'])
  })
})