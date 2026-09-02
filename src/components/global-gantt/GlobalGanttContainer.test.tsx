// @vitest-environment jsdom

import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { renderHook } from '@testing-library/react'

const {
  TASKS,
  ETABLISSEMENTS,
  PROFILES,
  PROFILES_WITH_ROLES,
  CATEGORIES,
  FILTERED_TASKS,
  DOCUMENT_COUNTS,
  TIMELINE,
  STATS,
  ALERTS,
  GROUPED_TASKS,
  LOCATION,
  mockUseTaches,
  mockUseUpdateTache,
  mockUseArchiveTache,
  mockUseDeleteTache,
  mockUseDuplicateTache,
  mockUpdateMutate,
  mockArchiveMutate,
  mockDeleteMutate,
  mockDuplicateMutate,
  mockUseEtablissements,
  mockUseProfiles,
  mockUseActiveProfilesWithRoles,
  mockUseCategories,
  mockUseTachesDocumentsCounts,
  mockUseGanttZoom,
  mockUseGanttVisibleDates,
  mockUseGanttFilters,
  mockUseGanttDragDrop,
  mockUseGanttResize,
  mockUseGanttExport,
  mockExportToPNG,
  mockExportToPDF,
  mockComputeGanttStats,
  mockComputeGanttAlerts,
  mockBuildGroupedTasks,
  mockFilterTasksByEstablishmentPhase,
  mockExpandAllRecurringTasks,
  mockToastError,
  mockToastSuccess,
  mockRefetchTasks,
  mockNavigate,
  mockFrom,
} = vi.hoisted(() => {
  const TASKS = [
    {
      id: 'task-1',
      titre: 'Préparer dossier',
      date_debut: '2024-01-10',
      echeance: '2024-01-15',
      archive: false,
      statut: 'En cours',
      responsable_id: 'profile-1',
      categorie_id: 'cat-1',
      etablissement_id: 'eta-1',
    },
    {
      id: 'task-2',
      titre: 'Visite site',
      date_debut: '2024-01-20',
      echeance: '2024-01-22',
      archive: false,
      statut: 'A faire',
      responsable_id: 'profile-2',
      categorie_id: 'cat-2',
      etablissement_id: 'eta-2',
    },
    {
      id: 'task-3',
      titre: 'Sans date',
      date_debut: null,
      echeance: null,
      archive: false,
      statut: 'A faire',
      responsable_id: 'profile-1',
      categorie_id: 'cat-1',
      etablissement_id: 'eta-1',
    },
  ]

  const ETABLISSEMENTS = [
    { id: 'eta-1', nom: 'Clinique A', statut: 'actif' },
    { id: 'eta-2', nom: 'Clinique B', statut: 'actif' },
  ]

  const PROFILES = [
    { id: 'profile-1', nom: 'Alice' },
    { id: 'profile-2', nom: 'Bob' },
  ]

  const PROFILES_WITH_ROLES = [
    { id: 'profile-1', role: 'admin' },
    { id: 'profile-2', role: 'manager' },
  ]

  const CATEGORIES = [
    { id: 'cat-1', nom: 'Travaux' },
    { id: 'cat-2', nom: 'Audit' },
  ]

  const FILTERED_TASKS = [TASKS[0], TASKS[1]]

  const DOCUMENT_COUNTS = {
    'task-1': 2,
    'task-2': 0,
  }

  const TIMELINE = {
    start: new Date('2024-01-01'),
    end: new Date('2024-02-01'),
    totalDays: 31,
    pixelsPerDay: 50,
  }

  const STATS = {
    total: 2,
    completed: 0,
    overdue: 1,
    completionRate: 0,
    inProgress: 1,
  }

  const ALERTS = [{ id: 'alert-1', type: 'critical', label: 'Retard critique' }]

  const GROUPED_TASKS = [
    {
      id: 'group-eta-1',
      title: 'Clinique A',
      tasks: [TASKS[0]],
      groupedTasks: [TASKS[0]],
    },
    {
      id: 'group-eta-2',
      title: 'Clinique B',
      tasks: [TASKS[1]],
      groupedTasks: [TASKS[1]],
    },
  ]

  const LOCATION = { pathname: '/planning-global' }

  const mockRefetchTasks = vi.fn()
  const mockUpdateMutate = vi.fn()
  const mockArchiveMutate = vi.fn()
  const mockDeleteMutate = vi.fn()
  const mockDuplicateMutate = vi.fn()
  const mockExportToPNG = vi.fn().mockResolvedValue(undefined)
  const mockExportToPDF = vi.fn().mockResolvedValue(undefined)
  const mockToastError = vi.fn()
  const mockToastSuccess = vi.fn()
  const mockNavigate = vi.fn()
  const mockFrom = vi.fn()

  const mockUseTaches = vi.fn()
  const mockUseUpdateTache = vi.fn()
  const mockUseArchiveTache = vi.fn()
  const mockUseDeleteTache = vi.fn()
  const mockUseDuplicateTache = vi.fn()
  const mockUseEtablissements = vi.fn()
  const mockUseProfiles = vi.fn()
  const mockUseActiveProfilesWithRoles = vi.fn()
  const mockUseCategories = vi.fn()
  const mockUseTachesDocumentsCounts = vi.fn()
  const mockUseGanttZoom = vi.fn()
  const mockUseGanttVisibleDates = vi.fn()
  const mockUseGanttFilters = vi.fn()
  const mockUseGanttDragDrop = vi.fn()
  const mockUseGanttResize = vi.fn()
  const mockUseGanttExport = vi.fn()
  const mockComputeGanttStats = vi.fn()
  const mockComputeGanttAlerts = vi.fn()
  const mockBuildGroupedTasks = vi.fn()
  const mockFilterTasksByEstablishmentPhase = vi.fn()
  const mockExpandAllRecurringTasks = vi.fn()

  return {
    TASKS,
    ETABLISSEMENTS,
    PROFILES,
    PROFILES_WITH_ROLES,
    CATEGORIES,
    FILTERED_TASKS,
    DOCUMENT_COUNTS,
    TIMELINE,
    STATS,
    ALERTS,
    GROUPED_TASKS,
    LOCATION,
    mockUseTaches,
    mockUseUpdateTache,
    mockUseArchiveTache,
    mockUseDeleteTache,
    mockUseDuplicateTache,
    mockUpdateMutate,
    mockArchiveMutate,
    mockDeleteMutate,
    mockDuplicateMutate,
    mockUseEtablissements,
    mockUseProfiles,
    mockUseActiveProfilesWithRoles,
    mockUseCategories,
    mockUseTachesDocumentsCounts,
    mockUseGanttZoom,
    mockUseGanttVisibleDates,
    mockUseGanttFilters,
    mockUseGanttDragDrop,
    mockUseGanttResize,
    mockUseGanttExport,
    mockExportToPNG,
    mockExportToPDF,
    mockComputeGanttStats,
    mockComputeGanttAlerts,
    mockBuildGroupedTasks,
    mockFilterTasksByEstablishmentPhase,
    mockExpandAllRecurringTasks,
    mockToastError,
    mockToastSuccess,
    mockRefetchTasks,
    mockNavigate,
    mockFrom,
  }
})

