// @vitest-environment jsdom
import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import BIStudio from './BIStudio'

const {
  DATASETS,
  DASHBOARDS,
  QUESTIONS,
  FILTERED_DS_QUESTIONS,
  DATASETS_RESULT,
  DASHBOARDS_RESULT,
  QUESTIONS_RESULT,
  QUESTIONS_FILTERED_RESULT,
  QUESTIONS_LOADING_RESULT,
  QUESTIONS_ERROR_RESULT,
  DATASETS_LOADING_RESULT,
  DATASETS_ERROR_RESULT,
  REFETCH_DS,
  REFETCH_Q,
  pageTitleMock,
  useBIDatasetsMock,
  useBIDashboardsMock,
  useBIQuestionsMock,
  editorPropsSpy,
} = vi.hoisted(() => {
  const datasets = [
    {
      id: 'ds-sales',
      name: 'Ventes',
      description: 'Données de ventes',
      source_view: 'vw_sales',
      columns: [
        { name: 'date', label: 'Date' },
        { name: 'amount', label: 'Montant' },
        { name: 'region', label: 'Région' },
      ],
    },
    {
      id: 'ds-users',
      name: 'Utilisateurs',
      description: 'Base clients',
      source_view: 'vw_users',
      columns: [
        { name: 'id', label: 'ID' },
        { name: 'email', label: 'Email' },
      ],
    },
  ]

  const dashboards = [
    {
      id: 'db-1',
      name: 'Dashboard Sales',
      description: 'Suivi commercial',
      allowed_roles: ['admin', 'manager'],
      layout: [{ id: 'w1' }, { id: 'w2' }],
    },
  ]

  const questions = [
    {
      id: 'q-1',
      name: 'Revenue mensuel',
      description: 'Analyse des ventes mensuelles',
      tags: ['sales', 'monthly'],
      viz_type: 'line',
      is_shared: true,
    },
    {
      id: 'q-2',
      name: 'Top régions',
      description: 'Performance par région',
      tags: ['geo'],
      viz_type: 'bar',
      is_shared: false,
    },
    {
      id: 'q-3',
      name: 'KPI conversion',
      description: 'Vue synthétique',
      tags: [],
      viz_type: 'kpi',
      is_shared: true,
    },
  ]

  const filteredDsQuestions = [questions[0]]

  const refetchDs = vi.fn()
  const refetchQ = vi.fn()

  return {
    DATASETS: datasets,
    DASHBOARDS: dashboards,
    QUESTIONS: questions,
    FILTERED_DS_QUESTIONS: filteredDsQuestions,
    DATASETS_RESULT: {
      data: datasets,
      isLoading: false,
      isError: false,
      refetch: refetchDs,
    },
    DASHBOARDS_RESULT: {
      data: dashboards,
    },
    QUESTIONS_RESULT: {
      data: questions,
      isLoading: false,
      isError: false,
      refetch: refetchQ,
    },
    QUESTIONS_FILTERED_RESULT: {
      data: filteredDsQuestions,
      isLoading: false,
      isError: false,
      refetch: refetchQ,
    },
    QUESTIONS_LOADING_RESULT: {
      data: questions,
      isLoading: true,
      isError: false,
      refetch: refetchQ,
    },
    QUESTIONS_ERROR_RESULT: {
      data: null,
      isLoading: false,
      isError: true,
      refetch: refetchQ,
    },
    DATASETS_LOADING_RESULT: {
      data: datasets,
      isLoading: true,
      isError: false,
      refetch: refetchDs,
    },
    DATASETS_ERROR_RESULT: {
      data: null,
      isLoading: false,
      isError: true,
      refetch: refetchDs,
    },
    REFETCH_DS: refetchDs,
    REFETCH_Q: refetchQ,
    pageTitleMock: vi.fn(),
    useBIDatasetsMock: vi.fn(),
    useBIDashboardsMock: vi.fn(),
    useBIQuestionsMock: vi.fn(),
    editorPropsSpy: vi.fn(),
  }
})

vi.mock('@/components/ui/card', () => ({
  Card: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  CardContent: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  CardHeader: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  CardTitle: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
    disabled,
    className,
  }: {
    children?: React.ReactNode
    onClick?: React.MouseEventHandler<HTMLButtonElement>
    disabled?: boolean
    className?: string
  }) => (
    <button type="button" onClick={onClick} disabled={disabled} className={className}>
      {children}
    </button>
  ),
}))

