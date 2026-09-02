/* @vitest-environment jsdom */
import React from 'react'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { CsmKpisView } from './CsmKpisView'

const {
  ETABLISSEMENTS,
  KPIS,
  upsertMock,
  removeMock,
} = vi.hoisted(() => ({
  ETABLISSEMENTS: [
    { id: 'etab-1', nom: 'Clinique Alpha' },
    { id: 'etab-2', nom: 'Hôpital Beta' },
  ],
  KPIS: [
    {
      id: 'kpi-1',
      etablissement_id: 'etab-1',
      periode: 'Trimestre 1',
      sort_order: 0,
      taux_satisfaction: 91,
      dossiers_traites: 120,
      taux_utilisation_formatage: 31,
      taux_utilisation_ocr: 22,
      taux_utilisation_cotations: 13,
      taux_utilisation_courriers: 14,
      taux_utilisation_traduction: 15,
      taux_utilisation_examens: 16,
      taux_utilisation_chatbot: 17,
      taux_uhcd_marque: 18,
      taux_uhcd_compte: 19,
      ccm2_plus: 20,
      ccmu3_plus: 21,
      avis_specialise: 22,
      temps_passage_urgences: 23,
    },
    {
      id: 'kpi-2',
      etablissement_id: 'etab-1',
      periode: 'Évolution T2',
      sort_order: 1,
      taux_satisfaction: 92,
      dossiers_traites: 130,
      taux_utilisation_formatage: 32,
      taux_utilisation_ocr: 23,
      taux_utilisation_cotations: 14,
      taux_utilisation_courriers: 15,
      taux_utilisation_traduction: 16,
      taux_utilisation_examens: 17,
      taux_utilisation_chatbot: 18,
      taux_uhcd_marque: 19,
      taux_uhcd_compte: 20,
      ccm2_plus: 21,
      ccmu3_plus: 22,
      avis_specialise: 23,
      temps_passage_urgences: 24,
    },
    {
      id: 'kpi-3',
      etablissement_id: 'etab-1',
      periode: 'Bilan annuel',
      sort_order: 2,
      taux_satisfaction: 93,
      dossiers_traites: 140,
      taux_utilisation_formatage: 33,
      taux_utilisation_ocr: 24,
      taux_utilisation_cotations: 15,
      taux_utilisation_courriers: 16,
      taux_utilisation_traduction: 17,
      taux_utilisation_examens: 18,
      taux_utilisation_chatbot: 19,
      taux_uhcd_marque: 20,
      taux_uhcd_compte: 21,
      ccm2_plus: 22,
      ccmu3_plus: 23,
      avis_specialise: 24,
      temps_passage_urgences: 25,
    },
    {
      id: 'kpi-4',
      etablissement_id: 'etab-2',
      periode: 'Evolution T1',
      sort_order: 0,
      taux_satisfaction: 80,
      dossiers_traites: 90,
      taux_utilisation_formatage: 10,
      taux_utilisation_ocr: 11,
      taux_utilisation_cotations: 12,
      taux_utilisation_courriers: 13,
      taux_utilisation_traduction: 14,
      taux_utilisation_examens: 15,
      taux_utilisation_chatbot: 16,
      taux_uhcd_marque: 17,
      taux_uhcd_compte: 18,
      ccm2_plus: 19,
      ccmu3_plus: 20,
      avis_specialise: 21,
      temps_passage_urgences: 22,
    },
  ],
  upsertMock: vi.fn(),
  removeMock: vi.fn(),
}))

vi.mock('@/hooks/production/useProduction', () => ({
  useProduction: vi.fn(() => ({ data: ETABLISSEMENTS })),
}))

vi.mock('@/hooks/csm/useCsmKpisTrimestriels', () => ({
  useCsmKpisTrimestriels: vi.fn(() => ({
    data: KPIS,
    upsert: upsertMock,
    remove: removeMock,
  })),
}))

vi.mock('@/components/ui/table', () => ({
  Table: ({ children }: { children: React.ReactNode }) => <table>{children}</table>,
  TableHeader: ({ children }: { children: React.ReactNode }) => <thead>{children}</thead>,
  TableBody: ({ children }: { children: React.ReactNode }) => <tbody>{children}</tbody>,
  TableRow: ({ children, className }: { children: React.ReactNode; className?: string }) => <tr className={className}>{children}</tr>,
  TableHead: ({ children, className }: { children: React.ReactNode; className?: string }) => <th className={className}>{children}</th>,
  TableCell: ({ children, className }: { children: React.ReactNode; className?: string }) => <td className={className}>{children}</td>,
}))

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
    className,
    'aria-label': ariaLabel,
    type,
  }: {
    children: React.ReactNode
    onClick?: () => void
    className?: string
    'aria-label'?: string
    type?: 'button' | 'submit' | 'reset'
  }) => (
    <button type={type ?? 'button'} onClick={onClick} className={className} aria-label={ariaLabel}>
      {children}
    </button>
  ),
}))

