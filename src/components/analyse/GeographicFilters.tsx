import { useEffect, useState } from 'react';
import { debug } from '@/lib/debug';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Search, X, Filter, Users, MapPin, Building, Cpu, ChevronDown, Check } from 'lucide-react';
import { useGeographicFilters, GeographicFilters as GeoFiltersType } from '@/hooks/geography/useGeographicFilters';
import { getAllRegions } from '@/lib/geography';
import { Separator } from '@/components/ui/separator';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useProfiles } from '@/hooks/profile/useProfiles';
import { cn } from '@/lib/utils';

interface GeographicFiltersProps {
  onFiltersChange: (filters: GeoFiltersType) => void;
}

const STORAGE_KEY = 'geo-advanced-filters';

const PHASE_CHIPS = [
  { value: 'Prospects', color: 'bg-amber-500', textColor: 'text-amber-700 dark:text-amber-400', bgLight: 'bg-amber-50 dark:bg-amber-950/30', border: 'border-amber-200 dark:border-amber-800' },
  { value: 'Déploiement', color: 'bg-blue-500', textColor: 'text-blue-700 dark:text-blue-400', bgLight: 'bg-blue-50 dark:bg-blue-950/30', border: 'border-blue-200 dark:border-blue-800' },
  { value: 'Production', color: 'bg-emerald-500', textColor: 'text-emerald-700 dark:text-emerald-400', bgLight: 'bg-emerald-50 dark:bg-emerald-950/30', border: 'border-emerald-200 dark:border-emerald-800' },
];

const TYPE_CHIPS = [
  { value: 'CH', label: 'CH' },
  { value: 'CHU', label: 'CHU' },
  { value: 'Clinique', label: 'Clinique' },
  { value: 'ESPIC', label: 'ESPIC' },
  { value: 'HIA', label: 'HIA' },
];

const DPI_CHIPS = [
  { value: 'Easily', label: 'Easily' },
  { value: 'Maincare', label: 'Maincare' },
  { value: 'Sillage', label: 'Sillage' },
  { value: 'DxCare', label: 'DxCare' },
  { value: 'Orbis', label: 'Orbis' },
  { value: 'Autre', label: 'Autre' },
];

