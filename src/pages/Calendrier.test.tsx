/* @vitest-environment jsdom */

import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import Calendrier from './Calendrier'

const {
  AUTH_STATE,
  TASKS,
  PROFILES,
  ETABS,
  CATEGORIES,
  CALENDARS,
  DEFAULT_CALENDAR,
  MARQUE_CALENDARS,
  EVENTS,
  ABSENCES,
  FILTERS_STATE,
  LOCATION_STATE,
  MOBILE_DRAWER_STATE,
  TOAST_FN,
  EXPORT_ICS_FN,
  PAGE_TITLE_FN,
  DEBUG_ERROR_FN,
  UPDATE_MUTATE_ASYNC,
  mockFrom,
  builderState,
} = vi.hoisted(() => {
  const AUTH_STATE = {
    user: { id: 'u1', email: 'tt@example.co' },
    session: { user: { id: 'u1' } },
    isLoading: false,
  }

  const TASKS = [
    {
      id: 't1',
      titre: 'Tâche établissement',
      etablissement_id: 'e1',
      categorie_id: 'cat1',
      statut: 'A faire',
    },
    {
      id: 't2',
      titre: 'Tâche simple',
      etablissement_id: null,
      categorie_id: 'cat2',
      statut: 'En cours',
    },
  ]

  const PROFILES = [
    { id: 'p1', user_id: 'u1', nom: 'User One' },
    { id: 'p2', user_id: 'u2', nom: 'User Two' },
  ]

  const ETABS = [{ id: 'e1', statut: 'actif', nom: 'Etab 1' }]
  const CATEGORIES = [
    { id: 'cat1', nom: 'Cat 1' },
    { id: 'cat2', nom: 'Cat 2' },
  ]

  const CALENDARS = [
    { id: 'cal1', name: 'Principal', is_visible: true },
    { id: 'cal2', name: 'Secondaire', is_visible: false },
  ]

  const DEFAULT_CALENDAR = { id: 'cal1', name: 'Principal', is_visible: true }
  const MARQUE_CALENDARS = [{ id: 'sc1', name: 'Team' }]
  const EVENTS = [
    { id: 'ev1', title: 'Réunion' },
    { id: 'ev2', title: 'Point' },
  ]
  const ABSENCES = [{ id: 'ab1', user_id: 'u2' }]

  const FILTERS_STATE = {
    filters: { search: '' },
    hasActiveFilters: false,
  }

  const LOCATION_STATE = { pathname: '/calendar' }
  const MOBILE_DRAWER_STATE = { setOpen: vi.fn() }
  const TOAST_FN = vi.fn()
  const EXPORT_ICS_FN = vi.fn()
  const PAGE_TITLE_FN = vi.fn()
  const DEBUG_ERROR_FN = vi.fn()
  const UPDATE_MUTATE_ASYNC = vi.fn()

  const builderState = {
    mode: 'success' as 'success' | 'error',
    data: { role: 'admin' } as { role?: string } | null,
    error: null as { message: string } | null,
  }

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
      single: vi.fn(async () => ({ data: builderState.data, error: builderState.error })),
      maybeSingle: vi.fn(async () => ({ data: builderState.data, error: builderState.error })),
      then: (
        onFulfilled: (value: {
          data: { role?: string } | null
          error: { message: string } | null
        }) => unknown
      ) =>
        Promise.resolve({ data: builderState.data, error: builderState.error }).then(onFulfilled),
      catch: (onRejected: (reason: unknown) => unknown) =>
        Promise.resolve({ data: builderState.data, error: builderState.error }).catch(onRejected),
    }
    return builder
  }

  const mockFrom = vi.fn(() => createBuilder())

  return {
    AUTH_STATE,
    TASKS,
    PROFILES,
    ETABS,
    CATEGORIES,
    CALENDARS,
    DEFAULT_CALENDAR,
    MARQUE_CALENDARS,
    EVENTS,
    ABSENCES,
    FILTERS_STATE,
    LOCATION_STATE,
    MOBILE_DRAWER_STATE,
    TOAST_FN,
    EXPORT_ICS_FN,
    PAGE_TITLE_FN,
    DEBUG_ERROR_FN,
    UPDATE_MUTATE_ASYNC,
    mockFrom,
    builderState,
  }
})

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
    channel: vi.fn(() => ({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnThis(),
    })),
    removeChannel: vi.fn(),
  },
}))

vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => AUTH_STATE,
}))

vi.mock('@/hooks/shared/use-toast', () => ({
  useToast: () => ({ toast: TOAST_FN }),
}))

vi.mock('@/hooks/shared/usePageTitle', () => ({
  usePageTitle: PAGE_TITLE_FN,
}))

vi.mock('@/lib/debug', () => ({
  debug: {
    error: DEBUG_ERROR_FN,
    log: vi.fn(),
    warn: vi.fn(),
  },
}))

vi.mock('@/hooks/ui/use-mobile', () => ({
  useIsMobile: () => false,
}))

