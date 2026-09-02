import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
// @vitest-environment jsdom

import React from 'react'
import { renderHook, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { subDays, subYears } from 'date-fns'
import { useRapportsFilters } from './useRapportsFilters'

const { AUTH_STATE, getPreferenceMock, updatePreferenceMock, builder, mockFrom } = vi.hoisted(
  () => {
    const chain = {
      select: vi.fn(() => chain),
      eq: vi.fn(() => chain),
      gte: vi.fn(() => chain),
      lte: vi.fn(() => chain),
      in: vi.fn(() => chain),
      order: vi.fn(() => chain),
      limit: vi.fn(() => chain),
      insert: vi.fn(() => chain),
      update: vi.fn(() => chain),
      delete: vi.fn(() => chain),
      single: vi.fn(async () => ({ data: null, error: null })),
      maybeSingle: vi.fn(async () => ({ data: null, error: null })),
      then: vi.fn(
        (
          onFulfilled?: (value: { data: null; error: null }) => unknown,
          onRejected?: (reason: unknown) => unknown
        ) => Promise.resolve({ data: null, error: null }).then(onFulfilled, onRejected)
      ),
      catch: vi.fn((onRejected?: (reason: unknown) => unknown) =>
        Promise.resolve({ data: null, error: null }).catch(onRejected)
      ),
    }

    return {
      AUTH_STATE: {
        user: { id: 'u1', email: 't@t.co' },
        session: { user: { id: 'u1' } },
        isLoading: false,
      },
      getPreferenceMock: vi.fn(),
      updatePreferenceMock: vi.fn(),
      builder: chain,
      mockFrom: vi.fn(() => chain),
    }
  }
)

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
  },
}))

vi.mock('../profile/useUserPreferences', () => ({
  useUserPreferences: () => ({
    getPreference: getPreferenceMock,
    updatePreference: updatePreferenceMock,
  }),
}))

vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => AUTH_STATE,
}))

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

