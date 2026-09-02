import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

export interface SortConfig {
  field:
    | 'nom'
    | 'created_at'
    | 'dernier_contact'
    | 'prochaine_action'
    | 'valeur_partenariat'
    | 'engagement_score'
    | 'ville'
  direction: 'asc' | 'desc'
}

interface SortMenuPartenairesProps {
  sortConfig: SortConfig
  onSortChange: (config: SortConfig) => void
  variant?: 'default' | 'glassmorphism'
}

export function SortMenuPartenaires({
  sortConfig,
  onSortChange,
  variant = 'glassmorphism',
}: SortMenuPartenairesProps) {
  const isGlassmorphism = variant === 'glassmorphism'

  const sortOptions = [
    { field: 'nom' as const, label: 'Nom' },
    { field: 'created_at' as const, label: 'Date création' },
    { field: 'dernier_contact' as const, label: 'Dernier contact' },
    { field: 'prochaine_action' as const, label: 'Prochaine action' },
    { field: 'valeur_partenariat' as const, label: 'Valeur' },
    { field: 'engagement_score' as const, label: 'Engagement' },
    { field: 'ville' as const, label: 'Ville' },
  ]

  const handleSort = (field: SortConfig['field']) => {
    if (sortConfig.field === field) {
      onSortChange({
        field,
        direction: sortConfig.direction === 'asc' ? 'desc' : 'asc',
      })
    } else {
      onSortChange({ field, direction: 'asc' })
    }
  }

  const currentLabel = sortOptions.find((opt) => opt.field === sortConfig.field)?.label || 'Trier'

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            'h-6 px-2 sm:h-7 sm:px-2.5 gap-1 rounded-lg transition-all shrink-0',
            isGlassmorphism
              ? 'bg-card/10 backdrop-blur-sm border border-white/20 text-white/80 hover:bg-card/20 hover:text-white'
              : 'hover:bg-muted'
          )}
        >
          <ArrowUpDown className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
          <span className="hidden sm:inline text-xs">{currentLabel}</span>
          {sortConfig.direction === 'asc' ? (
            <ArrowUp className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
          ) : (
            <ArrowDown className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-40 p-1" align="end">
        <div className="flex flex-col gap-0.5">
          {sortOptions.map((option) => {
            const isActive = sortConfig.field === option.field
            return (
              <Button
                key={option.field}
                variant={isActive ? 'secondary' : 'ghost'}
                size="sm"
                className={cn('w-full justify-between text-xs h-7', isActive && 'font-medium')}
                onClick={() => handleSort(option.field)}
              >
                <span>{option.label}</span>
                {isActive &&
                  (sortConfig.direction === 'asc' ? (
                    <ArrowUp className="h-3 w-3" />
                  ) : (
                    <ArrowDown className="h-3 w-3" />
                  ))}
              </Button>
            )
          })}
        </div>
      </PopoverContent>
    </Popover>
  )
}
