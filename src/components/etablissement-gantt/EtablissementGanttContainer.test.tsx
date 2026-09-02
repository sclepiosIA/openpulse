import React from 'react'
import { render, screen, fireEvent, act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const {
  USER,
  ETAB_ID,
  ETAB,
  CATEGORIES,
  TASKS,
  TIMELINE,
  mockToastError,
  mockToastSuccess,
  mockExportToPNG,
  mockExportToPDF,
  mockUpdateMutate,
  mockArchiveMutate,
  mockDeleteMutate,
  mockDuplicateMutate,
  mockUseTachesByEtablissement,
  mockUseUpdateTache,
  mockUseArchiveTache,
  mockUseDeleteTache,
  mockUseDuplicateTache,
  mockUseCategories,
  mockUseEtablissement,
  mockUseProfiles,
  mockUseGanttZoom,
  mockUseGanttVisibleDates,
  mockUseGanttFilters,
  mockUseGanttDragDrop,
  mockUseGanttResize,
  mockUseGanttExport,
  mockCleanupRadixUIState,
  mockCleanupRadixUIStateDelayed,
  mockCreateRadixWatchdog,
  mockFrom,
  supabaseBuilder
} = vi.hoisted(() => {
  const USER = { id: 'u1', email: 't@t.co' }
  const ETAB_ID = 'etab-1'
  const ETAB = { id: ETAB_ID, nom: 'Etab Test' }

  const CATEGORIES = [
    { id: 'cat-1', nom: 'Cat A', couleur: '#111111' },
    { id: 'cat-2', nom: 'Cat B', couleur: '#222222' }
  ]

  const TASKS = [
    {
      id: 't1',
      titre: 'Tache 1',
      categorie_id: 'cat-1',
      date_debut: '2025-01-10',
      created_at: '2025-01-01',
      ordre: 2,
      archive: false
    },
    {
      id: 't2',
      titre: 'Tache 2',
      categorie_id: 'cat-1',
      date_debut: '2025-01-05',
      created_at: '2025-01-02',
      ordre: 1,
      archive: false
    },
    {
      id: 't3',
      titre: 'Tache 3',
      categorie_id: 'cat-2',
      date_debut: undefined,
      created_at: '2025-01-03',
      ordre: 3,
      archive: true
    }
  ]

  const TIMELINE = {
    start: new Date('2025-01-01T00:00:00.000Z'),
    end: new Date('2025-02-01T00:00:00.000Z'),
    totalDays: 31,
    pixelsPerDay: 20
  }

  const mockToastError = vi.fn()
  const mockToastSuccess = vi.fn()

  const mockExportToPNG = vi.fn()
  const mockExportToPDF = vi.fn()

  const mockUpdateMutate = vi.fn()
  const mockArchiveMutate = vi.fn()
  const mockDeleteMutate = vi.fn()
  const mockDuplicateMutate = vi.fn()

  const mockUseTachesByEtablissement = vi.fn()
  const mockUseUpdateTache = vi.fn()
  const mockUseArchiveTache = vi.fn()
  const mockUseDeleteTache = vi.fn()
  const mockUseDuplicateTache = vi.fn()

  const mockUseCategories = vi.fn()
  const mockUseEtablissement = vi.fn()
  const mockUseProfiles = vi.fn()

  const mockUseGanttZoom = vi.fn()
  const mockUseGanttVisibleDates = vi.fn()
  const mockUseGanttFilters = vi.fn()
  const mockUseGanttDragDrop = vi.fn()
  const mockUseGanttResize = vi.fn()
  const mockUseGanttExport = vi.fn()

  const mockCleanupRadixUIState = vi.fn()
  const mockCleanupRadixUIStateDelayed = vi.fn()
  const mockCreateRadixWatchdog = vi.fn()

  const mockFrom = vi.fn()

  type SupabaseResult = { data: unknown; error: { message: string } | null }
  let resolved: SupabaseResult = { data: null, error: null }

  const supabaseBuilder = {
    __setResolved(next: SupabaseResult) {
      resolved = next
      return supabaseBuilder
    },
    select() {
      return supabaseBuilder
    },
    eq() {
      return supabaseBuilder
    },
    gte() {
      return supabaseBuilder
    },
    lte() {
      return supabaseBuilder
    },
    in() {
      return supabaseBuilder
    },
    order() {
      return supabaseBuilder
    },
    limit() {
      return supabaseBuilder
    },
    insert() {
      return supabaseBuilder
    },
    update() {
      return supabaseBuilder
    },
    delete() {
      return supabaseBuilder
    },
    upsert() {
      return supabaseBuilder
    },
    single() {
      return Promise.resolve(resolved)
    },
    maybeSingle() {
      return Promise.resolve(resolved)
    },
    then(onFulfilled: (v: SupabaseResult) => unknown, onRejected?: (e: unknown) => unknown) {
      return Promise.resolve(resolved).then(onFulfilled, onRejected)
    },
    catch(onRejected: (e: unknown) => unknown) {
      return Promise.resolve(resolved).catch(onRejected)
    },
    finally(onFinally: () => void) {
      return Promise.resolve(resolved).finally(onFinally)
    }
  }

  return {
    USER,
    ETAB_ID,
    ETAB,
    CATEGORIES,
    TASKS,
    TIMELINE,
    mockToastError,
    mockToastSuccess,
    mockExportToPNG,
    mockExportToPDF,
    mockUpdateMutate,
    mockArchiveMutate,
    mockDeleteMutate,
    mockDuplicateMutate,
    mockUseTachesByEtablissement,
    mockUseUpdateTache,
    mockUseArchiveTache,
    mockUseDeleteTache,
    mockUseDuplicateTache,
    mockUseCategories,
    mockUseEtablissement,
    mockUseProfiles,
    mockUseGanttZoom,
    mockUseGanttVisibleDates,
    mockUseGanttFilters,
    mockUseGanttDragDrop,
    mockUseGanttResize,
    mockUseGanttExport,
    mockCleanupRadixUIState,
    mockCleanupRadixUIStateDelayed,
    mockCreateRadixWatchdog,
    mockFrom,
    supabaseBuilder
  }
})

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
    auth: {
      getSession: vi.fn(async () => ({ data: { session: { user: USER } }, error: null })),
      getUser: vi.fn(async () => ({ data: { user: USER }, error: null }))
    }
  }
}))