vi.mock('@/components/ui/collapsible', () => ({
  Collapsible: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CollapsibleTrigger: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
  CollapsibleContent: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
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
      className={className}
      onClick={() => onSave(value ?? 'saved')}
    >
      {value ?? placeholder}
    </button>
  ),
}))

vi.mock('lucide-react', () => ({
  ChevronDown: () => <svg data-testid="chevron-down" />,
  Plus: () => <svg data-testid="plus-icon" />,
  Trash2: () => <svg data-testid="trash-icon" />,
}))

vi.mock('@/lib/utils', () => ({
  cn: (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(' '),
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

describe('CsmKpisView', () => {
  beforeEach(() => {
    upsertMock.mockClear()
    removeMock.mockClear()
  })

  it('render les établissements, le nombre de périodes, les colonnes et la note sur la dernière évolution', () => {
    const { container } = render(<CsmKpisView />, { wrapper: createWrapper() })

    expect(screen.getByText('Clinique Alpha')).toBeInTheDocument()
    expect(screen.getByText('Hôpital Beta')).toBeInTheDocument()
    expect(screen.getByText('(3 périodes)')).toBeInTheDocument()
    expect(screen.getByText('(1 périodes)')).toBeInTheDocument()

    expect(screen.getAllByText('Satisfaction')).toHaveLength(2)
    expect(screen.getAllByText('Dossiers')).toHaveLength(2)
    expect(screen.getAllByText('OCR/Dictée')).toHaveLength(2)
    expect(screen.getAllByText('Temps passage')).toHaveLength(2)

    expect(screen.getByText('Trimestre 1')).toBeInTheDocument()
    expect(screen.getByText('Évolution T2')).toBeInTheDocument()
    expect(screen.getByText('Bilan annuel')).toBeInTheDocument()
    expect(screen.getByText('Evolution T1')).toBeInTheDocument()

    expect(screen.getAllByText('*si données N-1 disponibles')).toHaveLength(2)

    const rows = container.querySelectorAll('tbody tr')
    expect(rows).toHaveLength(4)
    expect(rows[1]?.className).toContain('bg-pink-50/50')
    expect(rows[2]?.className).toContain('font-semibold')
    expect(rows[3]?.className).toContain('bg-pink-50/50')
  })

  it('ajoute une période avec les bonnes valeurs métier pour chaque établissement', () => {
    render(<CsmKpisView />, { wrapper: createWrapper() })

    const addButtons = screen.getAllByRole('button', { name: /Ajouter une période/i })
    expect(addButtons).toHaveLength(2)

    fireEvent.click(addButtons[0])
    expect(upsertMock).toHaveBeenCalledWith({
      etablissement_id: 'etab-1',
      periode: 'Trimestre 4',
      sort_order: 3,
    })

    fireEvent.click(addButtons[1])
    expect(upsertMock).toHaveBeenCalledWith({
      etablissement_id: 'etab-2',
      periode: 'Trimestre 2',
      sort_order: 1,
    })
  })

  it('supprime un KPI via le bouton Supprimer', () => {
    render(<CsmKpisView />, { wrapper: createWrapper() })

    const deleteButtons = screen.getAllByRole('button', { name: 'Supprimer' })
    expect(deleteButtons).toHaveLength(4)

    fireEvent.click(deleteButtons[2])
    expect(removeMock).toHaveBeenCalledWith('kpi-3')
  })

  it('propage les modifications des cellules éditables vers upsert avec les bonnes données pour la période et les valeurs numériques', () => {
    render(<CsmKpisView />, { wrapper: createWrapper() })

    const trimestreRow = screen.getByText('Trimestre 1').closest('tr')
    expect(trimestreRow).toBeTruthy()
    if (!trimestreRow) return

    const rowQueries = within(trimestreRow)

    fireEvent.click(rowQueries.getByText('Trimestre 1'))
    expect(upsertMock).toHaveBeenCalledWith({
      ...KPIS[0],
      periode: 'Trimestre 1',
    })

    fireEvent.click(rowQueries.getByText('91'))
    expect(upsertMock).toHaveBeenCalledWith({
      ...KPIS[0],
      taux_satisfaction: 91,
    })

    fireEvent.click(rowQueries.getByText('120'))
    expect(upsertMock).toHaveBeenCalledWith({
      ...KPIS[0],
      dossiers_traites: 120,
    })
  })
})