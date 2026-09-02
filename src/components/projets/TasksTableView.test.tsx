// @vitest-environment jsdom
import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const {
  TASKS,
  MOBILE_TASKS,
  AUTH_STATE,
  mockNavigate,
  mockToast,
  mockExportTasksToCSV,
  mockFormatDateFr,
  mockIsOverdue,
  mockGetPriorityLabelFr,
  mockGetStatusLabelFr,
  mockInvalidateQueries,
  mockFrom,
  mockEq,
  mockUpdate,
  mockSelect,
  mockGte,
  mockLte,
  mockIn,
  mockOrder,
  mockLimit,
  mockInsert,
  mockDelete,
  mockSingle,
  mockMaybeSingle,
  stableSuccessResult,
  stableErrorResult,
} = vi.hoisted(() => {
  const TASKS = [
    {
      id: 't1',
      titre: 'Bravo task',
      etablissement_id: 'et1',
      etablissements: { nom: 'Clinique B' },
      categories_taches: { nom: 'Cat B', couleur: '#00f' },
      priorite: 'medium',
      echeance: '2024-06-20',
      responsable_profile: { prenom: 'Zoe', nom: 'Martin' },
      statut: 'En cours',
    },
    {
      id: 't2',
      titre: 'Alpha task',
      etablissement_id: 'et2',
      etablissements: { nom: 'Clinique A' },
      categories_taches: { nom: 'Cat A', couleur: '#f00' },
      priorite: 'high',
      echeance: '2024-06-10',
      responsable_profile: { prenom: 'Alice', nom: 'Bernard' },
      statut: 'A faire',
    },
    {
      id: 't3',
      titre: 'Charlie task',
      etablissement_id: null,
      etablissements: { nom: 'Clinique C' },
      categories_taches: { nom: 'Cat C', couleur: '#0f0' },
      priorite: 'low',
      echeance: null,
      responsable_profile: { prenom: 'Bob', nom: 'Durand' },
      statut: 'Terminé',
    },
  ]

  const MOBILE_TASKS = [
    {
      id: 'm1',
      titre: 'Mobile one',
      etablissement_id: 'et9',
      etablissements: { nom: 'Mobile Clinic' },
      categories_taches: { nom: 'Mob', couleur: '#333' },
      priorite: 'high',
      echeance: '2024-06-01',
      responsable_profile: { prenom: 'Mo', nom: 'Bile' },
      statut: 'A faire',
    },
  ]

  const AUTH_STATE = {
    user: { id: 'u1', email: 't@t.co' },
    session: { user: { id: 'u1' } },
    isLoading: false,
  }

  const mockNavigate = vi.fn()
  const mockToast = vi.fn()
  const mockExportTasksToCSV = vi.fn()
  const mockFormatDateFr = vi.fn((value: string | null) => (value ? `FR:${value}` : ''))
  const mockIsOverdue = vi.fn((echeance: string | null, statut: string) =>
    Boolean(echeance && statut !== 'Terminé')
  )
  const mockGetPriorityLabelFr = vi.fn((p: string) => `prio:${p}`)
  const mockGetStatusLabelFr = vi.fn((s: string) => `status:${s}`)
  const mockInvalidateQueries = vi.fn()

  const stableSuccessResult = { data: null, error: null }
  const stableErrorResult = { data: null, error: { message: 'x' } }

  const mockEq = vi.fn(() => Promise.resolve(stableSuccessResult))
  const mockUpdate = vi.fn(() => builder)
  const mockSelect = vi.fn(() => builder)
  const mockGte = vi.fn(() => builder)
  const mockLte = vi.fn(() => builder)
  const mockIn = vi.fn(() => builder)
  const mockOrder = vi.fn(() => builder)
  const mockLimit = vi.fn(() => builder)
  const mockInsert = vi.fn(() => builder)
  const mockDelete = vi.fn(() => builder)
  const mockSingle = vi.fn(() => Promise.resolve(stableSuccessResult))
  const mockMaybeSingle = vi.fn(() => Promise.resolve(stableSuccessResult))

  const builder = {
    select: mockSelect,
    eq: mockEq,
    gte: mockGte,
    lte: mockLte,
    in: mockIn,
    order: mockOrder,
    limit: mockLimit,
    insert: mockInsert,
    update: mockUpdate,
    delete: mockDelete,
    single: mockSingle,
    maybeSingle: mockMaybeSingle,
    then: (onFulfilled: (value: typeof stableSuccessResult) => unknown) =>
      Promise.resolve(stableSuccessResult).then(onFulfilled),
    catch: (onRejected: (reason: unknown) => unknown) =>
      Promise.resolve(stableSuccessResult).catch(onRejected),
  }

  const mockFrom = vi.fn(() => builder)

  return {
    TASKS,
    MOBILE_TASKS,
    AUTH_STATE,
    mockNavigate,
    mockToast,
    mockExportTasksToCSV,
    mockFormatDateFr,
    mockIsOverdue,
    mockGetPriorityLabelFr,
    mockGetStatusLabelFr,
    mockInvalidateQueries,
    mockFrom,
    mockEq,
    mockUpdate,
    mockSelect,
    mockGte,
    mockLte,
    mockIn,
    mockOrder,
    mockLimit,
    mockInsert,
    mockDelete,
    mockSingle,
    mockMaybeSingle,
    stableSuccessResult,
    stableErrorResult,
  }
})

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}))