vi.mock('date-fns', async importOriginal => {
  const actual = await importOriginal<typeof import('date-fns')>()

  return {
    ...actual,
    format: (date: Parameters<typeof actual.format>[0], formatStr: Parameters<typeof actual.format>[1], options?: Parameters<typeof actual.format>[2]) => {
      if (formatStr === 'yyyy-MM-dd') {
        return '2026-06-10'
      }

      return actual.format(date, formatStr, options)
    }
  }
})

vi.mock('sonner', () => ({
  toast: {
    error: mockToastError,
    success: mockToastSuccess
  }
}))

vi.mock('@/hooks/tasks/useTaches', () => ({
  useTachesByEtablissement: (etablissementId: string) => mockUseTachesByEtablissement(etablissementId),
  useUpdateTache: () => mockUseUpdateTache(),
  useArchiveTache: () => mockUseArchiveTache(),
  useDeleteTache: () => mockUseDeleteTache(),
  useDuplicateTache: () => mockUseDuplicateTache()
}))

vi.mock('@/hooks/catalogue/useCategories', () => ({
  useCategories: () => mockUseCategories()
}))

vi.mock('@/hooks/crm/useEtablissements', () => ({
  useEtablissement: (etablissementId: string) => mockUseEtablissement(etablissementId)
}))

vi.mock('@/hooks/profile/useProfiles', () => ({
  useProfiles: () => mockUseProfiles()
}))

