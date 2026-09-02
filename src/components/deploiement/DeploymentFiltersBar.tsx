import { useEffect, useMemo } from 'react'
import { Search, X, Filter, Users } from 'lucide-react'
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
import { useActiveProfiles } from '@/hooks/profile/useProfiles'
import { DEPLOYMENT_PHASES, HEALTH_OPTIONS } from '@/lib/deploymentUtils'
import type { DeploymentFilters, SortField, SortDirection } from '@/hooks/production/useDeploymentFilters'

interface DeploymentFiltersBarProps {
  filters: DeploymentFilters
  onFiltersChange: (filters: DeploymentFilters) => void
  sortField: SortField
  sortDirection: SortDirection
  onSortChange: (field: SortField, direction: SortDirection) => void
  regions: string[]
  types: string[]
}

const FILTERS_STORAGE_KEY = 'deployment-filters'
const SORT_STORAGE_KEY = 'deployment-sort'

export function DeploymentFiltersBar({
  filters,
  onFiltersChange,
  sortField,
  sortDirection,
  onSortChange,
  regions,
  types
}: DeploymentFiltersBarProps) {
  const { data: profiles } = useActiveProfiles()

  // Persist filters to localStorage
  useEffect(() => {
    const savedFilters = filters.searchTerm || filters.regions.length || filters.types.length || 
                         filters.statuts.length || filters.healthStatuses.length || filters.teamMembers.length
    if (savedFilters) {
      localStorage.setItem(FILTERS_STORAGE_KEY, JSON.stringify(filters))
    }
  }, [filters])

  // Persist sort to localStorage
  useEffect(() => {
    localStorage.setItem(SORT_STORAGE_KEY, JSON.stringify({ field: sortField, direction: sortDirection }))
  }, [sortField, sortDirection])

  // Load filters from localStorage on mount
  useEffect(() => {
    const savedFilters = localStorage.getItem(FILTERS_STORAGE_KEY)
    const savedSort = localStorage.getItem(SORT_STORAGE_KEY)
    
    if (savedFilters) {
      try {
        const parsed = JSON.parse(savedFilters)
        onFiltersChange(parsed)
      } catch (e) {
        // Invalid JSON, ignore
      }
    }
    
    if (savedSort) {
      try {
        const parsed = JSON.parse(savedSort)
        onSortChange(parsed.field, parsed.direction)
      } catch (e) {
        // Invalid JSON, ignore
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const hasActiveFilters = useMemo(() => 
    filters.regions.length > 0 ||
    filters.types.length > 0 ||
    filters.statuts.length > 0 ||
    filters.healthStatuses.length > 0 ||
    filters.teamMembers.length > 0,
  [filters])

  const activeFiltersCount = useMemo(() => 
    filters.regions.length + filters.types.length + filters.statuts.length + 
    filters.healthStatuses.length + filters.teamMembers.length,
  [filters])

  const resetFilters = () => {
    const emptyFilters: DeploymentFilters = {
      searchTerm: '',
      regions: [],
      types: [],
      statuts: [],
      healthStatuses: [],
      teamMembers: [],
    }
    onFiltersChange(emptyFilters)
    localStorage.removeItem(FILTERS_STORAGE_KEY)
  }

  return (
    <div className="space-y-4">
      {/* Barre principale */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Recherche */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher un établissement..."
            value={filters.searchTerm}
            onChange={(e) => onFiltersChange({ ...filters, searchTerm: e.target.value })}
            className="pl-10"
          />
        </div>

        {/* Filtres avancés */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="w-full sm:w-auto">
              <Filter className="w-4 h-4 mr-2" />
              <span className="hidden sm:inline">Filtres</span>
              {hasActiveFilters && (
                <Badge variant="secondary" className="ml-2">
                  {activeFiltersCount}
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 max-h-[70vh] overflow-y-auto" align="end">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-sm">Filtres avancés</h4>
                {hasActiveFilters && (
                  <Button variant="ghost" size="sm" onClick={resetFilters}>
                    Réinitialiser
                  </Button>
                )}
              </div>

              {/* Équipe (CSM/CP) */}
              <div className="space-y-2">
                <Label className="text-xs font-medium flex items-center gap-2">
                  <Users className="w-3 h-3" />
                  Équipe (CSM/Chef de projet)
                </Label>
                <div className="space-y-2 max-h-32 overflow-y-auto">
                  {profiles?.map((profile) => (
                    <div key={profile.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`team-${profile.id}`}
                        checked={filters.teamMembers.includes(profile.id)}
                        onCheckedChange={(checked) => {
                          const newTeam = checked
                            ? [...filters.teamMembers, profile.id]
                            : filters.teamMembers.filter(t => t !== profile.id)
                          onFiltersChange({ ...filters, teamMembers: newTeam })
                        }}
                      />
                      <label
                        htmlFor={`team-${profile.id}`}
                        className="text-sm cursor-pointer"
                      >
                        {profile.prenom} {profile.nom}
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              {/* Régions */}
              <div className="space-y-2">
                <Label className="text-xs font-medium">Régions</Label>
                <div className="space-y-2 max-h-32 overflow-y-auto">
                  {regions.map(region => (
                    <div key={region} className="flex items-center space-x-2">
                      <Checkbox
                        id={`region-${region}`}
                        checked={filters.regions.includes(region)}
                        onCheckedChange={(checked) => {
                          const newRegions = checked
                            ? [...filters.regions, region]
                            : filters.regions.filter(r => r !== region)
                          onFiltersChange({ ...filters, regions: newRegions })
                        }}
                      />
                      <label
                        htmlFor={`region-${region}`}
                        className="text-sm cursor-pointer"
                      >
                        {region}
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              {/* Types */}
              <div className="space-y-2">
                <Label className="text-xs font-medium">Types</Label>
                <div className="space-y-2">
                  {types.map(type => (
                    <div key={type} className="flex items-center space-x-2">
                      <Checkbox
                        id={`type-${type}`}
                        checked={filters.types.includes(type)}
                        onCheckedChange={(checked) => {
                          const newTypes = checked
                            ? [...filters.types, type]
                            : filters.types.filter(t => t !== type)
                          onFiltersChange({ ...filters, types: newTypes })
                        }}
                      />
                      <label
                        htmlFor={`type-${type}`}
                        className="text-sm cursor-pointer"
                      >
                        {type}
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              {/* Statuts */}
              <div className="space-y-2">
                <Label className="text-xs font-medium">Statuts</Label>
                <div className="space-y-2">
                  {DEPLOYMENT_PHASES.map(statut => (
                    <div key={statut} className="flex items-center space-x-2">
                      <Checkbox
                        id={`statut-${statut}`}
                        checked={filters.statuts.includes(statut)}
                        onCheckedChange={(checked) => {
                          const newStatuts = checked
                            ? [...filters.statuts, statut]
                            : filters.statuts.filter(s => s !== statut)
                          onFiltersChange({ ...filters, statuts: newStatuts })
                        }}
                      />
                      <label
                        htmlFor={`statut-${statut}`}
                        className="text-sm cursor-pointer"
                      >
                        {statut}
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              {/* Santé */}
              <div className="space-y-2">
                <Label className="text-xs font-medium">État de santé</Label>
                <div className="space-y-2">
                  {HEALTH_OPTIONS.map(health => (
                    <div key={health.value} className="flex items-center space-x-2">
                      <Checkbox
                        id={`health-${health.value}`}
                        checked={filters.healthStatuses.includes(health.value as any)}
                        onCheckedChange={(checked) => {
                          const newHealth = checked
                            ? [...filters.healthStatuses, health.value as any]
                            : filters.healthStatuses.filter(h => h !== health.value)
                          onFiltersChange({ ...filters, healthStatuses: newHealth })
                        }}
                      />
                      <label
                        htmlFor={`health-${health.value}`}
                        className="text-sm cursor-pointer"
                      >
                        {health.label}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </PopoverContent>
        </Popover>

        {/* Tri */}
        <Select
          value={`${sortField}-${sortDirection}`}
          onValueChange={(value) => {
            const [field, dir] = value.split('-') as [SortField, SortDirection]
            onSortChange(field, dir)
          }}
        >
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="nom-asc">Nom (A-Z)</SelectItem>
            <SelectItem value="nom-desc">Nom (Z-A)</SelectItem>
            <SelectItem value="date_signature-desc">Date signature ↓</SelectItem>
            <SelectItem value="date_signature-asc">Date signature ↑</SelectItem>
            <SelectItem value="progression-desc">Progression ↓</SelectItem>
            <SelectItem value="progression-asc">Progression ↑</SelectItem>
            <SelectItem value="urgence-desc">Urgence ↓</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Filtres actifs */}
      {hasActiveFilters && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-muted-foreground">Filtres:</span>
          
          {filters.teamMembers.map(teamId => {
            const profile = profiles?.find((p) => p.id === teamId)
            return profile ? (
              <Badge key={`team-${teamId}`} variant="secondary" className="gap-1">
                {profile.prenom} {profile.nom}
                <X
                  className="w-3 h-3 cursor-pointer"
                  onClick={() => onFiltersChange({
                    ...filters,
                    teamMembers: filters.teamMembers.filter(t => t !== teamId)
                  })}
                />
              </Badge>
            ) : null
          })}
          
          {filters.regions.map(region => (
            <Badge key={`region-${region}`} variant="secondary" className="gap-1">
              {region}
              <X
                className="w-3 h-3 cursor-pointer"
                onClick={() => onFiltersChange({
                  ...filters,
                  regions: filters.regions.filter(r => r !== region)
                })}
              />
            </Badge>
          ))}
          
          {filters.types.map(type => (
            <Badge key={`type-${type}`} variant="secondary" className="gap-1">
              {type}
              <X
                className="w-3 h-3 cursor-pointer"
                onClick={() => onFiltersChange({
                  ...filters,
                  types: filters.types.filter(t => t !== type)
                })}
              />
            </Badge>
          ))}
          
          {filters.statuts.map(statut => (
            <Badge key={`statut-${statut}`} variant="secondary" className="gap-1">
              {statut}
              <X
                className="w-3 h-3 cursor-pointer"
                onClick={() => onFiltersChange({
                  ...filters,
                  statuts: filters.statuts.filter(s => s !== statut)
                })}
              />
            </Badge>
          ))}
          
          {filters.healthStatuses.map(health => (
            <Badge key={`health-${health}`} variant="secondary" className="gap-1">
              {HEALTH_OPTIONS.find(h => h.value === health)?.label}
              <X
                className="w-3 h-3 cursor-pointer"
                onClick={() => onFiltersChange({
                  ...filters,
                  healthStatuses: filters.healthStatuses.filter(h => h !== health)
                })}
              />
            </Badge>
          ))}
          
          <Button variant="ghost" size="sm" onClick={resetFilters}>
            Tout effacer
          </Button>
        </div>
      )}
    </div>
  )
}
