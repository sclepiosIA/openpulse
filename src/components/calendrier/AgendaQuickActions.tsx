import { Button } from '@/components/ui/button';
import { Check, CalendarClock, Archive } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AgendaQuickActionsProps {
  taskId: string;
  isCompleted: boolean;
  onMarkDone: (taskId: string) => void;
  onPostpone: (taskId: string) => void;
  onArchive: (taskId: string) => void;
  className?: string;
}

export function AgendaQuickActions({
  taskId,
  isCompleted,
  onMarkDone,
  onPostpone,
  onArchive,
  className,
}: AgendaQuickActionsProps) {
  return (
    <div
      className={cn(
        'absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200',
        'flex items-center gap-1 bg-background/95 backdrop-blur-sm p-1 rounded-md shadow-sm border',
        className
      )}
    >
      <Button
        size="icon"
        variant="ghost"
        onClick={(e) => {
          e.stopPropagation();
          onMarkDone(taskId);
        }}
        className={cn(
          'h-7 w-7',
          isCompleted && 'text-success'
        )}
        title={isCompleted ? 'Marquer comme non terminé' : 'Marquer comme terminé'} aria-label="Valider">
        <Check className="h-4 w-4" />
      </Button>

      {!isCompleted && (
        <>
          <Button
            size="icon"
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation();
              onPostpone(taskId);
            }}
            className="h-7 w-7"
            title="Reporter à demain"
            aria-label="Reporter à demain"
          >
            <CalendarClock className="h-4 w-4" />
          </Button>

          <Button
            size="icon"
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation();
              onArchive(taskId);
            }}
            className="h-7 w-7 text-muted-foreground hover:text-destructive"
            title="Archiver" aria-label="Archiver">
            <Archive className="h-4 w-4" />
          </Button>
        </>
      )}
    </div>
  );
}