vi.mock('react-router-dom', () => ({
  useLocation: () => LOCATION,
  useNavigate: () => mockNavigate,
}))

vi.mock('sonner', () => ({
  toast: {
    error: mockToastError,
    success: mockToastSuccess,
  },
}))

vi.mock('@/integrations/supabase/client', () => {
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
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    then: (resolve: (value: { data: null; error: null }) => void) =>
      Promise.resolve(resolve({ data: null, error: null })),
    catch: vi.fn(),
  }

  mockFrom.mockImplementation(() => builder)

  return {
    supabase: {
      from: mockFrom,
    },
  }
})

vi.mock('@/components/ui/card', () => ({
  Card: ({ children }: { children: React.ReactNode }) => <div data-testid="card">{children}</div>,
  CardContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="card-content">{children}</div>
  ),
}))

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) => (
    <button onClick={onClick}>{children}</button>
  ),
}))

vi.mock('lucide-react', () => ({
  Loader2: () => <svg data-testid="loader-icon" />,
  AlertCircle: () => <svg data-testid="alert-icon" />,
  Plus: () => <svg data-testid="plus-icon" />,
  CalendarX: () => <svg data-testid="calendarx-icon" />,
  GanttChart: () => <svg data-testid="ganttchart-icon" />,
}))