describe('useRapportsFilters', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getPreferenceMock.mockReturnValue('charts')
  })

  it('initialise la vue depuis les préférences et persiste un changement de vue', () => {
    const wrapper = createWrapper()
    const { result } = renderHook(() => useRapportsFilters(), { wrapper })

    expect(result.current.view).toBe('charts')
    expect(getPreferenceMock).toHaveBeenCalledWith('rapports_view', 'dashboard')

    act(() => {
      result.current.setView('table')
    })

    expect(result.current.view).toBe('table')
    expect(updatePreferenceMock).toHaveBeenCalledTimes(1)
    expect(updatePreferenceMock).toHaveBeenCalledWith('rapports_view', 'table')
  })

  it('initialise les filtres par défaut avec la période 30 jours et les bornes métier attendues', () => {
    const wrapper = createWrapper()
    const before = new Date()

    const { result } = renderHook(() => useRapportsFilters(), { wrapper })

    const after = new Date()

    expect(result.current.filters.periodPreset).toBe('30d')
    expect(result.current.filters.compareWithPrevious).toBe(false)
    expect(result.current.filters.selectedEtablissements).toEqual([])
    expect(result.current.filters.selectedResponsables).toEqual([])
    expect(result.current.filters.selectedStatuts).toEqual([])
    expect(result.current.filters.selectedTypesOffre).toEqual([])
    expect(result.current.filters.selectedPalliers).toEqual([])
    expect(result.current.filters.minValue).toBe(0)
    expect(result.current.filters.maxValue).toBe(1000000)
    expect(result.current.filters.minPassages).toBe(0)
    expect(result.current.filters.maxPassages).toBe(200000)
    expect(result.current.filters.includeProspects).toBe(true)
    expect(result.current.filters.productionOnly).toBe(false)

    const expectedStartMin = subDays(before, 30).getTime()
    const expectedStartMax = subDays(after, 30).getTime()
    const actualStart = result.current.filters.startDate.getTime()
    expect(actualStart).toBeGreaterThanOrEqual(expectedStartMin)
    expect(actualStart).toBeLessThanOrEqual(expectedStartMax)

    const actualEnd = result.current.filters.endDate.getTime()
    expect(actualEnd).toBeGreaterThanOrEqual(before.getTime())
    expect(actualEnd).toBeLessThanOrEqual(after.getTime())

    const daysDiff = Math.floor(
      (result.current.filters.endDate.getTime() - result.current.filters.startDate.getTime()) /
        (1000 * 60 * 60 * 24)
    )
    const expectedPreviousEnd = subDays(result.current.filters.startDate, 1).getTime()
    const expectedPreviousStart = subDays(
      result.current.filters.previousEndDate,
      daysDiff
    ).getTime()

    expect(result.current.filters.previousEndDate.getTime()).toBe(expectedPreviousEnd)
    expect(result.current.filters.previousStartDate.getTime()).toBe(expectedPreviousStart)
  })

  it('recalcule les dates pour les presets 7d, 90d et 1y', () => {
    const wrapper = createWrapper()
    const { result } = renderHook(() => useRapportsFilters(), { wrapper })

    expect(result.current.periodPreset).toBe('30d')

    const before7d = new Date()
    act(() => {
      result.current.setPeriodPreset('7d')
    })
    const after7d = new Date()

    expect(result.current.filters.periodPreset).toBe('7d')
    expect(result.current.filters.startDate.getTime()).toBeGreaterThanOrEqual(
      subDays(before7d, 7).getTime()
    )
    expect(result.current.filters.startDate.getTime()).toBeLessThanOrEqual(
      subDays(after7d, 7).getTime()
    )

    const before90d = new Date()
    act(() => {
      result.current.setPeriodPreset('90d')
    })
    const after90d = new Date()

    expect(result.current.filters.periodPreset).toBe('90d')
    expect(result.current.filters.startDate.getTime()).toBeGreaterThanOrEqual(
      subDays(before90d, 90).getTime()
    )
    expect(result.current.filters.startDate.getTime()).toBeLessThanOrEqual(
      subDays(after90d, 90).getTime()
    )

    const before1y = new Date()
    act(() => {
      result.current.setPeriodPreset('1y')
    })
    const after1y = new Date()

    expect(result.current.filters.periodPreset).toBe('1y')
    expect(result.current.filters.startDate.getTime()).toBeGreaterThanOrEqual(
      subYears(before1y, 1).getTime()
    )
    expect(result.current.filters.startDate.getTime()).toBeLessThanOrEqual(
      subYears(after1y, 1).getTime()
    )
  })

  it('utilise les dates custom et calcule correctement la période précédente', () => {
    const wrapper = createWrapper()
    const { result } = renderHook(() => useRapportsFilters(), { wrapper })

    const customStart = new Date('2024-05-10T00:00:00.000Z')
    const customEnd = new Date('2024-05-20T00:00:00.000Z')

    act(() => {
      result.current.setCustomStartDate(customStart)
      result.current.setCustomEndDate(customEnd)
      result.current.setPeriodPreset('custom')
    })

    expect(result.current.filters.periodPreset).toBe('custom')
    expect(result.current.filters.startDate.getTime()).toBe(customStart.getTime())
    expect(result.current.filters.endDate.getTime()).toBe(customEnd.getTime())

    const daysDiff = Math.floor(
      (customEnd.getTime() - customStart.getTime()) / (1000 * 60 * 60 * 24)
    )
    const expectedPreviousEnd = subDays(customStart, 1)
    const expectedPreviousStart = subDays(expectedPreviousEnd, daysDiff)

    expect(result.current.filters.previousEndDate.getTime()).toBe(expectedPreviousEnd.getTime())
    expect(result.current.filters.previousStartDate.getTime()).toBe(expectedPreviousStart.getTime())
  })

  it('met à jour tous les filtres métier puis les réinitialise avec resetFilters', () => {
    const wrapper = createWrapper()
    const { result } = renderHook(() => useRapportsFilters(), { wrapper })

    act(() => {
      result.current.setCompareWithPrevious(true)
      result.current.setSelectedEtablissements(['etab-1', 'etab-2'])
      result.current.setSelectedResponsables(['resp-1'])
      result.current.setSelectedStatuts(['gagne', 'perdu'])
      result.current.setSelectedTypesOffre(['premium'])
      result.current.setSelectedPalliers(['p1'])
      result.current.setMinValue(100)
      result.current.setMaxValue(5000)
      result.current.setMinPassages(3)
      result.current.setMaxPassages(25)
      result.current.setIncludeProspects(false)
      result.current.setProductionOnly(true)
      result.current.setPeriodPreset('7d')
    })

    expect(result.current.filters.compareWithPrevious).toBe(true)
    expect(result.current.filters.selectedEtablissements).toEqual(['etab-1', 'etab-2'])
    expect(result.current.filters.selectedResponsables).toEqual(['resp-1'])
    expect(result.current.filters.selectedStatuts).toEqual(['gagne', 'perdu'])
    expect(result.current.filters.selectedTypesOffre).toEqual(['premium'])
    expect(result.current.filters.selectedPalliers).toEqual(['p1'])
    expect(result.current.filters.minValue).toBe(100)
    expect(result.current.filters.maxValue).toBe(5000)
    expect(result.current.filters.minPassages).toBe(3)
    expect(result.current.filters.maxPassages).toBe(25)
    expect(result.current.filters.includeProspects).toBe(false)
    expect(result.current.filters.productionOnly).toBe(true)
    expect(result.current.filters.periodPreset).toBe('7d')

    act(() => {
      result.current.resetFilters()
    })

    expect(result.current.filters.periodPreset).toBe('30d')
    expect(result.current.filters.compareWithPrevious).toBe(false)
    expect(result.current.filters.selectedEtablissements).toEqual([])
    expect(result.current.filters.selectedResponsables).toEqual([])
    expect(result.current.filters.selectedStatuts).toEqual([])
    expect(result.current.filters.selectedTypesOffre).toEqual([])
    expect(result.current.filters.selectedPalliers).toEqual([])
    expect(result.current.filters.minValue).toBe(0)
    expect(result.current.filters.maxValue).toBe(1000000)
    expect(result.current.filters.minPassages).toBe(0)
    expect(result.current.filters.maxPassages).toBe(200000)
    expect(result.current.filters.includeProspects).toBe(true)
    expect(result.current.filters.productionOnly).toBe(false)
  })

  it('retombe sur dashboard si la préférence est absente', () => {
    getPreferenceMock.mockReturnValue(null)

    const wrapper = createWrapper()
    const { result } = renderHook(() => useRapportsFilters(), { wrapper })

    expect(result.current.view).toBe('dashboard')
    expect(result.current.filters.periodPreset).toBe('30d')
    expect(result.current.filters.maxValue).toBe(1000000)
  })
})
