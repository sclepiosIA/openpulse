import { useMemo } from 'react'
import { Search, Filter, X, ArrowUpDown, MapPin, Building2, Users, Activity, Calendar } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

export interface FilterOption {
  value: string
  label: string
  icon?: React.ReactNode
}

export interface FilterConfig {
  key: string
  label: string
  icon?: React.ComponentType<{ className?: string }>
  options: FilterOption[]
  multiple?: boolean
}

export interface SortOption {
  value: string
  label: string
}

export interface CRMFiltersBarProps {
  // Search
  searchValue?: string
  onSearchChange?: (value: string) => void
  searchPlaceholder?: string
  
  // Filters
  filters: Record<string, string[]>
  filterConfigs: FilterConfig[]
  onFiltersChange: (filters: Record<string, string[]>) => void
  
  // Sort
  sortValue?: string
  sortOptions?: SortOption[]
  onSortChange?: (value: string) => void
  
  // Layout
  className?: string
  compact?: boolean
}

export function CRMFiltersBar({
  searchValue = '',
  onSearchChange,
  searchPlaceholder = 'Rechercher...',
  filters,
  filterConfigs,
  onFiltersChange,
  sortValue,
  sortOptions = [],
  onSortChange,
  className,
  compact = false
}: CRMFiltersBarProps) {
  const hasActiveFilters = useMemo(() => 
    Object.values(filters).some(arr => arr.length > 0),
  [filters])

  const activeFiltersCount = useMemo(() => 
    Object.values(filters).reduce((acc, arr) => acc + arr.length, 0),
  [filters])

  const toggleFilter = (key: string, value: string) => {
    const current = filters[key] || []
    const updated = current.includes(value)
      ? current.filter(v => v !== value)
      : [...current, value]
    onFiltersChange({ ...filters, [key]: updated })
  }

  const clearFilter = (key: string, value: string) => {
    const current = filters[key] || []
    onFiltersChange({ ...filters, [key]: current.filter(v => v !== value) })
  }

  const clearAllFilters = () => {
    const clearedFilters = Object.keys(filters).reduce((acc, key) => {
      acc[key] = []
      return acc
    }, {} as Record<string, string[]>)
    onFiltersChange(clearedFilters)
  }

  const getFilterLabel = (key: string, value: string): string => {
    const config = filterConfigs.find(f => f.key === key)
    const option = config?.options.find(o => o.value === value)
    return option?.label || value
  }

  const getFilterIcon = (key: string): React.ComponentType<{ className?: string }> | undefined => {
    return filterConfigs.find(f => f.key === key)?.icon
  }

  return (
    <div className={cn("space-y-4", className)}>
      {/* Barre principale */}
      <div className="flex flex-col lg:flex-row gap-3">
        {/* Recherche */}
        {onSearchChange && (
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder={searchPlaceholder}
              value={searchValue}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-10"
            />
          </div>
        )}

        {/* Filtres */}
        <div className="flex flex-wrap gap-2">
          {filterConfigs.map(config => {
            const Icon = config.icon
            const count = filters[config.key]?.length || 0
            
            return (
              <Popover key={config.key}>
                <PopoverTrigger asChild>
                  <Button 
                    variant="outline" 
                    size={compact ? "sm" : "default"}
                    className="gap-2"
                  >
                    {Icon && <Icon className="w-4 h-4" />}
                    <span className="hidden sm:inline">{config.label}</span>
                    {count > 0 && (
                      <Badge variant="secondary" className="ml-1">
                        {count}
                      </Badge>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-64 max-h-[50vh] overflow-y-auto" align="start">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-medium">{config.label}</Label>
                      {count > 0 && (
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => onFiltersChange({ ...filters, [config.key]: [] })}
                        >
                          Effacer
                        </Button>
                      )}
                    </div>
                    <div className="space-y-2">
                      {config.options.map(option => (
                        <div key={option.value} className="flex items-center space-x-2">
                          <Checkbox
                            id={`${config.key}-${option.value}`}
                            checked={filters[config.key]?.includes(option.value)}
                            onCheckedChange={() => toggleFilter(config.key, option.value)}
                          />
                          <label
                            htmlFor={`${config.key}-${option.value}`}
                            className="text-sm cursor-pointer flex items-center gap-2 flex-1"
                          >
                            {option.icon}
                            {option.label}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            )
          })}

          {/* Tri */}
          {sortOptions.length > 0 && onSortChange && (
            <Select value={sortValue} onValueChange={onSortChange}>
              <SelectTrigger className={cn("w-[160px]", compact && "h-9")}>
                <ArrowUpDown className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Trier par..." />
              </SelectTrigger>
              <SelectContent>
                {sortOptions.map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {/* Filtres actifs */}
      {hasActiveFilters && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground">Filtres:</span>
          
          {Object.entries(filters).map(([key, values]) =>
            values.map(value => {
              const Icon = getFilterIcon(key)
              return (
                <Badge key={`${key}-${value}`} variant="secondary" className="gap-1 pr-1">
                  {Icon && <Icon className="w-3 h-3" />}
                  {getFilterLabel(key, value)}
                  <button
                    onClick={() => clearFilter(key, value)}
                    className="ml-1 hover:bg-background rounded-full p-0.5"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              )
            })
          )}
          
          <Button variant="ghost" size="sm" onClick={clearAllFilters}>
            Tout effacer
          </Button>
        </div>
      )}
    </div>
  )
}

// Preset filter icons for common use cases
export const FILTER_ICONS = {
  region: MapPin,
  type: Building2,
  team: Users,
  health: Activity,
  date: Calendar,
  default: Filter
}
