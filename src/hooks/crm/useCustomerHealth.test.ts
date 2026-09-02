import { type PropsWithChildren } from 'react'
import { renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  useCustomerHealth,
  getHealthBadgeColor,
  getHealthColor,
  getHealthIcon,
  getHealthLabel,
  type CustomerHealthScore
} from './useCustomerHealth'

type Etablissement = {
  id: string
  date_signature?: string | null
}

const { FIXED_NOW, ETABS, METRICS, MISSING_ETABS } = vi.hoisted(() => {
  const FIXED_NOW = new Date('2026-06-11T12:00:00.000Z').getTime()

  const monthsAgoIso = (months: number) => {
    const d = new Date(FIXED_NOW)
    d.setUTCDate(1)
    d.setUTCMonth(d.getUTCMonth() - months)
    return d.toISOString()
  }

  const daysAgoIso = (days: number) => {
    const d = new Date(FIXED_NOW)
    d.setUTCDate(d.getUTCDate() - days)
    return d.toISOString()
  }

  const daysFromNowIso = (days: number) => {
    const d = new Date(FIXED_NOW)
    d.setUTCDate(d.getUTCDate() + days)
    return d.toISOString()
  }

  const ETABS: ReadonlyArray<Etablissement> = [
    { id: 'e_onboarding', date_signature: monthsAgoIso(2) },
    { id: 'e_healthy', date_signature: monthsAgoIso(6) },
    { id: 'e_critical', date_signature: monthsAgoIso(12) }
  ]

  const METRICS = new Map<string, Record<string, unknown>>([
    [
      'e_healthy',
      {
        adoption_rate: 95,
        support_tickets_open: 0,
        payment_status: 'on_time',
        last_activity_date: daysAgoIso(3),
        nps_score: 9.2,
        contract_end_date: daysFromNowIso(50)
      }
    ],
    [
      'e_critical',
      {
        adoption_rate: 30,
        support_tickets_open: 7,
        payment_status: 'overdue',
        last_activity_date: daysAgoIso(45),
        nps_score: 4.5,
        contract_end_date: daysFromNowIso(-10)
      }
    ]
  ])

  const MISSING_ETABS: ReadonlyArray<Etablissement> = [
    { id: 'e_missing', date_signature: new Date('2025-01-01T00:00:00.000Z').toISOString() }
  ]

  return { FIXED_NOW, ETABS, METRICS, MISSING_ETABS }
})

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: 0, gcTime: 0 }, mutations: { retry: 0 } }
  })

  function Wrapper({ children }: PropsWithChildren) {
    return QueryClientProvider({ client: queryClient, children })
  }

  return Wrapper
}

describe('useCustomerHealth', () => {
  it('calcule onboarding / healthy / critical avec métriques', () => {
    vi.useFakeTimers()
    vi.setSystemTime(FIXED_NOW)

    const Wrapper = createWrapper()
    const { result } = renderHook(() => useCustomerHealth([...ETABS], METRICS), { wrapper: Wrapper })

    const onboarding = result.current.get('e_onboarding')
    expect(onboarding).toBeTruthy()
    expect(onboarding?.status).toBe('onboarding')
    expect(onboarding?.alerts).toEqual(["En phase d'onboarding - Suivi renforcé requis"])

    const healthy = result.current.get('e_healthy') as CustomerHealthScore | undefined
    expect(healthy).toBeTruthy()
    expect(healthy?.status).toBe('healthy')
    expect(healthy?.score).toBe(100)
    expect(healthy?.factors.adoption).toBe(100)
    expect(healthy?.alerts).toEqual(['Renouvellement dans 2 mois'])

    const critical = result.current.get('e_critical') as CustomerHealthScore | undefined
    expect(critical).toBeTruthy()
    expect(critical?.status).toBe('critical')
    expect(critical?.score).toBe(38)
    expect(critical?.factors.adoption).toBe(40)
    expect(critical?.factors.support).toBe(40)
    expect(critical?.factors.payment).toBe(30)
    expect(critical?.factors.engagement).toBe(40)
    expect(critical?.factors.feedback).toBe(40)
    expect(critical?.alerts).toContain('Adoption faible: 30%')
    expect(critical?.alerts).toContain('7 tickets support ouverts')
    expect(critical?.alerts).toContain('Paiement en retard')
    expect(critical?.alerts).toContain("Pas d'activité depuis 45 jours")
    expect(critical?.alerts).toContain('NPS faible: 4.5')
    expect(critical?.alerts).toContain('Situation critique - Escalation immédiate')
    expect(critical?.alerts).toContain('Contrat expiré')

    vi.useRealTimers()
  })

  it("gère l'absence de métriques: adoption neutre + alerte, score healthy", () => {
    vi.useFakeTimers()
    vi.setSystemTime(FIXED_NOW)

    const Wrapper = createWrapper()
    const { result } = renderHook(() => useCustomerHealth([...MISSING_ETABS], undefined), { wrapper: Wrapper })

    const v = result.current.get('e_missing')
    expect(v).toBeTruthy()
    expect(v?.factors.adoption).toBe(50)
    expect(v?.alerts).toContain("Métriques d'adoption manquantes")
    expect(v?.score).toBe(85)
    expect(v?.status).toBe('healthy')

    vi.useRealTimers()
  })
})

describe('helpers de statut', () => {
  it('retourne les libellés/couleurs/icônes attendus', () => {
    expect(getHealthColor('healthy')).toBe('text-success')
    expect(getHealthBadgeColor('healthy')).toBe('bg-success/10 text-success border-success/20')
    expect(getHealthLabel('healthy')).toBe('Bon')
    expect(getHealthIcon('healthy')).toBe('🟢')

    expect(getHealthColor('at-risk')).toBe('text-warning')
    expect(getHealthBadgeColor('at-risk')).toBe('bg-warning/10 text-warning border-warning/20')
    expect(getHealthLabel('at-risk')).toBe('At Risk')
    expect(getHealthIcon('at-risk')).toBe('🟠')

    expect(getHealthColor('churn-risk')).toBe('text-destructive')
    expect(getHealthBadgeColor('churn-risk')).toBe('bg-destructive/10 text-destructive border-destructive/20')
    expect(getHealthLabel('churn-risk')).toBe('Churn Risk')
    expect(getHealthIcon('churn-risk')).toBe('🔴')

    expect(getHealthColor('critical')).toBe('text-destructive')
    expect(getHealthBadgeColor('critical')).toBe('bg-destructive/20 text-destructive border-destructive/30')
    expect(getHealthLabel('critical')).toBe('Critical')
    expect(getHealthIcon('critical')).toBe('🚨')

    expect(getHealthColor('onboarding')).toBe('text-primary')
    expect(getHealthBadgeColor('onboarding')).toBe('bg-primary/10 text-primary border-primary/20')
    expect(getHealthLabel('onboarding')).toBe('Onboarding')
    expect(getHealthIcon('onboarding')).toBe('🆕')
  })
})