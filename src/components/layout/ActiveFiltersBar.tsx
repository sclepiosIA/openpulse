import { X } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export interface ActiveFilter {
  key: string
  label: string
  value: string
  onRemove: () => void
}

interface ActiveFiltersBarProps {
  filters: ActiveFilter[]
  onClearAll: () => void
  className?: string
}

export function ActiveFiltersBar({ filters, onClearAll, className }: ActiveFiltersBarProps) {
  if (filters.length === 0) return null

  return (
    <div className={cn("flex items-center gap-2 flex-wrap py-2", className)}>
      <span className="text-xs text-muted-foreground font-medium">Filtres actifs:</span>
      
      {filters.map((filter) => (
        <Badge 
          key={filter.key} 
          variant="secondary" 
          className="text-xs gap-1 pr-1"
        >
          <span className="text-muted-foreground">{filter.label}:</span>
          <span>{filter.value}</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={filter.onRemove}
            aria-label={`Retirer le filtre ${filter.label}`}
            title="Retirer ce filtre"
            className="h-4 w-4 p-0 ml-1 hover:bg-transparent hover:text-destructive"
          >
            <X className="h-3 w-3" />
          </Button>
        </Badge>
      ))}
      
      {filters.length > 1 && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onClearAll}
          className="h-6 text-xs text-muted-foreground hover:text-foreground"
        >
          Tout effacer
        </Button>
      )}
    </div>
  )
}
