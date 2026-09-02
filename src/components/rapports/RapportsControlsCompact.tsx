import { Table2, LayoutGrid, Map, BarChart, PieChart, CalendarRange, Filter } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface RapportsControlsCompactProps {
  activeView: string
  onViewChange: (view: string) => void
  period: string
  onPeriodChange: (period: string) => void
  onFiltersClick?: () => void
  hasActiveFilters?: boolean
}

const views = [
  { id: 'table', icon: Table2, label: 'Tableau' },
  { id: 'cards', icon: LayoutGrid, label: 'Cartes' },
  { id: 'map', icon: Map, label: 'Carte' },
  { id: 'bar', icon: BarChart, label: 'Barres' },
  { id: 'pie', icon: PieChart, label: 'Camembert' },
] as const

const periods = [
  { value: 'month', label: 'Ce mois' },
  { value: 'quarter', label: 'Ce trimestre' },
  { value: 'year', label: 'Cette année' },
  { value: 'all', label: 'Tout' },
] as const

export function RapportsControlsCompact({
  activeView,
  onViewChange,
  period,
  onPeriodChange,
  onFiltersClick,
  hasActiveFilters = false,
}: RapportsControlsCompactProps) {
  return (
    <div className="flex items-center gap-2">
      {/* Period selector */}
      <Select value={period} onValueChange={onPeriodChange}>
        <SelectTrigger className="h-7 w-auto min-w-[100px] bg-card/10 backdrop-blur-sm border-white/20 text-white text-xs rounded-lg">
          <CalendarRange className="h-3 w-3 mr-1" />
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="bg-card">
          {periods.map((p) => (
            <SelectItem key={p.value} value={p.value}>
              {p.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Filters toggle */}
      {onFiltersClick && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onFiltersClick}
          aria-label={hasActiveFilters ? 'Filtres actifs — modifier' : 'Filtrer'}
          title="Filtrer"
          aria-pressed={hasActiveFilters}
          className={cn(
            'h-7 w-7 p-0 rounded-lg',
            hasActiveFilters
              ? 'bg-card text-primary shadow-md'
              : 'bg-card/10 backdrop-blur-sm border border-white/20 text-white/70 hover:bg-card/20 hover:text-white'
          )}
        >
          <Filter className="h-3.5 w-3.5" />
        </Button>
      )}

      {/* View selector */}
      <div className="flex items-center gap-0.5 bg-card/5 rounded-lg p-0.5">
        {views.map((view) => {
          const Icon = view.icon
          const isActive = activeView === view.id

          return (
            <button
              key={view.id}
              onClick={() => onViewChange(view.id)}
              className={cn(
                'flex items-center justify-center h-6 w-6 rounded-md transition-all',
                isActive
                  ? 'bg-card text-primary shadow-sm'
                  : 'text-white/60 hover:text-white hover:bg-card/10'
              )}
              title={view.label}
            >
              <Icon className="h-3.5 w-3.5" />
            </button>
          )
        })}
      </div>
    </div>
  )
}