vi.mock('@/hooks/tasks/useTaches', () => ({
  useTaches: () => ({ data: TASKS, isLoading: false }),
  useUpdateTache: () => ({
    mutateAsync: UPDATE_MUTATE_ASYNC,
  }),
}))

vi.mock('@/hooks/profile/useProfiles', () => ({
  useProfiles: () => ({ data: PROFILES }),
}))

vi.mock('@/hooks/crm/useEtablissements', () => ({
  useEtablissements: () => ({ data: ETABS }),
}))

vi.mock('@/hooks/catalogue/useCategories', () => ({
  useCategories: () => ({ data: CATEGORIES }),
}))

vi.mock('@/hooks/calendar/useCalendarFilters', () => ({
  useCalendarFilters: () => ({
    filters: FILTERS_STATE.filters,
    updateFilters: vi.fn(),
    resetFilters: vi.fn(),
    hasActiveFilters: FILTERS_STATE.hasActiveFilters,
    filterTasks: (tasks: typeof TASKS) => tasks,
  }),
}))

vi.mock('@/hooks/calendar/useCalendarKeyboard', () => ({
  useCalendarKeyboard: vi.fn(),
}))

vi.mock('@/hooks/calendar/useCalendarAbsences', () => ({
  useCalendarAbsences: () => ({
    absences: ABSENCES,
    totalCount: ABSENCES.length,
  }),
}))

vi.mock('@/hooks/calendar/useCalendars', () => ({
  useCalendars: () => ({ data: CALENDARS }),
  useDefaultCalendar: () => ({ data: DEFAULT_CALENDAR }),
}))

vi.mock('@/hooks/bookings/useMarqueTeamCalendars', () => ({
  useMarqueTeamCalendars: () => ({ data: MARQUE_CALENDARS }),
}))

vi.mock('@/hooks/calendar/useCalendarEvents', () => ({
  useCalendarEvents: () => ({ data: EVENTS }),
}))

vi.mock('@/lib/calendarUtils', () => ({
  exportToICS: EXPORT_ICS_FN,
}))

vi.mock('@/contexts/MobileDrawerContext', () => ({
  useMobileDrawer: () => MOBILE_DRAWER_STATE,
}))

vi.mock('react-router-dom', () => ({
  useLocation: () => LOCATION_STATE,
}))

vi.mock('@/components/ui/card', () => ({
  Card: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardTitle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) => (
    <button onClick={onClick}>{children}</button>
  ),
}))

