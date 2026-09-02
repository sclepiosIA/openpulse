/* @vitest-environment jsdom */
import React from 'react'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { CsmUtilisationView } from './CsmUtilisationView'

const {
  ETABS,
  KPIS,
  EMPTY_KPIS,
  useProductionMock,
  useCsmKpisMensuelsMock,
  upsertMock,
  removeMock,
} = vi.hoisted(() => ({
  ETABS: [
    { id: 'e1', nom: 'Clinique Alpha' },
    { id: 'e2', nom: 'Hôpital Beta' },
  ],
  KPIS: [
    {
      id: 'k1',
      etablissement_id: 'e1',
      mois: 'Janvier',
      taux_uhcd_backend: 20,
      taux_uhcd_compte: 10,
      palier_eme: 'P1',
      objectif_eme: 'O1',
      taux_utilisation: 50,
      passages_total: 100,
      dossiers_traites: 80,
      sort_order: 0,
    },
    {
      id: 'k2',
      etablissement_id: 'e1',
      mois: 'Février',
      taux_uhcd_backend: 30,
      taux_uhcd_compte: 20,
      palier_eme: 'P2',
      objectif_eme: 'O2',
      taux_utilisation: 70,
      passages_total: 120,
      dossiers_traites: 90,
      sort_order: 1,
    },
    {
      id: 'k3',
      etablissement_id: 'e2',
      mois: 'Mars',
      taux_uhcd_backend: 10,
      taux_uhcd_compte: 5,
      palier_eme: 'P3',
      objectif_eme: 'O3',
      taux_utilisation: 30,
      passages_total: 60,
      dossiers_traites: 40,
      sort_order: 0,
    },
  ],
  EMPTY_KPIS: [],
  useProductionMock: vi.fn(),
  useCsmKpisMensuelsMock: vi.fn(),
  upsertMock: vi.fn(),
  removeMock: vi.fn(),
}))

vi.mock('@/hooks/production/useProduction', () => ({
  useProduction: useProductionMock,
}))

vi.mock('@/hooks/csm/useCsmKpisMensuels', () => ({
  useCsmKpisMensuels: useCsmKpisMensuelsMock,
}))

vi.mock('@/lib/utils', () => ({
  cn: (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(' '),
}))

vi.mock('@/components/ui/card', () => ({
  Card: ({ children, className }: { children: React.ReactNode; className?: string }) => <div data-testid="card" className={className}>{children}</div>,
  CardContent: ({ children, className }: { children: React.ReactNode; className?: string }) => <div className={className}>{children}</div>,
}))

vi.mock('@/components/ui/table', () => ({
  Table: ({ children }: { children: React.ReactNode }) => <table>{children}</table>,
  TableBody: ({ children }: { children: React.ReactNode }) => <tbody>{children}</tbody>,
  TableCell: ({ children, className }: { children?: React.ReactNode; className?: string }) => <td className={className}>{children}</td>,
  TableHead: ({ children, className }: { children?: React.ReactNode; className?: string }) => <th className={className}>{children}</th>,
  TableHeader: ({ children }: { children: React.ReactNode }) => <thead>{children}</thead>,
  TableRow: ({ children, className }: { children: React.ReactNode; className?: string }) => <tr className={className}>{children}</tr>,
}))

vi.mock('@/components/ui/progress', () => ({
  Progress: ({ value, className }: { value?: number; className?: string }) => (
    <div data-testid="progress" data-value={String(value ?? 0)} className={className} />
  ),
}))

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
    className,
    'aria-label': ariaLabel,
  }: {
    children?: React.ReactNode
    onClick?: () => void
    className?: string
    'aria-label'?: string
  }) => (
    <button type="button" onClick={onClick} className={className} aria-label={ariaLabel}>
      {children}
    </button>
  ),
}))

vi.mock('@/components/ui/collapsible', () => ({
  Collapsible: ({ children }: { children: React.ReactNode }) => <section>{children}</section>,
  CollapsibleTrigger: ({ children, className }: { children: React.ReactNode; className?: string }) => <div className={className}>{children}</div>,
  CollapsibleContent: ({ children, className }: { children: React.ReactNode; className?: string }) => <div className={className}>{children}</div>,
}))

vi.mock('@/components/csm/EditableCell', () => ({
  EditableCell: ({
    value,
    placeholder,
    onSave,
    className,
  }: {
    value?: string
    placeholder?: string
    onSave: (value: string) => void
    className?: string
  }) => (
    <button
      type="button"
      data-testid={`editable-${placeholder ?? 'value'}-${value ?? 'empty'}`}
      className={className}
      onClick={() => onSave('42')}
    >
      {value ?? placeholder ?? ''}
    </button>
  ),
}))

