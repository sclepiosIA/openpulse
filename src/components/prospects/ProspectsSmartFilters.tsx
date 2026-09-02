import { Badge } from '@/components/ui/badge'
import { Star, Clock, TrendingUp, AlertTriangle, Target } from 'lucide-react'
import { cn } from '@/lib/utils'

export type ProspectSmartFilter = 'all' | 'hot' | 'recent' | 'stalled' | 'high_value'

interface SmartFilter {
  id: ProspectSmartFilter
  label: string
  icon: typeof Star
  description: string
}

const SMART_FILTERS: SmartFilter[] = [
  { id: 'all', label: 'Tous', icon: Target, description: 'Tous les prospects' },
  { id: 'hot', label: 'Chauds', icon: TrendingUp, description: 'Progression > 50%' },
  { id: 'recent', label: 'Récents', icon: Clock, description: 'Créés cette semaine' },
  { id: 'stalled', label: 'En pause', icon: AlertTriangle, description: 'Sans activité 30j+' },
  { id: 'high_value', label: 'Fort potentiel', icon: Star, description: 'CA > 50k€' },
]

interface ProspectsSmartFiltersProps {
  activeFilter: ProspectSmartFilter
  onFilterChange: (filter: ProspectSmartFilter) => void
  counts?: Record<ProspectSmartFilter, number>
  /** Mode compact pour mobile - icônes only avec glassmorphism */
  compact?: boolean
}

export function ProspectsSmartFilters({
  activeFilter,
  onFilterChange,
  counts,
  compact = false,
}: ProspectsSmartFiltersProps) {
  if (compact) {
    return (
      <div className="flex items-center gap-1 flex-nowrap">
        {SMART_FILTERS.map(({ id, icon: Icon, description }) => {
          const isActive = activeFilter === id
          const count = counts?.[id]

          return (
            <Badge
              key={id}
              variant="outline"
              className={cn(
                'cursor-pointer gap-0.5 h-6 px-1.5 transition-all rounded-lg backdrop-blur-sm border shrink-0',
                isActive
                  ? 'bg-card text-primary border-white shadow-md'
                  : 'bg-card/10 text-white/70 border-white/20 hover:bg-card/20 hover:text-white'
              )}
              onClick={() => onFilterChange(id)}
              title={description}
            >
              <Icon className="h-3 w-3" />
              {count !== undefined && <span className="text-[10px] font-semibold">{count}</span>}
            </Badge>
          )
        })}
      </div>
    )
  }

  return (
    <div className="flex flex-wrap gap-2">
      {SMART_FILTERS.map(({ id, label, icon: Icon, description }) => (
        <Badge
          key={id}
          variant="outline"
          className={cn(
            'cursor-pointer gap-1.5 px-3 py-1.5 transition-all rounded-lg backdrop-blur-sm border',
            activeFilter === id
              ? 'bg-card text-primary border-white shadow-md font-medium'
              : 'bg-card/10 text-white/90 border-white/20 hover:bg-card/20 hover:text-white hover:border-white/30'
          )}
          onClick={() => onFilterChange(id)}
          title={description}
        >
          <Icon className="h-3.5 w-3.5" />
          {label}
          {counts && counts[id] !== undefined && (
            <span
              className={cn(
                'ml-1 text-xs font-semibold',
                activeFilter === id ? 'text-primary/70' : 'text-white/70'
              )}
            >
              ({counts[id]})
            </span>
          )}
        </Badge>
      ))}
    </div>
  )
}