vi.mock('@/hooks/shared/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}))

vi.mock('@/hooks/ui/use-mobile', () => ({
  useIsMobile: vi.fn(() => false),
}))

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
  },
}))

vi.mock('@/components/ui/card', () => ({
  Card: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
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

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
    'aria-label': ariaLabel,
    title,
  }: {
    children: React.ReactNode
    onClick?: React.MouseEventHandler<HTMLButtonElement>
    'aria-label'?: string
    title?: string
  }) => (
    <button onClick={onClick} aria-label={ariaLabel} title={title}>
      {children}
    </button>
  ),
}))

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}))

vi.mock('@/components/ui/checkbox', () => ({
  Checkbox: ({
    checked,
    onCheckedChange,
  }: {
    checked?: boolean
    onCheckedChange?: (checked: boolean) => void
  }) => (
    <input
      type="checkbox"
      checked={Boolean(checked)}
      onChange={(e) => onCheckedChange?.(e.target.checked)}
    />
  ),
}))

vi.mock('@/components/ui/select', () => ({
  Select: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock('@/components/ui/tooltip', () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TooltipContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TooltipProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TooltipTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock('@/components/ui/table', () => ({
  Table: ({ children }: { children: React.ReactNode }) => <table>{children}</table>,
  TableHeader: ({ children }: { children: React.ReactNode }) => <thead>{children}</thead>,
  TableBody: ({ children }: { children: React.ReactNode }) => <tbody>{children}</tbody>,
  TableRow: ({
    children,
    onClick,
    onKeyDown,
    className,
    role,
    tabIndex,
    'aria-label': ariaLabel,
  }: {
    children: React.ReactNode
    onClick?: React.MouseEventHandler<HTMLTableRowElement>
    onKeyDown?: React.KeyboardEventHandler<HTMLTableRowElement>
    className?: string
    role?: string
    tabIndex?: number
    'aria-label'?: string
  }) => (
    <tr
      onClick={onClick}
      onKeyDown={onKeyDown}
      className={className}
      role={role}
      tabIndex={tabIndex}
      aria-label={ariaLabel}
    >
      {children}
    </tr>
  ),
  TableHead: ({
    children,
    onClick,
    className,
  }: {
    children: React.ReactNode
    onClick?: React.MouseEventHandler<HTMLTableCellElement>
    className?: string
  }) => (
    <th onClick={onClick} className={className}>
      {children}
    </th>
  ),
  TableCell: ({
    children,
    onClick,
    className,
  }: {
    children: React.ReactNode
    onClick?: React.MouseEventHandler<HTMLTableCellElement>
    className?: string
  }) => (
    <td onClick={onClick} className={className}>
      {children}
    </td>
  ),
}))

vi.mock('lucide-react', () => {
  const Icon = ({ className }: { className?: string }) => <svg data-class={className} />
  return {
    Search: Icon,
    Download: Icon,
    ArrowUpDown: Icon,
    ArrowUp: Icon,
    ArrowDown: Icon,
    Building2: Icon,
    Calendar: Icon,
    User: Icon,
    CheckCircle2: Icon,
    Clock: Icon,
    XCircle: Icon,
    AlertCircle: Icon,
    Archive: Icon,
  }
})

vi.mock('@/components/tasks/TaskEditDialog', () => ({
  TaskEditDialog: () => <div>TaskEditDialog</div>,
}))

vi.mock('./BulkActionsBarProjets', () => ({
  BulkActionsBarProjets: ({ selectedIds }: { selectedIds: string[] }) => (
    <div data-testid="bulk-bar">{selectedIds.join(',')}</div>
  ),
}))

vi.mock('./TaskMobileCard', () => ({
  TaskMobileCard: ({
    task,
    onClick,
    onArchive,
  }: {
    task: { id: string; titre: string }
    onClick: () => void
    onArchive: () => void
  }) => (
    <div>
      <span>{task.titre}</span>
      <button onClick={onClick}>open-{task.id}</button>
      <button onClick={onArchive}>archive-{task.id}</button>
    </div>
  ),
}))

vi.mock('@/lib/projetsUtils', () => ({
  exportTasksToCSV: mockExportTasksToCSV,
  formatDateFr: mockFormatDateFr,
  isOverdue: mockIsOverdue,
  getPriorityLabelFr: mockGetPriorityLabelFr,
  getStatusLabelFr: mockGetStatusLabelFr,
}))

vi.mock('@/lib/utils', () => ({
  cn: (...args: Array<string | false | null | undefined>) => args.filter(Boolean).join(' '),
}))

import { useIsMobile } from '@/hooks/ui/use-mobile'
import { useQueryClient } from '@tanstack/react-query'
import { TasksTableView } from './TasksTableView'

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  })

  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )

  return { Wrapper, queryClient }
}