vi.mock('lucide-react', () => {
  const Icon = ({ className }: { className?: string }) => <svg data-testid="icon" className={className} />
  return {
    ChevronDown: Icon,
    Plus: Icon,
    Trash2: Icon,
    BarChart3: Icon,
    Users: Icon,
    TrendingUp: Icon,
    TrendingDown: Icon,
  }
})

describe('CsmUtilisationView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useProductionMock.mockReturnValue({ data: ETABS })
    useCsmKpisMensuelsMock.mockReturnValue({
      data: KPIS,
      upsert: upsertMock,
      remove: removeMock,
    })
  })

  it('affiche les statistiques globales et les moyennes par établissement avec les valeurs métier attendues', () => {
    render(<CsmUtilisationView />)

    expect(screen.getByText('Comptes suivis')).toBeInTheDocument()
    expect(screen.getByText('Avec données')).toBeInTheDocument()
    expect(screen.getByText('Util. > 60%')).toBeInTheDocument()
    expect(screen.getByText('Util. < 40%')).toBeInTheDocument()

    const cards = screen.getAllByTestId('card')
    expect(cards).toHaveLength(4)

    expect(within(cards[0]).getByText('2')).toBeInTheDocument()
    expect(within(cards[1]).getByText('2')).toBeInTheDocument()
    expect(within(cards[2]).getByText('1')).toBeInTheDocument()
    expect(within(cards[3]).getByText('1')).toBeInTheDocument()

    expect(screen.getByText('Clinique Alpha')).toBeInTheDocument()
    expect(screen.getByText('Hôpital Beta')).toBeInTheDocument()
    expect(screen.getByText('Moy. 60%')).toBeInTheDocument()
    expect(screen.getByText('Moy. 30%')).toBeInTheDocument()

    expect(screen.getByText('25.0%')).toBeInTheDocument()
    expect(screen.getByText('15.0%')).toBeInTheDocument()
    expect(screen.getByText('10.0%')).toBeInTheDocument()
    expect(screen.getByText('5.0%')).toBeInTheDocument()

    expect(screen.getByText('+40.0%')).toBeInTheDocument()
    expect(screen.getByText('+50.0%')).toBeInTheDocument()
    expect(screen.getAllByText('-').length).toBeGreaterThanOrEqual(2)

    const progressBars = screen.getAllByTestId('progress')
    const progressValues = progressBars.map((node) => node.getAttribute('data-value'))
    expect(progressValues).toContain('50')
    expect(progressValues).toContain('70')
    expect(progressValues).toContain('30')
    expect(progressValues).toContain('60')
  })

  it('déclenche remove sur le KPI ciblé', () => {
    render(<CsmUtilisationView />)

    const deleteButtons = screen.getAllByRole('button', { name: 'Supprimer' })
    fireEvent.click(deleteButtons[1])

    expect(removeMock).toHaveBeenCalledTimes(1)
    expect(removeMock).toHaveBeenCalledWith('k2')
  })

  it('déclenche upsert lors de l’ajout d’une période avec les valeurs calculées', () => {
    render(<CsmUtilisationView />)

    const addButtons = screen.getAllByRole('button', { name: /Ajouter une période/i })
    fireEvent.click(addButtons[0])

    expect(upsertMock).toHaveBeenCalledWith({
      etablissement_id: 'e1',
      mois: 'Mois 3',
      sort_order: 2,
    })
  })

  it('déclenche upsert lors de l’édition d’une cellule numérique', () => {
    render(<CsmUtilisationView />)

    fireEvent.click(screen.getByTestId('editable-%-50'))

    expect(upsertMock).toHaveBeenCalledWith({
      id: 'k1',
      etablissement_id: 'e1',
      mois: 'Janvier',
      taux_uhcd_backend: 20,
      taux_uhcd_compte: 10,
      palier_eme: 'P1',
      objectif_eme: 'O1',
      taux_utilisation: 42,
      passages_total: 100,
      dossiers_traites: 80,
      sort_order: 0,
    })
  })

  it('rend sans données KPI et calcule des stats à zéro pour les données manquantes', () => {
    useCsmKpisMensuelsMock.mockReturnValue({
      data: EMPTY_KPIS,
      upsert: upsertMock,
      remove: removeMock,
    })

    render(<CsmUtilisationView />)

    const cards = screen.getAllByTestId('card')
    expect(within(cards[0]).getByText('2')).toBeInTheDocument()
    expect(within(cards[1]).getByText('0')).toBeInTheDocument()
    expect(within(cards[2]).getByText('0')).toBeInTheDocument()
    expect(within(cards[3]).getByText('0')).toBeInTheDocument()

    expect(screen.getByText('Clinique Alpha')).toBeInTheDocument()
    expect(screen.getByText('Hôpital Beta')).toBeInTheDocument()
    expect(screen.getAllByText('Moy. 0%')).toHaveLength(2)
    expect(screen.queryByText('Moyenne')).not.toBeInTheDocument()
  })
})