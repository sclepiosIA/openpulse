import { DndContext, type DragEndEvent } from '@dnd-kit/core'
import type { SensorDescriptor, SensorOptions } from '@dnd-kit/core'
import { restrictToHorizontalAxis } from '@dnd-kit/modifiers'
import { ChevronDown, ChevronRight, CheckCircle, Clock, AlertCircle, Repeat } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { isBefore, differenceInDays, addDays } from 'date-fns'
import { GanttTimeline } from '@/components/etablissement-gantt/GanttTimeline'
import { GanttGrid } from '@/components/etablissement-gantt/GanttGrid'
import { GanttTaskBar } from '@/components/etablissement-gantt/GanttTaskBar'
import { GanttRecurringTaskRow } from '@/components/etablissement-gantt/GanttRecurringTaskRow'
import { GanttWorkloadHeatmap } from '@/components/etablissement-gantt/GanttWorkloadHeatmap'
import { GanttMilestones } from '@/components/etablissement-gantt/GanttMilestones'
import type { GroupedTask } from '@/hooks/tasks/useRecurringTaskGrouping'
import type { Task } from '@/types/gantt'
import type { TimelineConfig, ZoomLevel } from '@/components/etablissement-gantt/hooks/useGanttZoom'
import type { ResizeHandle } from '@/components/etablissement-gantt/hooks/useGanttResize'
import type { ProfilePublic } from '@/hooks/profile/useProfiles'

/**
 * DEBT-01 : tâche Gantt globale — `Task` + métadonnées produites par le moteur
 * de récurrence (`expandAllRecurringTasks`) et relations Supabase éventuelles.
 */
export type GlobalGanttTask = Task & {
  recurrence_rule?: string | null
  _isRecurrenceOccurrence?: boolean
  _parentTaskId?: string
  [key: string]: unknown
}

interface GroupNode {
  id: string
  nom: string
  couleur: string
  tasks: GlobalGanttTask[]
  groupedTasks?: GroupedTask[]
}

interface FixedColumnProps {
  groupedTasks: GroupNode[]
  collapsedCategories: Set<string>
  toggleCategory: (id: string) => void
  onTaskClick: (task: GlobalGanttTask) => void
  zoomLevel: string
}

