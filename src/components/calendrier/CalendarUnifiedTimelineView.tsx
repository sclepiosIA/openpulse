import { useState, useRef, useMemo, useCallback, useEffect } from 'react';
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
  addDays,
  startOfWeek,
  setHours,
  setMinutes,
  eachDayOfInterval,
  isToday as isDateToday,
} from 'date-fns';
import { fr } from 'date-fns/locale';
import { CheckSquare } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ClickableLocation } from './ClickableLocation';
import { CalendarEvent } from '@/types/calendar';
import { ContentFilters } from './CalendarContentToggle';
import { CalendarAbsence } from '@/hooks/calendar/useCalendarAbsences';
import { CalendarItemTooltip } from './CalendarItemTooltip';
import { CalendarItemContextMenu } from './CalendarItemContextMenu';
import { useDeleteTache } from '@/hooks/tasks/useTaches';
import {
  buildContinuousBanners,
  splitEventsByDay,
  type TimelineTask as Task,
  type DayEventMeta,
} from './calendarTimelineHelpers';

interface CalendarUnifiedTimelineViewProps {
  tasks: Task[];
  events: CalendarEvent[];
  absences?: CalendarAbsence[];
  currentDate: Date;
  onDateChange: (date: Date) => void;
  onTaskClick: (task: Task) => void;
  onEventClick: (event: CalendarEvent) => void;
  onCreateEvent: (startTime: Date, endTime: Date) => void;
  contentFilters: ContentFilters;
  startHour?: number;
  endHour?: number;
  currentAuthUserId?: string;
}

const MIN_SLOT_DURATION = 15;
const MAX_VISIBLE_ITEMS = 3;

