import { memo } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { GanttTaskBar } from './GanttTaskBar'
import { GanttCategorySummaryBar } from './GanttCategorySummaryBar'
import { TimelineConfig } from './hooks/useGanttZoom'
import { differenceInDays, addDays, isBefore } from 'date-fns'
import { ResizeHandle } from './hooks/useGanttResize'
import { ProfilePublic } from '@/hooks/profile/useProfiles'

interface GanttCategoryProps {
  category: {
    id: string
    nom: string
    couleur?: string
    tasks: any[]
  }
  timeline: TimelineConfig
  onTaskClick: (task: any) => void
  onTaskResizeStart?: (taskId: string, handle: ResizeHandle, startClientX: number) => void
  draggedTaskId?: string | null
  resizingTaskId?: string | null
  isExpanded?: boolean
  onToggleExpand?: () => void
  /** Document counts par task ID */
  documentCounts?: Record<string, number>
  /** Fonction pour obtenir la preview de resize en temps réel */
  getResizePreview?: (taskId: string) => { left: number; width: number } | null
  /** Callbacks pour le menu contextuel */
  onTaskDuplicate?: (task: any) => void
  onTaskStatusChange?: (taskId: string, status: string) => void
  onTaskAssign?: (taskId: string, responsableId: string) => void
  onTaskArchive?: (task: any) => void
  onTaskDelete?: (taskId: string) => void
  /** Liste des profils pour l'attribution */
  profiles?: ProfilePublic[]
}

export const GanttCategory = memo(
  ({
    category,
    timeline,
    onTaskClick,
    onTaskResizeStart,
    draggedTaskId,
    resizingTaskId,
    isExpanded: isExpandedProp,
    onToggleExpand,
    documentCounts = {},
    getResizePreview,
    onTaskDuplicate,
    onTaskStatusChange,
    onTaskAssign,
    onTaskArchive,
    onTaskDelete,
    profiles = [],
  }: GanttCategoryProps) => {
    const isExpanded = isExpandedProp ?? true

    const getTaskPosition = (task: any) => {
      // Utiliser date_debut si disponible, sinon created_at
      const taskStart = task.date_debut ? new Date(task.date_debut) : new Date(task.created_at)

      const taskEnd = task.echeance ? new Date(task.echeance) : addDays(taskStart, 7)

      const startOffset = differenceInDays(taskStart, timeline.start)
      const duration = differenceInDays(taskEnd, taskStart) || 1

      // Calculer en PIXELS au lieu de pourcentages
      const left = Math.max(0, startOffset * timeline.pixelsPerDay)
      const width = Math.max(timeline.pixelsPerDay * 2, duration * timeline.pixelsPerDay)

      const isOverdue =
        task.statut !== 'Terminé' && task.echeance && isBefore(new Date(task.echeance), new Date())

      return { left, width, isOverdue }
    }

    // Obtenir la position effective (avec preview de resize si applicable)
    const getEffectivePosition = (task: any) => {
      const basePosition = getTaskPosition(task)

      // Si on a une preview de resize pour cette tâche, l'utiliser
      if (getResizePreview) {
        const preview = getResizePreview(task.id)
        if (preview) {
          return {
            left: preview.left,
            width: preview.width,
            isOverdue: basePosition.isOverdue,
          }
        }
      }

      return basePosition
    }

    return (
      <div className="border-b border-border/50">
        {/* Header de catégorie - compact h-10 avec accent glassmorphism */}
        <div
          className="flex items-center gap-2 px-3 bg-card/60 backdrop-blur-sm border-b border-primary/10 border-l-4 h-10 cursor-pointer hover:bg-card/80 transition-colors"
          style={{ borderLeftColor: category.couleur || '#888' }}
          onClick={onToggleExpand}
        >
          <div
            className="w-2.5 h-2.5 rounded-full flex-shrink-0 ring-2 ring-white shadow-sm"
            style={{ backgroundColor: category.couleur || '#888' }}
          />
          <span className="font-medium text-xs truncate">{category.nom}</span>
          <span className="text-xs text-muted-foreground px-1.5 py-0.5 bg-card/50 rounded">
            ({category.tasks.length})
          </span>
          {isExpanded ? (
            <ChevronDown className="w-3.5 h-3.5 ml-auto text-muted-foreground" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5 ml-auto text-muted-foreground" />
          )}
        </div>

        {/* Vue étendue : Liste des tâches individuelles - hauteur réduite h-10 */}
        {isExpanded && (
          <>
            {category.tasks.map((task, index) => (
              <div
                key={task.id}
                className={cn(
                  'relative h-10 border-b border-border/50 hover:bg-muted/20 transition-colors',
                  index % 2 === 0 && 'bg-muted/5'
                )}
              >
                <GanttTaskBar
                  task={task}
                  position={getEffectivePosition(task)}
                  onClick={() => onTaskClick(task)}
                  onResizeStart={
                    onTaskResizeStart
                      ? (handle, startX) => onTaskResizeStart(task.id, handle, startX)
                      : undefined
                  }
                  isDragging={draggedTaskId === task.id}
                  isResizing={resizingTaskId === task.id}
                  documentCount={documentCounts[task.id] || 0}
                  pixelsPerDay={timeline.pixelsPerDay}
                  onDuplicate={onTaskDuplicate ? () => onTaskDuplicate(task) : undefined}
                  onStatusChange={
                    onTaskStatusChange ? (status) => onTaskStatusChange(task.id, status) : undefined
                  }
                  onAssign={
                    onTaskAssign
                      ? (responsableId) => onTaskAssign(task.id, responsableId)
                      : undefined
                  }
                  onArchive={onTaskArchive ? () => onTaskArchive(task) : undefined}
                  onDelete={onTaskDelete ? () => onTaskDelete(task.id) : undefined}
                  profiles={profiles}
                />
              </div>
            ))}
          </>
        )}

        {/* Vue réduite : Barre récapitulative - hauteur réduite h-10 */}
        {!isExpanded && (
          <div className="relative h-10 border-b border-border bg-muted/5">
            <GanttCategorySummaryBar
              category={category}
              timeline={timeline}
              onClick={onToggleExpand || (() => {})}
            />
          </div>
        )}
      </div>
    )
  }
)

GanttCategory.displayName = 'GanttCategory'