export function GanttFixedColumn({
  groupedTasks,
  collapsedCategories,
  toggleCategory,
  onTaskClick,
  zoomLevel,
}: FixedColumnProps) {
  return (
    <div className="bg-background">
      <div
        className={cn(
          'sticky top-0 z-10 border-b border-border bg-muted/50',
          zoomLevel === 'day' ? 'h-[72px]' : 'h-10'
        )}
      />

      {groupedTasks.map((group) => {
        const isExpanded = !collapsedCategories.has(group.id)
        return (
          <div key={group.id} className="border-b border-border">
            <div
              className="flex items-center gap-2 px-2 bg-muted/50 border-b border-border h-10 hover:bg-muted transition-colors cursor-pointer"
              onClick={() => toggleCategory(group.id)}
            >
              {isExpanded ? (
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
              )}
              <div
                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: group.couleur }}
              />
              <span className="font-medium text-xs truncate flex-1">{group.nom}</span>
              <span className="text-xs text-muted-foreground">{group.tasks.length}</span>
            </div>

            {isExpanded &&
              (group.groupedTasks || []).map((groupedTask, index) => (
                <div
                  key={groupedTask.parentTask.id}
                  className={cn(
                    'flex items-center h-10 px-2 border-b border-border/50 hover:bg-muted/30 cursor-pointer transition-colors',
                    index % 2 === 0 && 'bg-muted/5'
                  )}
                  onClick={() => onTaskClick(groupedTask.parentTask)}
                >
                  {groupedTask.isRecurring ? (
                    <Repeat className="h-3 w-3 text-muted-foreground mr-1.5 flex-shrink-0" />
                  ) : (
                    <>
                      {groupedTask.parentTask.statut === 'Terminé' && (
                        <CheckCircle className="h-3 w-3 text-success mr-1.5 flex-shrink-0" />
                      )}
                      {groupedTask.parentTask.statut === 'En cours' && (
                        <Clock className="h-3 w-3 text-primary mr-1.5 flex-shrink-0" />
                      )}
                      {groupedTask.parentTask.statut === 'Bloqué' && (
                        <AlertCircle className="h-3 w-3 text-destructive mr-1.5 flex-shrink-0" />
                      )}
                      {groupedTask.parentTask.statut === 'A faire' && (
                        <div className="w-3 h-3 mr-1.5 flex-shrink-0" />
                      )}
                    </>
                  )}

                  <span className="text-xs truncate flex-1">{groupedTask.parentTask.titre}</span>

                  {groupedTask.isRecurring && groupedTask.occurrences.length > 1 && (
                    <Badge variant="outline" className="h-4 text-[9px] px-1 ml-1 flex-shrink-0">
                      {groupedTask.occurrences.filter((o) => o.statut === 'Terminé').length}/
                      {groupedTask.occurrences.length}
                    </Badge>
                  )}
                </div>
              ))}

            {!isExpanded &&
              (() => {
                const groupStats = {
                  total: group.tasks.length,
                  termine: group.tasks.filter((t) => t.statut === 'Terminé').length,
                  enCours: group.tasks.filter((t) => t.statut === 'En cours').length,
                  enRetard: group.tasks.filter(
                    (t) =>
                      t.statut !== 'Terminé' &&
                      t.echeance &&
                      isBefore(new Date(t.echeance), new Date())
                  ).length,
                }

                return (
                  <div className="flex items-center h-10 px-2 border-b border-border bg-muted/5 gap-2">
                    <Badge variant="secondary" className="h-5 gap-1 text-[10px]">
                      <CheckCircle className="h-2.5 w-2.5" />
                      {groupStats.termine}/{groupStats.total}
                    </Badge>
                    {groupStats.enCours > 0 && (
                      <Badge variant="secondary" className="h-5 gap-1 text-[10px]">
                        <Clock className="h-2.5 w-2.5" />
                        {groupStats.enCours}
                      </Badge>
                    )}
                    {groupStats.enRetard > 0 && (
                      <Badge variant="destructive" className="h-5 gap-1 text-[10px]">
                        {groupStats.enRetard}
                      </Badge>
                    )}
                  </div>
                )
              })()}
          </div>
        )
      })}
    </div>
  )
}

interface ScrollableCanvasProps {
  groupedTasks: GroupNode[]
  collapsedCategories: Set<string>
  filteredTasks: GlobalGanttTask[]
  timeline: TimelineConfig
  zoomLevel: ZoomLevel
  ganttWidth: number
  totalHeight: number
  todayPosition: number
  heatmapEnabled: boolean
  draggedTaskId: string | null
  resizingTask: { id: string } | null
  sensors: SensorDescriptor<SensorOptions>[]
  documentCounts: Record<string, number> | undefined
  profiles: ProfilePublic[]
  profileRoleMap: Map<string, string>
  scrollableRef: React.RefObject<HTMLDivElement>
  onDragStart: (id: string, task: GlobalGanttTask | undefined) => void
  onDragEnd: (event: DragEndEvent, task: GlobalGanttTask) => void
  handleResizeStart: (
    id: string,
    handle: ResizeHandle,
    container: HTMLDivElement,
    startX: number
  ) => void
  onTaskClick: (task: GlobalGanttTask) => void
  onTaskDuplicate: (task: GlobalGanttTask) => void
  onTaskStatusChange: (id: string, status: string) => void
  onTaskAssign: (id: string, responsableId: string) => void
  onTaskArchive: (task: GlobalGanttTask) => void
  onTaskDelete: (id: string) => void
}

