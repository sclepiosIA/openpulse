import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { CalendarX, ChevronDown, ChevronRight } from 'lucide-react'
import type { TacheData } from '@/lib/validations'

interface GanttUnplannedTasksAlertProps {
  unplannedTasks: TacheData[]
  expanded: boolean
  onExpandedChange: (open: boolean) => void
  onTaskClick: (task: TacheData) => void
}

export function GanttUnplannedTasksAlert({
  unplannedTasks,
  expanded,
  onExpandedChange,
  onTaskClick,
}: GanttUnplannedTasksAlertProps) {
  if (unplannedTasks.length === 0) return null

  return (
    <Collapsible open={expanded} onOpenChange={onExpandedChange}>
      <div className="flex items-center gap-2 px-3 py-2 mx-2 mt-2 bg-warning/10 border border-warning/30 rounded-md">
        <CalendarX className="h-4 w-4 text-warning flex-shrink-0" />
        <span className="text-sm font-medium">
          {unplannedTasks.length} tâche{unplannedTasks.length > 1 ? 's' : ''} sans dates
        </span>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm" className="h-6 px-2 ml-auto">
            {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          </Button>
        </CollapsibleTrigger>
      </div>
      <CollapsibleContent className="mt-2 mx-2">
        <div className="max-h-32 overflow-y-auto space-y-1 px-1">
          {unplannedTasks.slice(0, 10).map((task: any) => (
            <div
              key={task.id}
              className="flex items-center justify-between p-2 bg-background rounded border text-sm hover:bg-muted/50 cursor-pointer"
              onClick={() => onTaskClick(task)}
            >
              <span className="truncate flex-1">{task.titre}</span>
              <Button variant="outline" size="sm" className="h-6 text-xs ml-2">
                Planifier
              </Button>
            </div>
          ))}
          {unplannedTasks.length > 10 && (
            <p className="text-xs text-muted-foreground text-center py-1">
              Et {unplannedTasks.length - 10} autres...
            </p>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}
