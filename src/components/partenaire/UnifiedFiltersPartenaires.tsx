import {
  Star,
  Sparkles,
  Flame,
  Gem,
  User,
  Building2,
  Factory,
  Users,
  UserCheck,
  UserPlus,
  Handshake,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'

interface UnifiedFiltersPartenairesProps {
  activeFilter: string
  onFilterChange: (filter: string) => void
  counts: {
    all: number
    favorites: number
    new: number
    toRelance: number
    highValue: number
    mine: number
    institutionnel: number
    industriel: number
    actifs: number
    prospects: number
    apporteurs: number
  }
  compact?: boolean
}

export function UnifiedFiltersPartenaires({
  activeFilter,
  onFilterChange,
  counts,
  compact = false,
}: UnifiedFiltersPartenairesProps) {
  // Main status filters
  const mainFilters = [
    { id: 'all', label: 'Tous', icon: Users, count: counts.all },
    { id: 'actif', label: 'Actifs', icon: UserCheck, count: counts.actifs },
    { id: 'prospect', label: 'Prospects', icon: UserPlus, count: counts.prospects },
  ]

  // Smart filters as badges
  const smartBadges = [
    {
      id: 'apporteurs',
      icon: Handshake,
      count: counts.apporteurs,
      color: 'text-emerald-600',
      label: 'Apporteurs',
    },
    {
      id: 'favorites',
      icon: Star,
      count: counts.favorites,
      color: 'text-yellow-600',
      label: 'Favoris',
    },
    { id: 'new', icon: Sparkles, count: counts.new, color: 'text-blue-600', label: 'Nouveaux' },
    {
      id: 'to_relance',
      icon: Flame,
      count: counts.toRelance,
      color: 'text-orange-600',
      label: 'À relancer',
    },
    {
      id: 'high_value',
      icon: Gem,
      count: counts.highValue,
      color: 'text-purple-600',
      label: 'Forte valeur',
    },
  ]

  // Type filters (secondary) - hidden on compact
  const typeFilters = [
    {
      id: 'institutionnel_only',
      icon: Building2,
      count: counts.institutionnel,
      color: 'text-indigo-600',
      label: 'Instit.',
    },
    {
      id: 'industriel_only',
      icon: Factory,
      count: counts.industriel,
      color: 'text-cyan-600',
      label: 'Indust.',
    },
    { id: 'mine', icon: User, count: counts.mine, color: 'text-green-600', label: 'Mes part.' },
  ]

  const isMainFilter = mainFilters.some((f) => f.id === activeFilter)
  const currentMainValue = isMainFilter ? activeFilter : 'all'

  // Compact mode for mobile - glassmorphism style
  if (compact) {
    return (
      <div className="flex items-center gap-1 flex-nowrap">
        {/* Main filters as compact icon badges */}
        {mainFilters.map((filter) => {
          const Icon = filter.icon
          const isActive = currentMainValue === filter.id

          return (
            <Badge
              key={filter.id}
              variant="outline"
              className={cn(
                'cursor-pointer h-6 text-[10px] gap-0.5 px-1.5 transition-all rounded-md backdrop-blur-sm border shrink-0',
                isActive
                  ? 'bg-card text-primary border-white shadow-md'
                  : 'bg-card/10 text-white/70 border-white/20 hover:bg-card/20 hover:text-white'
              )}
              onClick={() => onFilterChange(filter.id)}
            >
              <Icon className="h-3 w-3" />
              <span className="font-semibold">{filter.count}</span>
            </Badge>
          )
        })}

        <div className="h-4 w-px bg-card/20 shrink-0" />

        {/* Smart filter badges - icon only */}
        {smartBadges.map((badge) => {
          const Icon = badge.icon
          const isActive = activeFilter === badge.id

          return (
            <Badge
              key={badge.id}
              variant="outline"
              className={cn(
                'cursor-pointer h-6 text-[10px] gap-0.5 px-1.5 transition-all rounded-md backdrop-blur-sm border shrink-0',
                isActive
                  ? 'bg-card text-primary border-white shadow-md'
                  : 'bg-card/10 text-white/70 border-white/20 hover:bg-card/20 hover:text-white'
              )}
              onClick={() => onFilterChange(isActive ? 'all' : badge.id)}
            >
              <Icon className={cn('h-3 w-3', !isActive && 'text-white/80')} />
              <span className="font-semibold">{badge.count}</span>
            </Badge>
          )
        })}
      </div>
    )
  }

  // Desktop mode - full layout
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Main status tabs */}
      <Tabs value={currentMainValue} onValueChange={onFilterChange}>
        <TabsList className="h-7 bg-muted/30">
          {mainFilters.map((filter) => (
            <TabsTrigger key={filter.id} value={filter.id} className="text-xs h-6 px-2 gap-1">
              {filter.label}
              <Badge variant="secondary" className="h-4 px-1 text-[10px] ml-0.5">
                {filter.count}
              </Badge>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <Separator orientation="vertical" className="h-5 hidden sm:block" />

      {/* Smart filter badges - glassmorphism style */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {smartBadges.map((badge) => {
          const Icon = badge.icon
          const isActive = activeFilter === badge.id

          return (
            <Badge
              key={badge.id}
              variant="outline"
              className={cn(
                'cursor-pointer h-7 text-xs gap-1.5 px-2.5 transition-all rounded-lg backdrop-blur-sm border',
                isActive
                  ? 'bg-primary text-primary-foreground border-primary shadow-md'
                  : 'bg-card/60 text-foreground/80 border-primary/15 hover:bg-card hover:border-primary/30 hover:shadow-sm'
              )}
              onClick={() => onFilterChange(isActive ? 'all' : badge.id)}
            >
              <Icon className={cn('h-3.5 w-3.5', !isActive && badge.color)} />
              <span className="hidden lg:inline font-medium">{badge.label}</span>
              <span className="font-semibold">{badge.count}</span>
            </Badge>
          )
        })}
      </div>

      {/* Type filters - hidden on mobile */}
      <div className="hidden md:flex items-center gap-1.5">
        <Separator orientation="vertical" className="h-5" />
        {typeFilters.map((filter) => {
          const Icon = filter.icon
          const isActive = activeFilter === filter.id

          return (
            <Badge
              key={filter.id}
              variant="outline"
              className={cn(
                'cursor-pointer h-7 text-xs gap-1.5 px-2.5 transition-all rounded-lg backdrop-blur-sm border',
                isActive
                  ? 'bg-primary text-primary-foreground border-primary shadow-md'
                  : 'bg-card/60 text-foreground/80 border-primary/15 hover:bg-card hover:border-primary/30 hover:shadow-sm'
              )}
              onClick={() => onFilterChange(isActive ? 'all' : filter.id)}
            >
              <Icon className={cn('h-3.5 w-3.5', !isActive && filter.color)} />
              <span className="hidden xl:inline font-medium">{filter.label}</span>
              <span className="font-semibold">{filter.count}</span>
            </Badge>
          )
        })}
      </div>
    </div>
  )
}
