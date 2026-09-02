import { Target, Rocket, CheckCircle, X, Layers } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

type FilterType = 'all' | 'prospects' | 'deploiement' | 'production'

interface PhaseFiltersCompactProps {
  mapFilter: FilterType
  onFilterChange: (filter: FilterType) => void
  counts: {
    all: number
    prospects: number
    deploiement: number
    production: number
  }
  selectedRegion?: string | null
  onClearRegion?: () => void
}

const FILTERS: { key: FilterType; icon: typeof Target; label: string; activeClass: string }[] = [
  { key: 'all', icon: Layers, label: 'Tous', activeClass: 'bg-card text-primary' },
  {
    key: 'prospects',
    icon: Target,
    label: 'Prosp.',
    activeClass: 'bg-amber-500 text-white border-amber-500',
  },
  {
    key: 'deploiement',
    icon: Rocket,
    label: 'Dépl.',
    activeClass: 'bg-blue-500 text-white border-blue-500',
  },
  {
    key: 'production',
    icon: CheckCircle,
    label: 'Prod.',
    activeClass: 'bg-emerald-500 text-white border-emerald-500',
  },
]

export function PhaseFiltersCompact({
  mapFilter,
  onFilterChange,
  counts,
  selectedRegion,
  onClearRegion,
}: PhaseFiltersCompactProps) {
  return (
    <div className="flex items-center gap-1 flex-nowrap">
      {FILTERS.map(({ key, icon: Icon, activeClass }) => {
        const isActive = mapFilter === key
        const count = counts[key]

        return (
          <Button
            key={key}
            variant="ghost"
            size="sm"
            onClick={() => onFilterChange(key)}
            className={cn(
              'h-6 px-1.5 gap-0.5 rounded-lg shrink-0',
              'bg-card/10 backdrop-blur-sm border border-white/20 text-white/70',
              'hover:bg-card/20 hover:text-white',
              isActive && activeClass,
              isActive && 'shadow-md'
            )}
          >
            <Icon className="h-3 w-3" />
            <span className="text-[10px] font-semibold">{count}</span>
          </Button>
        )
      })}

      {/* Selected region badge */}
      {selectedRegion && onClearRegion && (
        <Badge
          variant="secondary"
          className="h-6 px-1.5 gap-0.5 bg-card/90 text-primary text-[10px] font-medium shrink-0 cursor-pointer hover:bg-card"
          onClick={onClearRegion}
        >
          <span className="max-w-[60px] truncate">{selectedRegion}</span>
          <X className="h-2.5 w-2.5" />
        </Badge>
      )}
    </div>
  )
}
