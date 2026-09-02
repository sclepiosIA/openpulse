/* @vitest-environment jsdom */

import React from 'react'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { CalendarEmbeddedGantt } from './CalendarEmbeddedGantt'

const {
  TASKS,
  EMPTY_TASKS,
  ETABS,
  PROFILES,
  PROFILES_WITH_ROLES,
  CATEGORIES,
  DOC_COUNTS,
  TIMELINE,
  FILTERS_RESULT,
  UPDATE_MUTATE,
  ARCHIVE_MUTATE,
  DELETE_MUTATE,
  DUPLICATE_MUTATE,
  mockUseTaches,
  mockUseEtablissements,
  mockUseProfiles,
  mockUseActiveProfilesWithRoles,
  mockUseCategories,
  mockUseTachesDocumentsCounts,
  mockUseGanttZoom,
  mockUseGanttFilters,
  mockUseUpdateTache,
  mockUseArchiveTache,
  mockUseDeleteTache,
  mockUseDuplicateTache,
  mockFilterTasksByEstablishmentPhase,
  mockExpandAllRecurringTasks,
  mockGroupRecurringTasks,
} = vi.hoisted(() => {
  const TASKS = [
    {
      id: 't1',
      titre: 'Tâche en retard',
      etablissement_id: 'e1',
      responsable_id: 'p1',
      categorie_id: 'c1',
      statut: 'En cours',
      priorite: 'high',
      archive: false,
      date_debut: '2024-01-01',
      echeance: '2024-01-03',
      created_at: '2024-01-01T08:00:00.000Z',
      profiles: { nom: 'Martin', prenom: 'Alice' },
    },
    {
      id: 't2',
      titre: 'Tâche terminée',
      etablissement_id: 'e1',
      responsable_id: 'p2',
      categorie_id: 'c2',
      statut: 'Terminé',
      priorite: 'medium',
      archive: false,
      date_debut: '2024-01-05',
      echeance: '2024-01-06',
      created_at: '2024-01-05T08:00:00.000Z',
      profiles: { nom: 'Durand', prenom: 'Bob' },
    },
  ]

  const EMPTY_TASKS: typeof TASKS = []

  const ETABS = [
    { id: 'e1', nom: 'Clinique Alpha', statut: 'actif' },
    { id: 'e2', nom: 'Clinique Beta', statut: 'actif' },
  ]

  const PROFILES = [
    { id: 'p1', prenom: 'Alice', nom: 'Martin', email: 'a@test.io' },
    { id: 'p2', prenom: 'Bob', nom: 'Durand', email: 'b@test.io' },
  ]

  const PROFILES_WITH_ROLES = [
    { id: 'p1', role: 'admin' },
    { id: 'p2', role: 'manager' },
  ]

  const CATEGORIES = [
    { id: 'c1', nom: 'Maintenance', couleur: '#f00' },
    { id: 'c2', nom: 'Qualité', couleur: '#0f0' },
  ]

  const DOC_COUNTS = { t1: 3, t2: 0 }

  const TIMELINE = {
    start: new Date('2024-01-01T00:00:00.000Z'),
    totalDays: 30,
    pixelsPerDay: 20,
  }

  const FILTERS_RESULT = {
    filters: {},
    filteredTasks: TASKS,
    updateFilter: vi.fn(),
    resetFilters: vi.fn(),
    toggleQuickFilter: vi.fn(),
    hasActiveFilters: false,
  }

  return {
    TASKS,
    EMPTY_TASKS,
    ETABS,
    PROFILES,
    PROFILES_WITH_ROLES,
    CATEGORIES,
    DOC_COUNTS,
    TIMELINE,
    FILTERS_RESULT,
    UPDATE_MUTATE: vi.fn(),
    ARCHIVE_MUTATE: vi.fn(),
    DELETE_MUTATE: vi.fn(),
    DUPLICATE_MUTATE: vi.fn(),
    mockUseTaches: vi.fn(),
    mockUseEtablissements: vi.fn(),
    mockUseProfiles: vi.fn(),
    mockUseActiveProfilesWithRoles: vi.fn(),
    mockUseCategories: vi.fn(),
    mockUseTachesDocumentsCounts: vi.fn(),
    mockUseGanttZoom: vi.fn(),
    mockUseGanttFilters: vi.fn(),
    mockUseUpdateTache: vi.fn(),
    mockUseArchiveTache: vi.fn(),
    mockUseDeleteTache: vi.fn(),
    mockUseDuplicateTache: vi.fn(),
    mockFilterTasksByEstablishmentPhase: vi.fn(),
    mockExpandAllRecurringTasks: vi.fn(),
    mockGroupRecurringTasks: vi.fn(),
  }
})

