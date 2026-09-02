import { useEffect, useState, useMemo, useRef } from 'react'
import { DndContext } from '@dnd-kit/core'
import { restrictToHorizontalAxis } from '@dnd-kit/modifiers'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, ChevronDown } from 'lucide-react'
import { format } from 'date-fns'
import { toast } from 'sonner'
import {
  useTachesByEtablissement,
  useUpdateTache,
  useArchiveTache,
  useDeleteTache,
  useDuplicateTache,
} from '@/hooks/tasks/useTaches'
import { useCategories } from '@/hooks/catalogue/useCategories'
import { useEtablissement } from '@/hooks/crm/useEtablissements'
import { useProfiles } from '@/hooks/profile/useProfiles'
import { useGanttZoom } from './hooks/useGanttZoom'
import { useGanttVisibleDates } from './hooks/useGanttVisibleDates'
import { useGanttFilters } from './hooks/useGanttFilters'
import { useGanttDragDrop } from './hooks/useGanttDragDrop'
import { useGanttResize } from './hooks/useGanttResize'
import { useGanttExport } from '@/hooks/rd/useGanttExport'
import { GanttTimeline } from './GanttTimeline'
import { GanttGrid } from './GanttGrid'
import { GanttCategory } from './GanttCategory'
import { GanttControls } from './GanttControls'
import { GanttFiltersPanel } from './GanttFilters'
import { GanttLegend } from './GanttLegend'
import { GanttOverviewPanel } from './GanttOverviewPanel'

import { GanttAlerts } from './GanttAlerts'
import { GanttWorkloadHeatmap } from './GanttWorkloadHeatmap'
import { GanttMilestones } from './GanttMilestones'
import { TaskEditDialog } from '@/components/tasks/TaskEditDialog'
import { GanttTaskCreateDialog } from './GanttTaskCreateDialog'

interface EtablissementGanttContainerProps {
  etablissementId: string
}

