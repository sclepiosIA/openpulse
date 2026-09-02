import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { ApporteurProspectsTable } from './ApporteurProspectsTable'

const {
  PROSPECTS,
  EMPTY_APPORT_RESULT,
  LOADING_APPORT_RESULT,
  SUCCESS_APPORT_RESULT,
  STATS_RESULT,
  STATS_ERROR_RESULT,
  mockUseApporteurProspects,
  mockUseProspectStats,
  mockDeleteMutate,
  mockUseDeleteEtablissement,
  mockFrom,
  mockSupabaseBuilder,
  state,
} = vi.hoisted(() => {
  type MockEtablissement = {
    id: string
    nom: string
    ville: string
    statut: string
    type: string
    apporteurs_affaires_ids: string[]
  }

  type ApporteurResult = {
    prospects: MockEtablissement[]
    isLoading: boolean
    isError?: boolean
    error?: { message: string } | null
  }

  type ProgressInfo = {
    id: string
    progress: number
    totalTasks: number
    completedTasks: number
    potentialValue: number
  }

  type StatsResult = {
    data:
      | {
          prospectsPipelineProgress: ProgressInfo[]
        }
      | null
      | undefined
    isError?: boolean
    error?: { message: string } | null
  }

  const PROSPECTS: MockEtablissement[] = [
    {
      id: 'p1',
      nom: 'Clinique Nord',
      ville: 'Lille',
      statut: 'prospect',
      type: 'clinique',
      apporteurs_affaires_ids: ['pa-1'],
    },
    {
      id: 'p2',
      nom: 'Centre Sud',
      ville: 'Nice',
      statut: 'prospect',
      type: 'hopital',
      apporteurs_affaires_ids: ['pa-1'],
    },
  ]

  const EMPTY_PROSPECTS: MockEtablissement[] = []

  const EMPTY_APPORT_RESULT: ApporteurResult = {
    prospects: EMPTY_PROSPECTS,
    isLoading: false,
  }

  const LOADING_APPORT_RESULT: ApporteurResult = {
    prospects: EMPTY_PROSPECTS,
    isLoading: true,
  }

  const SUCCESS_APPORT_RESULT: ApporteurResult = {
    prospects: PROSPECTS,
    isLoading: false,
  }

  const STATS_RESULT: StatsResult = {
    data: {
      prospectsPipelineProgress: [
        {
          id: 'p1',
          progress: 75,
          totalTasks: 4,
          completedTasks: 3,
          potentialValue: 12000,
        },
        {
          id: 'p2',
          progress: 25,
          totalTasks: 4,
          completedTasks: 1,
          potentialValue: 5000,
        },
      ],
    },
    isError: false,
    error: null,
  }

  const STATS_ERROR_RESULT: StatsResult = {
    data: null,
    isError: true,
    error: { message: 'x' },
  }

  const state: {
    apporteurResult: ApporteurResult
    statsResult: StatsResult
    lastPartenaireId: string | undefined
  } = {
    apporteurResult: SUCCESS_APPORT_RESULT,
    statsResult: STATS_RESULT,
    lastPartenaireId: undefined,
  }

  const mockUseApporteurProspects = vi.fn((partenaireId?: string) => {
    state.lastPartenaireId = partenaireId
    return state.apporteurResult
  })

  const mockUseProspectStats = vi.fn(() => state.statsResult)
  const mockDeleteMutate = vi.fn()
  const mockUseDeleteEtablissement = vi.fn(() => ({ mutate: mockDeleteMutate }))

  const SUPABASE_DATA = [{ id: 'p1' }]
  const SUPABASE_OK = { data: SUPABASE_DATA, error: null }
  const SUPABASE_SINGLE_OK = { data: SUPABASE_DATA[0], error: null }
  const mockSupabaseBuilder: Record<string, unknown> = {}
  const chain = vi.fn(() => mockSupabaseBuilder)

  const methodNames = [
    'select',
    'eq',
    'neq',
    'gte',
    'lte',
    'gt',
    'lt',
    'in',
    'order',
    'limit',
    'range',
    'match',
    'is',
    'ilike',
    'like',
    'or',
    'filter',
    'contains',
    'containedBy',
    'insert',
    'update',
    'upsert',
    'delete',
  ] as const

  for (const methodName of methodNames) {
    mockSupabaseBuilder[methodName] = chain
  }

  mockSupabaseBuilder.single = vi.fn(() => Promise.resolve(SUPABASE_SINGLE_OK))
  mockSupabaseBuilder.maybeSingle = vi.fn(() => Promise.resolve(SUPABASE_SINGLE_OK))
  mockSupabaseBuilder.then = vi.fn(
    (
      onFulfilled: Parameters<Promise<unknown>['then']>[0],
      onRejected: Parameters<Promise<unknown>['then']>[1]
    ) => Promise.resolve(SUPABASE_OK).then(onFulfilled, onRejected)
  )
  mockSupabaseBuilder.catch = vi.fn((onRejected: Parameters<Promise<unknown>['catch']>[0]) =>
    Promise.resolve(SUPABASE_OK).catch(onRejected)
  )

  const mockFrom = vi.fn(() => mockSupabaseBuilder)

  return {
    PROSPECTS,
    EMPTY_APPORT_RESULT,
    LOADING_APPORT_RESULT,
    SUCCESS_APPORT_RESULT,
    STATS_RESULT,
    STATS_ERROR_RESULT,
    mockUseApporteurProspects,
    mockUseProspectStats,
    mockDeleteMutate,
    mockUseDeleteEtablissement,
    mockFrom,
    mockSupabaseBuilder,
    state,
  }
})

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
    auth: {
      getUser: vi.fn(() =>
        Promise.resolve({ data: { user: { id: 'u1', email: 't@t.co' } }, error: null })
      ),
      getSession: vi.fn(() =>
        Promise.resolve({ data: { session: { user: { id: 'u1', email: 't@t.co' } } }, error: null })
      ),
      onAuthStateChange: vi.fn(() => ({
        data: {
          subscription: {
            unsubscribe: vi.fn(),
          },
        },
      })),
    },
  },
}))

