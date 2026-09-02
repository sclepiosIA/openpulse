import '@testing-library/jest-dom/vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type {
  ButtonHTMLAttributes,
  ComponentProps,
  HTMLAttributes,
  InputHTMLAttributes,
  LabelHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react'

type MockDefinition = {
  filters?: Array<{ col: string; op: string; value?: string | string[] }>
  group_by?: Array<{ col: string; date_trunc?: string }>
  aggregations?: Array<{ fn: string; col?: string; alias: string }>
}

type MockSavePayload = {
  id?: string
  dataset_id: string
  name: string
  description: string
  definition: MockDefinition
  viz_type: string
}

const {
  DATASETS,
  DATASET_RESULT,
  SAVE_RESULT,
  SAVE_RESPONSE,
  mockMutateAsync,
  mockUseBIDatasets,
  mockUseSaveBIQuestion,
  mockOnOpenChange,
} = vi.hoisted(() => {
  type MockDataset = {
    id: string
    name: string
    columns: Array<{ name: string; label: string; type: string }>
  }

  type MockDatasetResult = {
    data: MockDataset[] | null | undefined
    isLoading: boolean
    isError: boolean
    error: { message: string } | null
  }

  const datasets: MockDataset[] = [
    {
      id: 'sales',
      name: 'Ventes',
      columns: [
        { name: 'amount', label: 'Montant', type: 'number' },
        { name: 'status', label: 'Statut', type: 'text' },
        { name: 'created_at', label: 'Créé le', type: 'date' },
      ],
    },
    {
      id: 'leads',
      name: 'Prospects',
      columns: [
        { name: 'source', label: 'Source', type: 'text' },
        { name: 'score', label: 'Score', type: 'number' },
      ],
    },
  ]

  const datasetResult: MockDatasetResult = {
    data: datasets,
    isLoading: false,
    isError: false,
    error: null,
  }

  const saveResponse = { id: 'saved-question' }
  const mutateAsync = vi.fn<(payload: MockSavePayload) => Promise<{ id: string }>>()

  const saveResult = {
    mutateAsync,
    isPending: false,
  }

  return {
    DATASETS: datasets,
    DATASET_RESULT: datasetResult,
    SAVE_RESULT: saveResult,
    SAVE_RESPONSE: saveResponse,
    mockMutateAsync: mutateAsync,
    mockUseBIDatasets: vi.fn(() => datasetResult),
    mockUseSaveBIQuestion: vi.fn(() => saveResult),
    mockOnOpenChange: vi.fn<(open: boolean) => void>(),
  }
})

vi.mock('@/hooks/bi/useBIStudio', () => ({
  useBIDatasets: mockUseBIDatasets,
  useSaveBIQuestion: mockUseSaveBIQuestion,
}))

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({
    open,
    children,
  }: {
    open: boolean
    onOpenChange?: (open: boolean) => void
    children: ReactNode
  }) => (open ? <div data-testid="dialog-root">{children}</div> : null),
  DialogContent: ({ children, className }: HTMLAttributes<HTMLDivElement>) => (
    <section data-testid="dialog-content" className={className}>
      {children}
    </section>
  ),
  DialogHeader: ({ children }: HTMLAttributes<HTMLDivElement>) => (
    <div data-testid="dialog-header">{children}</div>
  ),
  DialogTitle: ({ children }: HTMLAttributes<HTMLHeadingElement>) => <h2>{children}</h2>,
  DialogFooter: ({ children }: HTMLAttributes<HTMLDivElement>) => <footer>{children}</footer>,
}))

vi.mock('@/components/ui/input', () => ({
  Input: (props: InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
}))

vi.mock('@/components/ui/label', () => ({
  Label: ({ children, ...props }: LabelHTMLAttributes<HTMLLabelElement>) => (
    <label {...props}>{children}</label>
  ),
}))

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    variant: _variant,
    size: _size,
    asChild: _asChild,
    type,
    ...props
  }: ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: string
    size?: string
    asChild?: boolean
  }) => (
    <button type={type ?? 'button'} {...props}>
      {children}
    </button>
  ),
  buttonVariants: () => '',
}))

vi.mock('@/components/ui/select', () => ({
  Select: ({
    value,
    onValueChange,
    disabled,
    children,
  }: SelectHTMLAttributes<HTMLSelectElement> & {
    value?: string
    onValueChange?: (value: string) => void
  }) => (
    <select
      value={value ?? ''}
      disabled={disabled}
      onChange={(event) => onValueChange?.(event.currentTarget.value)}
    >
      {children}
    </select>
  ),
  SelectTrigger: () => null,
  SelectValue: () => null,
  SelectContent: ({ children }: { children: ReactNode }) => <>{children}</>,
  SelectItem: ({ value, children }: { value: string; children: ReactNode }) => (
    <option value={value}>{children}</option>
  ),
}))

vi.mock('@/components/ui/textarea', () => ({
  Textarea: (props: TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea {...props} />,
}))

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children }: HTMLAttributes<HTMLSpanElement>) => <span>{children}</span>,
}))

vi.mock('lucide-react', () => ({
  Plus: ({ className }: { className?: string }) => (
    <svg data-testid="icon-plus" className={className} />
  ),
  Trash2: ({ className }: { className?: string }) => (
    <svg data-testid="icon-trash" className={className} />
  ),
  Loader2: ({ className }: { className?: string }) => (
    <svg data-testid="icon-loader" className={className} />
  ),
}))

import { BIQuestionEditor } from './BIQuestionEditor'

function renderWithProviders(ui: ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  })

  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>)
}

