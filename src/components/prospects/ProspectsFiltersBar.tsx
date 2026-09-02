import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Slider } from '@/components/ui/slider'
import { Filter } from 'lucide-react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'

export interface ProspectFilters {
  search: string
  regions: string[]
  types: string[]
  statuts: string[]
  commercialIds: string[]
  progressionRange: [number, number]
}

interface ProspectsFiltersBarProps {
  filters: ProspectFilters
  onFiltersChange: (filters: ProspectFilters) => void
  availableRegions: string[]
  availableTypes: string[]
  availableStatuts: string[]
  availableCommercials: { id: string; name: string }[]
  variant?: 'default' | 'glassmorphism'
  /** Mode compact pour mobile */
  compact?: boolean
}

export function ProspectsFiltersBar({
  filters,
  onFiltersChange,
  availableRegions,
  availableTypes,
  availableStatuts,
  availableCommercials,
  variant = 'glassmorphism',
  compact = false,
}: ProspectsFiltersBarProps) {
  const [isOpen, setIsOpen] = useState(false)
  const isGlassmorphism = variant === 'glassmorphism'

  const activeFiltersCount = [
    filters.regions.length > 0,
    filters.types.length > 0,
    filters.statuts.length > 0,
    filters.commercialIds.length > 0,
    filters.progressionRange[0] > 0 || filters.progressionRange[1] < 100,
  ].filter(Boolean).length

  const toggleArrayFilter = (
    key: 'regions' | 'types' | 'statuts' | 'commercialIds',
    value: string
  ) => {
    const current = filters[key]
    const updated = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value]
    onFiltersChange({ ...filters, [key]: updated })
  }

  const resetFilters = () => {
    onFiltersChange({
      search: '',
      regions: [],
      types: [],
      statuts: [],
      commercialIds: [],
      progressionRange: [0, 100],
    })
  }

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            'gap-1.5 rounded-lg transition-all',
            compact ? 'h-6 px-1.5' : 'h-7 px-2.5',
            isGlassmorphism
              ? 'bg-card/10 backdrop-blur-sm border border-white/20 text-white/80 hover:bg-card/20 hover:text-white'
              : 'border hover:bg-muted'
          )}
        >
          <Filter className={compact ? 'h-3 w-3' : 'h-4 w-4'} />
          {!compact && <span className="hidden sm:inline text-xs">Filtres</span>}
          {activeFiltersCount > 0 && (
            <Badge
              className={cn(
                'rounded-full',
                compact ? 'h-3.5 px-1 text-[9px]' : 'h-4 px-1 text-[10px]',
                isGlassmorphism ? 'bg-card text-primary' : 'bg-primary text-primary-foreground'
              )}
            >
              {activeFiltersCount}
            </Badge>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-md">
        <SheetHeader className="pb-4">
          <div className="flex items-center justify-between">
            <SheetTitle>Filtres avancés</SheetTitle>
            {activeFiltersCount > 0 && (
              <Button variant="ghost" size="sm" onClick={resetFilters}>
                Réinitialiser
              </Button>
            )}
          </div>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-120px)]">
          <div className="space-y-6 pr-4">
            {/* Régions */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Régions</Label>
              <div className="flex flex-wrap gap-2">
                {availableRegions.map((region) => (
                  <Badge
                    key={region}
                    variant={filters.regions.includes(region) ? 'default' : 'outline'}
                    className="cursor-pointer hover:bg-primary/80"
                    onClick={() => toggleArrayFilter('regions', region)}
                  >
                    {region}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Types */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Types d'établissement</Label>
              <div className="flex flex-wrap gap-2">
                {availableTypes.map((type) => (
                  <Badge
                    key={type}
                    variant={filters.types.includes(type) ? 'default' : 'outline'}
                    className="cursor-pointer hover:bg-primary/80"
                    onClick={() => toggleArrayFilter('types', type)}
                  >
                    {type}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Statuts */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Statuts</Label>
              <div className="flex flex-wrap gap-2">
                {availableStatuts.map((statut) => (
                  <Badge
                    key={statut}
                    variant={filters.statuts.includes(statut) ? 'default' : 'outline'}
                    className="cursor-pointer hover:bg-primary/80"
                    onClick={() => toggleArrayFilter('statuts', statut)}
                  >
                    {statut}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Commerciaux */}
            {availableCommercials.length > 0 && (
              <div className="space-y-2">
                <Label className="text-sm font-medium">Commercial assigné</Label>
                <div className="flex flex-wrap gap-2">
                  {availableCommercials.map((commercial) => (
                    <Badge
                      key={commercial.id}
                      variant={
                        filters.commercialIds.includes(commercial.id) ? 'default' : 'outline'
                      }
                      className="cursor-pointer hover:bg-primary/80"
                      onClick={() => toggleArrayFilter('commercialIds', commercial.id)}
                    >
                      {commercial.name}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Progression */}
            <div className="space-y-4">
              <Label className="text-sm font-medium">
                Progression: {filters.progressionRange[0]}% - {filters.progressionRange[1]}%
              </Label>
              <Slider
                value={filters.progressionRange}
                onValueChange={(value) =>
                  onFiltersChange({ ...filters, progressionRange: value as [number, number] })
                }
                min={0}
                max={100}
                step={5}
                className="w-full"
              />
            </div>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  )
}
