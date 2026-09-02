import { List, GitBranch, GanttChart } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { DeploymentView } from './DeploymentViewSelector'

interface DeploymentViewSelectorCompactProps {
  currentView: DeploymentView
  onViewChange: (view: DeploymentView) => void
}

const VIEW_OPTIONS: { value: DeploymentView; icon: React.ElementType; label: string }[] = [
  { value: 'list', icon: List, label: 'Liste' },
  { value: 'timeline', icon: GitBranch, label: 'Chronologie' },
  { value: 'gantt', icon: GanttChart, label: 'Gantt' },
]

export function DeploymentViewSelectorCompact({
  currentView,
  onViewChange,
}: DeploymentViewSelectorCompactProps) {
  return (
    <div className="flex items-center gap-0.5 p-0.5 rounded-lg bg-card/10 backdrop-blur-sm border border-white/20">
      {VIEW_OPTIONS.map(({ value, icon: Icon, label }) => {
        const isActive = currentView === value
        return (
          <Button
            key={value}
            variant="ghost"
            size="sm"
            onClick={() => onViewChange(value)}
            title={label}
            className={cn(
              'h-6 w-6 p-0 rounded-md transition-all',
              isActive
                ? 'bg-card text-primary shadow-md'
                : 'text-white/70 hover:bg-card/20 hover:text-white'
            )}
          >
            <Icon className="h-3 w-3" />
          </Button>
        )
      })}
    </div>
  )
}