vi.mock('@/components/ui/input', () => ({
  Input: ({
    value,
    onChange,
    placeholder,
    className,
  }: {
    value?: string
    onChange?: React.ChangeEventHandler<HTMLInputElement>
    placeholder?: string
    className?: string
  }) => <input value={value} onChange={onChange} placeholder={placeholder} className={className} />,
}))

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
}))

vi.mock('@/components/ui/select', () => {
  const SelectContext = React.createContext<{
    value: string
    onValueChange?: (value: string) => void
  } | null>(null)

  return {
    Select: ({
      children,
      value,
      onValueChange,
    }: {
      children?: React.ReactNode
      value: string
      onValueChange?: (value: string) => void
    }) => (
      <SelectContext.Provider value={{ value, onValueChange }}>
        <div>{children}</div>
      </SelectContext.Provider>
    ),
    SelectTrigger: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
    SelectValue: () => <span />,
    SelectContent: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
    SelectItem: ({ children, value }: { children?: React.ReactNode; value: string }) => {
      const ctx = React.useContext(SelectContext)
      return (
        <button type="button" onClick={() => ctx?.onValueChange?.(value)}>
          {children}
        </button>
      )
    },
  }
})

vi.mock('@/components/ui/tabs', () => {
  const TabsContext = React.createContext<{
    value: string
    setValue: (value: string) => void
  } | null>(null)

  return {
    Tabs: ({
      children,
      defaultValue,
    }: {
      children?: React.ReactNode
      defaultValue: string
      className?: string
    }) => {
      const [value, setValue] = React.useState(defaultValue)
      return (
        <TabsContext.Provider value={{ value, setValue }}>
          <div>{children}</div>
        </TabsContext.Provider>
      )
    },
    TabsList: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
    TabsTrigger: ({
      children,
      value,
    }: {
      children?: React.ReactNode
      value: string
      className?: string
    }) => {
      const ctx = React.useContext(TabsContext)
      return (
        <button
          type="button"
          onClick={() => ctx?.setValue(value)}
          aria-selected={ctx?.value === value}
        >
          {children}
        </button>
      )
    },
    TabsContent: ({
      children,
      value,
    }: {
      children?: React.ReactNode
      value: string
      className?: string
    }) => {
      const ctx = React.useContext(TabsContext)
      if (ctx?.value !== value) return null
      return <div>{children}</div>
    },
  }
})

vi.mock('lucide-react', () => {
  const Icon = () => <svg aria-hidden="true" />
  return {
    Sparkles: Icon,
    Plus: Icon,
    Database: Icon,
    LayoutDashboard: Icon,
    Search: Icon,
    BarChart3: Icon,
    Users: Icon,
  }
})

vi.mock('@/components/common/PageDataState', () => ({
  PageDataState: ({
    children,
    isLoading,
    isError,
    isEmpty,
    emptyTitle,
  }: {
    children?: React.ReactNode
    isLoading?: boolean
    isError?: boolean
    isEmpty?: boolean
    emptyTitle?: string
  }) => {
    if (isLoading) return <div data-testid="page-loading">loading</div>
    if (isError) return <div data-testid="page-error">error</div>
    if (isEmpty) return <div data-testid="page-empty">{emptyTitle}</div>
    return <div>{children}</div>
  },
}))

vi.mock('@/hooks/shared/usePageTitle', () => ({
  usePageTitle: pageTitleMock,
}))

vi.mock('@/hooks/bi/useBIStudio', () => ({
  useBIDatasets: useBIDatasetsMock,
  useBIDashboards: useBIDashboardsMock,
  useBIQuestions: useBIQuestionsMock,
}))

vi.mock('@/components/bi/BIQuestionCard', () => ({
  BIQuestionCard: ({
    question,
    onEdit,
  }: {
    question: { id: string; name: string }
    onEdit: (q: { id: string; name: string }) => void
  }) => (
    <div data-testid={`question-card-${question.id}`}>
      <span>{question.name}</span>
      <button type="button" onClick={() => onEdit(question)}>
        Edit {question.name}
      </button>
    </div>
  ),
}))

vi.mock('@/components/bi/BIQuestionEditor', () => ({
  BIQuestionEditor: (props: {
    open: boolean
    onOpenChange: (open: boolean) => void
    initial: unknown
    defaultDatasetId?: string
  }) => {
    editorPropsSpy(props)
    return (
      <div data-testid="question-editor">
        {props.open ? 'open' : 'closed'}|{props.defaultDatasetId ?? 'none'}|
        {props.initial && typeof props.initial === 'object' && 'id' in props.initial
          ? String((props.initial as { id: string }).id)
          : 'new'}
      </div>
    )
  },
}))

