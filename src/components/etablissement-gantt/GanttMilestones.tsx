import { memo, useMemo } from 'react'
import { TimelineConfig } from './hooks/useGanttZoom'
import { differenceInDays, format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

interface GanttMilestonesProps {
  tasks: any[]
  timeline: TimelineConfig
  height: number
}

interface Milestone {
  id: string
  title: string
  date: Date
  type: 'high_priority' | 'deadline' | 'phase'
  color: string
  relatedTasks: any[]
}

export const GanttMilestones = memo(({ tasks, timeline, height }: GanttMilestonesProps) => {
  const milestones = useMemo((): Milestone[] => {
    const ms: Milestone[] = []

    // Jalons prioritaires (tâches haute priorité avec deadline)
    const highPriorityTasks = tasks.filter(t => 
      t.priorite === 'high' && 
      t.echeance && 
      t.statut !== 'Terminé'
    )

    highPriorityTasks.forEach(task => {
      ms.push({
        id: `hp_${task.id}`,
        title: task.titre,
        date: new Date(task.echeance),
        type: 'high_priority',
        color: 'bg-destructive',
        relatedTasks: [task]
      })
    })

    // Jalons de phase (regrouper les deadlines proches)
    const tasksByDeadline = tasks
      .filter(t => t.echeance && t.statut !== 'Terminé')
      .sort((a, b) => new Date(a.echeance).getTime() - new Date(b.echeance).getTime())

    // Grouper les tâches dont les deadlines sont à moins de 3 jours
    const groups: { date: Date; tasks: any[] }[] = []
    tasksByDeadline.forEach(task => {
      const taskDate = new Date(task.echeance)
      let foundGroup = false
      
      for (const group of groups) {
        if (Math.abs(differenceInDays(group.date, taskDate)) <= 3) {
          group.tasks.push(task)
          foundGroup = true
          break
        }
      }
      
      if (!foundGroup) {
        groups.push({ date: taskDate, tasks: [task] })
      }
    })

    // Créer des jalons pour les groupes importants (3+ tâches)
    groups.forEach((group, idx) => {
      if (group.tasks.length >= 3) {
        ms.push({
          id: `phase_${idx}`,
          title: `Jalon : ${group.tasks.length} tâches`,
          date: group.date,
          type: 'phase',
          color: 'bg-primary',
          relatedTasks: group.tasks
        })
      }
    })

    // Trier par date
    return ms.sort((a, b) => a.date.getTime() - b.date.getTime())
  }, [tasks])

  const getMilestonePosition = (date: Date) => {
    const offset = differenceInDays(date, timeline.start)
    return Math.max(0, Math.min(100, (offset / timeline.totalDays) * 100))
  }

  return (
    <TooltipProvider>
      <div className="absolute inset-0 pointer-events-none z-10">
        {milestones.map((milestone) => {
          const position = getMilestonePosition(milestone.date)
          
          // Ne pas afficher les jalons hors de la vue
          if (position < 0 || position > 100) return null

          return (
            <Tooltip key={milestone.id}>
              <TooltipTrigger asChild>
                <div
                  className="absolute top-0 pointer-events-auto"
                  style={{
                    left: `${position}%`,
                    height: `${height}px`
                  }}
                >
                  {/* Ligne verticale pointillée */}
                  <div 
                    className={cn(
                      "absolute left-1/2 -translate-x-1/2 w-0.5 border-l-2 border-dashed opacity-50",
                      milestone.type === 'high_priority' ? "border-destructive" :
                      milestone.type === 'phase' ? "border-primary" :
                      "border-warning"
                    )}
                    style={{ height: `${height}px` }}
                  />

                  {/* Losange au sommet */}
                  <div
                    className={cn(
                      "absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 rotate-45 border-2 border-background shadow-lg",
                      milestone.color
                    )}
                  />
                </div>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs">
                <div className="space-y-2">
                  <div>
                    <p className="font-semibold">{milestone.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {format(milestone.date, 'EEEE d MMMM yyyy', { locale: fr })}
                    </p>
                  </div>
                  {milestone.relatedTasks.length > 0 && (
                    <div className="text-xs space-y-1">
                      <p className="font-medium">Tâches associées:</p>
                      <ul className="list-disc list-inside space-y-0.5">
                        {milestone.relatedTasks.slice(0, 3).map(task => (
                          <li key={task.id} className="truncate">{task.titre}</li>
                        ))}
                        {milestone.relatedTasks.length > 3 && (
                          <li className="text-muted-foreground">
                            +{milestone.relatedTasks.length - 3} autre{milestone.relatedTasks.length - 3 > 1 ? 's' : ''}
                          </li>
                        )}
                      </ul>
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {differenceInDays(milestone.date, new Date()) >= 0 
                      ? `Dans ${differenceInDays(milestone.date, new Date())} jour${differenceInDays(milestone.date, new Date()) > 1 ? 's' : ''}`
                      : `Il y a ${Math.abs(differenceInDays(milestone.date, new Date()))} jour${Math.abs(differenceInDays(milestone.date, new Date())) > 1 ? 's' : ''}`
                    }
                  </p>
                </div>
              </TooltipContent>
            </Tooltip>
          )
        })}
      </div>
    </TooltipProvider>
  )
})

GanttMilestones.displayName = 'GanttMilestones'
