import { useState, useMemo, useRef } from 'react'
import { DndContext, DragStartEvent, DragEndEvent } from '@dnd-kit/core'
import { restrictToHorizontalAxis } from '@dnd-kit/modifiers'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Loader2,
  ChevronDown,
  ChevronRight,
  Plus,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  ExternalLink,
} from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { isBefore } from 'date-fns'
import { Link } from 'react-router-dom'
import {
  useTaches,
  useUpdateTache,
  useArchiveTache,
  useDeleteTache,
  useDuplicateTache,
} from '@/hooks/tasks/useTaches'
import { useCategories } from '@/hooks/catalogue/useCategories'
import { useEtablissements } from '@/hooks/crm/useEtablissements'
import { useProfiles } from '@/hooks/profile/useProfiles'
import { useActiveProfilesWithRoles } from '@/hooks/profile/useProfilesWithRoles'
import { useTachesDocumentsCounts } from '@/hooks/tasks/useTachesDocumentsCounts'
import { useGanttZoom } from '@/components/etablissement-gantt/hooks/useGanttZoom'
import { useGanttFilters } from '@/components/etablissement-gantt/hooks/useGanttFilters'
import { GanttTimeline } from '@/components/etablissement-gantt/GanttTimeline'
import { GanttGrid } from '@/components/etablissement-gantt/GanttGrid'
import { GanttTaskBar } from '@/components/etablissement-gantt/GanttTaskBar'
import { GanttRecurringTaskRow } from '@/components/etablissement-gantt/GanttRecurringTaskRow'
import { groupRecurringTasks, type GroupedTask } from '@/hooks/tasks/useRecurringTaskGrouping'
import { GanttControls } from '@/components/etablissement-gantt/GanttControls'
import { GanttRoleLegend } from '@/components/global-gantt/GanttRoleLegend'
import { GanttFiltersPanel } from '@/components/etablissement-gantt/GanttFilters'
import { TaskEditDialog } from '@/components/tasks/TaskEditDialog'
import { GanttTaskCreateDialog } from '@/components/etablissement-gantt/GanttTaskCreateDialog'
import { GanttDualLayout } from '@/components/etablissement-gantt/GanttDualLayout'
import { filterTasksByEstablishmentPhase } from '@/hooks/tasks/useTaskPhaseFilter'
import { expandAllRecurringTasks } from '@/lib/recurrenceUtils'
import { ContentFilters } from '@/components/calendrier/CalendarContentToggle'
import { useSensors, useSensor, PointerSensor } from '@dnd-kit/core'
import type { Task } from '@/types/gantt'
import type { GanttFilters as GanttFiltersState } from '@/components/etablissement-gantt/hooks/useGanttFilters'
import type { TacheData } from '@/lib/validations'

type GroupByOption = 'etablissement' | 'categorie' | 'responsable' | 'statut'
type SortField = 'date_debut' | 'echeance' | 'titre' | 'priorite' | 'statut' | 'responsable'
type SortDirection = 'asc' | 'desc'

/**
 * DEBT-01 : type de travail pour les tâches affichées dans ce Gantt embarqué.
 * Les données viennent de Supabase (relations jointes) et passent par le moteur
 * de récurrence, d'où les métadonnées `_isRecurrenceOccurrence`/`_parentTaskId`.
 */
type CalendarGanttTask = Task & {
  recurrence_rule?: string | null
  _isRecurrenceOccurrence?: boolean
  _parentTaskId?: string
  [key: string]: unknown
}

/** `groupRecurringTasks` ne produit que `parentTask`, mais l'ancien code
 * gardait un fallback `groupedTask.task` — conservé de façon typée. */
type GroupedTaskLoose = GroupedTask & { task?: CalendarGanttTask }

interface CalendarEmbeddedGanttProps {
  contentFilters?: ContentFilters
}

