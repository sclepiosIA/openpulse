import { useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Star, Sparkles, Building2, Users, Filter, ChevronDown } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { Groupe } from '@/hooks/crm/useGroupes'
import { differenceInDays } from 'date-fns'
import { cn } from '@/lib/utils'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface GroupesFiltersBarProps {
  groupes: Groupe[]
  compact?: boolean
}

const TYPES = [
  { value: null, label: 'Tous les types' },
  { value: 'GHT', label: 'GHT' },
  { value: 'Groupe Cliniques', label: 'Groupe Cliniques' },
  { value: 'Consortium', label: 'Consortium' },
  { value: 'Autre', label: 'Autre' },
]

export function GroupesFiltersBar({ groupes, compact = false }: GroupesFiltersBarProps) {
  const [searchParams, setSearchParams] = useSearchParams()
  const currentType = searchParams.get('type')
  const currentSmartFilter = searchParams.get('smart_filter')

  const handleTypeFilter = (type: string | null) => {
    const newSearchParams = new URLSearchParams(searchParams)
    if (type === null) {
      newSearchParams.delete('type')
    } else {
      newSearchParams.set('type', type)
    }
    setSearchParams(newSearchParams)
  }

  const handleSmartFilter = (filter: string | null) => {
    const newSearchParams = new URLSearchParams(searchParams)
    if (filter === null || currentSmartFilter === filter) {
      newSearchParams.delete('smart_filter')
    } else {
      newSearchParams.set('smart_filter', filter)
    }
    setSearchParams(newSearchParams)
  }

  // Compteurs pour les smart filters
  const counts = useMemo(() => {
    const now = new Date()
    return {
      nouveaux: groupes.filter((g) => differenceInDays(now, new Date(g.created_at)) <= 30).length,
      ght: groupes.filter((g) => g.type === 'GHT').length,
      grosses: groupes.filter((g) => g.nombre_etablissements > 5).length,
    }
  }, [groupes])

  const currentTypeLabel = TYPES.find((t) => t.value === currentType)?.label || 'Tous les types'

  // Classes conditionnelles pour le mode compact (mobile)
  const buttonClass = compact ? 'h-6 px-1.5 gap-0.5' : 'h-7 px-2 gap-1'
  const iconClass = compact ? 'h-3 w-3' : 'h-3.5 w-3.5'
  const badgeClass = compact ? 'h-3.5 px-0.5 text-[9px] ml-0.5' : 'h-4 px-1 text-[10px] ml-0.5'

  return (
    <div className={cn('flex items-center gap-2 flex-wrap', compact && 'gap-1 flex-nowrap')}>
      {/* Dropdown Type */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              compact ? 'h-6 px-1.5 gap-1' : 'h-8 gap-1.5',
              compact
                ? 'bg-card/10 backdrop-blur-sm border border-white/20 text-white/80 hover:bg-card/20 hover:text-white'
                : 'border hover:bg-muted'
            )}
          >
            <Filter className={iconClass} />
            {!compact && <span className="hidden sm:inline">{currentTypeLabel}</span>}
            {!compact && <span className="sm:hidden">Type</span>}
            <ChevronDown className={cn('h-3 w-3', compact ? 'text-white/50' : 'opacity-50')} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="bg-popover">
          {TYPES.map((type) => (
            <DropdownMenuItem
              key={type.value || 'all'}
              onClick={() => handleTypeFilter(type.value)}
              className={cn(currentType === type.value && 'bg-accent')}
            >
              {type.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {!compact && <div className="hidden sm:block h-5 w-px bg-border" />}

      {/* Smart filters compacts */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => handleSmartFilter('favoris')}
        className={cn(
          buttonClass,
          compact
            ? 'bg-card/10 backdrop-blur-sm border border-white/20 text-white/70 hover:bg-card/20 hover:text-white'
            : '',
          currentSmartFilter === 'favoris' &&
            (compact ? 'bg-card text-primary shadow-md' : 'bg-accent text-accent-foreground')
        )}
      >
        <Star className={cn(iconClass, currentSmartFilter === 'favoris' && 'fill-current')} />
        {!compact && <span className="hidden sm:inline">Favoris</span>}
      </Button>

      <Button
        variant="ghost"
        size="sm"
        onClick={() => handleSmartFilter('nouveaux')}
        className={cn(
          buttonClass,
          compact
            ? 'bg-card/10 backdrop-blur-sm border border-white/20 text-white/70 hover:bg-card/20 hover:text-white'
            : '',
          currentSmartFilter === 'nouveaux' &&
            (compact ? 'bg-card text-primary shadow-md' : 'bg-accent text-accent-foreground')
        )}
      >
        <Sparkles className={iconClass} />
        {!compact && <span className="hidden sm:inline">Nouveaux</span>}
        {counts.nouveaux > 0 && (
          <Badge
            className={cn(
              badgeClass,
              compact
                ? currentSmartFilter === 'nouveaux'
                  ? 'bg-primary/20 text-primary border-0'
                  : 'bg-card/20 text-white border-0'
                : 'bg-secondary text-secondary-foreground'
            )}
          >
            {counts.nouveaux}
          </Badge>
        )}
      </Button>

      <Button
        variant="ghost"
        size="sm"
        onClick={() => handleSmartFilter('ght')}
        className={cn(
          buttonClass,
          compact
            ? 'bg-card/10 backdrop-blur-sm border border-white/20 text-white/70 hover:bg-card/20 hover:text-white'
            : '',
          currentSmartFilter === 'ght' &&
            (compact ? 'bg-card text-primary shadow-md' : 'bg-accent text-accent-foreground')
        )}
      >
        <Building2 className={iconClass} />
        {!compact && <span className="hidden sm:inline">GHT</span>}
        <Badge
          className={cn(
            badgeClass,
            compact
              ? currentSmartFilter === 'ght'
                ? 'bg-primary/20 text-primary border-0'
                : 'bg-card/20 text-white border-0'
              : 'bg-secondary text-secondary-foreground'
          )}
        >
          {counts.ght}
        </Badge>
      </Button>

      <Button
        variant="ghost"
        size="sm"
        onClick={() => handleSmartFilter('grosses')}
        className={cn(
          buttonClass,
          compact
            ? 'bg-card/10 backdrop-blur-sm border border-white/20 text-white/70 hover:bg-card/20 hover:text-white'
            : '',
          currentSmartFilter === 'grosses' &&
            (compact ? 'bg-card text-primary shadow-md' : 'bg-accent text-accent-foreground')
        )}
      >
        <Users className={iconClass} />
        {!compact && <span className="hidden sm:inline">&gt;5 étab.</span>}
        <Badge
          className={cn(
            badgeClass,
            compact
              ? currentSmartFilter === 'grosses'
                ? 'bg-primary/20 text-primary border-0'
                : 'bg-card/20 text-white border-0'
              : 'bg-secondary text-secondary-foreground'
          )}
        >
          {counts.grosses}
        </Badge>
      </Button>
    </div>
  )
}