vi.mock('./useApporteurProspects', () => ({
  useApporteurProspects: mockUseApporteurProspects,
}))

vi.mock('@/hooks/crm/useProspects', () => ({
  useProspectStats: mockUseProspectStats,
  useProspects: vi.fn(() => ({ data: PROSPECTS, isLoading: false, isError: false })),
  useAllEtablissements: vi.fn(() => ({ data: PROSPECTS, isLoading: false, isError: false })),
  useCsmDashboardEtablissements: vi.fn(() => ({
    data: PROSPECTS,
    isLoading: false,
    isError: false,
  })),
}))

vi.mock('@/hooks/crm/useEtablissements', () => ({
  useDeleteEtablissement: mockUseDeleteEtablissement,
  etablissementKeys: {
    all: ['etablissements'],
    lists: () => ['etablissements', 'list'],
    detail: (id: string) => ['etablissements', 'detail', id],
  },
}))

vi.mock('@/components/prospects/ProspectsTableView', () => {
  interface MockProspect {
    id: string
    nom?: string
    ville?: string
  }

  interface ProgressInfo {
    progress: number
    totalTasks: number
    completedTasks: number
    potentialValue: number
  }

  interface ProspectsTableViewProps {
    prospects: MockProspect[]
    selectedIds: Set<string>
    onSelect: (id: string) => void
    onSelectAll: (selected: boolean) => void
    getProgressInfo: (prospectId: string) => ProgressInfo
    onEdit: (prospect: MockProspect) => void
    onDelete: (id: string) => void
  }

  return {
    ProspectsTableView: (props: ProspectsTableViewProps) => {
      const first = props.prospects[0]
      const progressInfo = first
        ? props.getProgressInfo(first.id)
        : { progress: 0, totalTasks: 0, completedTasks: 0, potentialValue: 0 }

      return (
        <section data-testid="prospects-table-view">
          <div data-testid="prospects-count">{props.prospects.length}</div>
          <div data-testid="selected-count">{props.selectedIds.size}</div>
          <div data-testid="first-progress">
            {progressInfo.completedTasks} / {progressInfo.totalTasks} ({progressInfo.progress}%)
          </div>
          <div data-testid="first-potential">{progressInfo.potentialValue}</div>
          <ul>
            {props.prospects.map((prospect) => (
              <li key={prospect.id}>
                {prospect.nom ?? prospect.id} - {prospect.ville ?? ''}
              </li>
            ))}
          </ul>
          <button
            type="button"
            data-testid="select-first"
            onClick={() => first && props.onSelect(first.id)}
          >
            sélectionner le premier
          </button>
          <button type="button" data-testid="select-all" onClick={() => props.onSelectAll(true)}>
            tout sélectionner
          </button>
          <button
            type="button"
            data-testid="clear-selection"
            onClick={() => props.onSelectAll(false)}
          >
            vider la sélection
          </button>
          <button
            type="button"
            data-testid="edit-first"
            onClick={() => first && props.onEdit(first)}
          >
            modifier le premier
          </button>
          <button
            type="button"
            data-testid="delete-first"
            onClick={() => first && props.onDelete(first.id)}
          >
            supprimer le premier
          </button>
        </section>
      )
    },
  }
})

vi.mock('@/components/etablissement/EtablissementEditForm', () => {
  interface EtablissementEditFormProps {
    etablissement: {
      id: string
      nom?: string
    }
    open: boolean
    onOpenChange: (open: boolean) => void
  }

  return {
    EtablissementEditForm: ({ etablissement, open, onOpenChange }: EtablissementEditFormProps) => {
      if (!open) return null

      return (
        <section data-testid="edit-form">
          <h2>Modifier {etablissement.nom ?? etablissement.id}</h2>
          <button type="button" data-testid="close-edit-form" onClick={() => onOpenChange(false)}>
            fermer
          </button>
        </section>
      )
    },
  }
})

