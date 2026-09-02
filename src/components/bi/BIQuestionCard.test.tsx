import '@testing-library/jest-dom/vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { BIQuestionCard } from './BIQuestionCard'
import type { BIQuestion } from '@/hooks/bi/useBIStudio'

const {
  ROWS,
  QUERY_DATA,
  TEST_QUESTION,
  RUN_LOADING,
  RUN_SUCCESS,
  RUN_ERROR,
  EXPLAIN_READY,
  DELETE_READY,
  EXPLANATION,
  mockRefetch,
  mockUseRunBIQuery,
  mockUseExplainBIWithAI,
  mockUseDeleteBIQuestion,
  mockExplainMutateAsync,
  mockDeleteMutate,
  mockToastSuccess,
  mockToastError,
  mockToastInfo,
  mockConfirm,
} = vi.hoisted(() => {
  const ROWS = [
    { month: 'janvier', revenue: 1200 },
    { month: 'février', revenue: 1800 },
  ] as const

  const QUERY_DATA = {
    rows: ROWS,
    row_count: 2,
    duration_ms: 17,
    cached: true,
  } as const

  const mockRefetch = vi.fn()
  const mockUseRunBIQuery = vi.fn()
  const mockUseExplainBIWithAI = vi.fn()
  const mockUseDeleteBIQuestion = vi.fn()
  const mockExplainMutateAsync = vi.fn()
  const mockDeleteMutate = vi.fn()
  const mockToastSuccess = vi.fn()
  const mockToastError = vi.fn()
  const mockToastInfo = vi.fn()
  const mockConfirm = vi.fn<() => boolean>()

  const RUN_LOADING = {
    data: null,
    isLoading: true,
    isError: false,
    error: null,
    refetch: mockRefetch,
    isFetching: true,
  } as const

  const RUN_SUCCESS = {
    data: QUERY_DATA,
    isLoading: false,
    isError: false,
    error: null,
    refetch: mockRefetch,
    isFetching: false,
  } as const

  const RUN_ERROR = {
    data: null,
    isLoading: false,
    isError: true,
    error: { message: 'x' },
    refetch: mockRefetch,
    isFetching: false,
  } as const

  const EXPLAIN_READY = {
    mutateAsync: mockExplainMutateAsync,
    isPending: false,
  } as const

  const DELETE_READY = {
    mutate: mockDeleteMutate,
    isPending: false,
  } as const

  const TEST_QUESTION = {
    id: 'q1',
    dataset_id: 'sales',
    name: 'Ventes par mois',
    description: 'Montant regroupé par mois',
    viz_type: 'bar',
    definition: {
      group_by: [{ col: 'month', alias: 'month' }],
      aggregations: [{ fn: 'sum', col: 'revenue', alias: 'revenue' }],
    },
    created_at: '2024-01-01',
    updated_at: '2024-01-02',
  } as const

  return {
    ROWS,
    QUERY_DATA,
    TEST_QUESTION,
    RUN_LOADING,
    RUN_SUCCESS,
    RUN_ERROR,
    EXPLAIN_READY,
    DELETE_READY,
    EXPLANATION: 'Les ventes progressent.',
    mockRefetch,
    mockUseRunBIQuery,
    mockUseExplainBIWithAI,
    mockUseDeleteBIQuestion,
    mockExplainMutateAsync,
    mockDeleteMutate,
    mockToastSuccess,
    mockToastError,
    mockToastInfo,
    mockConfirm,
  }
})

vi.mock('@/components/ui/card', async () => {
  const React = await import('react')
  type DivProps = import('react').HTMLAttributes<HTMLDivElement> & {
    children?: import('react').ReactNode
  }

  const makeComponent =
    (testId: string) =>
    ({ children, ...props }: DivProps) =>
      React.createElement('div', { ...props, 'data-testid': testId }, children)

  return {
    Card: makeComponent('card'),
    CardHeader: makeComponent('card-header'),
    CardContent: makeComponent('card-content'),
    CardTitle: makeComponent('card-title'),
    CardDescription: makeComponent('card-description'),
    CardFooter: makeComponent('card-footer'),
  }
})

vi.mock('@/components/ui/button', async () => {
  const React = await import('react')
  type ButtonProps = import('react').ButtonHTMLAttributes<HTMLButtonElement> & {
    children?: import('react').ReactNode
    size?: string
    variant?: string
    asChild?: boolean
  }

  const Button = ({
    children,
    size: _size,
    variant: _variant,
    asChild: _asChild,
    ...props
  }: ButtonProps) => React.createElement('button', props, children)

  return {
    Button,
    buttonVariants: vi.fn(() => ''),
  }
})

vi.mock('@/components/ui/badge', async () => {
  const React = await import('react')
  type BadgeProps = import('react').HTMLAttributes<HTMLDivElement> & {
    children?: import('react').ReactNode
    variant?: string
  }

  const Badge = ({ children, variant: _variant, ...props }: BadgeProps) =>
    React.createElement('div', { ...props, 'data-testid': 'badge' }, children)

  return {
    Badge,
    badgeVariants: vi.fn(() => ''),
  }
})

vi.mock('lucide-react', async () => {
  const React = await import('react')
  type SvgProps = import('react').SVGProps<SVGSVGElement>

  const icon = (name: string) => (props: SvgProps) =>
    React.createElement('svg', { ...props, 'data-testid': `icon-${name}` })

  return {
    RefreshCw: icon('RefreshCw'),
    Sparkles: icon('Sparkles'),
    Pencil: icon('Pencil'),
    Trash2: icon('Trash2'),
    Loader2: icon('Loader2'),
  }
})