export function CalendarEmbeddedGantt({ contentFilters }: CalendarEmbeddedGanttProps) {
  const [showFilters, setShowFilters] = useState(false)
  const [selectedTask, setSelectedTask] = useState<CalendarGanttTask | null>(null)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set())
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [groupBy, setGroupBy] = useState<GroupByOption>('etablissement')
  const [sortField, setSortField] = useState<SortField>('date_debut')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')
  const ganttContentRef = useRef<HTMLDivElement>(null)
  const scrollableRef = useRef<HTMLDivElement>(null)

  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  )

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
  const { data: allTasks, isLoading: isLoadingTasks } = useTaches()
  const { data: etablissements } = useEtablissements()
  const { data: profiles } = useProfiles()
  const { data: profilesWithRoles } = useActiveProfilesWithRoles()
  const { data: categories } = useCategories()

  // Hooks pour les actions
  const updateTache = useUpdateTache()
  const archiveTache = useArchiveTache()
  const deleteTache = useDeleteTache()
  const duplicateTache = useDuplicateTache()

  // Séparer les tâches avec dates
  const validTasks = useMemo(() => {
    if (!allTasks) return []

    // Boundary cast unique : les tâches Supabase embarquent les relations
    // jointes (categories_taches, profiles…) non déclarées dans TacheData.
    const sourceTasks = allTasks as CalendarGanttTask[]

    const phaseFiltered =
      etablissements && etablissements.length > 0
        ? filterTasksByEstablishmentPhase(
            sourceTasks,
            etablissements.map((e) => ({ id: e.id, statut: e.statut }))
          )
        : sourceTasks

    const nonArchived = phaseFiltered.filter((t) => !t.archive)
    // Accept tasks with at least an echeance; auto-generate date_debut from created_at if missing
    const planned = nonArchived
      .filter((t) => t.echeance)
      .map((t) => ({
        ...t,
        date_debut: t.date_debut || t.created_at?.split('T')[0] || t.echeance,
      }))

    // Étendre les tâches récurrentes
    const now = new Date()
    const rangeStart = new Date(now.getFullYear() - 1, 0, 1)
    const rangeEnd = new Date(now.getFullYear() + 2, 11, 31)
    return expandAllRecurringTasks(planned, rangeStart, rangeEnd)
  }, [allTasks, etablissements])

  // Compteurs de documents
  const taskIds = useMemo(() => validTasks.map((t) => t.id), [validTasks])
  const { data: documentCounts } = useTachesDocumentsCounts(taskIds)

  // Map pour les rôles
  const profileRoleMap = useMemo(() => {
    const map = new Map<string, string>()
    profilesWithRoles?.forEach((p) => {
      map.set(p.id, p.role)
    })
    return map
  }, [profilesWithRoles])

  // Hooks Gantt
  const { zoomLevel, setZoomLevel, timeline, goToPrevious, goToNext, goToToday, getTodayPosition } =
    useGanttZoom(validTasks)

  const etablissementsForFilter = useMemo(
    () => etablissements?.map((e) => ({ id: e.id, statut: e.statut })) || [],
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

  // Statistiques
  const stats = useMemo(() => {
    const total = filteredTasks.length
    const completed = filteredTasks.filter((t) => t.statut === 'Terminé').length
    const overdue = filteredTasks.filter(
      (t) => t.statut !== 'Terminé' && t.echeance && isBefore(new Date(t.echeance), new Date())
    ).length
    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0

    return { total, completed, overdue, completionRate }
  }, [filteredTasks])

  // Fonction de tri
  const sortTasks = (tasks: Task[]) => {
    return [...tasks].sort((a, b) => {
      let comparison = 0

      switch (sortField) {
        case 'date_debut':
          const dateA = a.date_debut ? new Date(a.date_debut).getTime() : Number.MAX_SAFE_INTEGER
          const dateB = b.date_debut ? new Date(b.date_debut).getTime() : Number.MAX_SAFE_INTEGER
          comparison = dateA - dateB
          break
        case 'echeance':
          const echA = a.echeance ? new Date(a.echeance).getTime() : Number.MAX_SAFE_INTEGER
          const echB = b.echeance ? new Date(b.echeance).getTime() : Number.MAX_SAFE_INTEGER
          comparison = echA - echB
          break
        case 'titre':
          comparison = (a.titre || '').localeCompare(b.titre || '', 'fr')
          break
        case 'priorite':
          const priorityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 }
          comparison =
            (priorityOrder[a.priorite ?? 'medium'] ?? 1) -
            (priorityOrder[b.priorite ?? 'medium'] ?? 1)
          break
        case 'statut':
          const statusOrder: Record<string, number> = {
            Bloqué: 0,
            'En cours': 1,
            'A faire': 2,
            Terminé: 3,
          }
          comparison = (statusOrder[a.statut] ?? 2) - (statusOrder[b.statut] ?? 2)
          break
        case 'responsable':
          const respA = a.profiles?.nom || a.profiles?.prenom || ''
          const respB = b.profiles?.nom || b.profiles?.prenom || ''
          comparison = respA.localeCompare(respB, 'fr')
          break
      }

      return sortDirection === 'desc' ? -comparison : comparison
    })
  }

  // Grouper les tâches
  const groupedTasks = useMemo(() => {
    if (!filteredTasks) return []

    switch (groupBy) {
      case 'etablissement':
        return (
          etablissements
            ?.map((etab) => {
              const etabTasks = sortTasks(
                filteredTasks.filter((t) => t.etablissement_id === etab.id)
              )
              return {
                id: etab.id,
                nom: etab.nom,
                couleur: '#3b82f6',
                tasks: etabTasks,
                groupedTasks: groupRecurringTasks(etabTasks),
              }
            })
            .filter((g) => g.tasks.length > 0) || []
        )

      case 'categorie':
        return (
          categories
            ?.map((cat) => {
              const catTasks = sortTasks(
                filteredTasks.filter((t) => (t.categorie_id || t.categories_taches?.id) === cat.id)
              )
              return {
                id: cat.id,
                nom: cat.nom,
                couleur: cat.couleur || '#888',
                tasks: catTasks,
                groupedTasks: groupRecurringTasks(catTasks),
              }
            })
            .filter((g) => g.tasks.length > 0) || []
        )

      case 'responsable':
        const responsables =
          profiles?.filter((p) => filteredTasks.some((t) => t.responsable_id === p.id)) || []
        return responsables.map((resp) => {
          const respTasks = sortTasks(filteredTasks.filter((t) => t.responsable_id === resp.id))
          return {
            id: resp.id,
            nom: `${resp.prenom || ''} ${resp.nom || ''}`.trim() || resp.email || 'Sans nom',
            couleur: '#8b5cf6',
            tasks: respTasks,
            groupedTasks: groupRecurringTasks(respTasks),
          }
        })

      case 'statut':
        const statuts = ['A faire', 'En cours', 'Bloqué', 'Terminé']
        return statuts
          .map((statut) => {
            const statusTasks = sortTasks(filteredTasks.filter((t) => t.statut === statut))
            return {
              id: statut,
              nom: statut,
              couleur:
                statut === 'Terminé'
                  ? '#10b981'
                  : statut === 'En cours'
                    ? '#3b82f6'
                    : statut === 'Bloqué'
                      ? '#ef4444'
                      : '#6b7280',
              tasks: statusTasks,
              groupedTasks: groupRecurringTasks(statusTasks),
            }
          })
          .filter((g) => g.tasks.length > 0)

      default:
        return []
    }
  }, [filteredTasks, groupBy, etablissements, categories, profiles, sortField, sortDirection])

  // Hauteur totale
  const totalHeight = useMemo(() => {
    return groupedTasks.reduce((acc, group) => {
      const isExpanded = !collapsedCategories.has(group.id)
      const categoryHeaderHeight = 40
      const contentHeight = isExpanded
        ? (group.groupedTasks?.length || group.tasks.length) * 40
        : 40
      return acc + categoryHeaderHeight + contentHeight
    }, 0)
  }, [groupedTasks, collapsedCategories])

  // Largeur dynamique
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

  const handleTaskClick = (task: CalendarGanttTask) => {
    setSelectedTask(task)
    setIsEditDialogOpen(true)
  }

  // Handlers pour les actions
  const handleTaskDuplicate = (task: CalendarGanttTask) => {
    duplicateTache.mutate(task as TacheData)
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

  const handleTaskArchive = (task: CalendarGanttTask) => {
    archiveTache.mutate({ id: task.id, archive: !task.archive })
  }

  const handleTaskDelete = (taskId: string) => {
    deleteTache.mutate(taskId)
  }

  // Position de la tâche
  const getTaskPosition = (task: CalendarGanttTask) => {
    if (!timeline) return null

    // `validTasks` garantit date_debut/echeance (voir pipeline `planned`)
    const startDate = new Date(task.date_debut as string)
    const endDate = new Date(task.echeance as string)
    const startDays = Math.floor(
      (startDate.getTime() - timeline.start.getTime()) / (1000 * 60 * 60 * 24)
    )
    const duration = Math.max(
      1,
      Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1
    )

    return {
      left: startDays * timeline.pixelsPerDay,
      width: duration * timeline.pixelsPerDay,
      isOverdue: task.statut !== 'Terminé' && isBefore(endDate, new Date()),
    }
  }

  // Drag handlers (simplified - no actual persistence, just UI feedback)
  const handleDragStart = (event: DragStartEvent) => {
    // Could track dragging state if needed
  }

  const handleDragEnd = (event: DragEndEvent) => {
    // Could implement actual drag persistence if needed
  }

  if (isLoadingTasks) {
    return (
      <Card className="h-[calc(100vh-280px)]">
        <CardContent className="flex items-center justify-center h-full">
          <Loader2 className="h-8 w-8 animate-spin" />
        </CardContent>
      </Card>
    )
  }

  if (!validTasks || validTasks.length === 0 || !timeline) {
    return (
      <Card className="h-[calc(100vh-280px)]">
        <CardContent className="flex flex-col items-center justify-center h-full text-center">
          <p className="text-muted-foreground mb-4">Aucune tâche planifiée à afficher</p>
          <Button asChild variant="outline">
            <Link to="/gantt">
              Ouvrir le Gantt complet
              <ExternalLink className="h-4 w-4 ml-2" />
            </Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  const todayPosition = getTodayPosition()

  // Prepare responsables list for filters
  const responsables =
    profiles?.map((p) => ({
      id: p.id,
      prenom: p.prenom || '',
      nom: p.nom || '',
    })) || []

  return (
    <Card className="h-[calc(100vh-280px)] overflow-hidden flex flex-col">
      <CardContent className="p-0 flex-1 overflow-hidden flex flex-col">
        {/* Toolbar compacte */}
        <div className="flex items-center justify-between gap-2 px-3 py-2 border-b bg-muted/30 flex-wrap">
          <div className="flex items-center gap-2">
            {/* Stats */}
            <Badge variant="outline" className="text-xs">
              {stats.total} tâches
            </Badge>
            {stats.overdue > 0 && (
              <Badge variant="destructive" className="text-xs">
                {stats.overdue} retard
              </Badge>
            )}
            <Badge variant="secondary" className="text-xs">
              {stats.completionRate}%
            </Badge>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Grouper */}
            <Select value={groupBy} onValueChange={(v) => setGroupBy(v as GroupByOption)}>
              <SelectTrigger className="w-[110px] h-7 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="etablissement" className="text-xs">
                  Établissement
                </SelectItem>
                <SelectItem value="categorie" className="text-xs">
                  Catégorie
                </SelectItem>
                <SelectItem value="responsable" className="text-xs">
                  Responsable
                </SelectItem>
                <SelectItem value="statut" className="text-xs">
                  Statut
                </SelectItem>
              </SelectContent>
            </Select>

            {/* Trier */}
            <div className="flex items-center gap-0.5">
              <Select value={sortField} onValueChange={(v) => setSortField(v as SortField)}>
                <SelectTrigger className="w-[90px] h-7 text-xs">
                  <ArrowUpDown className="h-3 w-3 mr-1 flex-shrink-0" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="date_debut" className="text-xs">
                    Début
                  </SelectItem>
                  <SelectItem value="echeance" className="text-xs">
                    Échéance
                  </SelectItem>
                  <SelectItem value="titre" className="text-xs">
                    Titre
                  </SelectItem>
                  <SelectItem value="priorite" className="text-xs">
                    Priorité
                  </SelectItem>
                </SelectContent>
              </Select>

              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={() => setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'))}
              >
                {sortDirection === 'asc' ? (
                  <ArrowUp className="h-3.5 w-3.5" />
                ) : (
                  <ArrowDown className="h-3.5 w-3.5" />
                )}
              </Button>
            </div>

            {/* Nouvelle tâche */}
            <Button size="sm" className="h-7" onClick={() => setIsCreateDialogOpen(true)}>
              <Plus className="h-3.5 w-3.5" />
              <span className="hidden sm:inline ml-1">Tâche</span>
            </Button>

            {/* Lien plein écran */}
            <Button variant="outline" size="sm" className="h-7" asChild>
              <Link to="/gantt" aria-label="Ouvrir le Gantt en plein écran">
                <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            </Button>
          </div>
        </div>

        {/* Contrôles de zoom */}
        <GanttControls
          zoomLevel={zoomLevel}
          onZoomChange={setZoomLevel}
          onPrevious={goToPrevious}
          onNext={goToNext}
          onToday={goToToday}
          onToggleFilters={() => setShowFilters(!showFilters)}
          hasActiveFilters={hasActiveFilters}
          quickFilters={filters.quickFilters}
          onToggleQuickFilter={(key) =>
            toggleQuickFilter(key as keyof GanttFiltersState['quickFilters'])
          }
        />

        {/* Légende des rôles */}
        <GanttRoleLegend />

        {/* Panneau de filtres */}
        {showFilters && (
          <div className="border-b">
            <GanttFiltersPanel
              filters={filters}
              onFilterChange={updateFilter}
              onReset={resetFilters}
              etablissements={etablissements?.map((e) => ({ id: e.id, nom: e.nom })) || []}
              categories={
                categories?.map((c) => ({ id: c.id, nom: c.nom, couleur: c.couleur })) || []
              }
              statuts={['A faire', 'En cours', 'Bloqué', 'Terminé']}
              priorites={['low', 'medium', 'high']}
              responsables={responsables}
            />
          </div>
        )}

        {/* Gantt Layout */}
        <DndContext
          sensors={sensors}
          modifiers={[restrictToHorizontalAxis]}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="flex-1 overflow-hidden" ref={ganttContentRef}>
            <GanttDualLayout
              scrollableRef={scrollableRef}
              leftColumnWidth={200}
              fixedContent={
                <div className="min-h-full">
                  {/* Header vide pour alignement */}
                  <div className="h-[52px] border-b bg-muted/50" />

                  {/* Labels des groupes */}
                  {groupedTasks.map((group) => {
                    const isExpanded = !collapsedCategories.has(group.id)
                    return (
                      <div key={group.id}>
                        {/* Header du groupe */}
                        <div
                          className="h-10 px-3 flex items-center gap-2 border-b bg-muted/30 cursor-pointer hover:bg-muted/50"
                          onClick={() => toggleCategory(group.id)}
                        >
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4 flex-shrink-0" />
                          ) : (
                            <ChevronRight className="h-4 w-4 flex-shrink-0" />
                          )}
                          <div
                            className="w-2 h-2 rounded-full flex-shrink-0"
                            style={{ backgroundColor: group.couleur }}
                          />
                          <span className="font-medium text-sm truncate flex-1">{group.nom}</span>
                          <Badge variant="secondary" className="text-xs">
                            {group.tasks.length}
                          </Badge>
                        </div>

                        {/* Labels des tâches */}
                        {isExpanded &&
                          group.groupedTasks?.map((groupedTask: GroupedTaskLoose) => (
                            <div
                              key={groupedTask.parentTask?.id || groupedTask.task?.id}
                              className="h-10 px-3 flex items-center border-b hover:bg-muted/20 cursor-pointer"
                              onClick={() =>
                                handleTaskClick(groupedTask.parentTask || groupedTask.task)
                              }
                            >
                              <span className="text-sm truncate">
                                {groupedTask.parentTask?.titre || groupedTask.task?.titre}
                              </span>
                            </div>
                          ))}

                        {/* Résumé si collapsed */}
                        {!isExpanded && (
                          <div className="h-10 px-3 flex items-center border-b bg-muted/10">
                            <span className="text-xs text-muted-foreground">
                              {group.tasks.length} tâche{group.tasks.length > 1 ? 's' : ''}
                            </span>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              }
              scrollableContent={
                <div style={{ width: ganttWidth, minHeight: totalHeight + 52 }}>
                  {/* Timeline header */}
                  <GanttTimeline
                    timeline={timeline}
                    zoomLevel={zoomLevel}
                    todayPosition={todayPosition}
                    width={ganttWidth}
                  />

                  {/* Grille + Barres */}
                  <div className="relative">
                    <GanttGrid timeline={timeline} zoomLevel={zoomLevel} height={totalHeight} />

                    {/* Ligne "Aujourd'hui" */}
                    {todayPosition !== null && (
                      <div
                        className="absolute top-0 w-0.5 bg-primary z-20"
                        style={{
                          left: `${todayPosition}px`,
                          height: totalHeight,
                        }}
                      />
                    )}

                    {/* Barres des tâches */}
                    {groupedTasks.map((group) => {
                      const isExpanded = !collapsedCategories.has(group.id)

                      return (
                        <div key={group.id}>
                          {/* Espace pour le header du groupe */}
                          <div style={{ height: 40 }} />

                          {isExpanded ? (
                            group.groupedTasks?.map(
                              (groupedTask: GroupedTaskLoose, idx: number) => {
                                const task = groupedTask.parentTask || groupedTask.task
                                const position = getTaskPosition(task)
                                if (!position) return null

                                const role = profileRoleMap.get(task.responsable_id || '')

                                if (groupedTask.isRecurring && groupedTask.occurrences) {
                                  return (
                                    <GanttRecurringTaskRow
                                      key={task.id}
                                      parentTask={task}
                                      occurrences={groupedTask.occurrences}
                                      timeline={timeline}
                                      onTaskClick={handleTaskClick}
                                      responsableRole={role}
                                    />
                                  )
                                }

                                return (
                                  <div key={task.id} className="h-10 relative">
                                    <GanttTaskBar
                                      task={task}
                                      position={position}
                                      responsableRole={role}
                                      onClick={() => handleTaskClick(task)}
                                      onDuplicate={() => handleTaskDuplicate(task)}
                                      onStatusChange={(status) =>
                                        handleTaskStatusChange(task.id, status)
                                      }
                                      onAssign={(responsableId) =>
                                        handleTaskAssign(task.id, responsableId)
                                      }
                                      onArchive={() => handleTaskArchive(task)}
                                      onDelete={() => handleTaskDelete(task.id)}
                                      documentCount={documentCounts?.[task.id] || 0}
                                      profiles={profiles || []}
                                    />
                                  </div>
                                )
                              }
                            )
                          ) : (
                            <div className="h-10 relative">
                              {/* Summary bar pour groupe collapsed */}
                              <div
                                className="absolute h-6 top-2 rounded bg-muted/50 border"
                                style={{
                                  left: 20,
                                  width: 100,
                                }}
                              />
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              }
            />
          </div>
        </DndContext>
      </CardContent>

      {/* Dialogs */}
      {selectedTask && (
        <TaskEditDialog
          tache={selectedTask}
          open={isEditDialogOpen}
          onOpenChange={setIsEditDialogOpen}
        />
      )}

      <GanttTaskCreateDialog
        isOpen={isCreateDialogOpen}
        onClose={() => setIsCreateDialogOpen(false)}
      />
    </Card>
  )
}
