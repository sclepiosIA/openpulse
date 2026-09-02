import { MapPin, Building2, Tag, Activity, Users } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import type { FilterConfig } from '@/components/layout/CRMFiltersBar'

interface DeploymentFiltersCompactProps {
  filters: Record<string, string[]>
  onFiltersChange: (filters: Record<string, string[]>) => void
  filterConfigs: FilterConfig[]
}

const FILTER_ICONS: Record<string, React.ElementType> = {
  regions: MapPin,
  types: Building2,
  statuts: Tag,
  healthStatuses: Activity,
  teamMembers: Users,
}

export function DeploymentFiltersCompact({
  filters,
  onFiltersChange,
  filterConfigs,
}: DeploymentFiltersCompactProps) {
  const handleFilterToggle = (key: string, value: string) => {
    const currentValues = filters[key] || []
    const newValues = currentValues.includes(value)
      ? currentValues.filter((v) => v !== value)
      : [...currentValues, value]

    onFiltersChange({
      ...filters,
      [key]: newValues,
    })
  }

  return (
    <div className="flex items-center gap-1 flex-nowrap">
      {filterConfigs.map((config) => {
        const Icon = FILTER_ICONS[config.key] || Tag
        const activeCount = (filters[config.key] || []).length
        const isActive = activeCount > 0

        return (
          <DropdownMenu key={config.key}>
            <DropdownMenuTrigger asChild>
              <Badge
                variant="outline"
                className={cn(
                  'h-6 px-1.5 gap-0.5 cursor-pointer rounded-lg border transition-all shrink-0',
                  isActive
                    ? 'bg-card text-primary border-white shadow-md'
                    : 'bg-card/10 text-white/70 border-white/20 hover:bg-card/20 hover:text-white'
                )}
              >
                <Icon className="h-3 w-3" />
                {activeCount > 0 && (
                  <span className="text-[10px] font-semibold">{activeCount}</span>
                )}
              </Badge>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="bg-card max-h-60 overflow-y-auto">
              {config.options.map((option) => (
                <DropdownMenuCheckboxItem
                  key={option.value}
                  checked={(filters[config.key] || []).includes(option.value)}
                  onCheckedChange={() => handleFilterToggle(config.key, option.value)}
                >
                  {option.label}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )
      })}
    </div>
  )
}