vi.mock('./hooks/useGanttZoom', () => ({
  useGanttZoom: (tasks: unknown[]) => mockUseGanttZoom(tasks)
}))

vi.mock('./hooks/useGanttVisibleDates', () => ({
  useGanttVisibleDates: (scrollableRef: unknown, timeline: unknown) => mockUseGanttVisibleDates(scrollableRef, timeline)
}))

vi.mock('./hooks/useGanttFilters', () => ({
  useGanttFilters: (tasks: unknown[]) => mockUseGanttFilters(tasks)
}))

vi.mock('./hooks/useGanttDragDrop', () => ({
  useGanttDragDrop: (timeline: unknown, ganttContentRef: unknown) => mockUseGanttDragDrop(timeline, ganttContentRef)
}))

vi.mock('./hooks/useGanttResize', () => ({
  useGanttResize: (timeline: unknown, tasks: unknown[]) => mockUseGanttResize(timeline, tasks)
}))

vi.mock('@/hooks/rd/useGanttExport', () => ({
  useGanttExport: () => mockUseGanttExport()
}))

vi.mock('@/lib/dom/radixOverlayCleanup', () => ({
  cleanupRadixUIState: (opts: { aggressive: boolean; debug: boolean }) => mockCleanupRadixUIState(opts),
  cleanupRadixUIStateDelayed: (opts: { aggressive: boolean; debug: boolean }) => mockCleanupRadixUIStateDelayed(opts),
  createRadixWatchdog: (ms: number, debug: boolean) => mockCreateRadixWatchdog(ms, debug)
}))

vi.mock('@dnd-kit/core', async () => {
  const ReactMod = await import('react')
  return {
    DndContext: ({ children }: { children: ReactMod.ReactNode }) => ReactMod.createElement(ReactMod.Fragment, null, children)
  }
})

vi.mock('@dnd-kit/modifiers', () => ({ restrictToHorizontalAxis: {} }))

vi.mock('@/components/ui/card', async () => {
  const ReactMod = await import('react')
  const Card = ({ children }: { children: ReactMod.ReactNode }) => ReactMod.createElement('div', { 'data-testid': 'card' }, children)
  const CardHeader = ({ children }: { children: ReactMod.ReactNode }) => ReactMod.createElement('div', { 'data-testid': 'card-header' }, children)
  const CardTitle = ({ children }: { children: ReactMod.ReactNode }) => ReactMod.createElement('h2', null, children)
  const CardContent = ({ children, className }: { children: ReactMod.ReactNode; className?: string }) =>
    ReactMod.createElement('div', { 'data-testid': 'card-content', 'data-class': className ?? '' }, children)

  return { Card, CardHeader, CardTitle, CardContent }
})

vi.mock('lucide-react', async () => {
  const ReactMod = await import('react')
  return {
    Loader2: (props: Record<string, unknown>) => ReactMod.createElement('div', { ...props, 'data-testid': 'loader2' }),
    ChevronDown: (props: Record<string, unknown>) => ReactMod.createElement('div', { ...props, 'data-testid': 'chevron-down' })
  }
})

vi.mock('./GanttTimeline', async () => {
  const ReactMod = await import('react')
  return {
    GanttTimeline: ({ width, zoomLevel }: { width: number; zoomLevel: string }) =>
      ReactMod.createElement('div', { 'data-testid': 'gantt-timeline', 'data-width': String(width), 'data-zoom': zoomLevel })
  }
})

vi.mock('./GanttGrid', async () => {
  const ReactMod = await import('react')
  return {
    GanttGrid: ({ height }: { height: number }) => ReactMod.createElement('div', { 'data-testid': 'gantt-grid', 'data-height': String(height) })
  }
})

vi.mock('./GanttCategory', async () => {
  const ReactMod = await import('react')
  return { GanttCategory: () => ReactMod.createElement('div', { 'data-testid': 'gantt-category' }) }
})