vi.mock('@/components/layout/CRMEmptyState', () => {
  interface CRMEmptyStateProps {
    title: string
    description: string
    icon: unknown
  }

  return {
    CRMEmptyState: ({ title, description }: CRMEmptyStateProps) => (
      <section data-testid="crm-empty-state">
        <h1>{title}</h1>
        <p>{description}</p>
      </section>
    ),
  }
})

vi.mock('@/components/ui/skeleton', () => ({
  Skeleton: ({ className }: { className?: string }) => (
    <div data-testid="skeleton-row" className={className} />
  ),
}))

vi.mock('lucide-react', () => ({
  Target: () => <svg data-testid="target-icon" />,
}))

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  },
}))

function renderWithProviders(ui: ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  })

  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>)
}

describe('ApporteurProspectsTable', () => {
  beforeEach(() => {
    cleanup()
    state.apporteurResult = SUCCESS_APPORT_RESULT
    state.statsResult = STATS_RESULT
    state.lastPartenaireId = undefined
    mockUseApporteurProspects.mockClear()
    mockUseProspectStats.mockClear()
    mockUseDeleteEtablissement.mockClear()
    mockDeleteMutate.mockClear()
    mockFrom.mockClear()

    const select = mockSupabaseBuilder.select
    if (typeof select === 'function' && 'mockClear' in select) {
      select.mockClear()
    }
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('affiche trois lignes skeleton pendant le chargement', () => {
    state.apporteurResult = LOADING_APPORT_RESULT

    renderWithProviders(<ApporteurProspectsTable partenaireId="pa-1" />)

    expect(screen.getAllByTestId('skeleton-row')).toHaveLength(3)
    expect(screen.queryByTestId('prospects-table-view')).toBeNull()
    expect(mockUseApporteurProspects).toHaveBeenCalledWith('pa-1')
  })

  it('rend les prospects filtrés avec les statistiques métier et gère sélection, édition et suppression', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)

    renderWithProviders(<ApporteurProspectsTable partenaireId="pa-1" />)

    expect(screen.getByTestId('prospects-count').textContent).toBe('2')
    expect(screen.getByText('Clinique Nord - Lille')).toBeTruthy()
    expect(screen.getByText('Centre Sud - Nice')).toBeTruthy()
    expect(screen.getByTestId('first-progress').textContent).toBe('3 / 4 (75%)')
    expect(screen.getByTestId('first-potential').textContent).toBe('12000')
    expect(state.lastPartenaireId).toBe('pa-1')

    await act(async () => {
      fireEvent.click(screen.getByTestId('select-all'))
    })
    expect(screen.getByTestId('selected-count').textContent).toBe('2')

    await act(async () => {
      fireEvent.click(screen.getByTestId('select-first'))
    })
    expect(screen.getByTestId('selected-count').textContent).toBe('1')

    await act(async () => {
      fireEvent.click(screen.getByTestId('clear-selection'))
    })
    expect(screen.getByTestId('selected-count').textContent).toBe('0')

    await act(async () => {
      fireEvent.click(screen.getByTestId('edit-first'))
    })
    expect(screen.getByTestId('edit-form').textContent).toContain('Modifier Clinique Nord')

    await act(async () => {
      fireEvent.click(screen.getByTestId('close-edit-form'))
    })
    expect(screen.queryByTestId('edit-form')).toBeNull()

    await act(async () => {
      fireEvent.click(screen.getByTestId('delete-first'))
    })
    expect(confirmSpy).toHaveBeenCalledWith('Supprimer ce prospect ?')
    expect(mockDeleteMutate).toHaveBeenCalledWith('p1')
  })

  it('affiche l’état vide quand aucun prospect n’est associé à l’apporteur', () => {
    state.apporteurResult = EMPTY_APPORT_RESULT

    renderWithProviders(<ApporteurProspectsTable partenaireId="pa-1" />)

    expect(screen.getByTestId('crm-empty-state').textContent).toContain('Aucun prospect ciblé')
    expect(screen.getByTestId('crm-empty-state').textContent).toContain(
      "Cet apporteur d'affaires n'a pas encore de prospect associé."
    )
    expect(screen.queryByTestId('prospects-table-view')).toBeNull()
  })

  it('utilise une progression par défaut lorsque le chargement des statistiques est en erreur', () => {
    state.statsResult = STATS_ERROR_RESULT

    renderWithProviders(<ApporteurProspectsTable partenaireId="pa-1" />)

    expect(mockUseProspectStats).toHaveBeenCalledTimes(1)
    expect(screen.getByText('Clinique Nord - Lille')).toBeTruthy()
    expect(screen.getByTestId('first-progress').textContent).toBe('0 / 0 (0%)')
    expect(screen.getByTestId('first-potential').textContent).toBe('0')
    expect(screen.queryByText('x')).toBeNull()
  })

  it('ne déclenche pas la mutation de suppression si la confirmation est refusée', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)

    renderWithProviders(<ApporteurProspectsTable partenaireId="pa-1" />)

    await act(async () => {
      fireEvent.click(screen.getByTestId('delete-first'))
    })

    expect(confirmSpy).toHaveBeenCalledWith('Supprimer ce prospect ?')
    expect(mockDeleteMutate).not.toHaveBeenCalled()
  })
})
