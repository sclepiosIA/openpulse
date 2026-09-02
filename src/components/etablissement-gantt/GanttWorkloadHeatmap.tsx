import { memo, useMemo } from 'react'
import { TimelineConfig } from './hooks/useGanttZoom'
import { eachDayOfInterval, endOfDay, format, isWithinInterval, startOfDay } from 'date-fns'
import { fr } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Task } from '@/types/gantt'

interface GanttWorkloadHeatmapProps {
  tasks: Task[]
  timeline: TimelineConfig
  height: number
  enabled: boolean
}

export const GanttWorkloadHeatmap = memo(({ 
  tasks, 
  timeline, 
  height, 
  enabled 
}: GanttWorkloadHeatmapProps) => {
  const workloadByDay = useMemo(() => {
    if (!enabled || !timeline) return []

    const days = eachDayOfInterval({ start: timeline.start, end: timeline.end })
    
    return days.map((day, index) => {
      // Compter les tâches qui incluent ce jour
      const tasksOnThisDay = tasks.filter(task => {
        if (!task.echeance || !task.created_at) return false
        const taskStart = new Date(task.created_at)
        const taskEnd = new Date(task.echeance)
        return isWithinInterval(day, {
          start: startOfDay(taskStart),
          end: endOfDay(taskEnd),
        })
      })

      const count = tasksOnThisDay.length
      const responsables = new Set(tasksOnThisDay.filter(t => t.responsable_id).map(t => t.responsable_id))

      // Définir l'intensité de la couleur selon la charge
      let intensity = 'bg-transparent'
      if (count >= 10) intensity = 'bg-destructive/30'
      else if (count >= 6) intensity = 'bg-warning/30'
      else if (count >= 3) intensity = 'bg-primary/20'
      else if (count > 0) intensity = 'bg-muted/30'

      const position = (index / days.length) * 100
      const width = (1 / days.length) * 100

      return {
        day,
        count,
        responsablesCount: responsables.size,
        intensity,
        position,
        width
      }
    })
  }, [tasks, timeline, enabled])

  if (!enabled || !timeline) return null

  return (
    <TooltipProvider>
      <div className="absolute inset-0 pointer-events-none z-5">
        {workloadByDay.map((data, index) => (
          // stable: workload buckets are positional within timeline
          <Tooltip key={`workload-${index}`}>
            <TooltipTrigger asChild>
              <div
                className={cn(
                  "absolute top-0 transition-opacity duration-200 pointer-events-auto",
                  data.intensity
                )}
                style={{
                  left: `${data.position}%`,
                  width: `${data.width}%`,
                  height: `${height}px`
                }}
              />
            </TooltipTrigger>
            <TooltipContent>
              <div className="text-sm">
                <p className="font-semibold">{format(data.day, 'EEEE d MMMM', { locale: fr })}</p>
                <p>{data.count} tâche{data.count > 1 ? 's' : ''}</p>
                {data.responsablesCount > 0 && (
                  <p className="text-muted-foreground">{data.responsablesCount} personne{data.responsablesCount > 1 ? 's' : ''}</p>
                )}
              </div>
            </TooltipContent>
          </Tooltip>
        ))}
      </div>
    </TooltipProvider>
  )
})

GanttWorkloadHeatmap.displayName = 'GanttWorkloadHeatmap'