beforeEach(() => {
  DATASET_RESULT.data = DATASETS
  DATASET_RESULT.isLoading = false
  DATASET_RESULT.isError = false
  DATASET_RESULT.error = null
  SAVE_RESULT.isPending = false
  vi.clearAllMocks()
  mockMutateAsync.mockResolvedValue(SAVE_RESPONSE)
})

afterEach(() => {
  cleanup()
})

describe('BIQuestionEditor', () => {
  it('affiche un état chargement sans sections dépendantes du dataset et désactive la sauvegarde', () => {
    DATASET_RESULT.data = undefined
    DATASET_RESULT.isLoading = true

    renderWithProviders(
      <BIQuestionEditor open={true} onOpenChange={mockOnOpenChange} defaultDatasetId="sales" />
    )

    expect(screen.getByRole('heading', { name: 'Nouvelle question BI' })).toBeInTheDocument()
    expect(screen.getByText('Dataset')).toBeInTheDocument()
    expect(screen.getByText('Visualisation')).toBeInTheDocument()

    const selects = screen.getAllByRole('combobox')
    expect(selects).toHaveLength(2)
    expect(within(selects[0]).queryAllByRole('option')).toHaveLength(0)

    expect(screen.queryByText('Filtres')).not.toBeInTheDocument()
    expect(screen.queryByText('Colonnes dispo :')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sauvegarder' })).toBeDisabled()
  })

  it('rend les valeurs métier en succès pour un nouveau questionnaire BI', () => {
    renderWithProviders(
      <BIQuestionEditor open={true} onOpenChange={mockOnOpenChange} defaultDatasetId="sales" />
    )

    expect(screen.getByRole('heading', { name: 'Nouvelle question BI' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Ventes' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Prospects' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Barres' })).toBeInTheDocument()

    expect(screen.getByText('Filtres')).toBeInTheDocument()
    expect(screen.getByText('Aucun filtre.')).toBeInTheDocument()
    expect(screen.getByText('Group by')).toBeInTheDocument()
    expect(screen.getByText('Aucun groupement.')).toBeInTheDocument()
    expect(screen.getByText('Agrégations')).toBeInTheDocument()
    expect(screen.getByText('Aucune agrégation.')).toBeInTheDocument()
    expect(screen.getByText('Colonnes dispo :')).toBeInTheDocument()
    expect(screen.getAllByText('Montant').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Statut').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Créé le').length).toBeGreaterThan(0)
  })

  it('préremplit une question existante et verrouille le dataset en édition', () => {
    const initialQuestion = {
      id: 'question-1',
      dataset_id: 'sales',
      name: 'CA existant',
      description: 'Question déjà créée',
      viz_type: 'line',
      definition: {
        filters: [{ col: 'status', op: '=', value: 'paid' }],
        group_by: [{ col: 'created_at', date_trunc: 'month' }],
        aggregations: [{ fn: 'sum', col: 'amount', alias: 'total_amount' }],
      },
    } satisfies NonNullable<ComponentProps<typeof BIQuestionEditor>['initial']>

    renderWithProviders(
      <BIQuestionEditor open={true} onOpenChange={mockOnOpenChange} initial={initialQuestion} />
    )

    expect(screen.getByRole('heading', { name: 'Modifier la question' })).toBeInTheDocument()
    expect(screen.getByDisplayValue('CA existant')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Question déjà créée')).toBeInTheDocument()
    expect(screen.getByDisplayValue('paid')).toBeInTheDocument()
    expect(screen.getByDisplayValue('total_amount')).toBeInTheDocument()

    const selects = screen.getAllByRole('combobox')
    expect(selects[0]).toBeDisabled()
    expect(selects[0]).toHaveValue('sales')
    expect(selects[1]).toHaveValue('line')
  })

  it('déclenche la mutation de sauvegarde avec les champs saisis puis ferme la fenêtre', async () => {
    renderWithProviders(<BIQuestionEditor open={true} onOpenChange={mockOnOpenChange} />)

    const selects = screen.getAllByRole('combobox')
    fireEvent.change(selects[0], { target: { value: 'sales' } })
    fireEvent.change(selects[1], { target: { value: 'bar' } })

    fireEvent.change(screen.getByPlaceholderText('Ex: Revenus par mois'), {
      target: { value: 'Revenus mensuels' },
    })

    const textboxes = screen.getAllByRole('textbox')
    fireEvent.change(textboxes[1], {
      target: { value: 'CA par mois' },
    })

    const saveButton = screen.getByRole('button', { name: 'Sauvegarder' })

    await waitFor(() => {
      expect(saveButton).toBeEnabled()
    })

    await act(async () => {
      fireEvent.click(saveButton)
    })

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith({
        id: undefined,
        dataset_id: 'sales',
        name: 'Revenus mensuels',
        description: 'CA par mois',
        definition: {},
        viz_type: 'bar',
      })
    })

    expect(mockOnOpenChange).toHaveBeenCalledWith(false)
  })

  it('garde les sections dataset masquées et la sauvegarde désactivée en erreur de chargement', () => {
    DATASET_RESULT.data = null
    DATASET_RESULT.isLoading = false
    DATASET_RESULT.isError = true
    DATASET_RESULT.error = { message: 'x' }

    renderWithProviders(
      <BIQuestionEditor open={true} onOpenChange={mockOnOpenChange} defaultDatasetId="sales" />
    )

    expect(screen.getByRole('heading', { name: 'Nouvelle question BI' })).toBeInTheDocument()
    expect(screen.getByText('Dataset')).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: 'Ventes' })).not.toBeInTheDocument()
    expect(screen.queryByText('Filtres')).not.toBeInTheDocument()
    expect(screen.queryByText('Group by')).not.toBeInTheDocument()
    expect(screen.queryByText('Agrégations')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sauvegarder' })).toBeDisabled()
  })
})