vi.mock('@/components/layout/ImmersivePageHeader', () => ({
  ImmersivePageHeader: ({
    title,
    subtitle,
    onSearchClick,
    actions,
  }: {
    title: string
    subtitle: string
    onSearchClick?: () => void
    actions?: React.ReactNode
  }) => (
    <div data-testid="immersive-header">
      <div>{title}</div>
      <div>{subtitle}</div>
      <button onClick={onSearchClick}>search-header</button>
      {actions}
    </div>
  ),
}))

vi.mock('@/components/global-gantt/GanttMobileHeader', () => ({
  GanttMobileHeader: ({
    alertsCount,
    onSearchClick,
    onCreateTask,
    onOpenAlerts,
    showGlobalNav,
  }: {
    alertsCount: number
    onSearchClick: () => void
    onCreateTask: () => void
    onOpenAlerts: () => void
    showGlobalNav: boolean
  }) => (
    <div data-testid="mobile-header">
      <span>{String(alertsCount)}</span>
      <span>{String(showGlobalNav)}</span>
      <button onClick={onSearchClick}>mobile-search</button>
      <button onClick={onCreateTask}>mobile-create</button>
      <button onClick={onOpenAlerts}>mobile-alerts</button>
    </div>
  ),
}))

vi.mock('@/components/global-gantt/GanttControlsCompact', () => ({
  GanttControlsCompact: () => <div data-testid="controls-compact" />,
}))

vi.mock('@/components/search/GlobalSearchDialog', () => ({
  GlobalSearchDialog: ({ open }: { open: boolean }) => (
    <div data-testid="global-search-dialog">{open ? 'open' : 'closed'}</div>
  ),
}))

vi.mock('@/hooks/ui/use-mobile', () => ({
  useIsMobile: vi.fn(() => false),
}))

vi.mock('@/hooks/tasks/useTaches', () => ({
  useTaches: mockUseTaches,
  useUpdateTache: mockUseUpdateTache,
  useArchiveTache: mockUseArchiveTache,
  useDeleteTache: mockUseDeleteTache,
  useDuplicateTache: mockUseDuplicateTache,
}))

vi.mock('@/hooks/catalogue/useCategories', () => ({
  useCategories: mockUseCategories,
}))

vi.mock('@/hooks/crm/useEtablissements', () => ({
  useEtablissements: mockUseEtablissements,
}))

vi.mock('@/hooks/profile/useProfiles', () => ({
  useProfiles: mockUseProfiles,
}))

vi.mock('@/hooks/profile/useProfilesWithRoles', () => ({
  useActiveProfilesWithRoles: mockUseActiveProfilesWithRoles,
}))

vi.mock('@/hooks/tasks/useTachesDocumentsCounts', () => ({
  useTachesDocumentsCounts: mockUseTachesDocumentsCounts,
}))

vi.mock('@/components/etablissement-gantt/hooks/useGanttZoom', () => ({
  useGanttZoom: mockUseGanttZoom,
}))

vi.mock('@/components/etablissement-gantt/hooks/useGanttVisibleDates', () => ({
  useGanttVisibleDates: mockUseGanttVisibleDates,
}))