vi.mock('@/components/ui/tabs', () => ({
  Tabs: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TabsContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock('@/components/calendrier/CalendarFilters', () => ({
  CalendarFilters: () => <div data-testid="calendar-filters" />,
}))

vi.mock('@/components/calendrier/CalendarSidebar', () => ({
  CalendarSidebar: () => <div data-testid="calendar-sidebar" />,
}))

vi.mock('@/components/calendrier/CalendarContentToggle', () => ({
  ContentFilters: {},
}))

vi.mock('@/components/calendrier/CalendarUnifiedTimelineView', () => ({
  CalendarUnifiedTimelineView: () => <div data-testid="timeline-view" />,
}))

vi.mock('@/components/calendrier/CalendarAIInput', () => ({
  CalendarAIInput: () => <div data-testid="calendar-ai-input" />,
}))

vi.mock('@/components/calendrier/CalendarUnifiedMonthView', () => ({
  CalendarUnifiedMonthView: () => <div data-testid="month-view" />,
}))

vi.mock('@/components/calendrier/CalendarUnifiedAgendaView', () => ({
  CalendarUnifiedAgendaView: () => <div data-testid="agenda-view" />,
}))

vi.mock('@/components/calendrier/CalendarMobileDayView', () => ({
  CalendarMobileDayView: () => <div data-testid="mobile-day-view" />,
}))

vi.mock('@/components/calendrier/EventFormDialog', () => ({
  EventFormDialog: () => <div data-testid="event-form-dialog" />,
}))

vi.mock('@/components/etablissement-gantt/GanttAlerts', () => ({
  GanttAlerts: ({ tasks }: { tasks: typeof TASKS }) => (
    <div data-testid="gantt-alerts">alerts:{tasks.length}</div>
  ),
}))

vi.mock('@/components/calendrier/CalendarSyncSettings', () => ({
  CalendarSyncSettings: () => <div data-testid="calendar-sync-settings" />,
}))

vi.mock('@/components/calendrier/TaskQuickAdd', () => ({
  TaskQuickAdd: () => <div data-testid="task-quick-add" />,
}))

vi.mock('@/components/layout/ImmersivePageBackground', () => ({
  ImmersivePageBackground: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock('@/lib/utils', () => ({
  cn: (...values: Array<string | false | null | undefined>) => values.filter(Boolean).join(' '),
}))

vi.mock('lucide-react', () => ({
  Calendar: () => <span />,
  List: () => <span />,
  Filter: () => <span />,
  Clock: () => <span />,
  CalendarDays: () => <span />,
  GanttChart: () => <span />,
}))

vi.mock('@/components/calendrier/CalendarEmbeddedGantt', () => ({
  CalendarEmbeddedGantt: () => <div data-testid="embedded-gantt" />,
}))

vi.mock('@/pages/calendrier/CalendrierPageSections', () => ({
  CalendrierHero: ({
    taskCount,
    eventCount,
    absenceCount,
    establishmentTaskCount,
    onExport,
    onOpenMobileDrawer,
    onToggleEstablishmentTasks,
  }: {
    taskCount: number
    eventCount: number
    absenceCount: number
    establishmentTaskCount: number
    onExport: () => void
    onOpenMobileDrawer: () => void
    onToggleEstablishmentTasks: () => void
  }) => (
    <div>
      <div data-testid="hero-task-count">{String(taskCount)}</div>
      <div data-testid="hero-event-count">{String(eventCount)}</div>
      <div data-testid="hero-absence-count">{String(absenceCount)}</div>
      <div data-testid="hero-establishment-count">{String(establishmentTaskCount)}</div>
      <button onClick={onExport}>export</button>
      <button onClick={onOpenMobileDrawer}>open-drawer</button>
      <button onClick={onToggleEstablishmentTasks}>toggle-establishment</button>
    </div>
  ),
  CalendrierControlBar: ({
    showCalendarSidebar,
    activeView,
    currentDate,
  }: {
    showCalendarSidebar: boolean
    activeView: string
    currentDate: Date
  }) => (
    <div>
      <div data-testid="sidebar-visible">{String(showCalendarSidebar)}</div>
      <div data-testid="active-view">{activeView}</div>
      <div data-testid="current-date-type">{currentDate instanceof Date ? 'date' : 'other'}</div>
    </div>
  ),
  CalendrierTaskDetailsDialog: () => <div data-testid="task-details-dialog" />,
}))

function createClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  })
}

function renderWithClient() {
  const client = createClient()
  return render(
    <QueryClientProvider client={client}>
      <Calendrier />
    </QueryClientProvider>
  )
}

describe('Calendrier', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    builderState.mode = 'success'
    builderState.data = { role: 'admin' }
    builderState.error = null
    UPDATE_MUTATE_ASYNC.mockResolvedValue({ id: 't1' })
  })

  it('rend les compteurs métier attendus et initialise les préférences', async () => {
    renderWithClient()

    expect(PAGE_TITLE_FN).toHaveBeenCalledWith('Calendrier')

    expect(await screen.findByTestId('hero-task-count')).toHaveTextContent('2')
    expect(screen.getByTestId('hero-event-count')).toHaveTextContent('2')
    expect(screen.getByTestId('hero-absence-count')).toHaveTextContent('1')
    expect(screen.getByTestId('hero-establishment-count')).toHaveTextContent('1')
    expect(screen.getByTestId('sidebar-visible')).toHaveTextContent('true')
    expect(screen.getByTestId('active-view')).toHaveTextContent('timeline')
    expect(screen.getByTestId('current-date-type')).toHaveTextContent('date')
    expect(screen.getByTestId('calendar-ai-input')).toBeInTheDocument()
    expect(screen.getByTestId('gantt-alerts')).toHaveTextContent('alerts:2')

    await waitFor(() => {
      expect(localStorage.getItem('calendar-content-filters')).toContain('"showTasks":true')
      expect(localStorage.getItem('calendar-sidebar-visible')).toBe('true')
    })

    expect(mockFrom).toHaveBeenCalledWith('user_roles')
  })

  it('exporte les tâches affichées et ouvre le drawer mobile', async () => {
    renderWithClient()

    fireEvent.click(await screen.findByText('export'))

    expect(EXPORT_ICS_FN).toHaveBeenCalledTimes(1)
    expect(EXPORT_ICS_FN).toHaveBeenCalledWith(TASKS, 'Calendrier')
    expect(TOAST_FN).toHaveBeenCalledWith({
      title: 'Export réussi',
      description: 'Le fichier ICS a été téléchargé',
    })

    fireEvent.click(screen.getByText('open-drawer'))
    expect(MOBILE_DRAWER_STATE.setOpen).toHaveBeenCalledWith(true)
  })

  it('filtre les tâches établissement quand on bascule le toggle', async () => {
    renderWithClient()

    expect(await screen.findByTestId('hero-task-count')).toHaveTextContent('2')

    fireEvent.click(screen.getByText('toggle-establishment'))

    await waitFor(() => {
      expect(screen.getByTestId('hero-task-count')).toHaveTextContent('1')
      expect(screen.getByTestId('gantt-alerts')).toHaveTextContent('alerts:1')
    })

    const saved = localStorage.getItem('calendar-content-filters')
    expect(saved).toContain('"showEstablishmentTasks":false')
  })

  it('gère sans crash une réponse supabase en erreur sur le rôle', async () => {
    builderState.data = null
    builderState.error = { message: 'x' }

    renderWithClient()

    expect(await screen.findByTestId('hero-task-count')).toHaveTextContent('2')
    expect(mockFrom).toHaveBeenCalledWith('user_roles')
  })
})
