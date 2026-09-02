import { LayoutGrid, List, BarChart3, Clock, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { ProductionView } from './ProductionViewSelector'

interface ProductionViewSelectorCompactProps {
  currentView: ProductionView
  onViewChange: (view: ProductionView) => void
}

const VIEW_OPTIONS: { value: ProductionView; icon: React.ElementType; label: string }[] = [
  { value: 'grid', icon: LayoutGrid, label: 'Grille' },
  { value: 'list', icon: List, label: 'Liste' },
  { value: 'analytics', icon: BarChart3, label: 'Analytique' },
  { value: 'timeline', icon: Clock, label: 'Chrono' },
  { value: 'cohorts', icon: Users, label: 'Cohortes' },
]

export function ProductionViewSelectorCompact({
  currentView,
  onViewChange,
}: ProductionViewSelectorCompactProps) {
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