export function GeographicFilters({ onFiltersChange }: GeographicFiltersProps) {
  const { filters, updateFilter, resetFilters, hasActiveFilters } = useGeographicFilters();
  const { data: profiles } = useProfiles();
  const allRegions = getAllRegions();
  const [regionsOpen, setRegionsOpen] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        // Ne pas restaurer les phases pour éviter conflit avec les boutons du header
        delete parsed.phases;
        Object.keys(parsed).forEach(key => {
          if (key in filters) {
            updateFilter(key as keyof GeoFiltersType, parsed[key]);
          }
        });
        onFiltersChange({ ...parsed, phases: [] });
      }
    } catch (e) {
      if (import.meta.env.DEV) debug.warn('[GeoFilters] Failed to load saved filters:', e);
    }
  }, []);

  const handleApply = () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(filters));
    } catch (e) {
      if (import.meta.env.DEV) debug.warn('[GeoFilters] Failed to save filters:', e);
    }
    onFiltersChange(filters);
  };

  const handleReset = () => {
    resetFilters();
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {
      if (import.meta.env.DEV) debug.warn('[GeoFilters] Failed to clear filters:', e);
    }
    onFiltersChange({
      search: '',
      regions: [],
      types: [],
      phases: [],
      dpis: [],
      licensesRange: [0, 1000],
      passagesRange: [0, 500000],
    });
  };

  const toggleArrayFilter = (key: 'regions' | 'types' | 'phases' | 'dpis', value: string) => {
    const current = filters[key];
    const updated = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value];
    updateFilter(key, updated);
  };

  const allProfiles = profiles || [];

  const activeCount = [
    filters.regions.length,
    filters.types.length,
    filters.phases.length,
    filters.dpis.length,
    filters.commercialId ? 1 : 0,
    filters.chefProjetId ? 1 : 0,
    filters.csmId ? 1 : 0,
  ].reduce((a, b) => a + b, 0);

  return (
    <Card className="h-fit lg:sticky lg:top-4 shadow-sm">
      <CardHeader className="pb-3 px-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-primary/10">
              <Filter className="h-4 w-4 text-primary" />
            </div>
            <CardTitle className="text-base font-semibold">Filtres</CardTitle>
          </div>
          {activeCount > 0 && (
            <Badge className="text-xs font-bold bg-primary text-primary-foreground">
              {activeCount}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4 px-4">
        <div className="space-y-5 max-h-[calc(100vh-320px)] lg:max-h-[calc(100vh-280px)] overflow-y-auto pr-1">
          {/* Recherche */}
          <div className="space-y-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher..."
                value={filters.search}
                onChange={(e) => updateFilter('search', e.target.value)}
                className="pl-9 h-10 bg-muted/30"
              />
              {filters.search && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                  onClick={() => updateFilter('search', '')}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </div>

          <Separator className="my-3" />

          {/* Équipe */}
          <Collapsible defaultOpen={false}>
            <CollapsibleTrigger className="flex items-center justify-between w-full group">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <Label className="font-medium cursor-pointer text-sm">Équipe</Label>
                {(filters.commercialId || filters.chefProjetId || filters.csmId) && (
                  <Badge variant="secondary" className="text-[10px] h-5">
                    {[filters.commercialId, filters.chefProjetId, filters.csmId].filter(Boolean).length}
                  </Badge>
                )}
              </div>
              <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-3 pt-3">
              <Select
                value={filters.commercialId || 'all'}
                onValueChange={(v) => updateFilter('commercialId', v === 'all' ? undefined : v)}
              >
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Commercial" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les commerciaux</SelectItem>
                  {allProfiles.map(p => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.prenom} {p.nom}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={filters.chefProjetId || 'all'}
                onValueChange={(v) => updateFilter('chefProjetId', v === 'all' ? undefined : v)}
              >
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Chef de projet" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les chefs de projet</SelectItem>
                  {allProfiles.map(p => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.prenom} {p.nom}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={filters.csmId || 'all'}
                onValueChange={(v) => updateFilter('csmId', v === 'all' ? undefined : v)}
              >
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="CSM" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les CSM</SelectItem>
                  {allProfiles.map(p => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.prenom} {p.nom}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CollapsibleContent>
          </Collapsible>

          <Separator className="my-3" />

          {/* Phases - Chips */}
          <div className="space-y-2.5">
            <div className="flex items-center gap-2">
              <Label className="font-medium text-sm">Phases</Label>
              {filters.phases.length > 0 && (
                <Badge variant="secondary" className="text-[10px] h-5">{filters.phases.length}</Badge>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {PHASE_CHIPS.map((phase) => {
                const isSelected = filters.phases.includes(phase.value);
                return (
                  <button
                    key={phase.value}
                    onClick={() => toggleArrayFilter('phases', phase.value)}
                    className={cn(
                      "px-3 py-1.5 rounded-full text-xs font-medium border transition-all",
                      "hover:scale-[1.02] active:scale-[0.98]",
                      isSelected 
                        ? cn(phase.color, "text-white border-transparent")
                        : cn(phase.bgLight, phase.textColor, phase.border)
                    )}
                  >
                    {phase.value}
                  </button>
                );
              })}
            </div>
          </div>

          <Separator className="my-3" />

          {/* Régions - Combobox */}
          <div className="space-y-2.5">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <Label className="font-medium text-sm">Régions</Label>
              {filters.regions.length > 0 && (
                <Badge variant="secondary" className="text-[10px] h-5">{filters.regions.length}</Badge>
              )}
            </div>
            <Popover open={regionsOpen} onOpenChange={setRegionsOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full justify-between h-9 text-xs font-normal"
                >
                  {filters.regions.length > 0 
                    ? `${filters.regions.length} région${filters.regions.length > 1 ? 's' : ''} sélectionnée${filters.regions.length > 1 ? 's' : ''}`
                    : "Sélectionner des régions..."
                  }
                  <ChevronDown className="h-3.5 w-3.5 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[260px] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Rechercher une région..." className="h-9" />
                  <CommandList>
                    <CommandEmpty>Aucune région trouvée.</CommandEmpty>
                    <CommandGroup>
                      {allRegions.map((region) => (
                        <CommandItem
                          key={region}
                          value={region}
                          onSelect={() => toggleArrayFilter('regions', region)}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              filters.regions.includes(region) ? "opacity-100" : "opacity-0"
                            )}
                          />
                          <span className="text-xs">{region}</span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            {filters.regions.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {filters.regions.slice(0, 3).map((region) => (
                  <Badge 
                    key={region} 
                    variant="secondary" 
                    className="text-[10px] cursor-pointer hover:bg-destructive hover:text-destructive-foreground"
                    onClick={() => toggleArrayFilter('regions', region)}
                  >
                    {region.length > 12 ? region.slice(0, 12) + '...' : region}
                    <X className="h-2.5 w-2.5 ml-1" />
                  </Badge>
                ))}
                {filters.regions.length > 3 && (
                  <Badge variant="outline" className="text-[10px]">
                    +{filters.regions.length - 3}
                  </Badge>
                )}
              </div>
            )}
          </div>

          <Separator className="my-3" />

          {/* Types - Chips */}
          <Collapsible defaultOpen={false}>
            <CollapsibleTrigger className="flex items-center justify-between w-full group">
              <div className="flex items-center gap-2">
                <Building className="h-4 w-4 text-muted-foreground" />
                <Label className="font-medium cursor-pointer text-sm">Types</Label>
                {filters.types.length > 0 && (
                  <Badge variant="secondary" className="text-[10px] h-5">{filters.types.length}</Badge>
                )}
              </div>
              <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-3">
              <div className="flex flex-wrap gap-2">
                {TYPE_CHIPS.map((type) => {
                  const isSelected = filters.types.includes(type.value);
                  return (
                    <button
                      key={type.value}
                      onClick={() => toggleArrayFilter('types', type.value)}
                      className={cn(
                        "px-3 py-1.5 rounded-full text-xs font-medium border transition-all",
                        "hover:scale-[1.02] active:scale-[0.98]",
                        isSelected 
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-muted/50 text-muted-foreground border-border hover:border-primary/50"
                      )}
                    >
                      {type.label}
                    </button>
                  );
                })}
              </div>
            </CollapsibleContent>
          </Collapsible>

          <Separator className="my-3" />

          {/* DPI - Chips */}
          <Collapsible defaultOpen={false}>
            <CollapsibleTrigger className="flex items-center justify-between w-full group">
              <div className="flex items-center gap-2">
                <Cpu className="h-4 w-4 text-muted-foreground" />
                <Label className="font-medium cursor-pointer text-sm">DPI</Label>
                {filters.dpis.length > 0 && (
                  <Badge variant="secondary" className="text-[10px] h-5">{filters.dpis.length}</Badge>
                )}
              </div>
              <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-3">
              <div className="flex flex-wrap gap-2">
                {DPI_CHIPS.map((dpi) => {
                  const isSelected = filters.dpis.includes(dpi.value);
                  return (
                    <button
                      key={dpi.value}
                      onClick={() => toggleArrayFilter('dpis', dpi.value)}
                      className={cn(
                        "px-3 py-1.5 rounded-full text-xs font-medium border transition-all",
                        "hover:scale-[1.02] active:scale-[0.98]",
                        isSelected 
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-muted/50 text-muted-foreground border-border hover:border-primary/50"
                      )}
                    >
                      {dpi.label}
                    </button>
                  );
                })}
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>

        {/* Boutons d'action - Sticky */}
        <div className="flex gap-2 pt-4 border-t sticky bottom-0 bg-card">
          <Button onClick={handleApply} className="flex-1 h-10 font-medium">
            Appliquer
          </Button>
          {hasActiveFilters && (
            <Button onClick={handleReset} variant="outline" size="icon" className="h-10 w-10" aria-label="Fermer">
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
