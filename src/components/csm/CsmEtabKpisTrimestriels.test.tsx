// @vitest-environment jsdom

import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook } from '@testing-library/react'

const {
  KPIS_ROWS,
  AUTH_STATE,
  mockUseCsmKpisTrimestriels,
  mockUpsert,
  mockRemove,
  mockFrom,
  mockToastSuccess,
  mockToastError,
} = vi.hoisted(() => ({
  KPIS_ROWS: [
    {
      id: 'k1',
      etablissement_id: 'etab-1',
      periode: 'Trimestre 1',
      sort_order: 0,
      taux_satisfaction: 91,
      dossiers_traites: 120,
      taux_utilisation_formatage: 50,
      taux_utilisation_ocr: 45,
      taux_utilisation_cotations: 40,
      taux_utilisation_courriers: 35,
      taux_utilisation_traduction: 30,
      taux_utilisation_examens: 25,
      taux_utilisation_chatbot: 20,
      taux_uhcd_marque: 15,
      taux_uhcd_compte: 10,
      ccm2_plus: 5,
      ccmu3_plus: 3,
      avis_specialise: 12,
      temps_passage_urgences: 84,
    },
    {
      id: 'k2',
      etablissement_id: 'etab-1',
      periode: 'Évolution T2',
      sort_order: 1,
      taux_satisfaction: 92,
      dossiers_traites: 140,
      taux_utilisation_formatage: 52,
      taux_utilisation_ocr: 47,
      taux_utilisation_cotations: 42,
      taux_utilisation_courriers: 37,
      taux_utilisation_traduction: 32,
      taux_utilisation_examens: 27,
      taux_utilisation_chatbot: 22,
      taux_uhcd_marque: 17,
      taux_uhcd_compte: 11,
      ccm2_plus: 6,
      ccmu3_plus: 4,
      avis_specialise: 13,
      temps_passage_urgences: 80,
    },
    {
      id: 'k3',
      etablissement_id: 'etab-1',
      periode: 'Bilan annuel',
      sort_order: 2,
      taux_satisfaction: 93,
      dossiers_traites: 160,
      taux_utilisation_formatage: 54,
      taux_utilisation_ocr: 49,
      taux_utilisation_cotations: 44,
      taux_utilisation_courriers: 39,
      taux_utilisation_traduction: 34,
      taux_utilisation_examens: 29,
      taux_utilisation_chatbot: 24,
      taux_uhcd_marque: 19,
      taux_uhcd_compte: 12,
      ccm2_plus: 7,
      ccmu3_plus: 5,
      avis_specialise: 14,
      temps_passage_urgences: 76,
    },
  ],
  AUTH_STATE: {
    user: { id: 'u1', email: 'test@site.fr' },
    session: { user: { id: 'u1' } },
    isLoading: false,
  },
  mockUseCsmKpisTrimestriels: vi.fn(),
  mockUpsert: vi.fn(),
  mockRemove: vi.fn(),
  mockFrom: vi.fn(),
  mockToastSuccess: vi.fn(),
  mockToastError: vi.fn(),
}))

function createBuilder() {
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    gte: vi.fn(() => builder),
    lte: vi.fn(() => builder),
    in: vi.fn(() => builder),
    order: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    insert: vi.fn(() => builder),
    update: vi.fn(() => builder),
    delete: vi.fn(() => builder),
    upsert: vi.fn(() => builder),
    single: vi.fn(async () => ({ data: null, error: null })),
    maybeSingle: vi.fn(async () => ({ data: null, error: null })),
    then: (onFulfilled: (value: { data: null; error: null }) => unknown) =>
      Promise.resolve({ data: null, error: null }).then(onFulfilled),
    catch: (onRejected: (reason: unknown) => unknown) =>
      Promise.resolve({ data: null, error: null }).catch(onRejected),
  }
  return builder
}

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom.mockImplementation(() => createBuilder()),
  },
}))

vi.mock('sonner', () => ({
  toast: {
    success: mockToastSuccess,
    error: mockToastError,
  },
}))

vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => AUTH_STATE,
}))

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => AUTH_STATE,
}))

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => AUTH_STATE,
}))

vi.mock('@/hooks/csm/useCsmKpisTrimestriels', () => ({
  useCsmKpisTrimestriels: mockUseCsmKpisTrimestriels,
}))

vi.mock('@/components/ui/table', () => {
  const Table = ({ children }: { children: React.ReactNode }) => <table>{children}</table>
  const TableHeader = ({ children }: { children: React.ReactNode }) => <thead>{children}</thead>
  const TableBody = ({ children }: { children: React.ReactNode }) => <tbody>{children}</tbody>
  const TableRow = ({ children, className }: { children: React.ReactNode; className?: string }) => <tr className={className}>{children}</tr>
  const TableHead = ({ children, className }: { children: React.ReactNode; className?: string }) => <th className={className}>{children}</th>
  const TableCell = ({ children, className }: { children: React.ReactNode; className?: string }) => <td className={className}>{children}</td>
  return { Table, TableHeader, TableBody, TableRow, TableHead, TableCell }
})