describe('BIStudio', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useBIDatasetsMock.mockReturnValue(DATASETS_RESULT)
    useBIDashboardsMock.mockReturnValue(DASHBOARDS_RESULT)
    useBIQuestionsMock.mockImplementation((datasetId?: string) =>
      datasetId === 'ds-sales' ? QUESTIONS_FILTERED_RESULT : QUESTIONS_RESULT
    )
  })

  it('affiche les KPI, filtre par recherche et ouvre un nouvel éditeur', () => {
    render(<BIStudio />)

    expect(pageTitleMock).toHaveBeenCalledWith('BI Studio')
    expect(screen.getByText('Exploration & analyses')).toBeInTheDocument()
    expect(screen.getByText('2 partagées')).toBeInTheDocument()
    expect(screen.getByText('sources actives')).toBeInTheDocument()
    expect(screen.getByText('tableaux de bord')).toBeInTheDocument()
    expect(screen.getByText('questions taguées')).toBeInTheDocument()
    expect(screen.getByText('3 / 3 questions')).toBeInTheDocument()

    expect(screen.getByTestId('question-card-q-1')).toBeInTheDocument()
    expect(screen.getByTestId('question-card-q-2')).toBeInTheDocument()
    expect(screen.getByTestId('question-card-q-3')).toBeInTheDocument()

    fireEvent.change(screen.getByPlaceholderText('Rechercher (nom, description, tag)…'), {
      target: { value: 'sales' },
    })

    expect(screen.getByTestId('question-card-q-1')).toBeInTheDocument()
    expect(screen.queryByTestId('question-card-q-2')).not.toBeInTheDocument()
    expect(screen.queryByTestId('question-card-q-3')).not.toBeInTheDocument()
    expect(screen.getByText('1 / 3 questions')).toBeInTheDocument()

    fireEvent.click(screen.getAllByRole('button', { name: /nouvelle question/i })[0])
    expect(screen.getByTestId('question-editor')).toHaveTextContent('open|none|new')
  })

  it('applique le filtre dataset, ouvre l’édition et affiche les dashboards puis datasets', () => {
    render(<BIStudio />)

    fireEvent.click(screen.getAllByRole('button', { name: 'Ventes' })[0])

    expect(useBIQuestionsMock).toHaveBeenLastCalledWith('ds-sales')
    expect(screen.getByTestId('question-card-q-1')).toBeInTheDocument()
    expect(screen.queryByTestId('question-card-q-2')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Edit Revenue mensuel' }))
    expect(screen.getByTestId('question-editor')).toHaveTextContent('open|ds-sales|q-1')

    fireEvent.click(screen.getByRole('button', { name: /dashboards/i }))
    expect(screen.getByText('Dashboard Sales')).toBeInTheDocument()
    expect(screen.getByText('Suivi commercial')).toBeInTheDocument()
    expect(screen.getByText('2 widgets')).toBeInTheDocument()
    expect(screen.getByText('admin')).toBeInTheDocument()
    expect(screen.getByText('manager')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Datasets' }))
    expect(screen.getByText('Ventes')).toBeInTheDocument()
    expect(screen.getByText('Utilisateurs')).toBeInTheDocument()
    expect(screen.getByText('vw_sales')).toBeInTheDocument()
    expect(screen.getByText('Date')).toBeInTheDocument()
    expect(screen.getByText('Montant')).toBeInTheDocument()
  })

  it('affiche les états de chargement puis erreur', () => {
    useBIDatasetsMock.mockReturnValueOnce(DATASETS_LOADING_RESULT)

    const { rerender } = render(<BIStudio />)
    expect(screen.getByTestId('page-loading')).toBeInTheDocument()

    useBIDatasetsMock.mockReturnValue(DATASETS_ERROR_RESULT)
    useBIDashboardsMock.mockReturnValue(DASHBOARDS_RESULT)
    useBIQuestionsMock.mockReturnValue(QUESTIONS_ERROR_RESULT)

    rerender(<BIStudio />)
    expect(screen.getByTestId('page-error')).toBeInTheDocument()
  })

  it('affiche un état vide des questions quand les filtres ne trouvent rien', () => {
    render(<BIStudio />)

    fireEvent.change(screen.getByPlaceholderText('Rechercher (nom, description, tag)…'), {
      target: { value: 'introuvable' },
    })

    expect(screen.getByTestId('page-empty')).toHaveTextContent('Aucune question')
    expect(screen.queryByTestId('question-card-q-1')).not.toBeInTheDocument()
  })
})
