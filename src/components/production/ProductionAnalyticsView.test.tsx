import React from 'react'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { ProductionAnalyticsView } from './ProductionAnalyticsView'

const {
  NAVIGATE,
  MOCK_ETABS,
  BASE_STATS,
  mockCalculateEtablissementValue,
  mockFormatCurrency,
  mockGetHealthLabelFr
} = vi.hoisted(() => {
  const NAVIGATE = vi.fn()

  const REVENUE_MAP: Record<string, number> = {
    e1: 1000,
    e2: 9000,
    e3: 5000,
    e4: 12000,
    e5: 7000,
    e6: 2000
  }

  const MOCK_ETABS = [
    { id: 'e1', nom: 'Alpha', type: 'Clinique', region: 'IDF', ville: 'Paris' },
    { id: 'e2', nom: 'Bravo', type: 'Hôpital', region: 'NAQ', ville: 'Bordeaux' },
    { id: 'e3', nom: 'Charlie', type: 'Cabinet', region: 'ARA', ville: 'Lyon' },
    { id: 'e4', nom: 'Delta', type: 'Hôpital', region: 'OCC', ville: 'Toulouse' },
    { id: 'e5', nom: 'Echo', type: 'Clinique', region: 'PACA', ville: 'Nice' },
    { id: 'e6', nom: 'Foxtrot', type: 'Cabinet', region: 'BRE', ville: 'Rennes' }
  ]

  const mockCalculateEtablissementValue = vi.fn((etab: { id: string }) => REVENUE_MAP[etab.id] ?? 0)

  const LABELS: Record<string, string> = {
    'healthy': 'En bonne santé',
    'at-risk': 'À risque',
    'churn-risk': 'Risque de churn',
    'onboarding': 'Onboarding'
  }
  const mockGetHealthLabelFr = vi.fn((key: string) => LABELS[key] ?? key)

  const mockFormatCurrency = vi.fn((value: number) => `EUR ${value}`)

  const BASE_STATS = {
    totalRevenue: 1000,
    averageNPS: 7.2,
    byHealth: {
      healthy: { revenue: 400, nps: 8.5, count: 10 },
      atRisk: { revenue: 300, nps: 6.1, count: 5 },
      churnRisk: { revenue: 200, nps: 3.2, count: 2 },
      onboarding: { revenue: 100, nps: 0, count: 3 }
    },
    renewals: {
      next30Days: [
        { id: 'e4', nom: 'Delta', type: 'Hôpital', region: 'OCC', ville: 'Toulouse' },
        { id: 'e2', nom: 'Bravo', type: 'Hôpital', region: 'NAQ', ville: 'Bordeaux' },
        { id: 'e1', nom: 'Alpha', type: 'Clinique', region: 'IDF', ville: 'Paris' },
        { id: 'e3', nom: 'Charlie', type: 'Cabinet', region: 'ARA', ville: 'Lyon' }
      ],
      next90Days: [
        { id: 'e5', nom: 'Echo', type: 'Clinique', region: 'PACA', ville: 'Nice' },
        { id: 'e6', nom: 'Foxtrot', type: 'Cabinet', region: 'BRE', ville: 'Rennes' },
        { id: 'e3', nom: 'Charlie', type: 'Cabinet', region: 'ARA', ville: 'Lyon' },
        { id: 'e2', nom: 'Bravo', type: 'Hôpital', region: 'NAQ', ville: 'Bordeaux' }
      ]
    }
  }

  return {
    NAVIGATE,
    MOCK_ETABS,
    BASE_STATS,
    mockCalculateEtablissementValue,
    mockFormatCurrency,
    mockGetHealthLabelFr
  }
})

vi.mock('react-router-dom', () => ({
  useNavigate: () => NAVIGATE
}))

vi.mock('@/components/ui/card', () => ({
  Card: ({ children, ...props }: any) => <div data-testid="Card" {...props}>{children}</div>,
  CardHeader: ({ children, ...props }: any) => <div data-testid="CardHeader" {...props}>{children}</div>,
  CardTitle: ({ children, ...props }: any) => <div data-testid="CardTitle" {...props}>{children}</div>,
  CardContent: ({ children, ...props }: any) => <div data-testid="CardContent" {...props}>{children}</div>
}))

vi.mock('lucide-react', () => ({
  BarChart3: (props: any) => <svg data-testid="icon-BarChart3" {...props} />,
  TrendingUp: (props: any) => <svg data-testid="icon-TrendingUp" {...props} />,
  Users: (props: any) => <svg data-testid="icon-Users" {...props} />,
  DollarSign: (props: any) => <svg data-testid="icon-DollarSign" {...props} />
}))

vi.mock('@/lib/valueCalculations', () => ({
  calculateEtablissementValue: mockCalculateEtablissementValue
}))

vi.mock('@/lib/productionUtils', () => ({
  formatCurrency: mockFormatCurrency,
  getHealthLabelFr: mockGetHealthLabelFr
}))

