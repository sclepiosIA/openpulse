import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Checkbox } from '@/components/ui/checkbox'
import { Columns3, RotateCcw, ChevronUp, ChevronDown } from 'lucide-react'
import type { ColumnConfig } from '@/hooks/views/useColumnVisibility'

interface ColumnVisibilityMenuProps {
  /** Columns in current display order (use orderedColumns from the hook). */
  columns: ColumnConfig[]
  isVisible: (key: string) => boolean
  toggle: (key: string) => void
  move: (key: string, direction: 'up' | 'down') => void
  reset: () => void
  triggerClassName?: string
}

/**
 * Twenty CRM-inspired column visibility + reorder menu.
 * Required columns are shown as disabled, always-on checkboxes.
 * Up/down arrows reorder columns within the list.
 */
export function ColumnVisibilityMenu({
  columns,
  isVisible,
  toggle,
  move,
  reset,
  triggerClassName,
}: ColumnVisibilityMenuProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          aria-label="Colonnes affichées"
          title="Colonnes affichées"
          className={triggerClassName ?? 'h-9 px-2'}
        >
          <Columns3 className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-0">
        <div className="flex items-center justify-between px-3 py-2 border-b">
          <span className="text-sm font-medium">Colonnes</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={reset}
            className="h-7 px-2 text-xs"
          >
            <RotateCcw className="h-3 w-3 mr-1" />
            Réinitialiser
          </Button>
        </div>
        <div className="max-h-80 overflow-y-auto py-1">
          {columns.map((col, idx) => {
            const checked = isVisible(col.key)
            const canMoveUp = idx > 0
            const canMoveDown = idx < columns.length - 1
            return (
              <div
                key={col.key}
                className="flex items-center gap-1 px-2 py-1 hover:bg-muted/60 group"
              >
                <Checkbox
                  checked={checked}
                  disabled={col.required}
                  onCheckedChange={() => toggle(col.key)}
                  aria-label={`Afficher ${col.label}`}
                />
                <span className={`flex-1 text-sm ${col.required ? 'text-muted-foreground' : ''}`}>
                  {col.label}
                  {col.required && (
                    <span className="ml-1 text-[10px] text-muted-foreground">(requis)</span>
                  )}
                </span>
                <div className="flex opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    disabled={!canMoveUp}
                    onClick={() => move(col.key, 'up')}
                    aria-label={`Monter ${col.label}`}
                    title="Monter"
                  >
                    <ChevronUp className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    disabled={!canMoveDown}
                    onClick={() => move(col.key, 'down')}
                    aria-label={`Descendre ${col.label}`}
                    title="Descendre"
                  >
                    <ChevronDown className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      </PopoverContent>
    </Popover>
  )
}
