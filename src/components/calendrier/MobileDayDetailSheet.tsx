import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Calendar, CheckSquare, UserMinus, Plus, Clock } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { ClickableLocation } from './ClickableLocation';
import { CalendarEvent } from '@/types/calendar';

interface Task {
  id: string;
  titre: string;
  echeance?: string;
  statut: string;
  priorite?: string;
  categories_taches?: { nom: string; couleur?: string } | null;
}

interface CalendarAbsence {
  id: string;
  title: string;
  profile_name: string;
  start: Date;
  end: Date;
  type: string;
  color: string;
}

interface MobileDayDetailSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date: Date | null;
  events: CalendarEvent[];
  tasks: Task[];
  absences: CalendarAbsence[];
  onEventClick: (event: CalendarEvent) => void;
  onTaskClick: (task: Task) => void;
  onCreateEvent: (date: Date) => void;
}

export function MobileDayDetailSheet({
  open,
  onOpenChange,
  date,
  events,
  tasks,
  absences,
  onEventClick,
  onTaskClick,
  onCreateEvent,
}: MobileDayDetailSheetProps) {
  if (!date) return null;

  const hasItems = events.length > 0 || tasks.length > 0 || absences.length > 0;

  const getStatusColor = (statut: string) => {
    switch (statut) {
      case 'Terminé': return 'bg-green-500';
      case 'Bloqué': return 'bg-red-500';
      case 'En cours': return 'bg-blue-500';
      default: return 'bg-muted-foreground';
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[70vh] rounded-t-3xl">
        <SheetHeader className="pb-4 border-b">
          <SheetTitle className="flex items-center gap-2 text-left">
            <div className="w-10 h-10 rounded-full bg-orange-500/10 flex items-center justify-center">
              <Calendar className="h-5 w-5 text-orange-500" />
            </div>
            <div>
              <div className="text-lg font-semibold capitalize">
                {format(date, 'EEEE d', { locale: fr })}
              </div>
              <div className="text-sm text-muted-foreground font-normal capitalize">
                {format(date, 'MMMM yyyy', { locale: fr })}
              </div>
            </div>
          </SheetTitle>
        </SheetHeader>

        <ScrollArea className="h-[calc(70vh-140px)] mt-4">
          <div className="space-y-4 pr-4">
            {/* Absences */}
            {absences.length > 0 && (
              <div>
                <h4 className="font-medium text-sm mb-2 flex items-center gap-2 text-muted-foreground">
                  <UserMinus className="h-4 w-4" />
                  Absences ({absences.length})
                </h4>
                <div className="space-y-2">
                  {absences.map(absence => (
                    <div
                      key={absence.id}
                      className="p-3 rounded-xl border-l-4 bg-muted/30"
                      style={{ borderColor: absence.color }}
                    >
                      <p className="font-medium text-sm">{absence.profile_name}</p>
                      <p className="text-xs text-muted-foreground">{absence.type}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Events */}
            {events.length > 0 && (
              <div>
                <h4 className="font-medium text-sm mb-2 flex items-center gap-2 text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  Événements ({events.length})
                </h4>
                <div className="space-y-2">
                  {events.map(event => (
                    <button
                      key={event.id}
                      className="w-full p-3 rounded-xl border-l-4 bg-muted/30 text-left touch-target-comfortable active:scale-[0.98] transition-transform"
                      style={{ borderColor: event.color || event.calendar?.color || '#3B82F6' }}
                      onClick={() => {
                        onEventClick(event);
                        onOpenChange(false);
                      }}
                    >
                      <p className="font-medium text-sm">{event.title}</p>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {format(parseISO(event.start_time), 'HH:mm')} - {format(parseISO(event.end_time), 'HH:mm')}
                        </span>
                        {event.location && (
                          <ClickableLocation 
                            location={event.location}
                            iconClassName="h-3 w-3"
                          />
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Tasks */}
            {tasks.length > 0 && (
              <div>
                <h4 className="font-medium text-sm mb-2 flex items-center gap-2 text-muted-foreground">
                  <CheckSquare className="h-4 w-4" />
                  Tâches ({tasks.length})
                </h4>
                <div className="space-y-2">
                  {tasks.map(task => (
                    <button
                      key={task.id}
                      className="w-full p-3 rounded-xl bg-muted/30 text-left touch-target-comfortable active:scale-[0.98] transition-transform flex items-start gap-3"
                      onClick={() => {
                        onTaskClick(task);
                        onOpenChange(false);
                      }}
                    >
                      <div className={cn(
                        "w-3 h-3 rounded-full mt-1 flex-shrink-0",
                        getStatusColor(task.statut)
                      )} />
                      <div className="min-w-0 flex-1">
                        <p className={cn(
                          "font-medium text-sm",
                          task.statut === 'Terminé' && 'line-through text-muted-foreground'
                        )}>
                          {task.titre}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className="text-[10px] h-5">
                            {task.statut}
                          </Badge>
                          {task.categories_taches?.nom && (
                            <Badge 
                              variant="secondary" 
                              className="text-[10px] h-5"
                              style={{ 
                                backgroundColor: task.categories_taches.couleur ? `${task.categories_taches.couleur}20` : undefined,
                                color: task.categories_taches.couleur 
                              }}
                            >
                              {task.categories_taches.nom}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Empty state */}
            {!hasItems && (
              <div className="text-center py-8">
                <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-4">
                  <Calendar className="h-8 w-8 text-muted-foreground" />
                </div>
                <p className="text-muted-foreground text-sm">
                  Aucun élément prévu ce jour
                </p>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Create button */}
        <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-background via-background to-transparent pt-8">
          <Button 
            className="w-full h-12 text-base gap-2"
            onClick={() => {
              onCreateEvent(date);
              onOpenChange(false);
            }}
          >
            <Plus className="h-5 w-5" />
            Créer un événement
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
