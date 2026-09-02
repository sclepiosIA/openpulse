/* @vitest-environment jsdom */
import React from 'react'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { TodoPage } from './TodoPage'

const {
  FIXED_NOW,
  TODOS,
  useUnifiedTodosMock,
  useIsMobileMock,
  setSearchParamsMock,
  todoSidebarPropsSpy,
  todoListPropsSpy,
  quickAddPropsSpy,
  detailPanelPropsSpy,
  createModalPropsSpy,
  mobileHeaderPropsSpy,
  immersiveHeaderPropsSpy,
  buttonPropsSpy,
} = vi.hoisted(() => {
  const fixedNow = new Date('2024-01-15T10:00:00.000Z')
  const todayIso = new Date('2024-01-15T12:00:00.000Z').toISOString()
  const overdueIso = new Date('2024-01-14T12:00:00.000Z').toISOString()
  const futureIso = new Date('2024-01-17T12:00:00.000Z').toISOString()

  return {
    FIXED_NOW: fixedNow,
    TODOS: [
      { id: 't-overdue', title: 'Overdue task', is_done: false, due_date: overdueIso },
      { id: 't-today', title: 'Today task', is_done: false, due_date: todayIso },
      { id: 't-done', title: 'Done task', is_done: true, due_date: futureIso },
    ],
    useUnifiedTodosMock: vi.fn(),
    useIsMobileMock: vi.fn(),
    setSearchParamsMock: vi.fn(),
    todoSidebarPropsSpy: vi.fn(),
    todoListPropsSpy: vi.fn(),
    quickAddPropsSpy: vi.fn(),
    detailPanelPropsSpy: vi.fn(),
    createModalPropsSpy: vi.fn(),
    mobileHeaderPropsSpy: vi.fn(),
    immersiveHeaderPropsSpy: vi.fn(),
    buttonPropsSpy: vi.fn(),
  }
})

let currentSearchParams = new URLSearchParams()
let activeQueryClient: QueryClient | undefined