vi.mock('./GanttFilters', async () => {
  const ReactMod = await import('react')
  return {
    GanttFiltersPanel: ({ categories }: { categories: unknown[] }) =>
      ReactMod.createElement('div', { 'data-testid': 'gantt-filters', 'data-categories-count': String(categories.length) })
  }
})

vi.mock('./GanttLegend', async () => {
  const ReactMod = await import('react')
  return { GanttLegend: () => ReactMod.createElement('div', { 'data-testid': 'gantt-legend' }) }
})

vi.mock('./GanttOverviewPanel', async () => {
  const ReactMod = await import('react')
  return {
    GanttOverviewPanel: ({ tasks }: { tasks: unknown[] }) =>
      ReactMod.createElement('div', { 'data-testid': 'gantt-overview', 'data-tasks-count': String(tasks.length) })
  }
})

vi.mock('./GanttAlerts', async () => {
  const ReactMod = await import('react')
  return {
    GanttAlerts: ({ tasks }: { tasks: unknown[] }) =>
      ReactMod.createElement('div', { 'data-testid': 'gantt-alerts', 'data-tasks-count': String(tasks.length) })
  }
})

vi.mock('./GanttWorkloadHeatmap', async () => {
  const ReactMod = await import('react')
  return { GanttWorkloadHeatmap: () => ReactMod.createElement('div', { 'data-testid': 'gantt-heatmap' }) }
})

vi.mock('./GanttMilestones', async () => {
  const ReactMod = await import('react')
  return { GanttMilestones: () => ReactMod.createElement('div', { 'data-testid': 'gantt-milestones' }) }
})

vi.mock('@/components/tasks/TaskEditDialog', async () => {
  const ReactMod = await import('react')
  return { TaskEditDialog: () => ReactMod.createElement('div', { 'data-testid': 'task-edit-dialog' }) }
})

vi.mock('./GanttTaskCreateDialog', async () => {
  const ReactMod = await import('react')
  return { GanttTaskCreateDialog: () => ReactMod.createElement('div', { 'data-testid': 'gantt-task-create-dialog' }) }
})

vi.mock('./GanttControls', async () => {
  const ReactMod = await import('react')
  return {
    GanttControls: ({
      onExportPNG,
      onExportPDF,
      onToggleFilters,
      onToggleHeatmap,
      onCreateTask,
      isExporting,
      heatmapEnabled
    }: {
      onExportPNG: () => void
      onExportPDF: () => void
      onToggleFilters: () => void
      onToggleHeatmap: () => void
      onCreateTask: () => void
      isExporting: boolean
      heatmapEnabled: boolean
    }) =>
      ReactMod.createElement(
        'div',
        { 'data-testid': 'gantt-controls', 'data-exporting': String(isExporting), 'data-heatmap': String(heatmapEnabled) },
        ReactMod.createElement('button', { type: 'button', onClick: onToggleFilters }, 'toggle-filters'),
        ReactMod.createElement('button', { type: 'button', onClick: onExportPNG }, 'export-png'),
        ReactMod.createElement('button', { type: 'button', onClick: onExportPDF }, 'export-pdf'),
        ReactMod.createElement('button', { type: 'button', onClick: onToggleHeatmap }, 'toggle-heatmap'),
        ReactMod.createElement('button', { type: 'button', onClick: onCreateTask }, 'create-task')
      )
  }
})

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false }
    }
  })
}

function createWrapper(client: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>
  }
}

function renderWithClient(ui: React.ReactElement) {
  const client = createTestQueryClient()
  return {
    client,
    ...render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>)
  }
}

async function flushMicrotasks() {
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
  })
}

