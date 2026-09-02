import { X, ArrowUpDown, Layers, CheckSquare } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export interface ActiveFilterChip {
  key: string
  icon: 'sort' | 'group' | 'selection' | 'filter'
  label: string
  value: string
  onClear?: () => void
}

interface ViewFilterChipsBarProps {
  chips: ActiveFilterChip[]
  onClearAll?: () => void
  className?: string
}

const ICONS = {
  sort: ArrowUpDown,
  group: Layers,
  selection: CheckSquare,
  filter: ArrowUpDown,
} as const

/**
 * Twenty CRM-inspired chip bar showing active table state (sort, group, selection).
 * Each chip is removable; hides itself when no chips are active.
 */
export function ViewFilterChipsBar({ chips, onClearAll, className }: ViewFilterChipsBarProps) {
  if (chips.length === 0) return null

  return (
    <div
      className={cn(
        'flex items-center gap-1.5 flex-wrap px-2 py-1.5 border-b bg-muted/20',
        className,
      )}
      role="region"
      aria-label="Filtres actifs"
    >
      <span className="text-xs text-muted-foreground mr-1">Actifs :</span>
      {chips.map((chip) => {
        const Icon = ICONS[chip.icon] ?? ICONS.filter
        return (
          <Badge
            key={chip.key}
            variant="secondary"
            className="gap-1 pl-1.5 pr-1 py-0.5 text-xs font-normal"
          >
            <Icon className="h-3 w-3 text-muted-foreground" />
            <span className="text-muted-foreground">{chip.label} :</span>
            <span className="font-medium">{chip.value}</span>
            {chip.onClear && (
              <button
                type="button"
                onClick={chip.onClear}
                className="ml-0.5 rounded hover:bg-background/70 p-0.5"
                aria-label={`Retirer ${chip.label}`}
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </Badge>
        )
      })}
      {chips.length > 1 && onClearAll && (
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
          onClick={onClearAll}
        >
          Tout effacer
        </Button>
      )}
    </div>
  )
}
