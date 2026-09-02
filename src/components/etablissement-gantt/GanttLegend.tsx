import { memo, useMemo, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { CheckCircle, Clock, AlertCircle, Circle, ChevronUp, ChevronDown } from 'lucide-react'
import { Task } from '@/types/gantt'
import { TASK_STATUSES } from '@/constants/taskStatuses'

interface GanttLegendProps {
  tasks: Task[]
}

export const GanttLegend = memo(({ tasks }: GanttLegendProps) => {
  const [isOpen, setIsOpen] = useState(false)
  
  const stats = useMemo(() => {
    const total = tasks.length
    const byStatus = {
      [TASK_STATUSES.TODO]: tasks.filter(t => t.statut === TASK_STATUSES.TODO).length,
      [TASK_STATUSES.IN_PROGRESS]: tasks.filter(t => t.statut === TASK_STATUSES.IN_PROGRESS).length,
      [TASK_STATUSES.BLOCKED]: tasks.filter(t => t.statut === TASK_STATUSES.BLOCKED).length,
      [TASK_STATUSES.DONE]: tasks.filter(t => t.statut === TASK_STATUSES.DONE).length,
    }
    const overdue = tasks.filter(t => 
      t.statut !== TASK_STATUSES.DONE && 
      t.echeance && 
      new Date(t.echeance) < new Date()
    ).length

    return { total, byStatus, overdue }
  }, [tasks])

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className="bg-background/95 backdrop-blur-sm border rounded-lg shadow-lg max-w-fit">
        {/* Trigger compact */}
        <CollapsibleTrigger asChild>
          <Button 
            variant="ghost" 
            size="sm" 
            className="w-full flex items-center justify-between gap-2 px-3 py-2"
          >
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">
                {stats.total} tâche{stats.total > 1 ? 's' : ''}
              </span>
              {stats.overdue > 0 && (
                <Badge variant="destructive" className="h-5 px-1.5 text-xs">
                  {stats.overdue} retard
                </Badge>
              )}
            </div>
            {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
          </Button>
        </CollapsibleTrigger>

        {/* Contenu expanded - caché sur mobile */}
        <CollapsibleContent className="hidden md:block">
          <div className="px-3 pb-3 pt-1 space-y-3 border-t">
            {/* Légende des statuts */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1.5 text-xs">
                <Circle className="h-3 w-3 text-muted-foreground" />
                <span>À faire ({stats.byStatus[TASK_STATUSES.TODO]})</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs">
                <Clock className="h-3 w-3 text-primary" />
                <span>En cours ({stats.byStatus[TASK_STATUSES.IN_PROGRESS]})</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs">
                <AlertCircle className="h-3 w-3 text-destructive" />
                <span>Bloqué ({stats.byStatus[TASK_STATUSES.BLOCKED]})</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs">
                <CheckCircle className="h-3 w-3 text-success" />
                <span>Terminé ({stats.byStatus[TASK_STATUSES.DONE]})</span>
              </div>
            </div>

            {/* Légende des priorités */}
            <div className="flex items-center gap-3 text-xs">
              <span className="text-muted-foreground">Priorité :</span>
              <div className="flex items-center gap-1">
                <div className="w-2.5 h-2.5 bg-destructive rounded" />
                <span>Haute</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2.5 h-2.5 bg-warning rounded" />
                <span>Moyenne</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2.5 h-2.5 bg-muted rounded" />
                <span>Basse</span>
              </div>
            </div>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  )
})

GanttLegend.displayName = 'GanttLegend'