vi.mock('@/integrations/supabase/client', () => {
  const createBuilder = () => {
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

  return {
    supabase: {
      from: vi.fn(() => createBuilder()),
    },
  }
})

vi.mock('react-router-dom', () => ({
  useSearchParams: () => [currentSearchParams, setSearchParamsMock] as const,
}))

vi.mock('@/hooks/ui/use-mobile', () => ({
  useIsMobile: useIsMobileMock,
}))

vi.mock('@/hooks/tasks/useUnifiedTodos', () => ({
  useUnifiedTodos: useUnifiedTodosMock,
}))

vi.mock('./TodoSidebar', () => ({
  TodoSidebar: (props: {
    selectedFilter: string
    selectedProjectId: string | null
    selectedEtablissementId: string | null
    onSelectFilter: (value: 'all' | 'today' | 'overdue' | 'upcoming') => void
    onSelectProject: (value: string) => void
    onSelectEtablissement: (value: string) => void
    showDone: boolean
    onShowDoneChange: (value: boolean) => void
  }) => {
    todoSidebarPropsSpy(props)

    return (
      <div data-testid="todo-sidebar">
        <button onClick={() => props.onSelectFilter('today')}>filter-today</button>
        <button onClick={() => props.onSelectProject('project-1')}>project-1</button>
        <button onClick={() => props.onSelectEtablissement('eta-1')}>eta-1</button>
        <button onClick={() => props.onShowDoneChange(true)}>show-done</button>
        <span data-testid="sidebar-filter">{props.selectedFilter}</span>
        <span data-testid="sidebar-show-done">{String(props.showDone)}</span>
      </div>
    )
  },
}))

vi.mock('./TodoList', () => ({
  TodoList: (props: {
    filter: string
    projectId?: string
    etablissementId?: string
    showDone: boolean
    search: string
    onSelectTodo: (todo: (typeof TODOS)[number]) => void
    selectedTodoId?: string
  }) => {
    todoListPropsSpy(props)

    return (
      <div data-testid="todo-list">
        <div data-testid="list-filter">{props.filter}</div>
        <div data-testid="list-project">{props.projectId ?? ''}</div>
        <div data-testid="list-etablissement">{props.etablissementId ?? ''}</div>
        <div data-testid="list-show-done">{String(props.showDone)}</div>
        <div data-testid="list-selected-id">{props.selectedTodoId ?? ''}</div>
        <button onClick={() => props.onSelectTodo(TODOS[1])}>select-today-task</button>
      </div>
    )
  },
}))

vi.mock('./TodoQuickAdd', () => ({
  TodoQuickAdd: (props: { projectId: string | null; etablissementId: string | null }) => {
    quickAddPropsSpy(props)

    return (
      <div data-testid="todo-quick-add">
        {props.projectId ?? 'no-project'}|{props.etablissementId ?? 'no-etablissement'}
      </div>
    )
  },
}))

vi.mock('./TodoDetailPanel', () => ({
  TodoDetailPanel: (props: { todo: (typeof TODOS)[number]; onClose: () => void }) => {
    detailPanelPropsSpy(props)

    return (
      <div data-testid="todo-detail-panel">
        <span>{props.todo.title}</span>
        <button onClick={props.onClose}>close-detail</button>
      </div>
    )
  },
}))

vi.mock('./modals/CreateTodoModal', () => ({
  CreateTodoModal: (props: {
    open: boolean
    onOpenChange: (open: boolean) => void
    defaultProjectId: string | null
    defaultEtablissementId: string | null
  }) => {
    createModalPropsSpy(props)

    return (
      <div data-testid="create-todo-modal">
        <span data-testid="create-open">{String(props.open)}</span>
        <span data-testid="create-project">{props.defaultProjectId ?? ''}</span>
        <span data-testid="create-etablissement">{props.defaultEtablissementId ?? ''}</span>
      </div>
    )
  },
}))

vi.mock('./TodoMobileHeader', () => ({
  TodoMobileHeader: (props: {
    stats: { total: number; overdue: number; today: number }
    onOpenFilters: () => void
    onCreateTask: () => void
    onSearchClick: () => void
    showGlobalNav: boolean
  }) => {
    mobileHeaderPropsSpy(props)

    return (
      <div data-testid="todo-mobile-header">
        <span data-testid="mobile-total">{String(props.stats.total)}</span>
        <span data-testid="mobile-overdue">{String(props.stats.overdue)}</span>
        <span data-testid="mobile-today">{String(props.stats.today)}</span>
        <span data-testid="mobile-global-nav">{String(props.showGlobalNav)}</span>
        <button onClick={props.onOpenFilters}>open-filters</button>
        <button onClick={props.onCreateTask}>mobile-create</button>
        <button onClick={props.onSearchClick}>mobile-search</button>
      </div>
    )
  },
}))

vi.mock('@/components/ui/button', () => ({
  Button: (props: { onClick: () => void; children: React.ReactNode; className?: string }) => {
    buttonPropsSpy(props)

    return (
      <button data-testid="header-add-button" onClick={props.onClick}>
        {props.children}
      </button>
    )
  },
}))

vi.mock('@/components/ui/sheet', () => ({
  Sheet: (props: {
    open: boolean
    onOpenChange?: (open: boolean) => void
    children: React.ReactNode
  }) => (
    <div data-testid="sheet" data-open={String(props.open)}>
      {props.children}
    </div>
  ),
  SheetContent: (props: { children: React.ReactNode; side?: string; className?: string }) => (
    <div data-testid={`sheet-content-${props.side ?? 'default'}`}>{props.children}</div>
  ),
}))

vi.mock('lucide-react', () => ({
  Plus: () => <svg data-testid="icon-plus" />,
  CheckSquare: () => <svg data-testid="icon-check-square" />,
}))

vi.mock('@/components/layout/ImmersivePageHeader', () => ({
  ImmersivePageHeader: (props: {
    title: string
    subtitle: string
    icon: React.ComponentType
    stats: Array<{ label: string; value: number; highlight?: boolean }>
    searchPlaceholder: string
    onSearchClick: () => void
    actions: React.ReactNode
    variant: string
  }) => {
    immersiveHeaderPropsSpy(props)

    return (
      <div data-testid="immersive-header">
        <span>{props.title}</span>
        <span>{props.subtitle}</span>
        <span data-testid="stat-total">{String(props.stats[0]?.value)}</span>
        <span data-testid="stat-overdue">{String(props.stats[1]?.value)}</span>
        <span data-testid="stat-today">{String(props.stats[2]?.value)}</span>
        <button onClick={props.onSearchClick}>desktop-search</button>
        <div>{props.actions}</div>
      </div>
    )
  },
}))

function createWrapper() {
  activeQueryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity, staleTime: Infinity },
      mutations: { retry: false },
    },
  })

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={activeQueryClient as QueryClient}>
        {children}
      </QueryClientProvider>
    )
  }
}

