import { BarChart3, Grid3x3, Table, TrendingUp, Target } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { RapportsView } from '@/hooks/analytics/useRapportsFilters'

interface RapportsViewSelectorCompactProps {
  currentView: RapportsView
  onViewChange: (view: RapportsView) => void
}

const VIEW_OPTIONS: { value: RapportsView; icon: React.ElementType; label: string }[] = [
  { value: 'dashboard', icon: Grid3x3, label: 'Dashboard' },
  { value: 'charts', icon: BarChart3, label: 'Graphiques' },
  { value: 'table', icon: Table, label: 'Tableau' },
  { value: 'evolution', icon: TrendingUp, label: 'Évolution' },
  { value: 'goals', icon: Target, label: 'Objectifs' },
]

export function RapportsViewSelectorCompact({
  currentView,
  onViewChange,
}: RapportsViewSelectorCompactProps) {
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
