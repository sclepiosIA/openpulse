import { useEffect } from 'react'
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
import { Search, Filter, X, ArrowUpDown, MapPin, Building2 } from 'lucide-react'
import type { ProductionFilters, ProductionSortConfig, ProductionSortField } from '@/hooks/production/useProductionFilters'
import type { CustomerHealthStatus } from '@/hooks/crm/useCustomerHealth'
import { getHealthLabel, getHealthIcon } from '@/hooks/crm/useCustomerHealth'
import { DURATION_OPTIONS } from '@/lib/productionUtils'

const STORAGE_KEY = 'production-filters'
const SORT_STORAGE_KEY = 'production-sort'

interface ProductionFiltersBarProps {
  filters: ProductionFilters
  onFiltersChange: (filters: Partial<ProductionFilters>) => void
  sortConfig: ProductionSortConfig
  onSortChange: (config: ProductionSortConfig) => void
  availableRegions: string[]
  availableTypes: string[]
  availableCsms: Array<{ id: string; name: string }>
}

export function ProductionFiltersBar({
  filters,
  onFiltersChange,
  sortConfig,
  onSortChange,
  availableRegions,
  availableTypes,
  availableCsms
}: ProductionFiltersBarProps) {
  // Charger les filtres depuis localStorage au montage
  useEffect(() => {
    try {
      const savedFilters = localStorage.getItem(STORAGE_KEY)
      const savedSort = localStorage.getItem(SORT_STORAGE_KEY)
      
      if (savedFilters) {
        const parsed = JSON.parse(savedFilters)
        onFiltersChange(parsed)
      }
      if (savedSort) {
        const parsed = JSON.parse(savedSort)
        onSortChange(parsed)
      }
    } catch {
      // Ignorer les erreurs de parsing
    }
  }, [])

  // Sauvegarder les filtres dans localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(filters))
    } catch {
      // Ignorer les erreurs
    }
  }, [filters])

  useEffect(() => {
    try {
      localStorage.setItem(SORT_STORAGE_KEY, JSON.stringify(sortConfig))
    } catch {
      // Ignorer les erreurs
    }
  }, [sortConfig])

  const hasActiveFilters = 
    filters.regions.length > 0 ||
    filters.types.length > 0 ||
    filters.healthStatuses.length > 0 ||
    filters.csmIds.length > 0 ||
    filters.durationRanges.length > 0 ||
    filters.adoptionRanges.length > 0 ||
    filters.npsRanges.length > 0 ||
    filters.supportLevels.length > 0 ||
    filters.renewalPeriods.length > 0

  const clearAllFilters = () => {
    const clearedFilters = {
      search: '',
      regions: [],
      types: [],
      healthStatuses: [],
      csmIds: [],
      durationRanges: [],
      adoptionRanges: [],
      npsRanges: [],
      supportLevels: [],
      renewalPeriods: []
    }
    onFiltersChange(clearedFilters)
    localStorage.removeItem(STORAGE_KEY)
  }

  const toggleHealthStatus = (status: CustomerHealthStatus) => {
    const current = filters.healthStatuses
    const updated = current.includes(status)
      ? current.filter(s => s !== status)
      : [...current, status]
    onFiltersChange({ healthStatuses: updated })
  }

  const toggleArrayFilter = (key: keyof ProductionFilters, value: string) => {
    const current = filters[key] as string[]
    const updated = current.includes(value)
      ? current.filter(v => v !== value)
      : [...current, value]
    onFiltersChange({ [key]: updated })
  }

  return (
    <div className="space-y-4">
      {/* Barre de recherche et filtres principaux */}
      <div className="flex flex-col lg:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher un établissement..."
            value={filters.search}
            onChange={(e) => onFiltersChange({ search: e.target.value })}
            className="pl-10"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          {/* Filtre Région */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="gap-2">
                <MapPin className="w-4 h-4" />
                <span className="hidden sm:inline">Région</span>
                {filters.regions.length > 0 && (
                  <Badge variant="secondary" className="ml-1">
                    {filters.regions.length}
                  </Badge>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64">
              <div className="space-y-2 max-h-64 overflow-y-auto">
                <p className="font-medium text-sm">Filtrer par région</p>
                {availableRegions.map(region => (
                  <label key={region} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={filters.regions.includes(region)}
                      onChange={() => toggleArrayFilter('regions', region)}
                      className="rounded"
                    />
                    <span className="text-sm">{region}</span>
                  </label>
                ))}
              </div>
            </PopoverContent>
          </Popover>

          {/* Filtre Type */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="gap-2">
                <Building2 className="w-4 h-4" />
                <span className="hidden sm:inline">Type</span>
                {filters.types.length > 0 && (
                  <Badge variant="secondary" className="ml-1">
                    {filters.types.length}
                  </Badge>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64">
              <div className="space-y-2 max-h-64 overflow-y-auto">
                <p className="font-medium text-sm">Filtrer par type</p>
                {availableTypes.map(type => (
                  <label key={type} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={filters.types.includes(type)}
                      onChange={() => toggleArrayFilter('types', type)}
                      className="rounded"
                    />
                    <span className="text-sm">{type}</span>
                  </label>
                ))}
              </div>
            </PopoverContent>
          </Popover>

          {/* Filtre Santé */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="gap-2">
                <Filter className="w-4 h-4" />
                <span className="hidden sm:inline">Santé</span>
                {filters.healthStatuses.length > 0 && (
                  <Badge variant="secondary" className="ml-1">
                    {filters.healthStatuses.length}
                  </Badge>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64">
              <div className="space-y-2">
                <p className="font-medium text-sm">Filtrer par santé</p>
                {(['healthy', 'at-risk', 'churn-risk', 'onboarding'] as CustomerHealthStatus[]).map(status => (
                  <label key={status} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={filters.healthStatuses.includes(status)}
                      onChange={() => toggleHealthStatus(status)}
                      className="rounded"
                    />
                    <span className="text-sm flex items-center gap-1">
                      {getHealthIcon(status)} {getHealthLabel(status)}
                    </span>
                  </label>
                ))}
              </div>
            </PopoverContent>
          </Popover>

          {/* Filtre CSM */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="gap-2">
                <Filter className="w-4 h-4" />
                <span className="hidden sm:inline">Équipe</span>
                {filters.csmIds.length > 0 && (
                  <Badge variant="secondary" className="ml-1">
                    {filters.csmIds.length}
                  </Badge>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64">
              <div className="space-y-2 max-h-64 overflow-y-auto">
                <p className="font-medium text-sm">Filtrer par CSM</p>
                {availableCsms.map(csm => (
                  <label key={csm.id} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={filters.csmIds.includes(csm.id)}
                      onChange={() => toggleArrayFilter('csmIds', csm.id)}
                      className="rounded"
                    />
                    <span className="text-sm">{csm.name}</span>
                  </label>
                ))}
              </div>
            </PopoverContent>
          </Popover>

          {/* Filtre Durée */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="gap-2">
                <Filter className="w-4 h-4" />
                <span className="hidden sm:inline">Durée</span>
                {filters.durationRanges.length > 0 && (
                  <Badge variant="secondary" className="ml-1">
                    {filters.durationRanges.length}
                  </Badge>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-48">
              <div className="space-y-2">
                <p className="font-medium text-sm">En production</p>
                {DURATION_OPTIONS.map(range => (
                  <label key={range.value} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={filters.durationRanges.includes(range.value)}
                      onChange={() => toggleArrayFilter('durationRanges', range.value)}
                      className="rounded"
                    />
                    <span className="text-sm">{range.label}</span>
                  </label>
                ))}
              </div>
            </PopoverContent>
          </Popover>

          {/* Tri */}
          <Select
            value={`${sortConfig.field}-${sortConfig.direction}`}
            onValueChange={(value) => {
              const [field, direction] = value.split('-') as [ProductionSortField, 'asc' | 'desc']
              onSortChange({ field, direction })
            }}
          >
            <SelectTrigger className="w-[160px]">
              <ArrowUpDown className="w-4 h-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="nom-asc">Nom (A-Z)</SelectItem>
              <SelectItem value="nom-desc">Nom (Z-A)</SelectItem>
              <SelectItem value="health-desc">Santé (↓)</SelectItem>
              <SelectItem value="health-asc">Santé (↑)</SelectItem>
              <SelectItem value="revenue-desc">CA (↓)</SelectItem>
              <SelectItem value="revenue-asc">CA (↑)</SelectItem>
              <SelectItem value="date_signature-desc">Plus récent</SelectItem>
              <SelectItem value="date_signature-asc">Plus ancien</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Filtres actifs */}
      {hasActiveFilters && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground">Filtres actifs:</span>
          
          {filters.healthStatuses.map(status => (
            <Badge key={status} variant="secondary" className="gap-1">
              {getHealthIcon(status)} {getHealthLabel(status)}
              <button
                onClick={() => toggleHealthStatus(status)}
                className="ml-1 hover:bg-background rounded-full"
              >
                <X className="w-3 h-3" />
              </button>
            </Badge>
          ))}

          {filters.regions.map(region => (
            <Badge key={region} variant="secondary" className="gap-1">
              <MapPin className="w-3 h-3" /> {region}
              <button
                onClick={() => toggleArrayFilter('regions', region)}
                className="ml-1 hover:bg-background rounded-full"
              >
                <X className="w-3 h-3" />
              </button>
            </Badge>
          ))}

          {filters.types.map(type => (
            <Badge key={type} variant="secondary" className="gap-1">
              <Building2 className="w-3 h-3" /> {type}
              <button
                onClick={() => toggleArrayFilter('types', type)}
                className="ml-1 hover:bg-background rounded-full"
              >
                <X className="w-3 h-3" />
              </button>
            </Badge>
          ))}

          {filters.csmIds.map(csmId => {
            const csm = availableCsms.find(c => c.id === csmId)
            return (
              <Badge key={csmId} variant="secondary" className="gap-1">
                {csm?.name || csmId}
                <button
                  onClick={() => toggleArrayFilter('csmIds', csmId)}
                  className="ml-1 hover:bg-background rounded-full"
                >
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            )
          })}

          {filters.durationRanges.map(range => {
            const option = DURATION_OPTIONS.find(o => o.value === range)
            return (
              <Badge key={range} variant="secondary" className="gap-1">
                {option?.label || range}
                <button
                  onClick={() => toggleArrayFilter('durationRanges', range)}
                  className="ml-1 hover:bg-background rounded-full"
                >
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            )
          })}

          <Button variant="ghost" size="sm" onClick={clearAllFilters}>
            Tout réinitialiser
          </Button>
        </div>
      )}
    </div>
  )
}
