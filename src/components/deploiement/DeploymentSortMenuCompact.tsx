import { ArrowUpDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { SortOption } from '@/components/layout/CRMFiltersBar'

interface DeploymentSortMenuCompactProps {
  sortValue: string
  onSortChange: (value: string) => void
  sortOptions: SortOption[]
}

export function DeploymentSortMenuCompact({
  sortValue,
  onSortChange,
  sortOptions,
}: DeploymentSortMenuCompactProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-2 gap-1 rounded-lg bg-card/10 backdrop-blur-sm border border-white/20 text-white/80 hover:bg-card/20 hover:text-white shrink-0"
        >
          <ArrowUpDown className="h-3 w-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="bg-card">
        <DropdownMenuRadioGroup value={sortValue} onValueChange={onSortChange}>
          {sortOptions.map((option) => (
            <DropdownMenuRadioItem key={option.value} value={option.value}>
              {option.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
