import { useState, useMemo, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Loader2, AlertCircle, Plus, CalendarX, GanttChart } from 'lucide-react'
import { ImmersivePageHeader } from '@/components/layout/ImmersivePageHeader'
import { GanttMobileHeader } from '@/components/global-gantt/GanttMobileHeader'
import { GanttControlsCompact } from '@/components/global-gantt/GanttControlsCompact'
import { GlobalSearchDialog } from '@/components/search/GlobalSearchDialog'
import { useIsMobile } from '@/hooks/ui/use-mobile'
import { format } from 'date-fns'
import { toast } from 'sonner'
import {
  useTaches,
  useUpdateTache,
  useArchiveTache,
  useDeleteTache,
  useDuplicateTache,
} from '@/hooks/tasks/useTaches'
import type { TacheData } from '@/lib/validations'
import type { EtablissementData } from '@/lib/validations'
import { useCategories } from '@/hooks/catalogue/useCategories'
import { useEtablissements } from '@/hooks/crm/useEtablissements'
import { useProfiles } from '@/hooks/profile/useProfiles'
import { useActiveProfilesWithRoles } from '@/hooks/profile/useProfilesWithRoles'
import { useTachesDocumentsCounts } from '@/hooks/tasks/useTachesDocumentsCounts'
import { useGanttZoom } from '@/components/etablissement-gantt/hooks/useGanttZoom'
import { useGanttVisibleDates } from '@/components/etablissement-gantt/hooks/useGanttVisibleDates'
import { useGanttFilters } from '@/components/etablissement-gantt/hooks/useGanttFilters'
import { useGanttDragDrop } from '@/components/etablissement-gantt/hooks/useGanttDragDrop'
import { useGanttResize } from '@/components/etablissement-gantt/hooks/useGanttResize'
import { useGanttExport } from '@/hooks/rd/useGanttExport'
import { computeGanttStats, computeGanttAlerts, buildGroupedTasks } from './globalGanttHelpers'
import { GanttControls } from '@/components/etablissement-gantt/GanttControls'
import { GanttRoleLegend } from '@/components/global-gantt/GanttRoleLegend'
import { GanttDesktopHeaderActions } from './GanttDesktopHeaderActions'
import { GanttUnplannedTasksAlert } from './GanttUnplannedTasksAlert'
import { GanttFiltersPanel } from '@/components/etablissement-gantt/GanttFilters'
import { TaskEditDialog } from '@/components/tasks/TaskEditDialog'
import { GanttTaskCreateDialog } from '@/components/etablissement-gantt/GanttTaskCreateDialog'
import { GanttDualLayout } from '@/components/etablissement-gantt/GanttDualLayout'
import { filterTasksByEstablishmentPhase } from '@/hooks/tasks/useTaskPhaseFilter'
import { expandAllRecurringTasks } from '@/lib/recurrenceUtils'
import { GanttFixedColumn, GanttScrollableCanvas, type GlobalGanttTask } from './GlobalGanttBody'

type GroupByOption = 'etablissement' | 'categorie' | 'responsable' | 'statut'
type SortField = 'date_debut' | 'echeance' | 'titre' | 'priorite' | 'statut' | 'responsable'
type SortDirection = 'asc' | 'desc'

