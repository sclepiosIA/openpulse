import React from 'react'
import { render, screen, fireEvent, act } from '@testing-library/react'

const { mockUseTresoreriePrevisionnel, PREVISIONS_STRESS, PREVISIONS_OK } = vi.hoisted(() => {
  const PREVISIONS_STRESS = [
    {
      moisLabel: 'Jan 25',
      revenusContractualises: 1000,
      revenusPipeline: 0,
      depenses: 5000,
      fluxTresorerie: -4000,
      soldePrevu: -3000,
    },
    {
      moisLabel: 'Fév 25',
      revenusContractualises: 2000,
      revenusPipeline: 1000,
      depenses: 1000,
      fluxTresorerie: 2000,
      soldePrevu: -1000,
    },
  ]
  const PREVISIONS_OK = [
    {
      moisLabel: 'Jan 25',
      revenusContractualises: 100000,
      revenusPipeline: 20000,
      depenses: 30000,
      fluxTresorerie: 90000,
      soldePrevu: 150000,
    },
    {
      moisLabel: 'Fév 25',
      revenusContractualises: 80000,
      revenusPipeline: 10000,
      depenses: 25000,
      fluxTresorerie: 65000,
      soldePrevu: 215000,
    },
  ]
  return {
    mockUseTresoreriePrevisionnel: vi.fn(() => ({
      previsions: PREVISIONS_OK,
      isLoading: false,
    })),
    PREVISIONS_STRESS,
    PREVISIONS_OK,
  }
})

vi.mock('@/hooks/tresorerie/useTresoreriePrevisionnel', () => ({
  useTresoreriePrevisionnel: mockUseTresoreriePrevisionnel,
}))

vi.mock('@/lib/utils', () => ({
  cn: (...classes: Array<string | undefined | false | null>) => classes.filter(Boolean).join(' '),
}))

vi.mock('@/components/ui/card', () => ({
  Card: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  CardContent: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  CardHeader: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  CardTitle: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
}))

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
  }: {
    children?: React.ReactNode
    onClick?: () => void
  }) => (
    <button type="button" onClick={onClick}>
      {children}
    </button>
  ),
}))

vi.mock('@/components/ui/skeleton', () => ({
  Skeleton: () => <div data-testid="skeleton" />,
}))

vi.mock('@/components/ui/tabs', () => ({
  Tabs: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  TabsList: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  TabsTrigger: ({ children }: { children?: React.ReactNode }) => (
    <button type="button">{children}</button>
  ),
}))

vi.mock('@/components/ui/input', () => ({
  Input: ({
    id,
    value,
    onChange,
    placeholder,
  }: {
    id?: string
    value?: string
    onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void
    placeholder?: string
  }) => <input id={id} value={value} onChange={onChange} placeholder={placeholder} />,
}))

vi.mock('@/components/ui/label', () => ({
  Label: ({ children, htmlFor }: { children?: React.ReactNode; htmlFor?: string }) => (
    <label htmlFor={htmlFor}>{children}</label>
  ),
}))

vi.mock('@/components/ui/select', () => ({
  Select: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  SelectContent: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  SelectTrigger: ({ children, id }: { children?: React.ReactNode; id?: string }) => (
    <div id={id}>{children}</div>
  ),
  SelectValue: () => <span />,
}))

vi.mock('lucide-react', () => ({
  TrendingUp: () => null,
  TrendingDown: () => null,
  AlertTriangle: () => null,
  Target: () => null,
  Calculator: () => null,
  BarChart3: () => null,
}))

vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  LineChart: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  Line: () => null,
  XAxis: () => null,
  YAxis: () => null,
  Tooltip: () => null,
  Legend: () => null,
  ReferenceLine: () => null,
}))

import { TresoreriePrevisionnelle } from './TresoreriePrevisionnelle'

describe('TresoreriePrevisionnelle', () => {
  beforeEach(() => {
    mockUseTresoreriePrevisionnel.mockReturnValue({
      previsions: PREVISIONS_OK,
      isLoading: false,
    })
  })

  it('affiche les skeletons pendant le chargement et masque le contenu principal', () => {
    mockUseTresoreriePrevisionnel.mockReturnValue({
      previsions: [],
      isLoading: true,
    })
    render(<TresoreriePrevisionnelle />)
    expect(screen.getAllByTestId('skeleton')).toHaveLength(4)
    expect(screen.queryByText('Horizon :')).toBeNull()
    expect(screen.queryByText("Simulateur d'impact")).toBeNull()
  })

  it('affiche les KPIs des trois scénarios après chargement', () => {
    render(<TresoreriePrevisionnelle />)
    expect(screen.getByText('Horizon :')).toBeTruthy()
    expect(screen.getByText('Pessimiste')).toBeTruthy()
    expect(screen.getByText('Réaliste')).toBeTruthy()
    expect(screen.getByText('Optimiste')).toBeTruthy()
    expect(screen.getByText('50% pipeline, +10% dépenses')).toBeTruthy()
    expect(screen.getByText('70% pipeline, dépenses stables')).toBeTruthy()
    expect(screen.getByText('100% pipeline, -5% dépenses')).toBeTruthy()
    expect(screen.getByText('Projection comparative des scénarios')).toBeTruthy()
    expect(screen.getByText("Simulateur d'impact")).toBeTruthy()
  })

  it("n'affiche pas d'alerte de point de stress avec des prévisions positives", () => {
    render(<TresoreriePrevisionnelle />)
    expect(screen.queryByText('Point de stress détecté en scénario pessimiste')).toBeNull()
  })

  it('affiche une alerte de point de stress quand le scénario pessimiste passe en négatif', () => {
    mockUseTresoreriePrevisionnel.mockReturnValue({
      previsions: PREVISIONS_STRESS,
      isLoading: false,
    })
    render(<TresoreriePrevisionnelle />)
    expect(screen.getByText('Point de stress détecté en scénario pessimiste')).toBeTruthy()
    // Le mois du point de stress est le premier mois (Jan 25), affiché en gras dans l'alerte
    expect(screen.getByText('Jan 25', { selector: 'strong' })).toBeTruthy()
  })

  it('active une simulation après saisie d un montant et clic sur Appliquer', async () => {
    render(<TresoreriePrevisionnelle />)
    const input = screen.getByPlaceholderText('Ex: 50000')
    await act(async () => {
      fireEvent.change(input, { target: { value: '50000' } })
    })
    await act(async () => {
      fireEvent.click(screen.getByText('Appliquer'))
    })
    expect(screen.getByText(/Simulation active/)).toBeTruthy()
    expect(screen.getByText('Réinitialiser')).toBeTruthy()
  })

  it('réinitialise la simulation via le bouton Réinitialiser', async () => {
    render(<TresoreriePrevisionnelle />)
    await act(async () => {
      fireEvent.change(screen.getByPlaceholderText('Ex: 50000'), {
        target: { value: '10000' },
      })
    })
    await act(async () => {
      fireEvent.click(screen.getByText('Appliquer'))
    })
    expect(screen.getByText(/Simulation active/)).toBeTruthy()
    await act(async () => {
      fireEvent.click(screen.getByText('Réinitialiser'))
    })
    expect(screen.queryByText(/Simulation active/)).toBeNull()
  })

  it('ignore la simulation si le montant est invalide', async () => {
    render(<TresoreriePrevisionnelle />)
    await act(async () => {
      fireEvent.click(screen.getByText('Appliquer'))
    })
    expect(screen.queryByText(/Simulation active/)).toBeNull()
  })
})