describe('ProductionAnalyticsView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('affiche la répartition du CA par santé avec bons libellés, valeurs et pourcentages', () => {
    const stats = {
      ...BASE_STATS,
      renewals: { next30Days: [], next90Days: [] }
    }

    render(<ProductionAnalyticsView stats={stats} etablissements={MOCK_ETABS} healthMetrics={new Map()} />)

    const caTitle = screen.getByText('Répartition du CA par santé')
    const caCard = caTitle.closest('[data-testid="Card"]') as HTMLElement
    const withinCa = within(caCard)

    withinCa.getByText('En bonne santé')
    withinCa.getByText('À risque')
    withinCa.getByText('Risque de churn')
    withinCa.getByText('Onboarding')

    withinCa.getByText('EUR 400')
    withinCa.getByText('EUR 300')
    withinCa.getByText('EUR 200')
    withinCa.getByText('EUR 100')

    withinCa.getByText('40%')
    withinCa.getByText('30%')
    withinCa.getByText('20%')
    withinCa.getByText('10%')

    expect(mockGetHealthLabelFr).toHaveBeenCalledWith('healthy')
    expect(mockFormatCurrency).toHaveBeenCalledWith(400)
  })

  it('affiche les blocs NPS conditionnels avec arrondi correct', () => {
    const stats = {
      ...BASE_STATS,
      renewals: { next30Days: [], next90Days: [] }
    }

    render(<ProductionAnalyticsView stats={stats} etablissements={MOCK_ETABS} healthMetrics={new Map()} />)

    const npsTitle = screen.getByText('NPS moyen par segment')
    const npsCard = npsTitle.closest('[data-testid="Card"]') as HTMLElement
    const withinNps = within(npsCard)

    withinNps.getByText('7.2/10')
    withinNps.getByText('En bonne santé')
    withinNps.getByText('8.5/10')
    withinNps.getByText('À risque')
    withinNps.getByText('6.1/10')
    withinNps.getByText('Risque de churn')
    withinNps.getByText('3.2/10')
    expect(withinNps.queryByText('Onboarding')).toBeNull()
  })

  it('affiche le Top 5 clients triés par CA calculé et navigue au clic', () => {
    const stats = {
      ...BASE_STATS,
      renewals: { next30Days: [], next90Days: [] }
    }

    render(<ProductionAnalyticsView stats={stats} etablissements={MOCK_ETABS} healthMetrics={new Map()} />)

    const topTitle = screen.getByText('Top 5 clients par CA')
    const topCard = topTitle.closest('[data-testid="Card"]') as HTMLElement
    const withinTop = within(topCard)

    const orderedNames = withinTop.getAllByText(/^(Alpha|Bravo|Charlie|Delta|Echo|Foxtrot)$/).map(el => el.textContent)
    expect(orderedNames).toEqual(['Delta', 'Bravo', 'Echo', 'Charlie', 'Foxtrot'])
    expect(withinTop.queryByText('Alpha')).toBeNull()

    fireEvent.click(withinTop.getByText('Delta'))
    expect(NAVIGATE).toHaveBeenCalledWith('/etablissements/e4')
    expect(mockCalculateEtablissementValue).toHaveBeenCalled()
  })

  it('affiche les renouvellements avec compteurs et limite à 3 éléments, et navigue au clic', () => {
    const stats = { ...BASE_STATS }

    render(<ProductionAnalyticsView stats={stats} etablissements={MOCK_ETABS} healthMetrics={new Map()} />)

    const renewalsTitle = screen.getByText('Renouvellements à venir')
    const renewalsCard = renewalsTitle.closest('[data-testid="Card"]') as HTMLElement
    const withinRenewals = within(renewalsCard)

    const urgentsHeading = withinRenewals.getByText('Urgents (sous 30 jours) - 4 client(s)')
    const urgentSection = urgentsHeading.parentElement as HTMLElement
    const withinUrgents = within(urgentSection)
    withinUrgents.getByText('Delta')
    withinUrgents.getByText('Bravo')
    withinUrgents.getByText('Alpha')
    expect(withinUrgents.queryByText('Charlie')).toBeNull()

    const next90Heading = withinRenewals.getByText('30-90 jours - 4 client(s)')
    const next90Section = next90Heading.parentElement as HTMLElement
    const withinNext90 = within(next90Section)
    withinNext90.getByText('Echo')
    withinNext90.getByText('Foxtrot')
    withinNext90.getByText('Charlie')
    expect(withinNext90.queryByText('Bravo')).toBeNull()

    fireEvent.click(withinUrgents.getByText('Bravo'))
    expect(NAVIGATE).toHaveBeenCalledWith('/etablissements/e2')
  })

  it('ne rend pas la carte des renouvellements si aucune donnée', () => {
    const stats = {
      ...BASE_STATS,
      renewals: { next30Days: [], next90Days: [] }
    }

    render(<ProductionAnalyticsView stats={stats} etablissements={MOCK_ETABS} healthMetrics={new Map()} />)

    expect(screen.queryByText('Renouvellements à venir')).toBeNull()
  })
})