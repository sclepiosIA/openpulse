import React from 'react'
import { renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  useDeploymentHealth,
  getHealthColor,
  getHealthBadgeColor,
  getHealthLabel,
  getHealthIcon,
} from './useDeploymentHealth'

type Etablissement = {
  id: string
  date_signature?: string | null
  progression?: number | null
  csm_id?: string | null
  chef_projet_id?: string | null
}

type TaskStats = {
  total: number
  onTime: number
  delayed: number
  blocked: number
}

describe('useDeploymentHealth and helpers', () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: 0, gcTime: 0 }, mutations: { retry: 0 } },
  })

  const wrapper = ({ children }: { children?: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children)

  beforeEach(() => {
    vi.useFakeTimers()
    // Fixed point in time for deterministic day calculations
    vi.setSystemTime(new Date('2024-02-10T00:00:00Z').getTime())
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('calculates correct health scores, statuses and reasons for multiple etablissements', () => {
    const etablissements: Etablissement[] = [
      {
        id: 'e1',
        date_signature: '2024-01-01T00:00:00Z',
        progression: 85,
        csm_id: 'c1',
        chef_projet_id: 'p1',
      },
      {
        id: 'e2',
        date_signature: '2024-01-01T00:00:00Z',
        progression: 69,
        csm_id: 'c2',
        chef_projet_id: 'p2',
      },
      {
        id: 'e3',
        date_signature: '2024-01-01T00:00:00Z',
        progression: 10,
        csm_id: null,
        chef_projet_id: null,
      },
    ]

    const tasksStats = new Map<string, TaskStats>()
    tasksStats.set('e2', { total: 10, onTime: 8, delayed: 2, blocked: 0 })
    tasksStats.set('e3', { total: 5, onTime: 0, delayed: 5, blocked: 3 })

    const { result } = renderHook(() => useDeploymentHealth(etablissements, tasksStats), { wrapper })
    const healthMap = result.current

    expect(healthMap.size).toBe(3)

    // e1: expected progression based on time is 80 (40 days * 2 = 80), progression 85 -> healthy
    const e1 = healthMap.get('e1')
    expect(e1).toBeDefined()
    expect(e1?.score).toBe(100)
    expect(e1?.status).toBe('healthy')
    expect(e1?.reasons).toEqual([])

    // e2: expected progression 80, progression 69 -> progression slightly in delay (-20),
    // delayRate = 2/10 = 0.2 -> (-15), total 100 -20 -15 = 65 => at-risk
    const e2 = healthMap.get('e2')
    expect(e2).toBeDefined()
    expect(e2?.score).toBe(65)
    expect(e2?.status).toBe('at-risk')
    expect(e2?.reasons).toEqual(['Progression légèrement en retard', '2 tâche(s) en retard'])

    // e3: progression 10 vs expected 80 -> -40, delayRate 1.0 -> -30, blocked 3 -> -40 (2 blocks counted),
    // team incomplete -> -10, total < 40 => blocked
    const e3 = healthMap.get('e3')
    expect(e3).toBeDefined()
    expect(e3?.status).toBe('blocked')
    expect(typeof e3?.score).toBe('number')
    expect((e3?.score ?? 0)).toBeLessThan(40)
    expect(e3?.reasons).toEqual([
      'Progression lente par rapport au temps écoulé',
      '5 tâche(s) en retard',
      '3 bloqueur(s) critique(s)',
      'Équipe incomplète',
    ])
  })

  it('returns correct labels, icons and color strings for each status', () => {
    expect(getHealthLabel('healthy')).toBe('Dans les temps')
    expect(getHealthLabel('at-risk')).toBe('À risque')
    expect(getHealthLabel('delayed')).toBe('En retard')
    expect(getHealthLabel('blocked')).toBe('Bloqué')

    expect(getHealthIcon('healthy')).toBe('🟢')
    expect(getHealthIcon('at-risk')).toBe('🟠')
    expect(getHealthIcon('delayed')).toBe('🔴')
    expect(getHealthIcon('blocked')).toBe('🚨')

    expect(getHealthColor('healthy')).toBe('text-green-600 dark:text-green-400')
    expect(getHealthColor('at-risk')).toBe('text-orange-600 dark:text-orange-400')
    expect(getHealthColor('delayed')).toBe('text-red-600 dark:text-red-400')
    expect(getHealthColor('blocked')).toBe('text-red-700 dark:text-red-500')

    expect(getHealthBadgeColor('healthy')).toContain('bg-green-100')
    expect(getHealthBadgeColor('at-risk')).toContain('bg-orange-100')
    expect(getHealthBadgeColor('delayed')).toContain('bg-red-100')
    expect(getHealthBadgeColor('blocked')).toContain('bg-red-200')
  })
})