export function GlobalGanttContainer() {
  const location = useLocation()
  const isMobile = useIsMobile()
  const showGlobalNav = !location.pathname.startsWith('/m/')

  const [showFilters, setShowFilters] = useState(false)
  const [selectedTask, setSelectedTask] = useState<TacheData | null>(null)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [heatmapEnabled, setHeatmapEnabled] = useState(false)
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set())
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [createTaskCategoryId, setCreateTaskCategoryId] = useState<string | undefined>()
  const [groupBy, setGroupBy] = useState<GroupByOption>('etablissement')
  const [sortField, setSortField] = useState<SortField>('date_debut')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')
  const [unplannedExpanded, setUnplannedExpanded] = useState(false)
  const [showGlobalSearch, setShowGlobalSearch] = useState(false)
  const [showAlertsDropdown, setShowAlertsDropdown] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const ganttContentRef = useRef<HTMLDivElement>(null)
  const scrollableRef = useRef<HTMLDivElement>(null)

  const toggleCategory = (categoryId: string) => {
    setCollapsedCategories((prev) => {
      const next = new Set(prev)
      if (next.has(categoryId)) {
        next.delete(categoryId)
      } else {
        next.add(categoryId)
      }
      return next
    })
  }

  // Charger les données
  const {
    data: allTasks,
    isLoading: isLoadingTasks,
    isError: isErrorTasks,
    refetch: refetchTasks,
  } = useTaches()
  const { data: etablissements } = useEtablissements()
  const { data: profiles } = useProfiles()
  const { data: profilesWithRoles } = useActiveProfilesWithRoles()
  const { data: categories } = useCategories()

  // Hooks pour les actions du menu contextuel
  const updateTache = useUpdateTache()
  const archiveTache = useArchiveTache()
  const deleteTache = useDeleteTache()
  const duplicateTache = useDuplicateTache()

  // Séparer les tâches avec dates et sans dates, et étendre les récurrences
  const { validTasks, unplannedTasks } = useMemo(() => {
    if (!allTasks) return { validTasks: [], unplannedTasks: [] }

    // First filter by phase based on establishment status
    const phaseFiltered =
      etablissements && etablissements.length > 0
        ? filterTasksByEstablishmentPhase(
            allTasks,
            etablissements.map((e: EtablissementData) => ({ id: e.id, statut: e.statut }))
          )
        : allTasks

    const nonArchived = phaseFiltered.filter((t: TacheData) => !t.archive)

    // Tâches planifiées (avec dates)
    const planned = nonArchived.filter((t: TacheData) => t.date_debut && t.echeance)

    // Étendre les tâches récurrentes sur 2 ans
    const now = new Date()
    const rangeStart = new Date(now.getFullYear() - 1, 0, 1) // 1 an avant
    const rangeEnd = new Date(now.getFullYear() + 2, 11, 31) // 2 ans après
    const expandedTasks = expandAllRecurringTasks(planned, rangeStart, rangeEnd)

    // Tâches non planifiées (sans dates)
    const unplanned = nonArchived.filter((t: TacheData) => !t.date_debut || !t.echeance)

    return { validTasks: expandedTasks, unplannedTasks: unplanned }
  }, [allTasks, etablissements])

  // Hook pour les compteurs de documents (batch query)
  const taskIds = useMemo(() => validTasks.map((t) => t.id), [validTasks])
  const { data: documentCounts } = useTachesDocumentsCounts(taskIds)

  // Map pour récupérer rapidement le rôle par profiles.id (car taches.responsable_id = profiles.id)
  const profileRoleMap = useMemo(() => {
    const map = new Map<string, string>()
    profilesWithRoles?.forEach((p) => {
      map.set(p.id, p.role)
    })
    return map
  }, [profilesWithRoles])

  // Hooks personnalisés
  const {
    zoomLevel,
    setZoomLevel,
    timeline,
    goToPrevious,
    goToNext,
    goToToday,
    getTodayPosition,
    navigateToDate,
  } = useGanttZoom(validTasks)

  const { visibleStart, visibleEnd } = useGanttVisibleDates(scrollableRef, timeline)

  // Pass etablissements to useGanttFilters for phase filtering
  const etablissementsForFilter = useMemo(
    () => etablissements?.map((e: any) => ({ id: e.id, statut: e.statut })) || [],
    [etablissements]
  )

  const {
    filters,
    filteredTasks,
    updateFilter,
    resetFilters,
    toggleQuickFilter,
    hasActiveFilters,
  } = useGanttFilters(validTasks, etablissementsForFilter)

  // Frontière de typage DEBT-01 : le moteur de filtres retourne des Task,
  // enrichies plus loin par les métadonnées Gantt/récurrence consommées par le rendu.
  const ganttFilteredTasks = filteredTasks as GlobalGanttTask[]

  const { sensors, draggedTaskId, handleDragStart, handleDragEnd } = useGanttDragDrop(
    timeline,
    ganttContentRef
  )

  const { resizingTask, handleResizeStart, getResizePreview } = useGanttResize(timeline, validTasks)

  const { exportToPNG, exportToPDF } = useGanttExport()

  // Calculer les statistiques
  const stats = useMemo(() => computeGanttStats(filteredTasks), [filteredTasks])

  const alerts = useMemo(() => computeGanttAlerts(filteredTasks), [filteredTasks])

  const groupedTasks = useMemo(
    () =>
      buildGroupedTasks({
        filteredTasks,
        groupBy,
        etablissements,
        categories,
        profiles,
        sortField,
        sortDirection,
      }),
    [filteredTasks, groupBy, etablissements, categories, profiles, sortField, sortDirection]
  )

  // Calculer la hauteur totale du Gantt (basé sur groupedTasks regroupées par récurrence)
  const totalHeight = useMemo(() => {
    return groupedTasks.reduce((acc, group) => {
      const isExpanded = !collapsedCategories.has(group.id)
      const categoryHeaderHeight = 40 // h-10
      // Use groupedTasks count for height calculation (recurring tasks = 1 line)
      const contentHeight = isExpanded
        ? (group.groupedTasks?.length || group.tasks.length) * 40 // h-10 par tâche groupée
        : 40 // h-10 pour le résumé
      return acc + categoryHeaderHeight + contentHeight
    }, 0)
  }, [groupedTasks, collapsedCategories])

  // Calculer la largeur dynamique du Gantt
  const ganttWidth = useMemo(() => {
    if (!timeline) return 1200

    const calculatedWidth = timeline.totalDays * timeline.pixelsPerDay

    const minWidthByZoom = {
      day: 1400,
      week: 2400,
      month: 2000,
      quarter: 1800,
      year: 1600,
    }

    const recommendedMin = minWidthByZoom[zoomLevel] || 1200

    return Math.max(calculatedWidth, recommendedMin)
  }, [timeline, zoomLevel])

  const handleTaskClick = (task: any) => {
    setSelectedTask(task)
    setIsEditDialogOpen(true)
  }

  // Handlers pour le menu contextuel
  const handleTaskDuplicate = (task: any) => {
    duplicateTache.mutate(task)
  }

  const handleTaskStatusChange = (taskId: string, status: string) => {
    const validStatut = status as 'A faire' | 'En cours' | 'Bloqué' | 'Terminé'
    updateTache.mutate({
      id: taskId,
      data: {
        statut: validStatut,
        ...(status === 'Terminé' ? { date_fin_reelle: new Date().toISOString() } : {}),
      },
    })
  }

  const handleTaskAssign = (taskId: string, responsableId: string) => {
    updateTache.mutate({ id: taskId, data: { responsable_id: responsableId } })
  }

  const handleTaskArchive = (task: any) => {
    archiveTache.mutate({ id: task.id, archive: !task.archive })
  }

  const handleTaskDelete = (taskId: string) => {
    deleteTache.mutate(taskId)
  }

  const handleExportPNG = async () => {
    if (!timeline) {
      toast.error("Impossible d'exporter : aucune timeline disponible")
      return
    }

    setIsExporting(true)
    try {
      await exportToPNG(
        ganttContentRef,
        {
          etablissementNom: 'Planning Global',
          tasks: filteredTasks,
          categories: categories || [],
          timeline: {
            start: timeline.start,
            end: timeline.end,
          },
        },
        `planning-global-${format(new Date(), 'yyyy-MM-dd')}.png`
      )
    } finally {
      setIsExporting(false)
    }
  }

  const handleExportPDF = async () => {
    if (!timeline) {
      toast.error("Impossible d'exporter : aucune timeline disponible")
      return
    }

    setIsExporting(true)
    try {
      await exportToPDF(
        ganttContentRef,
        {
          etablissementNom: 'Planning Global',
          tasks: filteredTasks,
          categories: categories || [],
          timeline: {
            start: timeline.start,
            end: timeline.end,
          },
        },
        `planning-global-${format(new Date(), 'yyyy-MM-dd')}.pdf`
      )
    } finally {
      setIsExporting(false)
    }
  }

  if (isErrorTasks) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4">
        <AlertCircle className="h-10 w-10 text-destructive" />
        <p className="text-muted-foreground">Erreur lors du chargement du planning</p>
        <Button variant="outline" onClick={() => refetchTasks()}>
          Réessayer
        </Button>
      </div>
    )
  }

  if (isLoadingTasks) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-3 text-muted-foreground">Chargement du planning...</span>
      </div>
    )
  }

  if (!validTasks || validTasks.length === 0) {
    return (
      <div className="min-h-dvh bg-gradient-page flex flex-col items-center justify-center p-8">
        <CalendarX className="h-16 w-16 text-muted-foreground/40 mb-4" />
        <h2 className="text-lg font-semibold text-foreground mb-2">Aucune tâche planifiée</h2>
        <p className="text-sm text-muted-foreground mb-1">
          {allTasks && allTasks.length > 0
            ? `${allTasks.length} tâche(s) existent mais n'ont pas de dates (début/échéance) définies.`
            : 'Créez des tâches avec des dates pour les voir apparaître dans le Gantt.'}
        </p>
        {unplannedTasks.length > 0 && (
          <p className="text-xs text-muted-foreground mt-1">
            {unplannedTasks.length} tâche(s) sans dates — ajoutez-leur des dates pour les planifier.
          </p>
        )}
        <Button
          variant="outline"
          size="sm"
          className="mt-4"
          onClick={() => setIsCreateDialogOpen(true)}
        >
          <Plus className="h-4 w-4 mr-2" />
          Créer une tâche
        </Button>
        {/* Audit run-1781711522 : le dialog doit être monté ici aussi sinon le clic
            empty-state ne fait rien (return anticipé avant le rendu principal). */}
        <GanttTaskCreateDialog
          isOpen={isCreateDialogOpen}
          onClose={() => {
            setIsCreateDialogOpen(false)
            setCreateTaskCategoryId(undefined)
          }}
          etablissementId={allTasks?.[0]?.etablissement_id || ''}
          defaultCategoryId={createTaskCategoryId}
        />
      </div>
    )
  }

  if (!timeline) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground">Impossible de générer la timeline</p>
        </CardContent>
      </Card>
    )
  }

  const todayPosition = getTodayPosition()

  // Mobile toolbar for header
  const mobileToolbar = (
    <GanttControlsCompact
      zoomLevel={zoomLevel}
      onZoomChange={setZoomLevel}
      groupBy={groupBy}
      onGroupByChange={setGroupBy}
      sortField={sortField}
      onSortFieldChange={setSortField}
    />
  )

  return (
    <div className="min-h-dvh bg-gradient-page flex flex-col">
      {/* Header - Mobile or Desktop */}
      {isMobile ? (
        <GanttMobileHeader
          stats={{
            total: stats.total,
            completed: stats.completed,
            overdue: stats.overdue,
            completionRate: stats.completionRate,
          }}
          alertsCount={alerts.length}
          hasWarnings={alerts.some((a) => a.type === 'critical')}
          onSearchClick={() => setShowGlobalSearch(true)}
          onCreateTask={() => setIsCreateDialogOpen(true)}
          onOpenAlerts={() => setShowAlertsDropdown(true)}
          toolbar={mobileToolbar}
          showGlobalNav={showGlobalNav}
        />
      ) : (
        <ImmersivePageHeader
          title="Planning Gantt"
          subtitle={`${stats.total} tâches planifiées`}
          icon={GanttChart}
          stats={[
            { label: 'progression', value: `${stats.completionRate}%`, highlight: true },
            ...(stats.overdue > 0 ? [{ label: 'retard', value: stats.overdue }] : []),
            { label: 'en cours', value: stats.inProgress },
          ]}
          searchPlaceholder="Rechercher tâches..."
          onSearchClick={() => setShowGlobalSearch(true)}
          actions={
            <GanttDesktopHeaderActions
              alerts={alerts}
              groupBy={groupBy}
              onGroupByChange={setGroupBy}
              sortField={sortField}
              onSortFieldChange={setSortField}
              sortDirection={sortDirection}
              onSortDirectionToggle={() =>
                setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'))
              }
              onCreateTask={() => setIsCreateDialogOpen(true)}
            />
          }
        />
      )}

      {/* Global Search Dialog */}
      <GlobalSearchDialog open={showGlobalSearch} setOpen={setShowGlobalSearch} hideTrigger />

      {/* Alerte tâches non planifiées - compact */}
      <GanttUnplannedTasksAlert
        unplannedTasks={unplannedTasks}
        expanded={unplannedExpanded}
        onExpandedChange={setUnplannedExpanded}
        onTaskClick={handleTaskClick}
      />

      {/* Card principale */}
      <Card className="flex flex-col overflow-hidden flex-1 mx-2 mb-2 mt-2 border-primary/10 bg-card/80 backdrop-blur-sm shadow-lg">
        <CardContent className="p-0 flex-1 overflow-hidden flex flex-col">
          {/* Contrôles compacts */}
          <GanttControls
            zoomLevel={zoomLevel}
            onZoomChange={setZoomLevel}
            onPrevious={goToPrevious}
            onNext={goToNext}
            onToday={goToToday}
            onToggleFilters={() => setShowFilters(!showFilters)}
            onExportPNG={handleExportPNG}
            onExportPDF={handleExportPDF}
            isExporting={isExporting}
            hasActiveFilters={hasActiveFilters}
            quickFilters={filters.quickFilters}
            onToggleQuickFilter={(key) => toggleQuickFilter(key as any)}
            visiblePeriod={timeline ? { start: timeline.start, end: timeline.end } : undefined}
            onToggleHeatmap={() => setHeatmapEnabled(!heatmapEnabled)}
            heatmapEnabled={heatmapEnabled}
            onCreateTask={() => setIsCreateDialogOpen(true)}
          />

          {/* Légende des rôles */}
          <div className="px-4 py-2 border-b border-primary/10 bg-marque-papier">
            <GanttRoleLegend />
          </div>

          {/* Contenu principal avec layout deux colonnes */}
          <div className="flex flex-1 overflow-hidden" ref={ganttContentRef}>
            {/* Panneau de filtres optionnel */}
            {showFilters && (
              <GanttFiltersPanel
                filters={filters}
                onFilterChange={updateFilter}
                onReset={resetFilters}
                categories={categories || []}
                etablissements={etablissements || []}
                responsables={profiles || []}
                statuts={['A faire', 'En cours', 'Bloqué', 'Terminé']}
                priorites={['low', 'medium', 'high']}
              />
            )}

            {/* Zone de Gantt avec GanttDualLayout */}
            <div className="flex-1 flex flex-col overflow-hidden">
              <GanttDualLayout
                leftColumnWidth={220}
                scrollableRef={scrollableRef}
                fixedContent={
                  <GanttFixedColumn
                    groupedTasks={groupedTasks}
                    collapsedCategories={collapsedCategories}
                    toggleCategory={toggleCategory}
                    onTaskClick={handleTaskClick}
                    zoomLevel={zoomLevel}
                  />
                }
                scrollableContent={
                  <GanttScrollableCanvas
                    groupedTasks={groupedTasks}
                    collapsedCategories={collapsedCategories}
                    filteredTasks={ganttFilteredTasks}
                    timeline={timeline}
                    zoomLevel={zoomLevel}
                    ganttWidth={ganttWidth}
                    totalHeight={totalHeight}
                    todayPosition={todayPosition}
                    heatmapEnabled={heatmapEnabled}
                    draggedTaskId={draggedTaskId}
                    resizingTask={resizingTask}
                    sensors={sensors}
                    documentCounts={documentCounts}
                    profiles={profiles || []}
                    profileRoleMap={profileRoleMap}
                    scrollableRef={scrollableRef}
                    onDragStart={handleDragStart}
                    onDragEnd={handleDragEnd}
                    handleResizeStart={(id, handle, container, startX) =>
                      handleResizeStart(id, handle, container, startX)
                    }
                    onTaskClick={handleTaskClick}
                    onTaskDuplicate={handleTaskDuplicate}
                    onTaskStatusChange={handleTaskStatusChange}
                    onTaskAssign={handleTaskAssign}
                    onTaskArchive={handleTaskArchive}
                    onTaskDelete={handleTaskDelete}
                  />
                }
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Dialogs */}
      {selectedTask && (
        <TaskEditDialog
          tache={selectedTask}
          open={isEditDialogOpen}
          onOpenChange={(open) => {
            if (!open) {
              setIsEditDialogOpen(false)
              setSelectedTask(null)
            }
          }}
        />
      )}

      <GanttTaskCreateDialog
        isOpen={isCreateDialogOpen}
        onClose={() => {
          setIsCreateDialogOpen(false)
          setCreateTaskCategoryId(undefined)
        }}
        etablissementId={filteredTasks[0]?.etablissement_id || ''}
        defaultCategoryId={createTaskCategoryId}
      />
    </div>
  )
}
