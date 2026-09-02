/* @vitest-environment jsdom */
import React from 'react'
import { render, screen, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ProductionCohortsView } from './ProductionCohortsView'

const { VALUE_MAP, mockCalculateEtablissementValue } = vi.hoisted(() => {
  const VALUE_MAP = new Map<string, number>([
    ['recent-1', 1000],
    ['recent-2', 3000],
    ['mid-1', 2000],
    ['mid-2', 4000],
    ['old-1', 5000],
    ['old-2', 1000],
    ['a1', 1200],
    ['a2', 1800],
  ])

  return {
    VALUE_MAP,
    mockCalculateEtablissementValue: vi.fn((etab: { id: string }) => VALUE_MAP.get(etab.id) ?? 0),
  }
})

vi.mock('@/components/ui/card', () => ({
  Card: ({ children }: { children: React.ReactNode }) => <div data-testid="card">{children}</div>,
  CardHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardTitle: ({ children, className }: { children: React.ReactNode; className?: string }) => <div className={className}>{children}</div>,
  CardContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock('@/components/ui/table', () => ({
  Table: ({ children }: { children: React.ReactNode }) => <table>{children}</table>,
  TableHeader: ({ children }: { children: React.ReactNode }) => <thead>{children}</thead>,
  TableBody: ({ children }: { children: React.ReactNode }) => <tbody>{children}</tbody>,
  TableRow: ({ children }: { children: React.ReactNode }) => <tr>{children}</tr>,
  TableHead: ({ children, className }: { children: React.ReactNode; className?: string }) => <th className={className}>{children}</th>,
  TableCell: ({ children, className }: { children: React.ReactNode; className?: string }) => <td className={className}>{children}</td>,
}))

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children, className }: { children: React.ReactNode; className?: string }) => <span className={className}>{children}</span>,
}))