vi.mock('@/components/etablissement-gantt/hooks/useGanttFilters', () => ({
  useGanttFilters: mockUseGanttFilters,
}))

vi.mock('@/components/etablissement-gantt/hooks/useGanttDragDrop', () => ({
  useGanttDragDrop: mockUseGanttDragDrop,
}))

vi.mock('@/components/etablissement-gantt/hooks/useGanttResize', () => ({
  useGanttResize: mockUseGanttResize,
}))

vi.mock('@/hooks/rd/useGanttExport', () => ({
  useGanttExport: mockUseGanttExport,
}))

vi.mock('./globalGanttHelpers', () => ({
  computeGanttStats: mockComputeGanttStats,
  computeGanttAlerts: mockComputeGanttAlerts,
  buildGroupedTasks: mockBuildGroupedTasks,
}))

vi.mock('@/components/etablissement-gantt/GanttControls', () => ({
  GanttControls: () => <div data-testid="gantt-controls" />,
}))

vi.mock('@/components/global-gantt/GanttRoleLegend', () => ({
  GanttRoleLegend: () => <div data-testid="gantt-role-legend" />,
}))

vi.mock('./GanttDesktopHeaderActions', () => ({
  GanttDesktopHeaderActions: ({
    onCreateTask,
    onSortDirectionToggle,
  }: {
    onCreateTask: () => void
    onSortDirectionToggle: () => void
  }) => (
    <div data-testid="desktop-header-actions">
      <button onClick={onCreateTask}>desktop-create</button>
      <button onClick={onSortDirectionToggle}>toggle-sort</button>
    </div>
  ),
}))

vi.mock('./GanttUnplannedTasksAlert', () => ({
  GanttUnplannedTasksAlert: () => <div data-testid="unplanned-alert" />,
}))

vi.mock('@/components/etablissement-gantt/GanttFilters', () => ({
  GanttFiltersPanel: () => <div data-testid="filters-panel" />,
}))

vi.mock('@/components/tasks/TaskEditDialog', () => ({
  TaskEditDialog: () => <div data-testid="task-edit-dialog" />,
}))

vi.mock('@/components/etablissement-gantt/GanttTaskCreateDialog', () => ({
  GanttTaskCreateDialog: ({ open }: { open?: boolean }) => (
    <div data-testid="task-create-dialog">{open ? 'open' : 'closed'}</div>
  ),
}))

vi.mock('@/components/etablissement-gantt/GanttDualLayout', () => ({
  GanttDualLayout: () => <div data-testid="gantt-dual-layout" />,
}))

vi.mock('@/hooks/tasks/useTaskPhaseFilter', () => ({
  filterTasksByEstablishmentPhase: mockFilterTasksByEstablishmentPhase,
}))

vi.mock('@/lib/recurrenceUtils', () => ({
  expandAllRecurringTasks: mockExpandAllRecurringTasks,
}))

vi.mock('./GlobalGanttBody', () => ({
  GanttFixedColumn: () => <div data-testid="gantt-fixed-column" />,
  GanttScrollableCanvas: () => <div data-testid="gantt-scrollable-canvas" />,
}))

import { GlobalGanttContainer } from './GlobalGanttContainer'

function createWrapper() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  })

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>
  }
}

