import { ArrowUpDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

export type ProspectSortField = 'nom' | 'date_creation' | 'progression' | 'ville' | 'ca_potentiel'
export type ProspectSortDirection = 'asc' | 'desc'

export interface ProspectSortConfig {
  field: ProspectSortField
  direction: ProspectSortDirection
}

interface ProspectsSortMenuProps {
  sortConfig: ProspectSortConfig
  onSortChange: (config: ProspectSortConfig) => void
  variant?: 'default' | 'glassmorphism'
  /** Mode compact pour mobile */
  compact?: boolean
}

const SORT_OPTIONS: {
  value: string
  label: string
  field: ProspectSortField
  direction: ProspectSortDirection
}[] = [
  { value: 'nom-asc', label: 'Nom (A-Z)', field: 'nom', direction: 'asc' },
  { value: 'nom-desc', label: 'Nom (Z-A)', field: 'nom', direction: 'desc' },
  { value: 'date_creation-desc', label: 'Plus récents', field: 'date_creation', direction: 'desc' },
  { value: 'date_creation-asc', label: 'Plus anciens', field: 'date_creation', direction: 'asc' },
  { value: 'progression-desc', label: 'Progression ↓', field: 'progression', direction: 'desc' },
  { value: 'progression-asc', label: 'Progression ↑', field: 'progression', direction: 'asc' },
  { value: 'ca_potentiel-desc', label: 'CA potentiel ↓', field: 'ca_potentiel', direction: 'desc' },
  { value: 'ca_potentiel-asc', label: 'CA potentiel ↑', field: 'ca_potentiel', direction: 'asc' },
  { value: 'ville-asc', label: 'Ville (A-Z)', field: 'ville', direction: 'asc' },
]

export function ProspectsSortMenu({
  sortConfig,
  onSortChange,
  variant = 'glassmorphism',
  compact = false,
}: ProspectsSortMenuProps) {
  const currentValue = `${sortConfig.field}-${sortConfig.direction}`
  const currentLabel = SORT_OPTIONS.find((o) => o.value === currentValue)?.label || 'Trier'
  const isGlassmorphism = variant === 'glassmorphism'

  const handleChange = (value: string) => {
    const option = SORT_OPTIONS.find((o) => o.value === value)
    if (option) {
      onSortChange({ field: option.field, direction: option.direction })
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            'gap-1.5 rounded-lg transition-all',
            compact ? 'h-6 px-1.5' : 'h-7 px-2.5',
            isGlassmorphism
              ? 'bg-card/10 backdrop-blur-sm border border-white/20 text-white/80 hover:bg-card/20 hover:text-white'
              : 'border hover:bg-muted'
          )}
        >
          <ArrowUpDown className={compact ? 'h-3 w-3' : 'h-4 w-4'} />
          {!compact && <span className="hidden sm:inline text-xs">{currentLabel}</span>}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuLabel>Trier par</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {SORT_OPTIONS.map((option) => (
          <DropdownMenuItem
            key={option.value}
            onClick={() => handleChange(option.value)}
            className={currentValue === option.value ? 'bg-accent' : ''}
          >
            {option.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
