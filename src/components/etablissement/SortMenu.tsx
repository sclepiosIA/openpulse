import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ArrowUpDown, Check } from 'lucide-react'
import { cn } from '@/lib/utils'

export type SortField = 'nom' | 'date_creation' | 'progression' | 'date_signature' | 'ville'
export type SortDirection = 'asc' | 'desc'

interface SortMenuProps {
  sortField: SortField
  sortDirection: SortDirection
  onSortChange: (field: SortField, direction: SortDirection) => void
}

const SORT_OPTIONS = [
  {
    value: 'nom-asc',
    label: 'Nom (A-Z)',
    field: 'nom' as SortField,
    direction: 'asc' as SortDirection,
  },
  {
    value: 'nom-desc',
    label: 'Nom (Z-A)',
    field: 'nom' as SortField,
    direction: 'desc' as SortDirection,
  },
  {
    value: 'date_creation-desc',
    label: 'Plus récents',
    field: 'date_creation' as SortField,
    direction: 'desc' as SortDirection,
  },
  {
    value: 'date_creation-asc',
    label: 'Plus anciens',
    field: 'date_creation' as SortField,
    direction: 'asc' as SortDirection,
  },
  {
    value: 'progression-desc',
    label: 'Progression ↓',
    field: 'progression' as SortField,
    direction: 'desc' as SortDirection,
  },
  {
    value: 'progression-asc',
    label: 'Progression ↑',
    field: 'progression' as SortField,
    direction: 'asc' as SortDirection,
  },
  {
    value: 'date_signature-desc',
    label: 'Signature récente',
    field: 'date_signature' as SortField,
    direction: 'desc' as SortDirection,
  },
  {
    value: 'date_signature-asc',
    label: 'Signature ancienne',
    field: 'date_signature' as SortField,
    direction: 'asc' as SortDirection,
  },
  {
    value: 'ville-asc',
    label: 'Ville (A-Z)',
    field: 'ville' as SortField,
    direction: 'asc' as SortDirection,
  },
  {
    value: 'ville-desc',
    label: 'Ville (Z-A)',
    field: 'ville' as SortField,
    direction: 'desc' as SortDirection,
  },
]

export function SortMenu({ sortField, sortDirection, onSortChange }: SortMenuProps) {
  const currentValue = `${sortField}-${sortDirection}`
  const currentOption = SORT_OPTIONS.find((opt) => opt.value === currentValue)

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            'h-8 sm:h-9 px-2 sm:px-3 gap-1.5 rounded-lg sm:rounded-xl transition-all duration-200',
            'bg-card/10 backdrop-blur-sm border border-white/20',
            'text-white/80 hover:bg-card/20 hover:text-white',
            'shadow-lg hover:shadow-xl'
          )}
        >
          <ArrowUpDown className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          <span className="hidden sm:inline text-xs font-medium">
            {currentOption?.label || 'Trier'}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-48 p-1.5 rounded-xl border-primary/10 shadow-xl bg-card/95 backdrop-blur-md"
        align="end"
      >
        <div className="flex flex-col gap-0.5">
          {SORT_OPTIONS.map((option) => {
            const isActive = option.value === currentValue
            return (
              <Button
                key={option.value}
                variant="ghost"
                size="sm"
                className={cn(
                  'h-9 justify-start text-xs font-normal px-3 rounded-lg transition-all',
                  isActive
                    ? 'bg-primary/10 text-primary font-medium border-l-2 border-primary'
                    : 'hover:bg-primary/5'
                )}
                onClick={() => onSortChange(option.field, option.direction)}
              >
                <Check
                  className={cn(
                    'h-3.5 w-3.5 mr-2 transition-opacity',
                    isActive ? 'opacity-100 text-primary' : 'opacity-0'
                  )}
                />
                {option.label}
              </Button>
            )
          })}
        </div>
      </PopoverContent>
    </Popover>
  )
}