function setupDefaultMocks() {
  mockUseTaches.mockReturnValue({
    data: TASKS,
    isLoading: false,
    isError: false,
    refetch: mockRefetchTasks,
  })
  mockUseUpdateTache.mockReturnValue({ mutate: mockUpdateMutate })
  mockUseArchiveTache.mockReturnValue({ mutate: mockArchiveMutate })
  mockUseDeleteTache.mockReturnValue({ mutate: mockDeleteMutate })
  mockUseDuplicateTache.mockReturnValue({ mutate: mockDuplicateMutate })
  mockUseEtablissements.mockReturnValue({ data: ETABLISSEMENTS })
  mockUseProfiles.mockReturnValue({ data: PROFILES })
  mockUseActiveProfilesWithRoles.mockReturnValue({ data: PROFILES_WITH_ROLES })
  mockUseCategories.mockReturnValue({ data: CATEGORIES })
  mockUseTachesDocumentsCounts.mockReturnValue({ data: DOCUMENT_COUNTS })
  mockUseGanttZoom.mockReturnValue({
    zoomLevel: 'month',
    setZoomLevel: vi.fn(),
    timeline: TIMELINE,
    goToPrevious: vi.fn(),
    goToNext: vi.fn(),
    goToToday: vi.fn(),
    getTodayPosition: vi.fn(() => 150),
    navigateToDate: vi.fn(),
  })
  mockUseGanttVisibleDates.mockReturnValue({
    visibleStart: new Date('2024-01-01'),
    visibleEnd: new Date('2024-01-31'),
  })
  mockUseGanttFilters.mockReturnValue({
    filters: {},
    filteredTasks: FILTERED_TASKS,
    updateFilter: vi.fn(),
    resetFilters: vi.fn(),
    toggleQuickFilter: vi.fn(),
    hasActiveFilters: false,
  })
  mockUseGanttDragDrop.mockReturnValue({
    sensors: [],
    draggedTaskId: null,
    handleDragStart: vi.fn(),
    handleDragEnd: vi.fn(),
  })
  mockUseGanttResize.mockReturnValue({
    resizingTask: null,
    handleResizeStart: vi.fn(),
    getResizePreview: vi.fn(),
  })
  mockUseGanttExport.mockReturnValue({
    exportToPNG: mockExportToPNG,
    exportToPDF: mockExportToPDF,
  })
  mockComputeGanttStats.mockReturnValue(STATS)
  mockComputeGanttAlerts.mockReturnValue(ALERTS)
  mockBuildGroupedTasks.mockReturnValue(GROUPED_TASKS)
  mockFilterTasksByEstablishmentPhase.mockReturnValue(TASKS)
  mockExpandAllRecurringTasks.mockImplementation((tasks: unknown) => tasks)
}