vi.mock('@/components/ui/card', () => {
  const Card = ({ children }: { children: React.ReactNode }) => <section>{children}</section>
  const CardHeader = ({ children, className }: { children: React.ReactNode; className?: string }) => <div className={className}>{children}</div>
  const CardContent = ({ children }: { children: React.ReactNode }) => <div>{children}</div>
  const CardTitle = ({ children, className }: { children: React.ReactNode; className?: string }) => <h2 className={className}>{children}</h2>
  return { Card, CardHeader, CardContent, CardTitle }
})

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
    ariaLabel,
    ariaLabelledby,
    ariaDescribedby,
    'aria-label': ariaLabelProp,
    className,
  }: {
    children: React.ReactNode
    onClick?: () => void
    ariaLabel?: string
    ariaLabelledby?: string
    ariaDescribedby?: string
    'aria-label'?: string
    className?: string
  }) => (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabelProp ?? ariaLabel}
      aria-labelledby={ariaLabelledby}
      aria-describedby={ariaDescribedby}
      className={className}
    >
      {children}
    </button>
  ),
}))

vi.mock('lucide-react', () => ({
  Plus: () => <svg data-testid="icon-plus" />,
  Trash2: () => <svg data-testid="icon-trash" />,
  LineChart: () => <svg data-testid="icon-linechart" />,
}))

vi.mock('@/components/csm/EditableCell', () => ({
  EditableCell: ({
    value,
    placeholder,
    onSave,
  }: {
    value?: string
    placeholder?: string
    onSave: (value: string) => void
  }) => (
    <button
      type="button"
      data-testid={`editable-${placeholder ?? 'cell'}-${value ?? 'empty'}`}
      onClick={() => onSave(value ?? '')}
    >
      {value ?? placeholder ?? ''}
    </button>
  ),
}))

vi.mock('@/lib/utils', () => ({
  cn: (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(' '),
}))

import { CsmEtabKpisTrimestriels } from './CsmEtabKpisTrimestriels'

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

describe('CsmEtabKpisTrimestriels', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseCsmKpisTrimestriels.mockReturnValue({
      data: KPIS_ROWS,
      upsert: mockUpsert,
      remove: mockRemove,
    })
  })

  it('rend les KPI trimestriels avec les valeurs métier et le compteur de périodes', () => {
    const wrapper = createWrapper()

    const { result } = renderHook(
      () => mockUseCsmKpisTrimestriels('etab-1'),
      { wrapper }
    )

    expect(result.current.data).toHaveLength(3)
    expect(result.current.data[0].taux_satisfaction).toBe(91)
    expect(result.current.data[1].periode).toBe('Évolution T2')
    expect(result.current.data[2].temps_passage_urgences).toBe(76)

    render(<CsmEtabKpisTrimestriels etablissementId="etab-1" />)

    expect(screen.getByText('KPIs trimestriels')).toBeInTheDocument()
    expect(screen.getByText('(3 périodes)')).toBeInTheDocument()
    expect(screen.getByText('Satisfaction')).toBeInTheDocument()
    expect(screen.getByText('OCR/Dictée')).toBeInTheDocument()
    expect(screen.getByText('Temps passage')).toBeInTheDocument()

    expect(screen.getByText('Trimestre 1')).toBeInTheDocument()
    expect(screen.getByText('Évolution T2')).toBeInTheDocument()
    expect(screen.getByText('Bilan annuel')).toBeInTheDocument()

    expect(screen.getByText('91')).toBeInTheDocument()
    expect(screen.getByText('140')).toBeInTheDocument()
    expect(screen.getByText('76')).toBeInTheDocument()
  })

  it('appelle upsert avec les bonnes données lors de l’ajout d’une période', () => {
    render(<CsmEtabKpisTrimestriels etablissementId="etab-1" />)

    fireEvent.click(screen.getByRole('button', { name: /ajouter une période/i }))

    expect(mockUpsert).toHaveBeenCalledTimes(1)
    expect(mockUpsert).toHaveBeenCalledWith({
      etablissement_id: 'etab-1',
      periode: 'Trimestre 4',
      sort_order: 3,
    })
  })

  it('appelle remove avec l’id de la ligne à supprimer', () => {
    render(<CsmEtabKpisTrimestriels etablissementId="etab-1" />)

    const deleteButtons = screen.getAllByRole('button', { name: 'Supprimer' })
    fireEvent.click(deleteButtons[1])

    expect(mockRemove).toHaveBeenCalledTimes(1)
    expect(mockRemove).toHaveBeenCalledWith('k2')
  })

  it('appelle upsert avec les données complètes lors de l’édition d’une cellule période', () => {
    render(<CsmEtabKpisTrimestriels etablissementId="etab-1" />)

    fireEvent.click(screen.getByTestId('editable-Période-Trimestre 1'))

    expect(mockUpsert).toHaveBeenCalledWith({
      ...KPIS_ROWS[0],
      periode: 'Trimestre 1',
    })
  })

  it('gère un état de chargement puis une erreur via le hook mocké', async () => {
    const wrapper = createWrapper()

    const loadingState = {
      data: [],
      upsert: mockUpsert,
      remove: mockRemove,
      isLoading: true,
      isError: false,
      error: null,
    }

    const errorState = {
      data: [],
      upsert: mockUpsert,
      remove: mockRemove,
      isLoading: false,
      isError: true,
      error: { message: 'x' },
    }

    mockUseCsmKpisTrimestriels
      .mockReturnValueOnce(loadingState)
      .mockReturnValueOnce(errorState)

    const { result, rerender } = renderHook(
      () => mockUseCsmKpisTrimestriels('etab-1'),
      { wrapper }
    )

    expect(result.current.isLoading).toBe(true)
    expect(result.current.data).toEqual([])

    rerender()

    expect(result.current.isLoading).toBe(false)
    expect(result.current.isError).toBe(true)
    expect(result.current.error).toEqual({ message: 'x' })
  })
})