export function EtablissementGanttContainer({ etablissementId }: EtablissementGanttContainerProps) {
  const [showFilters, setShowFilters] = useState(false)
  const [selectedTask, setSelectedTask] = useState<any | null>(null)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [heatmapEnabled, setHeatmapEnabled] = useState(false)
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set())
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [createTaskCategoryId, setCreateTaskCategoryId] = useState<string | undefined>()
  const containerRef = useRef<HTMLDivElement>(null)
  const ganttContentRef = useRef<HTMLDivElement>(null)
  const scrollableRef = useRef<HTMLDivElement>(null)

  // CRITICAL: Radix Lock Guard - Empêche le blocage de navigation par les overlays fantômes
  useEffect(() => {
    let watchdogCleanup: (() => void) | null = null

    // Import dynamique pour éviter les problèmes de bundling
    import('@/lib/dom/radixOverlayCleanup').then(({ cleanupRadixUIState, createRadixWatchdog }) => {
      // Nettoyage immédiat au montage
      cleanupRadixUIState({ aggressive: false, debug: false })

      // Watchdog qui surveille et répare les locks orphelins toutes les 600ms
      watchdogCleanup = createRadixWatchdog(600, false)
    })

    return () => {
      // Cleanup au démontage : arrêter le watchdog + nettoyage agressif
      watchdogCleanup?.()
      import('@/lib/dom/radixOverlayCleanup').then(({ cleanupRadixUIStateDelayed }) => {
        cleanupRadixUIStateDelayed({ aggressive: true, debug: false })
      })
    }
  }, [])

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

  // Charger les données - requête filtrée côté serveur (pas de limit=500 global)
  const { data: tasks, isLoading: isLoadingTasks } = useTachesByEtablissement(etablissementId)
  const { data: categories } = useCategories()
  const { data: etablissement } = useEtablissement(etablissementId)
  const { data: profiles } = useProfiles()

  // Hooks pour les actions du menu contextuel
  const updateTache = useUpdateTache()
  const archiveTache = useArchiveTache()
  const deleteTache = useDeleteTache()
  const duplicateTache = useDuplicateTache()

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
  } = useGanttZoom(tasks || [])

  const { visibleStart, visibleEnd } = useGanttVisibleDates(scrollableRef, timeline)

  const {
    filters,
    filteredTasks,
    updateFilter,
    resetFilters,
    toggleQuickFilter,
    hasActiveFilters,
  } = useGanttFilters(tasks || [])

  const { sensors, draggedTaskId, handleDragStart, handleDragEnd } = useGanttDragDrop(
    timeline,
    ganttContentRef
  )

  const { resizingTask, handleResizeStart, getResizePreview } = useGanttResize(
    timeline,
    tasks || []
  )

  const { exportToPNG, exportToPDF } = useGanttExport()

  // Grouper les tâches par catégorie
  const tasksByCategory = useMemo(() => {
    if (!filteredTasks || !categories) return []

    const grouped = categories
      .map((category) => {
        // Filtrer les tâches de cette catégorie
        const categoryTasks = filteredTasks.filter(
          (task) => (task.categorie_id || task.categories_taches?.id) === category.id
        )

        // Trier les tâches par date de début (chronologique)
        const sortedTasks = categoryTasks.sort((a, b) => {
          // Si les deux ont une date_debut, comparer chronologiquement
          if (a.date_debut && b.date_debut) {
            return new Date(a.date_debut).getTime() - new Date(b.date_debut).getTime()
          }

          // Si seulement A a une date_debut, A vient en premier
          if (a.date_debut && !b.date_debut) return -1

          // Si seulement B a une date_debut, B vient en premier
          if (!a.date_debut && b.date_debut) return 1

          // Si aucune n'a de date_debut, trier par ordre (ou created_at comme fallback)
          if (a.ordre !== undefined && b.ordre !== undefined) {
            return a.ordre - b.ordre
          }

          // Fallback final : trier par date de création
          return new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime()
        })

        return {
          id: category.id,
          nom: category.nom,
          couleur: category.couleur,
          tasks: sortedTasks,
        }
      })
      .filter((group) => group.tasks.length > 0)

    return grouped
  }, [filteredTasks, categories])

  // Calculer la hauteur totale du Gantt
  const totalHeight = useMemo(() => {
    return tasksByCategory.reduce((acc, cat) => {
      const isExpanded = !collapsedCategories.has(cat.id)
      const categoryHeaderHeight = 48 // h-12 = 48px
      const contentHeight = isExpanded
        ? cat.tasks.length * 64 // h-16 = 64px par tâche
        : 64 // h-16 uniformisé pour résumé en mode réduit
      return acc + categoryHeaderHeight + contentHeight
    }, 0)
  }, [tasksByCategory, collapsedCategories])

  // Calculer la largeur dynamique du Gantt avec largeurs minimales intelligentes
  const ganttWidth = useMemo(() => {
    if (!timeline) return 1200

    const calculatedWidth = timeline.totalDays * timeline.pixelsPerDay

    // Largeurs minimales recommandées par zoom pour une expérience optimale
    const minWidthByZoom = {
      day: 1400, // 3 semaines minimum à 50px/jour
      week: 2400, // 16 semaines minimum à 20px/jour
      month: 2000, // 8 mois minimum à 8px/jour
      quarter: 1800, // 8 trimestres minimum à 3px/jour
      year: 1600, // 3 ans minimum à 1.5px/jour
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
          etablissementNom: etablissement?.nom || 'Établissement',
          tasks: filteredTasks,
          categories: categories || [],
          timeline: {
            start: timeline.start,
            end: timeline.end,
          },
        },
        `planning-${etablissement?.nom.replace(/\s+/g, '-') || etablissementId}-${format(new Date(), 'yyyy-MM-dd')}.png`
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
          etablissementNom: etablissement?.nom || 'Établissement',
          tasks: filteredTasks,
          categories: categories || [],
          timeline: {
            start: timeline.start,
            end: timeline.end,
          },
        },
        `planning-${etablissement?.nom.replace(/\s+/g, '-') || etablissementId}-${format(new Date(), 'yyyy-MM-dd')}.pdf`
      )
    } finally {
      setIsExporting(false)
    }
  }

  if (isLoadingTasks) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  if (!tasks || tasks.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground">Aucune tâche à afficher</p>
        </CardContent>
      </Card>
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

  return (
    <div className="flex flex-col h-full space-y-4 relative isolate overflow-hidden">
      {/* Vue d'ensemble */}
      {timeline && (
        <GanttOverviewPanel
          tasks={tasks || []}
          timeline={timeline}
          onNavigateTo={navigateToDate}
          currentViewStart={visibleStart || timeline.start}
          currentViewEnd={visibleEnd || timeline.end}
        />
      )}

      {/* Alertes */}
      <GanttAlerts tasks={filteredTasks} onTaskClick={handleTaskClick} />

      <Card className="flex flex-col h-[650px] bg-card/80 backdrop-blur-sm border-primary/10 shadow-lg">
        <CardHeader className="flex-shrink-0 py-3">
          <CardTitle className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center ring-2 ring-primary/10">
              <ChevronDown className="h-4 w-4 text-primary" />
            </div>
            Diagramme de Gantt - Planning des tâches
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 flex-1 overflow-auto flex flex-col">
          {/* Contrôles */}
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

          {/* Contenu principal avec layout deux colonnes */}
          <div className="flex flex-1 overflow-hidden" ref={ganttContentRef}>
            {/* Panneau de filtres optionnel */}
            {showFilters && (
              <GanttFiltersPanel
                filters={filters}
                onFilterChange={updateFilter}
                onReset={resetFilters}
                categories={categories || []}
                statuts={['A faire', 'En cours', 'Bloqué', 'Terminé']}
                priorites={['low', 'medium', 'high']}
              />
            )}

            {/* Zone de Gantt - Single pane (volet gauche supprimé) */}
            <div className="flex-1 overflow-auto" ref={scrollableRef}>
              <div className="min-w-[800px]">
                <DndContext
                  sensors={sensors}
                  modifiers={[restrictToHorizontalAxis]}
                  onDragStart={(e) =>
                    handleDragStart(
                      e.active.id as string,
                      tasks?.find((t) => t.id === e.active.id)
                    )
                  }
                  onDragEnd={(e) => {
                    const task = tasks?.find((t) => t.id === e.active.id)
                    if (task) handleDragEnd(e, task)
                  }}
                >
                  <div
                    className="relative"
                    style={{
                      minHeight: totalHeight,
                      width: `${ganttWidth}px`,
                      minWidth: `${ganttWidth}px`,
                    }}
                  >
                    {/* Timeline sticky en haut */}
                    <div
                      className="sticky top-0 z-20 bg-background border-b border-border"
                      style={{ width: `${ganttWidth}px` }}
                    >
                      <GanttTimeline
                        timeline={timeline}
                        zoomLevel={zoomLevel}
                        todayPosition={todayPosition}
                        width={ganttWidth}
                      />
                    </div>
                    {/* Grille de fond */}
                    <GanttGrid timeline={timeline} zoomLevel={zoomLevel} height={totalHeight} />

                    {/* Heatmap de charge */}
                    {heatmapEnabled && (
                      <GanttWorkloadHeatmap
                        tasks={filteredTasks}
                        timeline={timeline}
                        height={totalHeight}
                        enabled={heatmapEnabled}
                      />
                    )}

                    {/* Jalons */}
                    <GanttMilestones
                      tasks={filteredTasks}
                      timeline={timeline}
                      height={totalHeight}
                    />

                    {/* Ligne "Aujourd'hui" - z-index confiné localement, pointer-events-none pour ne jamais bloquer les clics */}
                    {todayPosition >= 0 && todayPosition <= ganttWidth && (
                      <div
                        className="absolute top-0 w-0.5 bg-destructive z-10 pointer-events-none shadow-lg"
                        style={{
                          left: `${todayPosition}px`,
                          height: `${totalHeight}px`,
                        }}
                      >
                        <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-destructive text-destructive-foreground text-xs font-semibold px-2 py-0.5 rounded shadow-md whitespace-nowrap pointer-events-none">
                          ⚡ AUJOURD'HUI
                        </div>
                      </div>
                    )}

                    {/* Catégories et tâches - uniquement les barres */}
                    {tasksByCategory.map((category) => (
                      <GanttCategory
                        key={category.id}
                        category={category}
                        timeline={timeline}
                        onTaskClick={handleTaskClick}
                        onTaskResizeStart={(taskId, handle, startClientX) => {
                          const task = tasks?.find((t) => t.id === taskId)
                          if (task && scrollableRef.current) {
                            handleResizeStart(taskId, handle, scrollableRef.current, startClientX)
                          }
                        }}
                        draggedTaskId={draggedTaskId}
                        resizingTaskId={resizingTask?.id}
                        isExpanded={!collapsedCategories.has(category.id)}
                        onToggleExpand={() => toggleCategory(category.id)}
                        getResizePreview={getResizePreview}
                        onTaskDuplicate={handleTaskDuplicate}
                        onTaskStatusChange={handleTaskStatusChange}
                        onTaskAssign={handleTaskAssign}
                        onTaskArchive={handleTaskArchive}
                        onTaskDelete={handleTaskDelete}
                        profiles={profiles || []}
                      />
                    ))}
                  </div>
                </DndContext>
              </div>

              {/* Indicateur visuel de scroll horizontal */}
              {ganttWidth > 1200 && (
                <div className="text-xs text-muted-foreground text-center py-2 border-t bg-muted/20 flex-shrink-0">
                  ⬅️ Faites défiler horizontalement pour voir toute la période ➡️
                </div>
              )}
            </div>
          </div>

          {/* Légende */}
          <GanttLegend tasks={filteredTasks} />
        </CardContent>
      </Card>

      {/* Dialog d'édition */}
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

      {/* Dialog de création de tâche */}
      <GanttTaskCreateDialog
        isOpen={isCreateDialogOpen}
        onClose={() => {
          setIsCreateDialogOpen(false)
          setCreateTaskCategoryId(undefined)
        }}
        etablissementId={etablissementId}
        defaultCategoryId={createTaskCategoryId}
      />
    </div>
  )
}