export function CalendarUnifiedTimelineView({
  tasks,
  events,
  absences = [],
  currentDate,
  onDateChange,
  onTaskClick,
  onEventClick,
  onCreateEvent,
  contentFilters,
  startHour = 7,
  endHour = 19,
  currentAuthUserId,
}: CalendarUnifiedTimelineViewProps) {
  const deleteTache = useDeleteTache();
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ day: number; hour: number; minute: number } | null>(null);
  const [dragEnd, setDragEnd] = useState<{ day: number; hour: number; minute: number } | null>(null);
  const [currentTimePosition, setCurrentTimePosition] = useState<number>(0);
  const [hasScrolled, setHasScrolled] = useState(false);
  const [viewportHeight, setViewportHeight] = useState(typeof window !== 'undefined' ? window.innerHeight : 800);

  // Google Calendar style: 60px per hour
  const HOUR_HEIGHT = 60;
  const TIME_GUTTER_WIDTH = 56; // w-14 = 14 * 4px

  // Update viewport height on resize
  useEffect(() => {
    const handleResize = () => setViewportHeight(window.innerHeight);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const weekStart = useMemo(() => startOfWeek(currentDate, { weekStartsOn: 1 }), [currentDate]);
  const weekDays = useMemo(() => 
    eachDayOfInterval({ start: weekStart, end: addDays(weekStart, 6) }),
    [weekStart]
  );

  const hours = useMemo(() => 
    Array.from({ length: endHour - startHour }, (_, i) => startHour + i),
    [startHour, endHour]
  );

  const isCurrentWeek = useMemo(() => 
    weekDays.some(day => isDateToday(day)),
    [weekDays]
  );

  // Current time indicator
  useEffect(() => {
    const updateCurrentTime = () => {
      const now = new Date();
      const todayIndex = weekDays.findIndex(d => isSameDay(d, now));
      if (todayIndex !== -1) {
        const minutesSinceStart = (now.getHours() - startHour) * 60 + now.getMinutes();
        const position = (minutesSinceStart / 60) * HOUR_HEIGHT;
        setCurrentTimePosition(position);
      } else {
        setCurrentTimePosition(-1);
      }
    };

    updateCurrentTime();
    const interval = setInterval(updateCurrentTime, 60000);
    return () => clearInterval(interval);
  }, [weekDays, startHour]);

  // Auto-scroll to current time or 10am (center of 7h-19h range) on mount
  useEffect(() => {
    if (!hasScrolled && scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        // Center on 10h (midpoint of 7h-19h business hours) if no current events
        const defaultScrollPosition = (10 - startHour) * HOUR_HEIGHT - 100;
        const scrollTo = isCurrentWeek && currentTimePosition > 0 
          ? currentTimePosition - 100 
          : Math.max(0, defaultScrollPosition);
        
        setTimeout(() => {
          scrollContainer.scrollTo({ top: scrollTo, behavior: 'smooth' });
          setHasScrolled(true);
        }, 100);
      }
    }
  }, [hasScrolled, isCurrentWeek, currentTimePosition, startHour]);

  // Reset scroll flag when week changes
  useEffect(() => {
    setHasScrolled(false);
  }, [weekStart]);

  // Separate all-day events from timed events with multi-day metadata
  const { allDayEventsByDay, timedEventsByDay } = useMemo(
    () =>
      splitEventsByDay({
        events,
        weekDays,
        contentFilters,
        startHour,
        endHour,
      }),
    [events, weekDays, contentFilters, startHour, endHour],
  );

  // Get tasks per day
  const tasksByDay = useMemo(() => {
    if (!contentFilters.showTasks) return {};

    return weekDays.reduce((acc, day, index) => {
      acc[index] = tasks.filter(task => {
        if (!task.echeance) return false;
        const taskDate = parseISO(task.echeance);
        return isSameDay(taskDate, day);
      });
      return acc;
    }, {} as Record<number, Task[]>);
  }, [tasks, weekDays, contentFilters.showTasks]);

  // Get absences per day
  const absencesByDay = useMemo(() => {
    if (!contentFilters.showAbsences) return {};

    return weekDays.reduce((acc, day, index) => {
      acc[index] = absences.filter(absence => {
        return (day >= absence.start && day <= absence.end) ||
          isSameDay(day, absence.start) ||
          isSameDay(day, absence.end);
      });
      return acc;
    }, {} as Record<number, CalendarAbsence[]>);
  }, [absences, weekDays, contentFilters.showAbsences]);

  // Build continuous banners for all-day section
  const continuousBanners = useMemo(
    () =>
      buildContinuousBanners({
        events,
        absences,
        tasks,
        weekDays,
        contentFilters,
      }),
    [events, absences, tasks, weekDays, contentFilters],
  );

  // Calculate event positions per day with overlap handling
  const positionedEventsByDay = useMemo(() => {
    return Object.entries(timedEventsByDay).reduce((acc, [dayIndex, dayEvents]) => {
      const sorted = [...dayEvents].sort((a, b) => 
        a.effectiveStartMinutes - b.effectiveStartMinutes
      );

      const columns: DayEventMeta[][] = [];

      sorted.forEach(eventMeta => {
        let columnIndex = columns.findIndex(column =>
          column.every(colEventMeta => {
            return eventMeta.effectiveEndMinutes <= colEventMeta.effectiveStartMinutes || 
                   eventMeta.effectiveStartMinutes >= colEventMeta.effectiveEndMinutes;
          })
        );

        if (columnIndex === -1) {
          columnIndex = columns.length;
          columns.push([]);
        }

        columns[columnIndex].push(eventMeta);
      });

      acc[Number(dayIndex)] = columns.flatMap((column, colIndex) =>
        column.map(eventMeta => {
          const { event, isStartDay, isEndDay, effectiveStartMinutes, effectiveEndMinutes } = eventMeta;
          
          const top = (effectiveStartMinutes / 60) * HOUR_HEIGHT;
          const height = ((effectiveEndMinutes - effectiveStartMinutes) / 60) * HOUR_HEIGHT;
          const width = 100 / columns.length;
          const left = colIndex * width;

          return {
            event,
            isStartDay,
            isEndDay,
            style: {
              top: `${top}px`,
              height: `${Math.max(height, 24)}px`,
              left: `${left}%`,
              width: `${width - 1}%`,
            },
          };
        })
      );

      return acc;
    }, {} as Record<number, { event: CalendarEvent; isStartDay: boolean; isEndDay: boolean; style: React.CSSProperties }[]>);
  }, [timedEventsByDay, HOUR_HEIGHT]);

  // Mouse handlers for drag-to-create
  const getTimeFromPosition = useCallback((clientX: number, clientY: number): { day: number; hour: number; minute: number } | null => {
    if (!containerRef.current) return null;
    
    const rect = containerRef.current.getBoundingClientRect();
    const scrollTop = containerRef.current.scrollTop;
    
    const x = clientX - rect.left - TIME_GUTTER_WIDTH;
    const y = clientY - rect.top + scrollTop;
    
    const dayWidth = (rect.width - TIME_GUTTER_WIDTH) / 7;
    const day = Math.floor(x / dayWidth);
    
    if (day < 0 || day > 6) return null;
    
    const totalMinutes = (y / HOUR_HEIGHT) * 60;
    const hour = Math.floor(totalMinutes / 60) + startHour;
    const minute = Math.round((totalMinutes % 60) / MIN_SLOT_DURATION) * MIN_SLOT_DURATION;
    
    return { 
      day,
      hour: Math.max(startHour, Math.min(endHour - 1, hour)), 
      minute: Math.min(45, minute) 
    };
  }, [startHour, endHour]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    const tgt = e.target;
    if (tgt instanceof Element && (tgt.closest('.event-item') || tgt.closest('.task-item'))) return;
    
    const time = getTimeFromPosition(e.clientX, e.clientY);
    if (!time) return;
    
    setIsDragging(true);
    setDragStart(time);
    setDragEnd({ ...time, minute: time.minute + 30 });
  }, [getTimeFromPosition]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging || !dragStart) return;
    
    const time = getTimeFromPosition(e.clientX, e.clientY);
    if (!time || time.day !== dragStart.day) return;
    
    if (time.hour * 60 + time.minute > dragStart.hour * 60 + dragStart.minute) {
      setDragEnd(time);
    }
  }, [isDragging, dragStart, getTimeFromPosition]);

  const handleMouseUp = useCallback(() => {
    if (isDragging && dragStart && dragEnd) {
      const targetDay = weekDays[dragStart.day];
      const startTime = setMinutes(setHours(targetDay, dragStart.hour), dragStart.minute);
      const endTime = setMinutes(setHours(targetDay, dragEnd.hour), dragEnd.minute);
      
      if (endTime > startTime) {
        onCreateEvent(startTime, endTime);
      }
    }
    
    setIsDragging(false);
    setDragStart(null);
    setDragEnd(null);
  }, [isDragging, dragStart, dragEnd, weekDays, onCreateEvent]);

  // Drag selection overlay
  const dragSelection = useMemo(() => {
    if (!isDragging || !dragStart || !dragEnd) return null;
    
    const startMinutes = (dragStart.hour - startHour) * 60 + dragStart.minute;
    const endMinutes = (dragEnd.hour - startHour) * 60 + dragEnd.minute;
    
    return {
      day: dragStart.day,
      top: (startMinutes / 60) * HOUR_HEIGHT,
      height: ((endMinutes - startMinutes) / 60) * HOUR_HEIGHT,
    };
  }, [isDragging, dragStart, dragEnd, startHour]);

  // Get today's index
  const todayIndex = useMemo(() => 
    weekDays.findIndex(d => isDateToday(d)),
    [weekDays]
  );

  return (
    <div className="gcal-container rounded-lg overflow-hidden">
      {/* Week Header - Google Calendar Style */}
      <div className="gcal-header">
        {/* Time gutter spacer */}
        <div className="gcal-time-gutter" />
        
        {/* Day columns header */}
        <div className="flex-1 grid grid-cols-7">
          {weekDays.map((day, index) => {
            const isToday = isDateToday(day);
            const dayTasks = tasksByDay[index] || [];
            const dayAbsences = absencesByDay[index] || [];
            const dayAllDayEvents = allDayEventsByDay[index] || [];

            return (
              <div
                key={`day-col-${day.toISOString()}`}
                className={cn(
                  'flex flex-col items-center py-1 border-l gcal-grid-line first:border-l-0',
                  isToday && 'gcal-today-col'
                )}
              >
                {/* Day name */}
                <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                  {format(day, 'EEE', { locale: fr })}
                </span>
                
                {/* Day number - Google style circle for today */}
                <span className={cn(
                  'text-base font-normal transition-colors',
                  isToday 
                    ? 'gcal-today-number w-7 h-7 flex items-center justify-center rounded-full' 
                    : 'text-foreground hover:bg-muted rounded-full w-7 h-7 flex items-center justify-center cursor-pointer'
                )}>
                  {format(day, 'd')}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* All-Day Section - Continuous Banners Google Calendar Style */}
      {continuousBanners.length > 0 && (
        <div className="border-b gcal-grid-line">
          <div className="flex">
            <div className="gcal-time-gutter flex items-start justify-end pr-2 pt-1">
              <span className="text-[10px] text-muted-foreground">Journée</span>
            </div>
            
            {/* Container with relative position for absolute banners */}
            <div 
              className="flex-1 relative" 
              style={{ 
                minHeight: `${Math.max(40, (Math.max(...continuousBanners.map(b => b.row), 0) + 1) * 26 + 8)}px` 
              }}
            >
              {/* Background grid for day borders */}
              <div className="absolute inset-0 grid grid-cols-7">
                {weekDays.map((day) => (
                  <div key={`grid-col-${day.toISOString()}`} className="border-l gcal-grid-line first:border-l-0" />
                ))}
              </div>
              
              {/* Continuous banners positioned absolutely */}
              {continuousBanners.map(banner => {
                const colWidth = 100 / 7;
                const left = banner.startColumn * colWidth;
                const width = (banner.endColumn - banner.startColumn + 1) * colWidth;
                const isMultiDay = banner.startColumn !== banner.endColumn;
                
                return (
                  <div
                    key={`${banner.type}-${banner.id}`}
                    onClick={() => {
                      if (banner.type === 'event') {
                        onEventClick(banner.originalItem as CalendarEvent);
                      } else if (banner.type === 'task') {
                        onTaskClick(banner.originalItem as Task);
                      }
                    }}
                    className={cn(
                      'gcal-continuous-banner',
                      banner.type === 'task' && 'gcal-task-continuous'
                    )}
                    style={{
                      left: `calc(${left}% + 2px)`,
                      width: `calc(${width}% - 4px)`,
                      top: `${banner.row * 26 + 4}px`,
                      backgroundColor: banner.color,
                      borderRadius: isMultiDay 
                        ? banner.startColumn === 0 && banner.endColumn === 6 
                          ? '0' 
                          : banner.startColumn === 0 
                            ? '0 4px 4px 0' 
                            : banner.endColumn === 6 
                              ? '4px 0 0 4px' 
                              : '4px'
                        : '4px',
                    }}
                  >
                    {banner.type === 'task' && (
                      <CheckSquare className="h-3 w-3 flex-shrink-0" />
                    )}
                    <span className="truncate">{banner.title}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Time Grid - Google Calendar Style */}
      <ScrollArea 
        ref={scrollAreaRef} 
        className="flex-1" 
        style={{ height: 'calc(100vh - 220px)', minHeight: '300px' }}
      >
        <div
          ref={containerRef}
          className="relative"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          <div className="flex">
            {/* Time column - Hour labels aligned to grid lines */}
            <div className="gcal-time-gutter">
              {hours.map(hour => (
                <div
                  key={hour}
                  className="relative border-b border-border/20"
                  style={{ height: `${HOUR_HEIGHT}px` }}
                >
                  <span className="absolute top-0 right-2 text-xs text-muted-foreground font-medium transform -translate-y-1/2">
                    {String(hour).padStart(2, '0')}:00
                  </span>
                </div>
              ))}
            </div>

            {/* Days grid */}
            <div className="flex-1 grid grid-cols-7 relative">
              {/* Hour lines */}
              {hours.map(hour => (
                <div
                  key={hour}
                  className="absolute left-0 right-0 border-t gcal-grid-line"
                  style={{ top: `${(hour - startHour) * HOUR_HEIGHT}px` }}
                />
              ))}

              {/* Current time indicator - Google style red line */}
              {todayIndex !== -1 && currentTimePosition > 0 && (
                <div
                  className="absolute z-20 pointer-events-none"
                  style={{
                    top: `${currentTimePosition}px`,
                    left: `${(todayIndex / 7) * 100}%`,
                    width: `${100 / 7}%`,
                  }}
                >
                  {/* Red dot */}
                  <div className="absolute -left-1.5 -top-1.5 w-3 h-3 rounded-full gcal-current-time-bg" />
                  {/* Red line */}
                  <div className="h-0.5 gcal-current-time-bg" />
                </div>
              )}

              {/* Day columns with events */}
              {weekDays.map((day, dayIndex) => {
                const dayEvents = positionedEventsByDay[dayIndex] || [];
                const isToday = isDateToday(day);

                return (
                  <div
                    key={dayIndex}
                    className={cn(
                      'relative border-l gcal-grid-line first:border-l-0',
                      isToday && 'gcal-today-col'
                    )}
                    style={{ height: `${hours.length * HOUR_HEIGHT}px` }}
                  >
                    {/* Events */}
                    {dayEvents.map(({ event, style }) => {
                      const eventColor = event.color || event.calendar?.color || '#1a73e8';
                      const isColleagueEvent = currentAuthUserId && event.calendar?.owner_id && event.calendar.owner_id !== currentAuthUserId;
                      const ownerInitials = isColleagueEvent && event.calendar?.owner_id
                        ? '👤'
                        : '';
                      
                      return (
                        <TooltipProvider key={event.id}>
                          <CalendarItemContextMenu
                            item={event}
                            type="event"
                            onEdit={() => onEventClick(event)}
                          >
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div
                                  className={cn(
                                    "event-item absolute rounded-md px-2 py-1 cursor-pointer overflow-hidden transition-all hover:z-10 hover:shadow-md",
                                    isColleagueEvent && "opacity-60"
                                  )}
                                  style={{
                                    ...style,
                                    backgroundColor: `${eventColor}e6`,
                                    borderLeft: `3px solid ${eventColor}`,
                                  }}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onEventClick(event);
                                  }}
                                >
                                  <div className="text-[11px] font-medium text-white truncate flex items-center gap-1">
                                    {isColleagueEvent && <span className="text-[9px]">{ownerInitials}</span>}
                                    {event.title}
                                  </div>
                                  <div className="text-[10px] text-white/80 truncate">
                                    {format(parseISO(event.start_time), 'HH:mm')} - {format(parseISO(event.end_time), 'HH:mm')}
                                  </div>
                                  {event.location && (
                                    <div className="mt-0.5">
                                      <ClickableLocation 
                                        location={event.location}
                                        iconClassName="h-2.5 w-2.5"
                                        className="text-[10px] text-white/70 hover:text-white"
                                      />
                                    </div>
                                  )}
                                </div>
                              </TooltipTrigger>
                              <TooltipContent side="right" className="p-3">
                                <CalendarItemTooltip item={event} type="event" />
                              </TooltipContent>
                            </Tooltip>
                          </CalendarItemContextMenu>
                        </TooltipProvider>
                      );
                    })}

                    {/* Drag selection overlay */}
                    {dragSelection && dragSelection.day === dayIndex && (
                      <div
                        className="absolute left-1 right-1 rounded-md gcal-drag-selection border-2 border-primary"
                        style={{
                          top: `${dragSelection.top}px`,
                          height: `${dragSelection.height}px`,
                        }}
                      >
                        <div className="p-1 text-[11px] font-medium text-primary">
                          Nouvel événement
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
