import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  format,
  parseISO,
  isSameDay,
  isToday as isDateToday,
  isPast,
  addDays,
  startOfDay,
  eachDayOfInterval,
} from 'date-fns';
import { fr } from 'date-fns/locale';
import { Calendar as CalendarIcon, MapPin, ChevronDown, ChevronUp, Video, UserMinus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CalendarEvent } from '@/types/calendar';
import { CalendarItemTooltip } from './CalendarItemTooltip';
import { CalendarItemContextMenu } from './CalendarItemContextMenu';
import { useDeleteTache } from '@/hooks/tasks/useTaches';
import { ContentFilters } from './CalendarContentToggle';

interface Task {
  id: string;
  titre: string;
  echeance?: string;
  statut: string;
  priorite?: string;
  description?: string;
  categories_taches?: { nom: string; couleur?: string } | null;
  etablissements?: { nom: string } | null;
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

interface CalendarUnifiedAgendaViewProps {
  tasks: Task[];
  events: CalendarEvent[];
  absences?: CalendarAbsence[];
  onTaskClick: (task: Task) => void;
  onEventClick: (event: CalendarEvent) => void;
  contentFilters: ContentFilters;
}

type AgendaItem = 
  | { type: 'task'; data: Task; date: Date }
  | { type: 'event'; data: CalendarEvent; date: Date }
  | { type: 'absence'; data: CalendarAbsence; date: Date };

export function CalendarUnifiedAgendaView({
  tasks,
  events,
  absences = [],
  onTaskClick,
  onEventClick,
  contentFilters,
}: CalendarUnifiedAgendaViewProps) {
  const [showPast, setShowPast] = useState(false);
  const [daysToShow, setDaysToShow] = useState(30);
  const deleteTache = useDeleteTache();

  // Combine and sort all items
  const allItems = useMemo(() => {
    const items: AgendaItem[] = [];
    const now = new Date();
    const cutoffPast = showPast ? addDays(now, -30) : now;
    const cutoffFuture = addDays(now, daysToShow);

    if (contentFilters.showTasks) {
      tasks.forEach(task => {
        if (!task.echeance) return;
        const date = parseISO(task.echeance);
        if (date >= startOfDay(cutoffPast) && date <= cutoffFuture) {
          items.push({ type: 'task', data: task, date });
        }
      });
    }

    if (contentFilters.showEvents) {
      events.forEach(event => {
        const date = parseISO(event.start_time);
        if (date >= startOfDay(cutoffPast) && date <= cutoffFuture) {
          items.push({ type: 'event', data: event, date });
        }
      });
    }

    if (contentFilters.showAbsences) {
      absences.forEach(absence => {
        const days = eachDayOfInterval({ start: absence.start, end: absence.end });
        days.forEach(day => {
          if (day >= startOfDay(cutoffPast) && day <= cutoffFuture) {
            items.push({ type: 'absence', data: absence, date: day });
          }
        });
      });
    }

    return items.sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [tasks, events, absences, contentFilters, showPast, daysToShow]);

  // Group items by date
  const groupedItems = useMemo(() => {
    const groups: { date: Date; items: AgendaItem[] }[] = [];
    
    allItems.forEach(item => {
      const existingGroup = groups.find(g => isSameDay(g.date, item.date));
      if (existingGroup) {
        existingGroup.items.push(item);
      } else {
        groups.push({ date: item.date, items: [item] });
      }
    });

    return groups;
  }, [allItems]);

  const getDateLabel = (date: Date) => {
    if (isDateToday(date)) return "Aujourd'hui";
    if (isSameDay(date, addDays(new Date(), 1))) return 'Demain';
    if (isSameDay(date, addDays(new Date(), -1))) return 'Hier';
    return null;
  };

  const getTaskStatusColor = (task: Task) => {
    switch (task.statut) {
      case 'Terminé': return '#22c55e';
      case 'En cours': return '#3b82f6';
      case 'Bloqué': return '#ef4444';
      default: return '#9ca3af';
    }
  };

  return (
    <div className="gcal-container rounded-lg overflow-hidden">
      {/* Controls - Google Calendar Style */}
      <div className="gcal-header flex items-center justify-between px-4 py-3 border-b gcal-grid-line">
        <div className="flex items-center gap-2">
          <Button
            variant={showPast ? 'default' : 'outline'}
            size="sm"
            onClick={() => setShowPast(!showPast)}
            className="h-8"
          >
            {showPast ? <ChevronUp className="h-4 w-4 mr-1" /> : <ChevronDown className="h-4 w-4 mr-1" />}
            Passé
          </Button>
        </div>
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <span>{allItems.length} éléments</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setDaysToShow(prev => prev === 30 ? 90 : 30)}
            className="h-8"
          >
            {daysToShow === 30 ? '30 jours' : '90 jours'}
          </Button>
        </div>
      </div>

      {/* Agenda List - Google Calendar 3-column style */}
      <ScrollArea className="flex-1 h-[calc(100vh-300px)] min-h-[400px]">
        {groupedItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <CalendarIcon className="h-12 w-12 mb-4 opacity-30" />
            <p className="text-lg font-medium">Aucun élément</p>
            <p className="text-sm">Activez les filtres pour voir les tâches et événements</p>
          </div>
        ) : (
          <div>
            {groupedItems.map((group, groupIndex) => {
              const isToday = isDateToday(group.date);
              const isPastDate = isPast(group.date) && !isToday;
              const dateLabel = getDateLabel(group.date);

              return (
                <div 
                  key={group.date.toISOString()} 
                  className={cn(
                    'border-b gcal-grid-line',
                    isPastDate && 'opacity-60'
                  )}
                >
                  {/* Date row - spans full width for visual grouping */}
                  {(groupIndex === 0 || !isSameDay(group.date, groupedItems[groupIndex - 1]?.date)) && (
                    <div className={cn(
                      'grid grid-cols-12 px-4 py-3',
                      isToday && 'gcal-today-col'
                    )}>
                      {/* Date column */}
                      <div className="col-span-2 sm:col-span-1">
                        <div className={cn(
                          'text-2xl font-light',
                          isToday ? 'gcal-today-number w-10 h-10 rounded-full flex items-center justify-center' : 'text-foreground'
                        )}>
                          {format(group.date, 'd')}
                        </div>
                      </div>
                      
                      {/* Day name and month */}
                      <div className="col-span-10 sm:col-span-11 flex items-center gap-2">
                        <span className="text-sm font-medium text-muted-foreground uppercase">
                          {format(group.date, 'EEE', { locale: fr })}
                        </span>
                        {dateLabel && (
                          <Badge variant="secondary" className="text-xs">
                            {dateLabel}
                          </Badge>
                        )}
                        <span className="text-sm text-muted-foreground">
                          {format(group.date, 'MMM yyyy', { locale: fr })}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Items for this date */}
                  {group.items.map((item, itemIndex) => {
                    const itemKey = item.type === 'task' 
                      ? `task-${item.data.id}` 
                      : item.type === 'event' 
                        ? `event-${item.data.id}` 
                        : `absence-${item.data.id}-${format(item.date, 'yyyy-MM-dd')}`;
                    
                    return (
                      <div
                        key={itemKey}
                        className={cn(
                          'grid grid-cols-12 px-4 py-3 hover:bg-muted/30 transition-colors',
                          item.type !== 'absence' && 'cursor-pointer',
                          itemIndex === 0 && 'border-t gcal-grid-line'
                        )}
                        onClick={() => {
                          if (item.type === 'task') {
                            onTaskClick(item.data as Task);
                          } else if (item.type === 'event') {
                            onEventClick(item.data as CalendarEvent);
                          }
                        }}
                      >
                        {/* Time column */}
                        <div className="col-span-3 sm:col-span-2 flex items-start">
                          {item.type === 'event' ? (
                            <div className="flex items-center gap-1.5 text-sm">
                              <div 
                                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                                style={{ 
                                  backgroundColor: (item.data as CalendarEvent).color || 
                                    (item.data as CalendarEvent).calendar?.color || '#1a73e8' 
                                }}
                              />
                              {(item.data as CalendarEvent).all_day ? (
                                <span className="text-muted-foreground">Journée</span>
                              ) : (
                                <span className="text-foreground font-medium">
                                  {format(parseISO((item.data as CalendarEvent).start_time), 'HH:mm')}
                                </span>
                              )}
                            </div>
                          ) : item.type === 'task' ? (
                            <div className="flex items-center gap-1.5 text-sm">
                              <div 
                                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                                style={{ backgroundColor: getTaskStatusColor(item.data as Task) }}
                              />
                              <span className="text-muted-foreground">Tâche</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5 text-sm">
                              <div 
                                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                                style={{ backgroundColor: (item.data as CalendarAbsence).color }}
                              />
                              <span className="text-muted-foreground">Absence</span>
                            </div>
                          )}
                        </div>

                        {/* Content column */}
                        <div className="col-span-9 sm:col-span-10">
                          {item.type === 'task' ? (
                            <TooltipProvider>
                              <CalendarItemContextMenu
                                item={item.data as Task}
                                type="task"
                                onEdit={() => onTaskClick(item.data as Task)}
                                onDelete={() => deleteTache.mutate((item.data as Task).id)}
                              >
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <div>
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <span className="font-medium">{(item.data as Task).titre}</span>
                                        <Badge 
                                          variant="secondary" 
                                          className="text-[10px] px-1.5 h-5"
                                          style={{
                                            backgroundColor: `${getTaskStatusColor(item.data as Task)}20`,
                                            color: getTaskStatusColor(item.data as Task),
                                          }}
                                        >
                                          {(item.data as Task).statut}
                                        </Badge>
                                      </div>
                                      {(item.data as Task).etablissements?.nom && (
                                        <p className="text-sm text-muted-foreground mt-0.5">
                                          {(item.data as Task).etablissements?.nom}
                                        </p>
                                      )}
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent side="right" className="p-3">
                                    <CalendarItemTooltip item={item.data as Task} type="task" />
                                  </TooltipContent>
                                </Tooltip>
                              </CalendarItemContextMenu>
                            </TooltipProvider>
                          ) : item.type === 'event' ? (
                            <TooltipProvider>
                              <CalendarItemContextMenu
                                item={item.data as CalendarEvent}
                                type="event"
                                onEdit={() => onEventClick(item.data as CalendarEvent)}
                              >
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <div>
                                      <div className="flex items-center gap-2">
                                        <span className="font-medium">{(item.data as CalendarEvent).title}</span>
                                        {!(item.data as CalendarEvent).all_day && (
                                          <span className="text-sm text-muted-foreground">
                                            → {format(parseISO((item.data as CalendarEvent).end_time), 'HH:mm')}
                                          </span>
                                        )}
                                      </div>
                                      <div className="flex items-center gap-3 text-sm text-muted-foreground mt-0.5 flex-wrap">
                                        {(item.data as CalendarEvent).location && (
                                          <span className="flex items-center gap-1">
                                            <MapPin className="h-3 w-3" />
                                            {(item.data as CalendarEvent).location}
                                          </span>
                                        )}
                                        {(item.data as CalendarEvent).video_conference_url && (
                                          <a
                                            href={(item.data as CalendarEvent).video_conference_url!}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center gap-1 text-primary hover:underline"
                                            onClick={(e) => e.stopPropagation()}
                                          >
                                            <Video className="h-3 w-3" />
                                            Rejoindre
                                          </a>
                                        )}
                                      </div>
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent side="right" className="p-3">
                                    <CalendarItemTooltip item={item.data as CalendarEvent} type="event" />
                                  </TooltipContent>
                                </Tooltip>
                              </CalendarItemContextMenu>
                            </TooltipProvider>
                          ) : (
                            <div>
                              <div className="flex items-center gap-2">
                                <UserMinus className="h-4 w-4" style={{ color: (item.data as CalendarAbsence).color }} />
                                <span className="font-medium">{(item.data as CalendarAbsence).profile_name}</span>
                                <Badge 
                                  variant="secondary" 
                                  className="text-[10px] px-1.5 h-5"
                                  style={{
                                    backgroundColor: `${(item.data as CalendarAbsence).color}20`,
                                    color: (item.data as CalendarAbsence).color,
                                  }}
                                >
                                  {(item.data as CalendarAbsence).type}
                                </Badge>
                              </div>
                              <p className="text-sm text-muted-foreground mt-0.5">
                                Du {format((item.data as CalendarAbsence).start, 'd MMM', { locale: fr })} au {format((item.data as CalendarAbsence).end, 'd MMM', { locale: fr })}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