vi.mock('@/components/ui/card', () => ({
  Card: ({ children, className }: { children?: React.ReactNode; className?: string }) => (
    <div data-testid="card" className={className}>
      {children}
    </div>
  ),
  CardContent: ({ children, className }: { children?: React.ReactNode; className?: string }) => (
    <div data-testid="card-content" className={className}>
      {children}
    </div>
  ),
}))

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
}))

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    asChild,
    ...props
  }: {
    children?: React.ReactNode
    asChild?: boolean
  }) => (asChild ? <>{children}</> : <button {...props}>{children}</button>),
}))

vi.mock('@/components/ui/select', () => ({
  Select: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  SelectContent: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  SelectTrigger: ({ children }: { children?: React.ReactNode }) => <button>{children}</button>,
  SelectValue: () => <span>select</span>,
}))

vi.mock('lucide-react', () => ({
  Loader2: ({ className }: { className?: string }) => <svg data-testid="loader" className={className} />,
  ChevronDown: () => <svg />,
  ChevronRight: () => <svg />,
  Plus: () => <svg />,
  ArrowUp: () => <svg />,
  ArrowDown: () => <svg />,
  ArrowUpDown: () => <svg />,
  ExternalLink: () => <svg data-testid="external-link" />,
}))

vi.mock('@dnd-kit/core', () => ({
  DndContext: ({ children }: { children?: React.ReactNode }) => <div data-testid="dnd-context">{children}</div>,
  PointerSensor: function PointerSensor() {
    return null
  },
  useSensors: () => [],
  useSensor: () => ({}),
}))

vi.mock('@dnd-kit/modifiers', () => ({
  restrictToHorizontalAxis: vi.fn(),
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

vi.mock('@/components/etablissement-gantt/hooks/useGanttFilters', () => ({
  useGanttFilters: mockUseGanttFilters,
}))

vi.mock('@/hooks/tasks/useRecurringTaskGrouping', () => ({
  groupRecurringTasks: mockGroupRecurringTasks,
}))

vi.mock('@/hooks/tasks/useTaskPhaseFilter', () => ({
  filterTasksByEstablishmentPhase: mockFilterTasksByEstablishmentPhase,
}))

vi.mock('@/lib/recurrenceUtils', () => ({
  expandAllRecurringTasks: mockExpandAllRecurringTasks,
}))

vi.mock('@/components/etablissement-gantt/GanttTimeline', () => ({
  GanttTimeline: () => <div data-testid="gantt-timeline" />,
}))

vi.mock('@/components/etablissement-gantt/GanttGrid', () => ({
  GanttGrid: () => <div data-testid="gantt-grid" />,
}))

vi.mock('@/components/etablissement-gantt/GanttTaskBar', () => ({
  GanttTaskBar: ({ task }: { task?: { id?: string } }) => (
    <div data-testid={`gantt-task-bar-${task?.id ?? 'unknown'}`} />
  ),
}))

vi.mock('@/components/etablissement-gantt/GanttRecurringTaskRow', () => ({
  GanttRecurringTaskRow: ({ task }: { task?: { id?: string } }) => (
    <div data-testid={`gantt-recurring-row-${task?.id ?? 'unknown'}`} />
  ),
}))

vi.mock('@/components/etablissement-gantt/GanttControls', () => ({
  GanttControls: () => <div data-testid="gantt-controls" />,
}))

vi.mock('@/components/global-gantt/GanttRoleLegend', () => ({
  GanttRoleLegend: () => <div data-testid="gantt-role-legend" />,
}))

vi.mock('@/components/etablissement-gantt/GanttFilters', () => ({
  GanttFiltersPanel: () => <div data-testid="gantt-filters-panel" />,
}))

vi.mock('@/components/tasks/TaskEditDialog', () => ({
  TaskEditDialog: () => <div data-testid="task-edit-dialog" />,
}))

vi.mock('@/components/etablissement-gantt/GanttTaskCreateDialog', () => ({
  GanttTaskCreateDialog: () => <div data-testid="task-create-dialog" />,
}))

vi.mock('@/components/etablissement-gantt/GanttDualLayout', () => ({
  GanttDualLayout: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="gantt-dual-layout">{children}</div>
  ),
}))

vi.mock('@/components/calendrier/CalendarContentToggle', () => ({}))

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  })

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>{children}</MemoryRouter>
      </QueryClientProvider>
    )
  }
}

