import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { format, parseISO, isSameDay, addDays, subDays, isToday, getHours } from 'date-fns';
import { fr } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, CheckSquare, Calendar, Users, Sun } from 'lucide-react';
import { Task } from '@/types/gantt';
import { cn } from '@/lib/utils';
import { getTaskStatusStyles, getStatusSolidColor } from '@/lib/calendarUtils';
import type { CalendarEvent } from '@/types/calendar';

interface CalendarMobileDayViewProps {
  tasks: Task[];
  events?: CalendarEvent[];
  absences?: any[];
  selectedDate: Date;
  onDateChange: (date: Date) => void;
  onTaskClick: (task: Task) => void;
  onEventClick?: (event: CalendarEvent) => void;
  contentFilters?: {
    showTasks: boolean;
    showEvents: boolean;
    showAbsences: boolean;
  };
  currentAuthUserId?: string;
}

// Heures de la journée à afficher
const TIME_SLOTS = Array.from({ length: 13 }, (_, i) => i + 8); // 8h à 20h

export function CalendarMobileDayView({ 
  tasks, 
  events = [],
  absences = [],
  selectedDate, 
  onDateChange, 
  onTaskClick,
  onEventClick,
  contentFilters = { showTasks: true, showEvents: true, showAbsences: true },
  currentAuthUserId,
}: CalendarMobileDayViewProps) {
  const isTodayDate = isToday(selectedDate);

  const getTasksForDay = () => {
    if (!contentFilters.showTasks) return [];
    return tasks.filter(
      (task) => task.echeance && isSameDay(parseISO(task.echeance), selectedDate)
    );
  };

  const getEventsForDay = () => {
    if (!contentFilters.showEvents) return [];
    return events.filter(
      (event) => isSameDay(parseISO(event.start_time), selectedDate)
    );
  };

  const getAbsencesForDay = () => {
    if (!contentFilters.showAbsences) return [];
    return absences.filter(
      (absence) => {
        const start = parseISO(absence.start);
        const end = parseISO(absence.end);
        return selectedDate >= start && selectedDate <= end;
      }
    );
  };

  const dayTasks = getTasksForDay();
  const dayEvents = getEventsForDay();
  const dayAbsences = getAbsencesForDay();
  
  // Séparer les événements all-day des événements avec horaire
  const allDayEvents = dayEvents.filter(e => e.all_day);
  const timedEvents = dayEvents.filter(e => !e.all_day);

  // Obtenir les éléments pour un slot horaire
  const getItemsForHour = (hour: number) => {
    const items: { type: 'event' | 'task'; data: any }[] = [];
    
    timedEvents.forEach(event => {
      const eventHour = getHours(parseISO(event.start_time));
      if (eventHour === hour) {
        items.push({ type: 'event', data: event });
      }
    });
    
    return items;
  };

  return (
    <div className="space-y-3">
      {/* Header jour avec navigation */}
      <div className="flex items-center justify-between px-1">
        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8"
          onClick={() => onDateChange(subDays(selectedDate, 1))} aria-label="Précédent">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="text-center">
          <div className={cn(
            "text-xs uppercase tracking-wider",
            isTodayDate ? "text-primary font-medium" : "text-muted-foreground"
          )}>
            {format(selectedDate, 'EEEE', { locale: fr })}
          </div>
          <div className={cn(
            "text-xl font-bold",
            isTodayDate && "text-primary"
          )}>
            {format(selectedDate, 'd MMMM', { locale: fr })}
          </div>
        </div>
        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8"
          onClick={() => onDateChange(addDays(selectedDate, 1))} aria-label="Suivant">
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Stats du jour */}
      <div className="flex items-center justify-center gap-2">
        {contentFilters.showTasks && (
          <Badge variant="secondary" className="text-[10px] h-5">
            <CheckSquare className="h-2.5 w-2.5 mr-1" />
            {dayTasks.length} tâches
          </Badge>
        )}
        {contentFilters.showEvents && (
          <Badge variant="outline" className="text-[10px] h-5 text-blue-600 border-blue-200">
            <Calendar className="h-2.5 w-2.5 mr-1" />
            {dayEvents.length} évén.
          </Badge>
        )}
        {contentFilters.showAbsences && dayAbsences.length > 0 && (
          <Badge variant="outline" className="text-[10px] h-5 text-amber-600 border-amber-200">
            <Users className="h-2.5 w-2.5 mr-1" />
            {dayAbsences.length} abs.
          </Badge>
        )}
      </div>

      {/* Timeline du jour */}
      <Card>
        <CardContent className="p-3">
          <ScrollArea className="h-[400px]">
            <div className="space-y-1">
              {/* Absences en header */}
              {dayAbsences.length > 0 && (
                <div className="mb-3 space-y-1">
                  {dayAbsences.map((absence, idx) => {
                    const absenceColor = absence.color || '#f59e0b';
                    return (
                      <div 
                        key={`abs-${idx}`}
                        className="p-2 rounded-lg text-xs"
                        style={{ 
                          backgroundColor: `${absenceColor}20`,
                          borderLeft: `4px solid ${absenceColor}`
                        }}
                      >
                        <Users className="h-3 w-3 inline mr-1.5" />
                        {absence.title}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Événements all-day */}
              {allDayEvents.length > 0 && (
                <div className="mb-3 space-y-1">
                  <div className="flex items-center gap-1 text-[10px] text-muted-foreground mb-1">
                    <Sun className="h-3 w-3" />
                    Journée entière
                  </div>
                  {allDayEvents.map((event) => {
                    const eventColor = event.color || event.calendar?.color || '#3B82F6';
                    return (
                      <div 
                        key={event.id}
                        onClick={() => onEventClick?.(event)}
                        className="p-2 rounded-lg text-xs cursor-pointer hover:opacity-80 transition-colors"
                        style={{ 
                          backgroundColor: `${eventColor}20`,
                          borderLeft: `4px solid ${eventColor}`,
                          color: eventColor
                        }}
                      >
                        <Calendar className="h-3 w-3 inline mr-1.5" />
                        {event.title}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Tâches du jour (sans horaire) */}
              {dayTasks.length > 0 && (
                <div className="mb-3 space-y-1">
                  <div className="flex items-center gap-1 text-[10px] text-muted-foreground mb-1">
                    <CheckSquare className="h-3 w-3" />
                    Tâches à faire
                  </div>
                  {dayTasks.map((task) => {
                    const statusStyles = getTaskStatusStyles(task.statut || '');
                    const borderColor = getStatusSolidColor(task.statut || '');
                    return (
                      <div 
                        key={task.id}
                        onClick={() => onTaskClick(task)}
                        className={cn(
                          "p-2 rounded-lg text-xs cursor-pointer hover:opacity-80 transition-colors",
                          statusStyles.bg,
                          statusStyles.text
                        )}
                        style={{ borderLeft: `4px solid ${borderColor}` }}
                      >
                        <CheckSquare className="h-3 w-3 inline mr-1.5" />
                        {task.titre}
                        {task.statut && (
                          <Badge variant="outline" className={cn("ml-2 text-[9px] h-4", statusStyles.border)}>
                            {task.statut}
                          </Badge>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Timeline horaire */}
              {timedEvents.length > 0 && (
                <div className="space-y-0">
                  <div className="flex items-center gap-1 text-[10px] text-muted-foreground mb-2">
                    <Calendar className="h-3 w-3" />
                    Planning horaire
                  </div>
                  {TIME_SLOTS.map((hour) => {
                    const hourItems = getItemsForHour(hour);
                    const hasItems = hourItems.length > 0;
                    
                    return (
                      <div 
                        key={hour} 
                        className={cn(
                          "flex gap-2 min-h-[32px] border-t border-border/30",
                          !hasItems && "opacity-50"
                        )}
                      >
                        <div className="w-10 text-[10px] text-muted-foreground shrink-0 pt-1 tabular-nums">
                          {hour}:00
                        </div>
                        <div className="flex-1 py-1 space-y-1">
                          {hourItems.map((item, idx) => {
                            if (item.type === 'event') {
                              const event = item.data as CalendarEvent;
                              const eventColor = event.color || event.calendar?.color || '#3B82F6';
                              const isColleagueEvent = currentAuthUserId && event.calendar?.owner_id && event.calendar.owner_id !== currentAuthUserId;
                              return (
                                <div 
                                  key={`ev-${idx}`}
                                  onClick={() => onEventClick?.(event)}
                                  className={cn(
                                    "p-1.5 rounded text-[10px] cursor-pointer hover:opacity-80 transition-colors",
                                    isColleagueEvent && "opacity-60"
                                  )}
                                  style={{ 
                                    backgroundColor: `${eventColor}20`,
                                    borderLeft: `3px solid ${eventColor}`,
                                    color: eventColor
                                  }}
                                >
                                  <span className="font-medium">
                                    {format(parseISO(event.start_time), 'HH:mm')} - {format(parseISO(event.end_time), 'HH:mm')}
                                  </span>
                                  <span className="ml-1.5">
                                    {isColleagueEvent && '👤 '}
                                    {event.title}
                                  </span>
                                </div>
                              );
                            }
                            return null;
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Empty state */}
              {dayTasks.length === 0 && dayEvents.length === 0 && dayAbsences.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                  <Calendar className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Aucun élément prévu</p>
                  <p className="text-xs">pour cette journée</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