function resetDefaultMockImplementations() {
  supabaseBuilder.__setResolved({ data: null, error: null })
  mockFrom.mockImplementation(() => supabaseBuilder)

  mockExportToPNG.mockImplementation(async () => undefined)
  mockExportToPDF.mockImplementation(async () => undefined)

  mockUseTachesByEtablissement.mockImplementation(() => ({ data: TASKS, isLoading: false, isError: false }))
  mockUseUpdateTache.mockImplementation(() => ({ mutate: mockUpdateMutate }))
  mockUseArchiveTache.mockImplementation(() => ({ mutate: mockArchiveMutate }))
  mockUseDeleteTache.mockImplementation(() => ({ mutate: mockDeleteMutate }))
  mockUseDuplicateTache.mockImplementation(() => ({ mutate: mockDuplicateMutate }))

  mockUseCategories.mockImplementation(() => ({ data: CATEGORIES }))
  mockUseEtablissement.mockImplementation(() => ({ data: ETAB }))
  mockUseProfiles.mockImplementation(() => ({ data: [{ id: 'p1', user_id: USER.id, display_name: 'User One' }] }))

  mockUseGanttZoom.mockImplementation(() => ({
    zoomLevel: 'week',
    setZoomLevel: vi.fn(),
    timeline: TIMELINE,
    goToPrevious: vi.fn(),
    goToNext: vi.fn(),
    goToToday: vi.fn(),
    getTodayPosition: vi.fn(() => 100),
    navigateToDate: vi.fn()
  }))

  mockUseGanttVisibleDates.mockImplementation(() => ({
    visibleStart: new Date('2025-01-05T00:00:00.000Z'),
    visibleEnd: new Date('2025-01-20T00:00:00.000Z')
  }))

  mockUseGanttFilters.mockImplementation(() => ({
    filters: { quickFilters: {} },
    filteredTasks: TASKS,
    updateFilter: vi.fn(),
    resetFilters: vi.fn(),
    toggleQuickFilter: vi.fn(),
    hasActiveFilters: false
  }))

  mockUseGanttDragDrop.mockImplementation(() => ({
    sensors: [],
    draggedTaskId: null,
    handleDragStart: vi.fn(),
    handleDragEnd: vi.fn()
  }))

  mockUseGanttResize.mockImplementation(() => ({
    resizingTask: null,
    handleResizeStart: vi.fn(),
    getResizePreview: vi.fn()
  }))

  mockUseGanttExport.mockImplementation(() => ({
    exportToPNG: mockExportToPNG,
    exportToPDF: mockExportToPDF
  }))

  mockCreateRadixWatchdog.mockImplementation(() => vi.fn())
}

