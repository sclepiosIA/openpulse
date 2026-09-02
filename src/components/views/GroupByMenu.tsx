import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuCheckboxItem,
} from '@/components/ui/dropdown-menu'
import { Group, Check } from 'lucide-react'

export interface GroupByMenuField {
  key: string
  label: string
}

interface GroupByMenuProps {
  fields: GroupByMenuField[]
  groupBy: string | null
  onChange: (key: string | null) => void
}

/** Twenty CRM-inspired "Group by" dropdown for table views. */
export function GroupByMenu({ fields, groupBy, onChange }: GroupByMenuProps) {
  const activeLabel = fields.find((f) => f.key === groupBy)?.label
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 gap-2">
          <Group className="h-4 w-4" />
          <span className="hidden sm:inline">
            {activeLabel ? `Groupé par ${activeLabel}` : 'Grouper'}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Grouper par</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuCheckboxItem
          checked={groupBy === null}
          onCheckedChange={() => onChange(null)}
        >
          Aucun groupement
        </DropdownMenuCheckboxItem>
        <DropdownMenuSeparator />
        {fields.map((f) => (
          <DropdownMenuCheckboxItem
            key={f.key}
            checked={groupBy === f.key}
            onCheckedChange={() => onChange(groupBy === f.key ? null : f.key)}
          >
            {f.label}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
