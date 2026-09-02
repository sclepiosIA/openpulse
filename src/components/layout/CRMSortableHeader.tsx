import { ReactNode } from "react"
import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { TableHead } from "@/components/ui/table"
import { Button } from "@/components/ui/button"

interface CRMSortableHeaderProps {
  children: ReactNode
  field: string
  currentSortField?: string | null
  currentSortDirection?: 'asc' | 'desc' | null
  onSort?: (field: string) => void
  className?: string
  align?: 'left' | 'center' | 'right'
}

/**
 * Sortable table header component for CRM tables.
 * Shows sort direction indicator and handles click events.
 */
export function CRMSortableHeader({
  children,
  field,
  currentSortField,
  currentSortDirection,
  onSort,
  className,
  align = 'left'
}: CRMSortableHeaderProps) {
  const isActive = currentSortField === field
  const isAsc = isActive && currentSortDirection === 'asc'
  const isDesc = isActive && currentSortDirection === 'desc'

  const handleClick = () => {
    onSort?.(field)
  }

  const SortIcon = isAsc ? ArrowUp : isDesc ? ArrowDown : ArrowUpDown

  return (
    <TableHead 
      className={cn(
        "whitespace-nowrap",
        align === 'center' && "text-center",
        align === 'right' && "text-right",
        className
      )}
    >
      <Button
        variant="ghost"
        size="sm"
        onClick={handleClick}
        className={cn(
          "h-8 px-2 -ml-2 font-medium",
          "hover:bg-muted/50",
          isActive && "text-foreground"
        )}
      >
        {children}
        <SortIcon 
          className={cn(
            "ml-2 h-3.5 w-3.5 transition-colors",
            isActive ? "text-foreground" : "text-muted-foreground"
          )} 
        />
      </Button>
    </TableHead>
  )
}
