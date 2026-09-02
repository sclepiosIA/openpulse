import { render, screen } from '@testing-library/react'
import { ForecastV2Panel } from './ForecastV2Panel'

const { mockUseForecastV2, SUCCESS_DATA, EMPTY_DATA } = vi.hoisted(() => {
  const SUCCESS_DATA = {
    model_version: 'v2.3-beta',
    computed_at: '2024-06-15T10:30:00Z',
    kpis: {
      pipeline_weighted_v1: 100000,
      pipeline_weighted_v2: 120000,
    },
    top_deals: [
      {
        id: 'd1',
        nom: 'Deal Alpha',
        statut: 'Négociation',
        closing_date: '2024-09-01T00:00:00Z',
        probability_v1: 50,
        probability_v2: 75,
        delta: 25,
        weighted_v1: 50000,
        weighted_v2: 75000,
        factors: [
          { label: 'Engagement email', points: 10 },
          { label: 'Inactivité', points: -5 },
        ],
      },
      {
        id: 'd2',
        nom: 'Deal Beta',
        statut: 'Proposition',
        closing_date: '2024-10-15T00:00:00Z',
        probability_v1: 40,
        probability_v2: 30,
        delta: -10,
        weighted_v1: 20000,
        weighted_v2: 15000,
        factors: [{ label: 'Retard relance', points: -8 }],
      },
    ],
  }
  const EMPTY_DATA = {
    model_version: 'v2.3-beta',
    computed_at: '2024-06-15T10:30:00Z',
    kpis: { pipeline_weighted_v1: 0, pipeline_weighted_v2: 0 },
    top_deals: [],
  }
  return { mockUseForecastV2: vi.fn(), SUCCESS_DATA, EMPTY_DATA }
})

vi.mock('@/hooks/forecasting/useForecastV2', () => ({
  useForecastV2: mockUseForecastV2,
}))

vi.mock('@/lib/formatters', () => ({
  safeNum: (n: unknown) =>
    typeof n === 'number' && Number.isFinite(n) ? n : 0,
}))

vi.mock('@/components/ui/card', () => ({
  Card: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  CardContent: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  CardHeader: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  CardTitle: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  CardDescription: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
}))

vi.mock('@/components/ui/skeleton', () => ({
  Skeleton: () => <div data-testid="skeleton" />,
}))

vi.mock('@/components/ui/popover', () => ({
  Popover: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  PopoverTrigger: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  PopoverContent: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock('@/components/ui/button', () => ({
  Button: ({ children }: { children?: React.ReactNode }) => (
    <button type="button">{children}</button>
  ),
}))

// Intl fr-FR insère des espaces insécables (U+202F / U+00A0) dans les montants.
// Testing Library normalise tout whitespace en espace simple : on fait pareil.
const eurText = (n: number) =>
  new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  })
    .format(n)
    .replace(/\s/g, ' ')

describe('ForecastV2Panel', () => {
  beforeEach(() => {
    mockUseForecastV2.mockReset()
  })

  it('affiche des skeletons pendant le chargement', () => {
    mockUseForecastV2.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    })

    render(<ForecastV2Panel />)

    expect(screen.getAllByTestId('skeleton')).toHaveLength(2)
    expect(screen.queryByText(/Forecast prédictif v2/)).not.toBeInTheDocument()
  })

  it("affiche le message d'erreur quand le hook échoue", () => {
    mockUseForecastV2.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('boom-forecast'),
    })

    render(<ForecastV2Panel />)

    expect(screen.getByText(/Erreur Forecast v2 : boom-forecast/)).toBeInTheDocument()
  })

  it('ne rend rien si pas de data et pas en chargement', () => {
    mockUseForecastV2.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: null,
    })

    const { container } = render(<ForecastV2Panel />)

    expect(container).toBeEmptyDOMElement()
  })

  it('affiche les KPIs, la version du modèle et les deals en cas de succès', () => {
    mockUseForecastV2.mockReturnValue({
      data: SUCCESS_DATA,
      isLoading: false,
      error: null,
    })

    render(<ForecastV2Panel start="2024-01-01" end="2024-12-31" />)

    expect(screen.getByText('Forecast prédictif v2')).toBeInTheDocument()
    expect(screen.getByText('v2.3-beta')).toBeInTheDocument()

    // KPIs comparatifs : v1, v2 et écart (20 000 €)
    expect(screen.getByText('Pondéré v1 (statique)')).toBeInTheDocument()
    expect(screen.getByText('Pondéré v2 (prédictif)')).toBeInTheDocument()
    expect(screen.getByText(eurText(100000))).toBeInTheDocument()
    expect(screen.getByText(eurText(120000))).toBeInTheDocument()
    // 20 000 € apparaît 2 fois : l'écart v2-v1 ET le weighted_v1 de Deal Beta
    expect(screen.getAllByText(eurText(20000))).toHaveLength(2)
    expect(screen.getByText('+20.0%')).toBeInTheDocument()
    expect(screen.getByText('Écart v2 vs v1')).toBeInTheDocument()

    // Deals
    expect(screen.getByText('Deal Alpha')).toBeInTheDocument()
    expect(screen.getByText('Deal Beta')).toBeInTheDocument()
    expect(screen.getByText('50%')).toBeInTheDocument()
    expect(screen.getByText('75%')).toBeInTheDocument()
    expect(screen.getByText('+25')).toBeInTheDocument()
    expect(screen.getByText('-10')).toBeInTheDocument()
    expect(screen.getByText(eurText(75000))).toBeInTheDocument()
    expect(screen.getByText(eurText(15000))).toBeInTheDocument()

    // Facteurs (popover mocké rend le contenu directement)
    expect(screen.getByText('Engagement email')).toBeInTheDocument()
    expect(screen.getByText('+10')).toBeInTheDocument()
    expect(screen.getByText('Inactivité')).toBeInTheDocument()
    expect(screen.getByText('-5')).toBeInTheDocument()
    expect(screen.getByText('Retard relance')).toBeInTheDocument()
    expect(screen.getByText('-8')).toBeInTheDocument()
  })

  it('transmet start/end au hook useForecastV2', () => {
    mockUseForecastV2.mockReturnValue({
      data: SUCCESS_DATA,
      isLoading: false,
      error: null,
    })

    render(<ForecastV2Panel start="2024-01-01" end="2024-03-31" />)

    expect(mockUseForecastV2).toHaveBeenCalledWith('2024-01-01', '2024-03-31')
  })

  it("affiche le message vide quand il n'y a aucun deal", () => {
    mockUseForecastV2.mockReturnValue({
      data: EMPTY_DATA,
      isLoading: false,
      error: null,
    })

    render(<ForecastV2Panel />)

    expect(screen.getByText('Aucun deal dans la période.')).toBeInTheDocument()
    expect(screen.queryByText('Deal Alpha')).not.toBeInTheDocument()
  })
})