describe('TasksTableView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useIsMobile).mockReturnValue(false)
  })

  it('affiche les tâches triées par priorité, filtre par recherche, sélectionne tout et exporte', async () => {
    const { Wrapper } = createWrapper()

    render(
      <TasksTableView
        taches={TASKS}
        onStatusChange={vi.fn()}
        getEtablissementColor={(id, nom) => `${id}-${nom}-color`}
      />,
      { wrapper: Wrapper }
    )

    expect(screen.getByText('Vue Tableau')).toBeInTheDocument()
    expect(screen.getByText('3 tâches')).toBeInTheDocument()

    const links = screen.getAllByRole('link')
    expect(links[0]).toHaveAttribute('aria-label', 'Ouvrir la tâche Alpha task')
    expect(links[1]).toHaveAttribute('aria-label', 'Ouvrir la tâche Bravo task')
    expect(links[2]).toHaveAttribute('aria-label', 'Ouvrir la tâche Charlie task')

    fireEvent.change(screen.getByPlaceholderText('Rechercher...'), {
      target: { value: 'clinique b' },
    })

    expect(screen.getByText('Bravo task')).toBeInTheDocument()
    expect(screen.queryByText('Alpha task')).not.toBeInTheDocument()
    expect(screen.queryByText('Charlie task')).not.toBeInTheDocument()

    fireEvent.click(screen.getAllByRole('checkbox')[0])
    expect(screen.getByTestId('bulk-bar')).toHaveTextContent('t1')

    fireEvent.click(screen.getByText('Exporter CSV'))
    expect(mockExportTasksToCSV).toHaveBeenCalledWith(
      [expect.objectContaining({ id: 't1', titre: 'Bravo task' })],
      'taches_tableau'
    )
    expect(mockToast).toHaveBeenCalledWith({ title: '1 tâche(s) exportée(s)' })
  })

  it("navigue vers l'établissement au clic sur une ligne et bascule le tri sur le titre", async () => {
    const { Wrapper } = createWrapper()

    render(
      <TasksTableView
        taches={TASKS}
        onStatusChange={vi.fn()}
        getEtablissementColor={() => '#123'}
      />,
      { wrapper: Wrapper }
    )

    fireEvent.click(screen.getByText('Titre'))
    let links = screen.getAllByRole('link')
    expect(links[0]).toHaveAttribute('aria-label', 'Ouvrir la tâche Alpha task')
    expect(links[1]).toHaveAttribute('aria-label', 'Ouvrir la tâche Bravo task')
    expect(links[2]).toHaveAttribute('aria-label', 'Ouvrir la tâche Charlie task')

    fireEvent.click(screen.getByText('Titre'))
    links = screen.getAllByRole('link')
    expect(links[0]).toHaveAttribute('aria-label', 'Ouvrir la tâche Charlie task')
    expect(links[1]).toHaveAttribute('aria-label', 'Ouvrir la tâche Bravo task')
    expect(links[2]).toHaveAttribute('aria-label', 'Ouvrir la tâche Alpha task')

    fireEvent.click(screen.getByLabelText('Ouvrir la tâche Bravo task'))
    expect(mockNavigate).toHaveBeenCalledWith('/etablissements/et1')
  })

  it('archive une tâche en mobile, invalide la query et affiche un toast succès', async () => {
    vi.mocked(useIsMobile).mockReturnValue(true)
    mockEq.mockResolvedValue(stableSuccessResult)

    const { Wrapper, queryClient } = createWrapper()
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')
    invalidateSpy.mockImplementation(mockInvalidateQueries)

    render(
      <TasksTableView
        taches={MOBILE_TASKS}
        onStatusChange={vi.fn()}
        getEtablissementColor={() => '#abc'}
      />,
      { wrapper: Wrapper }
    )

    expect(screen.getByText('Mobile one')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'archive-m1' }))

    await waitFor(() => {
      expect(mockFrom).toHaveBeenCalledWith('taches')
      expect(mockUpdate).toHaveBeenCalledWith({ archive: true })
      expect(mockEq).toHaveBeenCalledWith('id', 'm1')
      expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['taches'] })
      expect(mockToast).toHaveBeenCalledWith({ title: 'Tâche archivée' })
    })
  })

  it("gère l'erreur d'archivage sans invalider les queries", async () => {
    vi.mocked(useIsMobile).mockReturnValue(true)
    mockEq.mockResolvedValue(stableErrorResult)

    const { Wrapper, queryClient } = createWrapper()
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')
    invalidateSpy.mockImplementation(mockInvalidateQueries)

    render(
      <TasksTableView
        taches={MOBILE_TASKS}
        onStatusChange={vi.fn()}
        getEtablissementColor={() => '#abc'}
      />,
      { wrapper: Wrapper }
    )

    fireEvent.click(screen.getByRole('button', { name: 'archive-m1' }))

    await waitFor(() => {
      expect(mockEq).toHaveBeenCalledWith('id', 'm1')
    })

    expect(mockInvalidateQueries).not.toHaveBeenCalled()
    expect(mockToast).not.toHaveBeenCalledWith({ title: 'Tâche archivée' })
  })

  it("affiche l'état vide en mobile quand aucune tâche ne correspond à la recherche", () => {
    vi.mocked(useIsMobile).mockReturnValue(true)

    const { Wrapper } = createWrapper()

    render(
      <TasksTableView
        taches={MOBILE_TASKS}
        onStatusChange={vi.fn()}
        getEtablissementColor={() => '#abc'}
      />,
      { wrapper: Wrapper }
    )

    fireEvent.change(screen.getByPlaceholderText('Rechercher...'), {
      target: { value: 'introuvable' },
    })

    expect(screen.getByText('Aucune tâche trouvée')).toBeInTheDocument()
  })
})