export function GanttScrollableCanvas({
  groupedTasks,
  collapsedCategories,
  filteredTasks,
  timeline,
  zoomLevel,
  ganttWidth,
  totalHeight,
  todayPosition,
  heatmapEnabled,
  draggedTaskId,
  resizingTask,
  sensors,
  documentCounts,
  profiles,
  profileRoleMap,
  scrollableRef,
  onDragStart,
  onDragEnd,
  handleResizeStart,
  onTaskClick,
  onTaskDuplicate,
  onTaskStatusChange,
  onTaskAssign,
  onTaskArchive,
  onTaskDelete,
}: ScrollableCanvasProps) {
  return (
    <DndContext
      sensors={sensors}
      modifiers={[restrictToHorizontalAxis]}
      onDragStart={({ active }) => {
        const task = filteredTasks.find((t) => t.id === active.id)
        onDragStart(active.id as string, task)
      }}
      onDragEnd={(event) => {
        const task = filteredTasks.find((t) => t.id === draggedTaskId)
        if (task) onDragEnd(event, task)
      }}
    >
      <div className="relative" style={{ width: ganttWidth, minHeight: totalHeight }}>
        <div className="sticky top-0 z-20">
          <GanttTimeline
            timeline={timeline}
            zoomLevel={zoomLevel}
            todayPosition={todayPosition}
            width={ganttWidth}
          />
        </div>

        <GanttGrid timeline={timeline} zoomLevel={zoomLevel} height={totalHeight} />

        {heatmapEnabled && (
          <GanttWorkloadHeatmap
            tasks={filteredTasks}
            timeline={timeline}
            height={totalHeight}
            enabled={heatmapEnabled}
          />
        )}

        <GanttMilestones tasks={filteredTasks} timeline={timeline} height={totalHeight} />

        {todayPosition >= 0 && todayPosition <= ganttWidth && (
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-primary z-10 pointer-events-none"
            style={{ left: `${todayPosition}px` }}
          >
            <div className="absolute -top-1 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] font-medium text-primary-foreground bg-primary px-1 rounded">
              Auj.
            </div>
          </div>
        )}

        {groupedTasks.map((group) => {
          const isExpanded = !collapsedCategories.has(group.id)
          return (
            <div key={group.id} className="border-b border-border">
              <div className="h-10" />

              {isExpanded &&
                (group.groupedTasks || []).map((groupedTask, index) => (
                  <div
                    key={groupedTask.parentTask.id}
                    className={cn(
                      'relative h-10 border-b border-border/50',
                      index % 2 === 0 && 'bg-muted/5'
                    )}
                  >
                    {groupedTask.isRecurring ? (
                      <GanttRecurringTaskRow
                        parentTask={groupedTask.parentTask}
                        occurrences={groupedTask.occurrences}
                        timeline={timeline}
                        onTaskClick={onTaskClick}
                        categoryColor={group.couleur}
                        responsableRole={
                          groupedTask.parentTask.responsable_id
                            ? profileRoleMap.get(groupedTask.parentTask.responsable_id)
                            : undefined
                        }
                      />
                    ) : (
                      (() => {
                        const task = groupedTask.parentTask
                        const taskStart = task.date_debut
                          ? new Date(task.date_debut)
                          : new Date(task.created_at)
                        const taskEnd = task.echeance
                          ? new Date(task.echeance)
                          : addDays(taskStart, 7)

                        const startOffset = differenceInDays(taskStart, timeline.start)
                        const duration = Math.max(1, differenceInDays(taskEnd, taskStart))

                        const left = Math.max(0, startOffset * timeline.pixelsPerDay)
                        const width = Math.max(
                          timeline.pixelsPerDay * 2,
                          duration * timeline.pixelsPerDay
                        )

                        const isOverdue =
                          task.statut !== 'Terminé' &&
                          task.echeance &&
                          isBefore(new Date(task.echeance), new Date())

                        return (
                          <GanttTaskBar
                            task={task}
                            position={{ left, width, isOverdue }}
                            onClick={() => onTaskClick(task)}
                            onResizeStart={(handle, startX) => {
                              if (scrollableRef.current) {
                                handleResizeStart(task.id, handle, scrollableRef.current, startX)
                              }
                            }}
                            isDragging={draggedTaskId === task.id}
                            isResizing={resizingTask?.id === task.id}
                            documentCount={documentCounts?.[task.id] || 0}
                            pixelsPerDay={timeline.pixelsPerDay}
                            onDuplicate={() => onTaskDuplicate(task)}
                            onStatusChange={(status) => onTaskStatusChange(task.id, status)}
                            onAssign={(responsableId) => onTaskAssign(task.id, responsableId)}
                            onArchive={() => onTaskArchive(task)}
                            onDelete={() => onTaskDelete(task.id)}
                            profiles={profiles || []}
                            responsableRole={
                              task.responsable_id
                                ? profileRoleMap.get(task.responsable_id)
                                : undefined
                            }
                          />
                        )
                      })()
                    )}
                  </div>
                ))}

              {!isExpanded && <div className="h-10" />}
            </div>
          )
        })}
      </div>
    </DndContext>
  )
}