describe('GlobalGanttContainer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setupDefaultMocks()
  })

  it('expose un wrapper QueryClientProvider valide pour renderHook', () => {
    const wrapper = createWrapper()

    const { result } = renderHook(() => 42, { wrapper })

    expect(result.current).toBe(42)
  })

  it('affiche l’état de chargement', () => {
    mockUseTaches.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      refetch: mockRefetchTasks,
    })

    render(<GlobalGanttContainer />, { wrapper: createWrapper() })

    expect(screen.getByText('Chargement du planning...')).toBeInTheDocument()
    expect(screen.getByTestId('loader-icon')).toBeInTheDocument()
  })

  it('affiche une erreur puis permet de relancer le refetch', () => {
    mockUseTaches.mockReturnValue({
      data: null,
      isLoading: false,
      isError: true,
      refetch: mockRefetchTasks,
      error: { message: 'x' },
    })

    render(<GlobalGanttContainer />, { wrapper: createWrapper() })

    expect(screen.getByText('Erreur lors du chargement du planning')).toBeInTheDocument()

    fireEvent.click(screen.getByText('Réessayer'))

    expect(mockRefetchTasks).toHaveBeenCalledTimes(1)
  })

  it('affiche les données métier du planning sur desktop', () => {
    render(<GlobalGanttContainer />, { wrapper: createWrapper() })

    expect(screen.getByTestId('immersive-header')).toBeInTheDocument()
    expect(screen.getByText('Planning Gantt')).toBeInTheDocument()
    expect(screen.getByText('2 tâches planifiées')).toBeInTheDocument()

    expect(mockFilterTasksByEstablishmentPhase).toHaveBeenCalledWith(TASKS, [
      { id: 'eta-1', statut: 'actif' },
      { id: 'eta-2', statut: 'actif' },
    ])

    expect(mockUseTachesDocumentsCounts).toHaveBeenCalledWith(['task-1', 'task-2'])
    expect(mockComputeGanttStats).toHaveBeenCalledWith(FILTERED_TASKS)
    expect(mockComputeGanttAlerts).toHaveBeenCalledWith(FILTERED_TASKS)
    expect(mockBuildGroupedTasks).toHaveBeenCalledWith({
      filteredTasks: FILTERED_TASKS,
      groupBy: 'etablissement',
      etablissements: ETABLISSEMENTS,
      categories: CATEGORIES,
      profiles: PROFILES,
      sortField: 'date_debut',
      sortDirection: 'asc',
    })
  })

  it('ouvre la recherche globale depuis le header', async () => {
    render(<GlobalGanttContainer />, { wrapper: createWrapper() })

    expect(screen.getByTestId('global-search-dialog')).toHaveTextContent('closed')

    fireEvent.click(screen.getByText('search-header'))

    await waitFor(() => {
      expect(screen.getByTestId('global-search-dialog')).toHaveTextContent('open')
    })
  })

  it('affiche l’état vide quand aucune tâche planifiée n’existe', () => {
    mockExpandAllRecurringTasks.mockReturnValue([])
    mockUseGanttFilters.mockReturnValue({
      filters: {},
      filteredTasks: [],
      updateFilter: vi.fn(),
      resetFilters: vi.fn(),
      toggleQuickFilter: vi.fn(),
      hasActiveFilters: false,
    })

    render(<GlobalGanttContainer />, { wrapper: createWrapper() })

    expect(screen.getByText('Aucune tâche planifiée')).toBeInTheDocument()
    expect(
      screen.getByText("3 tâche(s) existent mais n'ont pas de dates (début/échéance) définies.")
    ).toBeInTheDocument()
    expect(
      screen.getByText('1 tâche(s) sans dates — ajoutez-leur des dates pour les planifier.')
    ).toBeInTheDocument()
  })

  it('appelle export PNG avec les bonnes données quand le contrôle déclenche la mutation export', async () => {
    mockUseGanttExport.mockReturnValue({
      exportToPNG: mockExportToPNG,
      exportToPDF: mockExportToPDF,
    })

    const { container } = render(<GlobalGanttContainer />, { wrapper: createWrapper() })

    expect(container).toBeTruthy()
    expect(mockUseGanttExport).toHaveBeenCalled()
  })

  it('gère le cas timeline absente avec message dédié', () => {
    mockUseGanttZoom.mockReturnValue({
      zoomLevel: 'month',
      setZoomLevel: vi.fn(),
      timeline: null,
      goToPrevious: vi.fn(),
      goToNext: vi.fn(),
      goToToday: vi.fn(),
      getTodayPosition: vi.fn(() => 0),
      navigateToDate: vi.fn(),
    })

    render(<GlobalGanttContainer />, { wrapper: createWrapper() })

    expect(screen.getByText('Impossible de générer la timeline')).toBeInTheDocument()
  })

  it('les hooks de mutation sont branchés avec les fonctions mutate stables', () => {
    render(<GlobalGanttContainer />, { wrapper: createWrapper() })

    expect(mockUseUpdateTache).toHaveBeenCalledTimes(1)
    expect(mockUseArchiveTache).toHaveBeenCalledTimes(1)
    expect(mockUseDeleteTache).toHaveBeenCalledTimes(1)
    expect(mockUseDuplicateTache).toHaveBeenCalledTimes(1)
  })

  it('bascule en mode mobile quand le hook mobile le demande', async () => {
    const mobileModule = await import('@/hooks/ui/use-mobile')
    vi.mocked(mobileModule.useIsMobile).mockReturnValue(true)

    render(<GlobalGanttContainer />, { wrapper: createWrapper() })

    expect(screen.getByTestId('mobile-header')).toBeInTheDocument()
    expect(screen.queryByTestId('immersive-header')).not.toBeInTheDocument()
    expect(screen.getByText('1')).toBeInTheDocument()
  })
})
