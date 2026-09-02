import { List, GanttChart, GitBranch } from 'lucide-react'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export type DeploymentView = 'list' | 'timeline' | 'gantt'

interface DeploymentViewSelectorProps {
  currentView: DeploymentView
  onViewChange: (view: DeploymentView) => void
}

const VIEWS = [
  { value: 'list', label: 'Liste', icon: List },
  { value: 'timeline', label: 'Chronologie', icon: GitBranch },
  { value: 'gantt', label: 'Gantt', icon: GanttChart },
] as const

export function DeploymentViewSelector({ currentView, onViewChange }: DeploymentViewSelectorProps) {
  const currentViewData = VIEWS.find(v => v.value === currentView) || VIEWS[0]
  const CurrentIcon = currentViewData.icon

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm font-medium text-muted-foreground hidden sm:inline">Vue:</span>
      
      {/* Mobile: Select dropdown */}
      <div className="sm:hidden">
        <Select value={currentView} onValueChange={(v) => onViewChange(v as DeploymentView)}>
          <SelectTrigger className="w-[140px] h-9">
            <CurrentIcon className="w-4 h-4 mr-2" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {VIEWS.map(view => {
              const Icon = view.icon
              return (
                <SelectItem key={view.value} value={view.value}>
                  <div className="flex items-center gap-2">
                    <Icon className="w-4 h-4" />
                    {view.label}
                  </div>
                </SelectItem>
              )
            })}
          </SelectContent>
        </Select>
      </div>

      {/* Desktop: Tabs */}
      <div className="hidden sm:block">
        <Tabs value={currentView} onValueChange={(v) => onViewChange(v as DeploymentView)}>
          <TabsList className="h-auto">
            {VIEWS.map(view => {
              const Icon = view.icon
              return (
                <TabsTrigger key={view.value} value={view.value} className="gap-1.5 px-3">
                  <Icon className="w-4 h-4" />
                  <span className="text-xs">{view.label}</span>
                </TabsTrigger>
              )
            })}
          </TabsList>
        </Tabs>
      </div>
    </div>
  )
}
