import { BarChart3, Grid3x3, Table, TrendingUp, Target } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { RapportsView } from '@/hooks/analytics/useRapportsFilters'
import { cn } from '@/lib/utils'

interface RapportsViewSelectorProps {
  currentView: RapportsView
  onViewChange: (view: RapportsView) => void
}

const VIEWS = [
  { value: 'dashboard', label: 'Tableau de bord', icon: Grid3x3 },
  { value: 'charts', label: 'Graphiques', icon: BarChart3 },
  { value: 'table', label: 'Tableau', icon: Table },
  { value: 'evolution', label: 'Évolution', icon: TrendingUp },
  { value: 'goals', label: 'Objectifs', icon: Target },
] as const

export function RapportsViewSelector({ currentView, onViewChange }: RapportsViewSelectorProps) {
  return (
    <TooltipProvider delayDuration={100}>
      <div className="flex items-center gap-0.5 border rounded-md p-0.5 bg-muted/30">
        {VIEWS.map(view => {
          const Icon = view.icon
          const isActive = currentView === view.value
          return (
            <Tooltip key={view.value}>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onViewChange(view.value as RapportsView)}
                  className={cn(
                    "h-6 w-6 p-0",
                    isActive && "bg-background shadow-sm"
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">
                {view.label}
              </TooltipContent>
            </Tooltip>
          )
        })}
      </div>
    </TooltipProvider>
  )
}
