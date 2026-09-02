import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, Star, User, Filter } from 'lucide-react';

interface AgendaQuickFiltersProps {
  overdueCount: number;
  highPriorityCount: number;
  myTasksCount: number;
  showOnlyOverdue: boolean;
  showOnlyHighPriority: boolean;
  showOnlyMyTasks: boolean;
  onToggleOverdue: () => void;
  onToggleHighPriority: () => void;
  onToggleMyTasks: () => void;
  onResetFilters: () => void;
}

export function AgendaQuickFilters({
  overdueCount,
  highPriorityCount,
  myTasksCount,
  showOnlyOverdue,
  showOnlyHighPriority,
  showOnlyMyTasks,
  onToggleOverdue,
  onToggleHighPriority,
  onToggleMyTasks,
  onResetFilters,
}: AgendaQuickFiltersProps) {
  const hasActiveFilters = showOnlyOverdue || showOnlyHighPriority || showOnlyMyTasks;

  return (
    <div className="flex flex-wrap items-center gap-2 p-4 bg-muted/30 rounded-lg border">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Filter className="h-4 w-4" />
        <span className="hidden sm:inline">Filtres rapides:</span>
      </div>

      <Button
        variant={showOnlyOverdue ? 'default' : 'outline'}
        size="sm"
        onClick={onToggleOverdue}
        className="gap-2"
      >
        <AlertCircle className="h-3 w-3" />
        En retard
        {overdueCount > 0 && (
          <Badge variant={showOnlyOverdue ? 'secondary' : 'default'} className="ml-1">
            {overdueCount}
          </Badge>
        )}
      </Button>

      <Button
        variant={showOnlyHighPriority ? 'default' : 'outline'}
        size="sm"
        onClick={onToggleHighPriority}
        className="gap-2"
      >
        <Star className="h-3 w-3" />
        Priorité haute
        {highPriorityCount > 0 && (
          <Badge variant={showOnlyHighPriority ? 'secondary' : 'default'} className="ml-1">
            {highPriorityCount}
          </Badge>
        )}
      </Button>

      <Button
        variant={showOnlyMyTasks ? 'default' : 'outline'}
        size="sm"
        onClick={onToggleMyTasks}
        className="gap-2"
      >
        <User className="h-3 w-3" />
        Mes tâches
        {myTasksCount > 0 && (
          <Badge variant={showOnlyMyTasks ? 'secondary' : 'default'} className="ml-1">
            {myTasksCount}
          </Badge>
        )}
      </Button>

      {hasActiveFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onResetFilters}
          className="ml-auto text-muted-foreground hover:text-foreground"
        >
          Réinitialiser
        </Button>
      )}
    </div>
  );
}
