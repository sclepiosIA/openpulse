
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Separator } from '@/components/ui/separator';
import { useActiveProfiles } from '@/hooks/profile/useProfiles';
import { useCategories } from '@/hooks/catalogue/useCategories';
import { useEtablissements } from '@/hooks/crm/useEtablissements';
import { CalendarFilters as CalendarFiltersType } from '@/hooks/calendar/useCalendarFilters';
import { Search, Filter, X, Calendar as CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

import { getDatePresets } from '@/lib/dateUtils';

interface CalendarFiltersProps {
  filters: CalendarFiltersType;
  onFiltersChange: (updates: Partial<CalendarFiltersType>) => void;
  onReset: () => void;
  hasActiveFilters: boolean;
}

export function CalendarFilters({ filters, onFiltersChange, onReset, hasActiveFilters }: CalendarFiltersProps) {
  const { data: profiles } = useActiveProfiles();
  const { data: categories } = useCategories();
  const { data: etablissements } = useEtablissements();

  const presets = getDatePresets();

  const toggleArrayFilter = (key: keyof CalendarFiltersType, value: string) => {
    const currentArray = filters[key] as string[];
    const newArray = currentArray.includes(value)
      ? currentArray.filter(v => v !== value)
      : [...currentArray, value];
    onFiltersChange({ [key]: newArray });
  };

  const applyDatePreset = (preset: { start: Date; end: Date }) => {
    onFiltersChange({ dateRange: preset });
  };

  const FiltersContent = () => (
    <div className="space-y-6">
      {/* Recherche */}
      <div className="space-y-2">
        <Label htmlFor="search">Recherche</Label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            id="search"
            placeholder="Rechercher une tâche..."
            value={filters.search}
            onChange={(e) => onFiltersChange({ search: e.target.value })}
            className="pl-9"
          />
        </div>
      </div>

      <Separator />

      {/* Plage de dates */}
      <div className="space-y-2">
        <Label>Période</Label>
        <div className="flex flex-wrap gap-2 mb-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => applyDatePreset(presets.thisWeek)}
          >
            Cette semaine
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => applyDatePreset(presets.thisMonth)}
          >
            Ce mois
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => applyDatePreset(presets.next7Days)}
          >
            7 prochains jours
          </Button>
        </div>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="w-full justify-start text-left font-normal">
              <CalendarIcon className="mr-2 h-4 w-4" />
              {filters.dateRange.start ? (
                filters.dateRange.end ? (
                  <>
                    {format(filters.dateRange.start, 'PP', { locale: fr })} -{' '}
                    {format(filters.dateRange.end, 'PP', { locale: fr })}
                  </>
                ) : (
                  format(filters.dateRange.start, 'PP', { locale: fr })
                )
              ) : (
                <span>Sélectionner une période</span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="range"
              selected={
                filters.dateRange.start && filters.dateRange.end
                  ? { from: filters.dateRange.start, to: filters.dateRange.end }
                  : undefined
              }
              onSelect={(range) => {
                onFiltersChange({
                  dateRange: {
                    start: range?.from || null,
                    end: range?.to || null,
                  },
                });
              }}
              initialFocus
            />
          </PopoverContent>
        </Popover>
      </div>

      <Separator />

      {/* Mes tâches uniquement */}
      <div className="flex items-center space-x-2">
        <Checkbox
          id="myTasks"
          checked={filters.showOnlyMyTasks}
          onCheckedChange={(checked) => onFiltersChange({ showOnlyMyTasks: checked as boolean })}
        />
        <Label htmlFor="myTasks" className="text-sm font-normal cursor-pointer">
          Mes tâches uniquement
        </Label>
      </div>

      {/* Masquer les tâches terminées */}
      <div className="flex items-center space-x-2">
        <Checkbox
          id="hideCompleted"
          checked={filters.hideCompleted}
          onCheckedChange={(checked) => onFiltersChange({ hideCompleted: checked as boolean })}
        />
        <Label htmlFor="hideCompleted" className="text-sm font-normal cursor-pointer">
          Masquer les tâches terminées
        </Label>
      </div>

      {/* Masquer les tâches obsolètes */}
      <div className="flex items-center space-x-2">
        <Checkbox
          id="hideObsolete"
          checked={filters.hideObsolete}
          onCheckedChange={(checked) => onFiltersChange({ hideObsolete: checked as boolean })}
        />
        <Label htmlFor="hideObsolete" className="text-sm font-normal cursor-pointer">
          Masquer les tâches obsolètes (&gt; 30 jours)
        </Label>
      </div>

      <Separator />

      {/* Responsables */}
      {profiles && profiles.length > 0 && (
        <div className="space-y-2">
          <Label>Responsables</Label>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {profiles.map((profile) => (
              <div key={profile.id} className="flex items-center space-x-2">
                <Checkbox
                  id={`resp-${profile.id}`}
                  checked={filters.responsables.includes(profile.id)}
                  onCheckedChange={() => toggleArrayFilter('responsables', profile.id)}
                />
                <Label htmlFor={`resp-${profile.id}`} className="text-sm font-normal cursor-pointer">
                  {profile.prenom} {profile.nom}
                </Label>
              </div>
            ))}
          </div>
        </div>
      )}

      <Separator />

      {/* Catégories */}
      {categories && categories.length > 0 && (
        <div className="space-y-2">
          <Label>Catégories</Label>
          <div className="space-y-2">
            {categories.map((category) => (
              <div key={category.id} className="flex items-center space-x-2">
                <Checkbox
                  id={`cat-${category.id}`}
                  checked={filters.categories.includes(category.id)}
                  onCheckedChange={() => toggleArrayFilter('categories', category.id)}
                />
                <Label htmlFor={`cat-${category.id}`} className="text-sm font-normal cursor-pointer flex items-center gap-2">
                  <div
                    className="h-3 w-3 rounded-full"
                    style={{ backgroundColor: category.couleur }}
                  />
                  {category.nom}
                </Label>
              </div>
            ))}
          </div>
        </div>
      )}

      <Separator />

      {/* Statuts */}
      <div className="space-y-2">
        <Label>Statuts</Label>
        <div className="space-y-2">
          {['en_attente', 'en_cours', 'terminee', 'bloquee'].map((statut) => (
            <div key={statut} className="flex items-center space-x-2">
              <Checkbox
                id={`stat-${statut}`}
                checked={filters.statuts.includes(statut)}
                onCheckedChange={() => toggleArrayFilter('statuts', statut)}
              />
              <Label htmlFor={`stat-${statut}`} className="text-sm font-normal cursor-pointer">
                {statut === 'en_attente' && 'En attente'}
                {statut === 'en_cours' && 'En cours'}
                {statut === 'terminee' && 'Terminée'}
                {statut === 'bloquee' && 'Bloquée'}
              </Label>
            </div>
          ))}
        </div>
      </div>

      <Separator />

      {/* Priorités */}
      <div className="space-y-2">
        <Label>Priorités</Label>
        <div className="space-y-2">
          {['low', 'medium', 'high'].map((priorite) => (
            <div key={priorite} className="flex items-center space-x-2">
              <Checkbox
                id={`prio-${priorite}`}
                checked={filters.priorites.includes(priorite)}
                onCheckedChange={() => toggleArrayFilter('priorites', priorite)}
              />
              <Label htmlFor={`prio-${priorite}`} className="text-sm font-normal cursor-pointer">
                {priorite === 'low' && 'Basse'}
                {priorite === 'medium' && 'Moyenne'}
                {priorite === 'high' && 'Haute'}
              </Label>
            </div>
          ))}
        </div>
      </div>

      {/* Reset button */}
      {hasActiveFilters && (
        <Button onClick={onReset} variant="outline" className="w-full">
          <X className="mr-2 h-4 w-4" />
          Réinitialiser les filtres
        </Button>
      )}
    </div>
  );

  return (
    <>
      {/* Desktop: Sidebar fixe */}
      <div className="hidden lg:block">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filtres
              {hasActiveFilters && (
                <Badge variant="secondary" className="ml-auto">
                  Actifs
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <FiltersContent />
          </CardContent>
        </Card>
      </div>

      {/* Mobile: Sheet */}
      <div className="lg:hidden">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" className="w-full">
              <Filter className="mr-2 h-4 w-4" />
              Filtres
              {hasActiveFilters && (
                <Badge variant="secondary" className="ml-2">
                  Actifs
                </Badge>
              )}
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-[300px] sm:w-[400px] overflow-y-auto">
            <SheetHeader>
              <SheetTitle>Filtres du calendrier</SheetTitle>
            </SheetHeader>
            <div className="mt-6">
              <FiltersContent />
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
}