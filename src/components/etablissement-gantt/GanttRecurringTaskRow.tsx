import { memo, useState } from 'react'
import { cn } from '@/lib/utils'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Badge } from '@/components/ui/badge'
import { Repeat, CheckCircle, Clock, AlertCircle, Circle } from 'lucide-react'
import { format, differenceInDays, addDays, isBefore } from 'date-fns'
import { fr } from 'date-fns/locale'
import { TimelineConfig } from './hooks/useGanttZoom'
import { getRoleColor, getRoleLabel } from '@/lib/roleColors'

interface GanttRecurringTaskRowProps {
  parentTask: any
  occurrences: any[]
  timeline: TimelineConfig
  onTaskClick: (task: any) => void
  categoryColor?: string
  responsableRole?: string | null
}

const statutColors = {
  "A faire": "bg-muted border-muted-foreground/30",
  "En cours": "bg-primary/20 border-primary/50",
  "Bloqué": "bg-destructive/20 border-destructive/50",
  "Terminé": "bg-success/20 border-success/50"
}

const statutIcons = {
  "A faire": Circle,
  "En cours": Clock,
  "Bloqué": AlertCircle,
  "Terminé": CheckCircle
}

export const GanttRecurringTaskRow = memo(({
  parentTask,
  occurrences,
  timeline,
  onTaskClick,
  categoryColor = '#3b82f6',
  responsableRole
}: GanttRecurringTaskRowProps) => {
  const [hoveredOccurrence, setHoveredOccurrence] = useState<string | null>(null)

  const getOccurrencePosition = (task: any) => {
    const taskStart = task.date_debut 
      ? new Date(task.date_debut) 
      : new Date(task.created_at)
    
    const taskEnd = task.echeance ? new Date(task.echeance) : addDays(taskStart, 1)
    
    const startOffset = differenceInDays(taskStart, timeline.start)
    const duration = differenceInDays(taskEnd, taskStart) || 1
    
    const left = Math.max(0, startOffset * timeline.pixelsPerDay)
    const width = Math.max(timeline.pixelsPerDay * 0.8, duration * timeline.pixelsPerDay)
    
    const isOverdue = task.statut !== "Terminé" && 
                     task.echeance && 
                     isBefore(new Date(task.echeance), new Date())

    return { left, width, isOverdue }
  }

  // Count completed vs total
  const completedCount = occurrences.filter(o => o.statut === 'Terminé').length
  const overdueCount = occurrences.filter(o => {
    return o.statut !== 'Terminé' && o.echeance && isBefore(new Date(o.echeance), new Date())
  }).length
  
  // Couleur du rôle
  const roleColor = getRoleColor(responsableRole)

  return (
    <div className="relative h-10 w-full">
      {/* Render each occurrence as a small bar */}
      {occurrences.map((occurrence, index) => {
        const position = getOccurrencePosition(occurrence)
        const StatusIcon = statutIcons[occurrence.statut as keyof typeof statutIcons] || Circle
        const isHovered = hoveredOccurrence === occurrence.id
        
        return (
          <TooltipProvider key={occurrence.id}>
            <Tooltip>
              <TooltipTrigger asChild>
                <div
                  className={cn(
                    "absolute top-1 h-8 rounded cursor-pointer transition-all duration-150 border",
                    "flex items-center justify-center overflow-hidden",
                    statutColors[occurrence.statut as keyof typeof statutColors] || "bg-muted",
                    position.isOverdue && "ring-1 ring-destructive/50",
                    isHovered && "scale-110 shadow-lg z-20"
                  )}
                  style={{
                    left: `${position.left}px`,
                    width: `${Math.max(position.width, 20)}px`,
                    borderLeftColor: categoryColor,
                    borderLeftWidth: '3px'
                  }}
                  onClick={() => onTaskClick(occurrence)}
                  onMouseEnter={() => setHoveredOccurrence(occurrence.id)}
                  onMouseLeave={() => setHoveredOccurrence(null)}
                >
                  {/* Barre supérieure colorée par rôle */}
                  <div 
                    className="absolute top-0 left-0 right-0 h-[2px]"
                    style={{ backgroundColor: roleColor.hex }}
                    title={getRoleLabel(responsableRole)}
                  />
                  {/* Show icon for small bars, title for larger ones */}
                  {position.width > 60 ? (
                    <span className="text-[10px] font-medium truncate px-1">
                      {format(new Date(occurrence.date_debut), 'dd/MM', { locale: fr })}
                    </span>
                  ) : (
                    <StatusIcon className={cn(
                      "h-3 w-3",
                      occurrence.statut === "Terminé" && "text-success",
                      occurrence.statut === "En cours" && "text-primary",
                      occurrence.statut === "Bloqué" && "text-destructive",
                      occurrence.statut === "A faire" && "text-muted-foreground"
                    )} />
                  )}
                </div>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs">
                <div className="space-y-1">
                  <p className="font-semibold text-sm flex items-center gap-1">
                    <Repeat className="h-3 w-3" />
                    {parentTask.titre}
                  </p>
                  <div className="text-xs text-muted-foreground space-y-0.5">
                    <p>Occurrence {index + 1}/{occurrences.length}</p>
                    <p>Date : {format(new Date(occurrence.date_debut), 'PPP', { locale: fr })}</p>
                    {occurrence.echeance && (
                      <p>Échéance : {format(new Date(occurrence.echeance), 'PPP', { locale: fr })}</p>
                    )}
                    <p>Statut : {occurrence.statut}</p>
                  </div>
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )
      })}
      
      {/* Summary badge at the end */}
      {occurrences.length > 1 && (
        <div 
          className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 pointer-events-none"
        >
          <Badge variant="outline" className="h-5 text-[10px] gap-1 bg-background/80">
            <Repeat className="h-2.5 w-2.5" />
            {completedCount}/{occurrences.length}
          </Badge>
          {overdueCount > 0 && (
            <Badge variant="destructive" className="h-5 text-[10px]">
              {overdueCount} retard
            </Badge>
          )}
        </div>
      )}
    </div>
  )
})

GanttRecurringTaskRow.displayName = 'GanttRecurringTaskRow'