vi.mock('@/hooks/bi/useBIStudio', () => ({
  useRunBIQuery: mockUseRunBIQuery,
  useExplainBIWithAI: mockUseExplainBIWithAI,
  useDeleteBIQuestion: mockUseDeleteBIQuestion,
}))

vi.mock('./BIViz', async () => {
  const React = await import('react')
  type BIVizMockProps = {
    rows: readonly Record<string, unknown>[]
    viz_type: string
    height?: number
  }

  const BIViz = ({ rows, viz_type, height = 320 }: BIVizMockProps) =>
    React.createElement(
      'div',
      {
        'data-testid': 'bi-viz',
        'data-viz-type': viz_type,
        'data-height': String(height),
      },
      `${rows.length} ligne(s)`
    )

  return { BIViz }
})

vi.mock('sonner', () => ({
  toast: {
    success: mockToastSuccess,
    error: mockToastError,
    info: mockToastInfo,
  },
}))

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  })
}

function renderWithClient(ui: ReactNode) {
  return render(<QueryClientProvider client={createQueryClient()}>{ui}</QueryClientProvider>)
}

const question = TEST_QUESTION as BIQuestion

beforeEach(() => {
  vi.clearAllMocks()
  mockUseRunBIQuery.mockReturnValue(RUN_SUCCESS)
  mockUseExplainBIWithAI.mockReturnValue(EXPLAIN_READY)
  mockUseDeleteBIQuestion.mockReturnValue(DELETE_READY)
  mockExplainMutateAsync.mockResolvedValue(EXPLANATION)
  mockConfirm.mockReturnValue(true)
  vi.stubGlobal('confirm', mockConfirm)
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('BIQuestionCard', () => {
  it('affiche le chargement avec les informations de la question', () => {
    mockUseRunBIQuery.mockReturnValue(RUN_LOADING)

    renderWithClient(<BIQuestionCard question={question} height={280} />)

    expect(mockUseRunBIQuery).toHaveBeenCalledWith('q1')
    expect(screen.getByTestId('card-title')).toHaveTextContent('Ventes par mois')
    expect(screen.getByText('Montant regroupé par mois')).toBeInTheDocument()
    expect(screen.getByTestId('badge')).toHaveTextContent('bar')
    expect(screen.getByText(/Chargement/)).toBeInTheDocument()
    expect(screen.queryByTestId('bi-viz')).not.toBeInTheDocument()
    expect(screen.getByTitle('Analyser avec Jarvis')).toBeDisabled()
  })

  it('affiche le résultat, rafraîchit, édite et lance une analyse IA', async () => {
    const onEdit = vi.fn<(q: BIQuestion) => void>()

    renderWithClient(<BIQuestionCard question={question} onEdit={onEdit} height={280} />)

    expect(screen.getByTestId('card-title')).toHaveTextContent('Ventes par mois')
    expect(screen.getByText('2 lignes · 17ms · cache')).toBeInTheDocument()

    const viz = screen.getByTestId('bi-viz')
    expect(viz).toHaveAttribute('data-viz-type', 'bar')
    expect(viz).toHaveAttribute('data-height', '280')
    expect(viz).toHaveTextContent('2 ligne(s)')

    fireEvent.click(screen.getByTitle('Actualiser'))
    expect(mockRefetch).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByTitle('Éditer'))
    expect(onEdit).toHaveBeenCalledWith(question)

    await act(async () => {
      fireEvent.click(screen.getByTitle('Analyser avec Jarvis'))
      await Promise.resolve()
    })

    expect(mockExplainMutateAsync).toHaveBeenCalledWith({
      question_name: 'Ventes par mois',
      rows: ROWS,
      viz_type: 'bar',
    })
    expect(await screen.findByText('Analyse Jarvis')).toBeInTheDocument()
    expect(screen.getByText('Les ventes progressent.')).toBeInTheDocument()
  })

  it('affiche une erreur et permet de réessayer', () => {
    mockUseRunBIQuery.mockReturnValue(RUN_ERROR)

    renderWithClient(<BIQuestionCard question={question} />)

    expect(screen.getByText('Erreur : x')).toBeInTheDocument()
    expect(screen.queryByTestId('bi-viz')).not.toBeInTheDocument()

    fireEvent.click(screen.getByText('Réessayer'))

    expect(mockRefetch).toHaveBeenCalledTimes(1)
  })

  it('supprime la question après confirmation', async () => {
    renderWithClient(<BIQuestionCard question={question} />)

    await act(async () => {
      fireEvent.click(screen.getByTitle('Supprimer'))
    })

    expect(mockConfirm).toHaveBeenCalledWith('Supprimer la question "Ventes par mois" ?')
    expect(mockDeleteMutate).toHaveBeenCalledWith('q1')
  })

  it('ne supprime pas la question si la confirmation est refusée', async () => {
    mockConfirm.mockReturnValue(false)

    renderWithClient(<BIQuestionCard question={question} />)

    await act(async () => {
      fireEvent.click(screen.getByTitle('Supprimer'))
    })

    expect(mockConfirm).toHaveBeenCalledWith('Supprimer la question "Ventes par mois" ?')
    expect(mockDeleteMutate).not.toHaveBeenCalled()
  })
})
