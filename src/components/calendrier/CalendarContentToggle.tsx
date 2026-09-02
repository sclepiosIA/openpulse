import { Button } from '@/components/ui/button';
import { CheckSquare, Calendar, UserMinus, Tag } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Label } from '@/components/ui/label';
import { useCategories } from '@/hooks/catalogue/useCategories';
import { useIsMobile } from '@/hooks/ui/use-mobile';

export interface ContentFilters {
  showTasks: boolean;
  showEvents: boolean;
  showAbsences: boolean;
  showEstablishmentTasks: boolean;
  selectedCategories?: string[];
}

interface CalendarContentToggleProps {
  filters: ContentFilters;
  onChange: (filters: ContentFilters) => void;
  taskCount?: number;
  eventCount?: number;
  absenceCount?: number;
  establishmentTaskCount?: number;
}

export function CalendarContentToggle({
  filters,
  onChange,
  taskCount = 0,
  eventCount = 0,
  absenceCount = 0,
}: CalendarContentToggleProps) {
  const { data: categories } = useCategories();
  const isMobile = useIsMobile();
  
  const toggleFilter = (key: keyof ContentFilters) => {
    if (key === 'selectedCategories') return;
    onChange({ ...filters, [key]: !filters[key] });
  };

  const toggleCategory = (categoryId: string) => {
    const current = filters.selectedCategories || [];
    const updated = current.includes(categoryId)
      ? current.filter(id => id !== categoryId)
      : [...current, categoryId];
    onChange({ ...filters, selectedCategories: updated });
  };

  const clearCategories = () => {
    onChange({ ...filters, selectedCategories: [] });
  };

  const selectedCategoryCount = filters.selectedCategories?.length || 0;

  // Mobile: Simpler pills with visible labels
  if (isMobile) {
    return (
      <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide" role="group" aria-label="Filtres de contenu du calendrier">
        {/* Tasks toggle - simple pill */}
        <Button
          variant={filters.showTasks ? "default" : "outline"}
          size="sm"
          onClick={() => toggleFilter('showTasks')}
          aria-label={`Afficher les tâches (${taskCount})`}
          aria-pressed={filters.showTasks}
          title="Afficher les tâches"
          className={cn(
            'h-7 px-2 gap-1 text-[11px] font-medium rounded-full flex-shrink-0',
            filters.showTasks 
              ? 'bg-primary text-primary-foreground' 
              : 'bg-background border-border'
          )}
        >
          <CheckSquare className="h-3 w-3" aria-hidden="true" />
          <span>{taskCount}</span>
        </Button>

        {/* Events toggle */}
        <Button
          variant={filters.showEvents ? "default" : "outline"}
          size="sm"
          onClick={() => toggleFilter('showEvents')}
          aria-label={`Afficher les évènements (${eventCount})`}
          aria-pressed={filters.showEvents}
          title="Afficher les évènements"
          className={cn(
            'h-7 px-2 gap-1 text-[11px] font-medium rounded-full flex-shrink-0',
            filters.showEvents 
              ? 'bg-emerald-600 text-white hover:bg-emerald-700' 
              : 'bg-background border-border'
          )}
        >
          <Calendar className="h-3 w-3" aria-hidden="true" />
          <span>{eventCount}</span>
        </Button>

        {/* Absences toggle */}
        <Button
          variant={filters.showAbsences ? "default" : "outline"}
          size="sm"
          onClick={() => toggleFilter('showAbsences')}
          aria-label={`Afficher les absences (${absenceCount})`}
          aria-pressed={filters.showAbsences}
          title="Afficher les absences"
          className={cn(
            'h-7 px-2 gap-1 text-[11px] font-medium rounded-full flex-shrink-0',
            filters.showAbsences 
              ? 'bg-amber-600 text-white hover:bg-amber-700' 
              : 'bg-background border-border'
          )}
        >
          <UserMinus className="h-3 w-3" aria-hidden="true" />
          <span>{absenceCount}</span>
        </Button>

        {/* Category filter - popover */}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              aria-label={
                selectedCategoryCount > 0
                  ? `Filtrer par catégorie (${selectedCategoryCount} sélectionnée${selectedCategoryCount > 1 ? 's' : ''})`
                  : 'Filtrer par catégorie'
              }
              title="Filtrer par catégorie"
              className={cn(
                'h-7 px-2 gap-1 text-[11px] font-medium rounded-full flex-shrink-0',
                selectedCategoryCount > 0 && 'bg-violet-100 border-violet-300 text-violet-700'
              )}
            >
              <Tag className="h-3 w-3" aria-hidden="true" />
              {selectedCategoryCount > 0 ? selectedCategoryCount : ''}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-56" align="start">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-muted-foreground">Catégories</p>
                {selectedCategoryCount > 0 && (
                  <Button variant="ghost" size="sm" className="h-5 px-1.5 text-[10px]" onClick={clearCategories}>
                    Effacer
                  </Button>
                )}
              </div>
              <ScrollArea className="max-h-[200px]">
                <div className="space-y-1.5">
                  {categories?.map((category) => (
                    <div key={category.id} className="flex items-center gap-2">
                      <Checkbox
                        id={`cat-mobile-${category.id}`}
                        checked={filters.selectedCategories?.includes(category.id) || false}
                        onCheckedChange={() => toggleCategory(category.id)}
                        className="h-4 w-4"
                      />
                      <div 
                        className="h-3 w-3 rounded-full flex-shrink-0" 
                        style={{ backgroundColor: category.couleur || '#6b7280' }}
                      />
                      <Label htmlFor={`cat-mobile-${category.id}`} className="text-sm cursor-pointer flex-1 truncate">
                        {category.nom}
                      </Label>
                    </div>
                  ))}
                  {(!categories || categories.length === 0) && (
                    <p className="text-xs text-muted-foreground text-center py-2">
                      Aucune catégorie
                    </p>
                  )}
                </div>
              </ScrollArea>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    );
  }

  // Desktop: Original design with more details
  return (
    <div className="flex items-center gap-0.5 bg-muted/50 p-0.5 rounded-md">
      {/* Tasks toggle */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => toggleFilter('showTasks')}
        className={cn(
          'h-7 px-2 gap-1 text-xs font-medium transition-all',
          filters.showTasks 
            ? 'bg-background shadow-sm text-primary' 
            : 'text-muted-foreground hover:text-foreground'
        )}
      >
        <CheckSquare className="h-3.5 w-3.5" />
        Tâches
        {taskCount > 0 && (
          <span className={cn(
            'text-[10px] px-1 py-0.5 rounded-full',
            filters.showTasks ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
          )}>
            {taskCount}
          </span>
        )}
      </Button>

      {/* Category filter */}
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              'h-7 px-2 gap-1 text-xs font-medium transition-all',
              selectedCategoryCount > 0
                ? 'bg-background shadow-sm text-primary' 
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <Tag className="h-3.5 w-3.5" />
            Cat.
            {selectedCategoryCount > 0 && (
              <Badge variant="secondary" className="h-4 px-1 text-[10px]">
                {selectedCategoryCount}
              </Badge>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-56" align="start">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-muted-foreground">Par catégorie</p>
              {selectedCategoryCount > 0 && (
                <Button variant="ghost" size="sm" className="h-5 px-1.5 text-[10px]" onClick={clearCategories}>
                  Effacer
                </Button>
              )}
            </div>
            <ScrollArea className="max-h-[180px]">
              <div className="space-y-1.5">
                {categories?.map((category) => (
                  <div key={category.id} className="flex items-center gap-1.5">
                    <Checkbox
                      id={`cat-${category.id}`}
                      checked={filters.selectedCategories?.includes(category.id) || false}
                      onCheckedChange={() => toggleCategory(category.id)}
                      className="h-3.5 w-3.5"
                    />
                    <div 
                      className="h-2.5 w-2.5 rounded-full flex-shrink-0" 
                      style={{ backgroundColor: category.couleur || '#6b7280' }}
                    />
                    <Label htmlFor={`cat-${category.id}`} className="text-xs cursor-pointer flex-1 truncate">
                      {category.nom}
                    </Label>
                  </div>
                ))}
                {(!categories || categories.length === 0) && (
                  <p className="text-[11px] text-muted-foreground text-center py-1.5">
                    Aucune catégorie
                  </p>
                )}
              </div>
            </ScrollArea>
          </div>
        </PopoverContent>
      </Popover>
      
      <Button
        variant="ghost"
        size="sm"
        className={cn(
          'h-7 px-2 gap-1 text-xs font-medium transition-all',
          filters.showEvents 
            ? 'bg-background shadow-sm text-primary' 
            : 'text-muted-foreground hover:text-foreground'
        )}
        onClick={() => toggleFilter('showEvents')}
      >
        <Calendar className="h-3.5 w-3.5" />
        Évén.
        {eventCount > 0 && (
          <span className={cn(
            'text-[10px] px-1 py-0.5 rounded-full',
            filters.showEvents ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
          )}>
            {eventCount}
          </span>
        )}
      </Button>
      
      <Button
        variant="ghost"
        size="sm"
        className={cn(
          'h-7 px-2 gap-1 text-xs font-medium transition-all',
          filters.showAbsences 
            ? 'bg-background shadow-sm text-primary' 
            : 'text-muted-foreground hover:text-foreground'
        )}
        onClick={() => toggleFilter('showAbsences')}
      >
        <UserMinus className="h-3.5 w-3.5" />
        Abs.
        {absenceCount > 0 && (
          <span className={cn(
            'text-[10px] px-1 py-0.5 rounded-full',
            filters.showAbsences ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
          )}>
            {absenceCount}
          </span>
        )}
      </Button>
    </div>
  );
}