vi.mock('lucide-react', () => ({
  Users: () => <svg data-testid="users-icon" />,
  TrendingUp: () => <svg data-testid="trendingup-icon" />,
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
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
}

describe('ProductionCohortsView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('affiche les cohortes triées, calcule les moyennes métier et les insights', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2025-06-15T12:00:00Z'))

    const etablissements = [
      { id: 'recent-1', date_signature: '2025-04-10' },
      { id: 'recent-2', date_signature: '2025-05-03' },
      { id: 'mid-1', date_signature: '2024-10-05' },
      { id: 'mid-2', date_signature: '2024-11-18' },
      { id: 'old-1', date_signature: '2024-01-10' },
      { id: 'old-2', date_signature: '2024-03-01' },
      { id: 'ignored-no-date' },
    ] as Array<{ id: string; date_signature?: string }>

    const healthScores = new Map([
      ['recent-1', { score: 91, status: 'healthy' }],
      ['recent-2', { score: 70, status: 'healthy' }],
      ['mid-1', { score: 90, status: 'healthy' }],
      ['mid-2', { score: 70, status: 'healthy' }],
      ['old-1', { score: 40, status: 'healthy' }],
      ['old-2', { score: 99, status: 'onboarding' }],
    ])

    const healthMetrics = new Map([
      ['recent-1', { nps_score: 9 }],
      ['recent-2', { nps_score: 8 }],
      ['mid-1', { nps_score: 9 }],
      ['mid-2', { nps_score: 7 }],
      ['old-1', { nps_score: 5 }],
      ['old-2', { nps_score: 0 }],
    ])

    render(
      <ProductionCohortsView
        etablissements={etablissements}
        healthScores={healthScores}
        healthMetrics={healthMetrics}
      />,
      { wrapper: createWrapper() },
    )

    expect(screen.getByText('Analyse par cohortes de lancement')).toBeInTheDocument()
    expect(screen.getByText('Insights cohortes')).toBeInTheDocument()

    const rows = screen.getAllByRole('row')
    expect(rows).toHaveLength(4)

    const recentRow = screen.getByText('2025 Q2').closest('tr')
    const midRow = screen.getByText('2024 Q4').closest('tr')
    const oldRow = screen.getByText('2024 Q1').closest('tr')

    expect(recentRow).not.toBeNull()
    expect(midRow).not.toBeNull()
    expect(oldRow).not.toBeNull()

    const recentCells = within(recentRow as HTMLTableRowElement).getAllByRole('cell')
    expect(recentCells[1]).toHaveTextContent('2')
    expect(recentCells[2]).toHaveTextContent('2 000 €')
    expect(recentCells[3]).toHaveTextContent('Onboarding')
    expect(recentCells[4]).toHaveTextContent('8.5')
    expect(recentCells[5]).toHaveTextContent('Trop tôt')

    const midCells = within(midRow as HTMLTableRowElement).getAllByRole('cell')
    expect(midCells[1]).toHaveTextContent('2')
    expect(midCells[2]).toHaveTextContent('3 000 €')
    expect(midCells[3]).toHaveTextContent('80')
    expect(midCells[4]).toHaveTextContent('8.0')
    expect(midCells[5]).toHaveTextContent('100%')

    const oldCells = within(oldRow as HTMLTableRowElement).getAllByRole('cell')
    expect(oldCells[1]).toHaveTextContent('2')
    expect(oldCells[2]).toHaveTextContent('3 000 €')
    expect(oldCells[3]).toHaveTextContent('40')
    expect(oldCells[4]).toHaveTextContent('2.5')
    expect(oldCells[5]).toHaveTextContent('100%')

    expect(mockCalculateEtablissementValue).toHaveBeenCalledTimes(6)
    expect(mockCalculateEtablissementValue).toHaveBeenCalledWith(expect.objectContaining({ id: 'recent-1' }))
    expect(mockCalculateEtablissementValue).toHaveBeenCalledWith(expect.objectContaining({ id: 'old-2' }))

    expect(screen.getByText('Meilleure cohorte (Health)')).toBeInTheDocument()
    expect(screen.getByText('2024 Q4 - Health score: 80')).toBeInTheDocument()

    expect(screen.getByText('Meilleure cohorte (NPS)')).toBeInTheDocument()
    expect(screen.getByText('2025 Q2 - NPS: 8.5')).toBeInTheDocument()

    expect(screen.getByText('Cohorte la plus récente')).toBeInTheDocument()
    expect(screen.getByText('2025 Q2 - 2 client(s) en onboarding')).toBeInTheDocument()

    vi.useRealTimers()
  })

  it('ignore les établissements sans date et masque health/NPS quand aucune donnée exploitable n’existe', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2025-06-15T12:00:00Z'))

    const etablissements = [
      { id: 'a1', date_signature: '2024-01-15' },
      { id: 'a2', date_signature: '2024-02-20' },
      { id: 'a3' },
    ] as Array<{ id: string; date_signature?: string }>

    const healthScores = new Map([
      ['a1', { score: 50, status: 'onboarding' }],
      ['a2', { score: 0, status: 'onboarding' }],
    ])

    const healthMetrics = new Map([
      ['a1', { nps_score: 0 }],
      ['a2', {}],
    ])

    render(
      <ProductionCohortsView
        etablissements={etablissements}
        healthScores={healthScores}
        healthMetrics={healthMetrics}
      />,
      { wrapper: createWrapper() },
    )

    const row = screen.getByText('2024 Q1').closest('tr')
    expect(row).not.toBeNull()

    const cells = within(row as HTMLTableRowElement).getAllByRole('cell')
    expect(cells[1]).toHaveTextContent('2')
    expect(cells[2]).toHaveTextContent('1 500 €')
    expect(cells[3]).toHaveTextContent('-')
    expect(cells[4]).toHaveTextContent('-')
    expect(cells[5]).toHaveTextContent('100%')

    expect(screen.queryByText('Meilleure cohorte (Health)')).not.toBeInTheDocument()
    expect(screen.queryByText('Meilleure cohorte (NPS)')).not.toBeInTheDocument()
    expect(screen.queryByText('Cohorte la plus récente')).not.toBeInTheDocument()

    vi.useRealTimers()
  })
})