describe.sequential('TodoPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(FIXED_NOW)

    currentSearchParams = new URLSearchParams()

    useUnifiedTodosMock.mockImplementation(
      ({ filter, showDone }: { filter?: string; showDone?: boolean }) => {
        if (filter === 'all' && showDone === true) {
          return { data: TODOS }
        }

        return { data: TODOS }
      }
    )

    useIsMobileMock.mockReturnValue(false)
  })

  afterEach(() => {
    cleanup()
    activeQueryClient?.clear()
    activeQueryClient = undefined

    vi.restoreAllMocks()
    vi.clearAllTimers()
    vi.useRealTimers()
    vi.unstubAllGlobals?.()
    vi.unstubAllEnvs?.()

    currentSearchParams = new URLSearchParams()
  })

  it('affiche le header desktop avec les stats calculées et ouvre le modal de création', async () => {
    render(<TodoPage />, { wrapper: createWrapper() })

    await waitFor(() => {
      expect(screen.getByTestId('immersive-header')).toBeInTheDocument()
      expect(screen.getByTestId('stat-total')).toHaveTextContent('3')
      expect(screen.getByTestId('stat-overdue')).toHaveTextContent('1')
      expect(screen.getByTestId('stat-today')).toHaveTextContent('1')
    })

    expect(screen.getByTestId('todo-quick-add')).toBeInTheDocument()
    expect(screen.queryByTestId('todo-mobile-header')).not.toBeInTheDocument()

    fireEvent.click(screen.getByTestId('header-add-button'))

    await waitFor(() => {
      expect(screen.getByTestId('create-open')).toHaveTextContent('true')
    })
  })

  it('sélectionne une tâche depuis l’URL puis nettoie le paramètre task', async () => {
    currentSearchParams = new URLSearchParams('task=t-today')

    render(<TodoPage />, { wrapper: createWrapper() })

    await waitFor(() => {
      expect(screen.getByTestId('todo-detail-panel')).toBeInTheDocument()
      expect(screen.getByText('Today task')).toBeInTheDocument()
      expect(setSearchParamsMock).toHaveBeenCalledTimes(1)
    })

    const firstCall = setSearchParamsMock.mock.calls[0]
    const paramsArg = firstCall[0] as URLSearchParams
    const optionsArg = firstCall[1] as { replace: boolean }

    expect(paramsArg.get('task')).toBeNull()
    expect(optionsArg).toEqual({ replace: true })
  })

  it('met à jour les filtres desktop et propage project/etablissement/showDone aux enfants', async () => {
    render(<TodoPage />, { wrapper: createWrapper() })

    await waitFor(() => {
      expect(screen.getByTestId('list-filter')).toHaveTextContent('all')
      expect(screen.getByTestId('list-project')).toHaveTextContent('')
      expect(screen.getByTestId('list-etablissement')).toHaveTextContent('')
      expect(screen.getByTestId('list-show-done')).toHaveTextContent('false')
    })

    fireEvent.click(screen.getByText('filter-today'))

    await waitFor(() => {
      expect(screen.getByTestId('list-filter')).toHaveTextContent('today')
      expect(screen.getByTestId('list-project')).toHaveTextContent('')
      expect(screen.getByTestId('list-etablissement')).toHaveTextContent('')
    })

    fireEvent.click(screen.getByText('project-1'))

    await waitFor(() => {
      expect(screen.getByTestId('list-project')).toHaveTextContent('project-1')
      expect(screen.getByTestId('list-filter')).toHaveTextContent('all')
      expect(screen.getByTestId('create-project')).toHaveTextContent('project-1')
      expect(screen.getByTestId('create-etablissement')).toHaveTextContent('')
    })

    await waitFor(() => {
      expect(quickAddPropsSpy).toHaveBeenLastCalledWith(
        expect.objectContaining({ projectId: 'project-1', etablissementId: null })
      )
    })

    fireEvent.click(screen.getByText('eta-1'))

    await waitFor(() => {
      expect(screen.getByTestId('list-etablissement')).toHaveTextContent('eta-1')
      expect(screen.getByTestId('list-project')).toHaveTextContent('')
      expect(screen.getByTestId('create-project')).toHaveTextContent('')
      expect(screen.getByTestId('create-etablissement')).toHaveTextContent('eta-1')
    })

    fireEvent.click(screen.getByText('show-done'))

    await waitFor(() => {
      expect(screen.getByTestId('list-show-done')).toHaveTextContent('true')
    })
  })

  it('ouvre le panneau de détail sur desktop lors de la sélection d’une tâche puis le ferme', async () => {
    render(<TodoPage />, { wrapper: createWrapper() })

    await waitFor(() => {
      expect(screen.queryByTestId('todo-detail-panel')).not.toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('select-today-task'))

    await waitFor(() => {
      expect(screen.getByTestId('todo-detail-panel')).toBeInTheDocument()
      expect(screen.getByTestId('list-selected-id')).toHaveTextContent('t-today')
    })

    fireEvent.click(screen.getByText('close-detail'))

    await waitFor(() => {
      expect(screen.queryByTestId('todo-detail-panel')).not.toBeInTheDocument()
    })
  })

  it('affiche la version mobile avec navigation PWA masquée et déclenche la recherche clavier', async () => {
    useIsMobileMock.mockReturnValue(true)
    const dispatchEventSpy = vi.spyOn(document, 'dispatchEvent')

    render(<TodoPage isPWAMode />, { wrapper: createWrapper() })

    await waitFor(() => {
      expect(screen.getByTestId('todo-mobile-header')).toBeInTheDocument()
      expect(screen.getByTestId('mobile-total')).toHaveTextContent('3')
      expect(screen.getByTestId('mobile-overdue')).toHaveTextContent('1')
      expect(screen.getByTestId('mobile-today')).toHaveTextContent('1')
      expect(screen.getByTestId('mobile-global-nav')).toHaveTextContent('false')
    })

    expect(screen.queryByTestId('todo-quick-add')).not.toBeInTheDocument()

    fireEvent.click(screen.getByText('open-filters'))

    await waitFor(() => {
      expect(screen.getAllByTestId('sheet')[0]).toHaveAttribute('data-open', 'true')
    })

    fireEvent.click(screen.getByText('mobile-create'))

    await waitFor(() => {
      expect(screen.getByTestId('create-open')).toHaveTextContent('true')
    })

    const callsBeforeSearch = dispatchEventSpy.mock.calls.length

    fireEvent.click(screen.getByText('mobile-search'))

    await waitFor(() => {
      expect(dispatchEventSpy.mock.calls.length).toBe(callsBeforeSearch + 1)
    })

    const eventArg = dispatchEventSpy.mock.calls[callsBeforeSearch][0]
    expect(eventArg).toBeInstanceOf(KeyboardEvent)
    expect((eventArg as KeyboardEvent).key).toBe('k')
    expect((eventArg as KeyboardEvent).metaKey).toBe(true)

    fireEvent.click(screen.getByText('select-today-task'))

    await waitFor(() => {
      expect(screen.getByTestId('todo-detail-panel')).toBeInTheDocument()
    })
  })
})