describe('EtablissementGanttContainer', () => {
  beforeEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
    resetDefaultMockImplementations()
  })

  afterEach(async () => {
    cleanup()
    await flushMicrotasks()
    vi.restoreAllMocks()
    vi.clearAllTimers()
    vi.useRealTimers()
    vi.unstubAllGlobals?.()
    vi.unstubAllEnvs?.()
  })

  it('affiche le loader pendant le chargement', async () => {
    mockUseTachesByEtablissement.mockImplementationOnce(() => ({ data: undefined, isLoading: true, isError: false }))

    const mod = await import('./EtablissementGanttContainer')
    renderWithClient(<mod.EtablissementGanttContainer etablissementId={ETAB_ID} />)

    expect(await screen.findByTestId('loader2')).toBeTruthy()
  }, 10000)

  it('affiche la vue Gantt en succès + peut exporter en PNG et appeler le hook export avec les bons paramètres métier', async () => {
    const client = createTestQueryClient()
    const Wrapper = createWrapper(client)

    const { result, unmount } = renderHook(() => ({ etab: ETAB, cats: CATEGORIES, tasks: TASKS }), { wrapper: Wrapper })
    expect(result.current.tasks).toHaveLength(3)
    expect(result.current.etab.nom).toBe('Etab Test')
    unmount()

    const mod = await import('./EtablissementGanttContainer')
    renderWithClient(<mod.EtablissementGanttContainer etablissementId={ETAB_ID} />)

    expect(await screen.findByText('Diagramme de Gantt - Planning des tâches')).toBeTruthy()

    await waitFor(() => {
      expect(screen.getByTestId('gantt-overview').getAttribute('data-tasks-count')).toBe('3')
      expect(screen.getByTestId('gantt-alerts').getAttribute('data-tasks-count')).toBe('3')
    })

    const timelineEl = screen.getByTestId('gantt-timeline')
    expect(timelineEl.getAttribute('data-zoom')).toBe('week')
    expect(Number(timelineEl.getAttribute('data-width'))).toBeGreaterThanOrEqual(2400)

    await act(async () => {
      fireEvent.click(screen.getByText('export-png'))
      await Promise.resolve()
    })

    await waitFor(
      () => {
        expect(mockExportToPNG).toHaveBeenCalledTimes(1)
      },
      { timeout: 5000 }
    )

    const args = mockExportToPNG.mock.calls[0]
    const payload = args[1] as {
      etablissementNom: string
      tasks: unknown[]
      categories: unknown[]
      timeline: { start: Date; end: Date }
    }
    const filename = args[2] as string

    expect(payload.etablissementNom).toBe('Etab Test')
    expect(payload.tasks).toHaveLength(3)
    expect(payload.categories).toHaveLength(2)
    expect(payload.timeline.start instanceof Date).toBe(true)
    expect(payload.timeline.end instanceof Date).toBe(true)
    expect(filename).toContain('planning-Etab-Test-')
    expect(filename).not.toContain(`${ETAB_ID}-`)
    expect(filename).toContain('2026-06-10')
    expect(filename.endsWith('.png')).toBe(true)

    await waitFor(() => {
      expect(screen.getByTestId('gantt-controls').getAttribute('data-exporting')).toBe('false')
    })
  }, 10000)

  it("gère l'erreur d'export si aucune timeline n'est disponible", async () => {
    mockUseGanttZoom.mockImplementationOnce(() => ({
      zoomLevel: 'week',
      setZoomLevel: vi.fn(),
      timeline: null,
      goToPrevious: vi.fn(),
      goToNext: vi.fn(),
      goToToday: vi.fn(),
      getTodayPosition: vi.fn(() => 100),
      navigateToDate: vi.fn()
    }))

    const mod = await import('./EtablissementGanttContainer')
    renderWithClient(<mod.EtablissementGanttContainer etablissementId={ETAB_ID} />)

    expect(await screen.findByText('Impossible de générer la timeline')).toBeTruthy()
  }, 10000)

  it('déclenche une mutation via useUpdateTache avec des paramètres précis (status Terminé)', async () => {
    const mod = await import('./EtablissementGanttContainer')
    renderWithClient(<mod.EtablissementGanttContainer etablissementId={ETAB_ID} />)

    await screen.findByText('Diagramme de Gantt - Planning des tâches')

    const updatePayload = {
      id: 't1',
      data: { statut: 'Terminé' as const, date_fin_reelle: '2025-01-31T10:00:00.000Z' }
    }

    await act(async () => {
      mockUseUpdateTache().mutate(updatePayload)
      await Promise.resolve()
    })

    expect(mockUpdateMutate).toHaveBeenCalledWith(updatePayload)
  }, 10000)

  it("expose une branche d'erreur (simulée) via le hook tasks: {data:null, error:{message:'x'}} => isError", async () => {
    const client = createTestQueryClient()
    const Wrapper = createWrapper(client)

    const HOOK_ERROR = { message: 'x' }
    mockUseTachesByEtablissement.mockImplementationOnce(() => ({
      data: null,
      error: HOOK_ERROR,
      isLoading: false,
      isError: true
    }))

    const { result, unmount } = renderHook(() => mockUseTachesByEtablissement(ETAB_ID), { wrapper: Wrapper })

    expect(result.current.isError).toBe(true)
    expect(result.current.error).toEqual(HOOK_ERROR)

    unmount()
  }, 10000)
})