describe('CalendarEmbeddedGantt', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    mockUseTaches.mockReturnValue({ data: TASKS, isLoading: false })
    mockUseEtablissements.mockReturnValue({ data: ETABS })
    mockUseProfiles.mockReturnValue({ data: PROFILES })
    mockUseActiveProfilesWithRoles.mockReturnValue({ data: PROFILES_WITH_ROLES })
    mockUseCategories.mockReturnValue({ data: CATEGORIES })
    mockUseTachesDocumentsCounts.mockReturnValue({ data: DOC_COUNTS })

    mockUseUpdateTache.mockReturnValue({ mutate: UPDATE_MUTATE })
    mockUseArchiveTache.mockReturnValue({ mutate: ARCHIVE_MUTATE })
    mockUseDeleteTache.mockReturnValue({ mutate: DELETE_MUTATE })
    mockUseDuplicateTache.mockReturnValue({ mutate: DUPLICATE_MUTATE })

    mockFilterTasksByEstablishmentPhase.mockImplementation((tasks: unknown) => tasks)
    mockExpandAllRecurringTasks.mockImplementation((tasks: unknown) => tasks)
    mockGroupRecurringTasks.mockImplementation((tasks: unknown) => [])

    mockUseGanttZoom.mockReturnValue({
      zoomLevel: 'day',
      setZoomLevel: vi.fn(),
      timeline: TIMELINE,
      goToPrevious: vi.fn(),
      goToNext: vi.fn(),
      goToToday: vi.fn(),
      getTodayPosition: vi.fn(() => 120),
    })

    mockUseGanttFilters.mockReturnValue(FILTERS_RESULT)
  })

  it('affiche un loader pendant le chargement des tâches', () => {
    mockUseTaches.mockReturnValue({ data: undefined, isLoading: true })

    render(<CalendarEmbeddedGantt />, { wrapper: createWrapper() })

    expect(screen.getByTestId('loader')).toBeInTheDocument()
    expect(screen.queryByText('Aucune tâche planifiée à afficher')).not.toBeInTheDocument()
  })

  it('affiche l’état vide avec lien vers le gantt complet quand aucune tâche valide ou timeline absente', () => {
    mockUseTaches.mockReturnValue({ data: EMPTY_TASKS, isLoading: false })
    mockUseGanttFilters.mockReturnValue({
      ...FILTERS_RESULT,
      filteredTasks: EMPTY_TASKS,
    })

    render(<CalendarEmbeddedGantt />, { wrapper: createWrapper() })

    expect(screen.getByText('Aucune tâche planifiée à afficher')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /ouvrir le gantt complet/i })).toHaveAttribute('href', '/gantt')
  })

  it('affiche les statistiques réelles calculées à partir des tâches filtrées', () => {
    render(<CalendarEmbeddedGantt />, { wrapper: createWrapper() })

    expect(screen.getByText('2 tâches')).toBeInTheDocument()
    expect(screen.getByText('1 retard')).toBeInTheDocument()
    expect(screen.getByText('50%')).toBeInTheDocument()

    expect(mockFilterTasksByEstablishmentPhase).toHaveBeenCalledWith(
      TASKS,
      ETABS.map((e) => ({ id: e.id, statut: e.statut })),
    )
    expect(mockExpandAllRecurringTasks).toHaveBeenCalledTimes(1)
    expect(mockUseTachesDocumentsCounts).toHaveBeenCalledWith(['t1', 't2'])
    expect(mockUseGanttZoom).toHaveBeenCalledWith(TASKS)
    expect(mockUseGanttFilters).toHaveBeenCalledWith(
      TASKS,
      ETABS.map((e) => ({ id: e.id, statut: e.statut })),
    )
    expect(screen.getByTestId('gantt-dual-layout')).toBeInTheDocument()
  })
})