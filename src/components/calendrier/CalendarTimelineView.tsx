import { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import {
  format,
  parseISO,
  isSameDay,
  addDays,
  subDays,
  setHours,
  setMinutes,
} from 'date-fns';
import { fr } from 'date-fns/locale';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CalendarEvent } from '@/types/calendar';

interface CalendarTimelineViewProps {
  events: CalendarEvent[];
  currentDate: Date;
  onDateChange: (date: Date) => void;
  onEventClick: (event: CalendarEvent) => void;
  onCreateEvent: (startTime: Date, endTime: Date) => void;
  startHour?: number;
  endHour?: number;
}

const HOUR_HEIGHT = 60; // pixels per hour
const MIN_SLOT_DURATION = 15; // minutes

export function CalendarTimelineView({
  events,
  currentDate,
  onDateChange,
  onEventClick,
  onCreateEvent,
  startHour = 7,
  endHour = 21,
}: CalendarTimelineViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ hour: number; minute: number } | null>(null);
  const [dragEnd, setDragEnd] = useState<{ hour: number; minute: number } | null>(null);
  const [currentTimePosition, setCurrentTimePosition] = useState<number>(0);

  const hours = useMemo(() => 
    Array.from({ length: endHour - startHour }, (_, i) => startHour + i),
    [startHour, endHour]
  );

  // Current time indicator
  useEffect(() => {
    const updateCurrentTime = () => {
      const now = new Date();
      if (isSameDay(now, currentDate)) {
        const minutesSinceStart = (now.getHours() - startHour) * 60 + now.getMinutes();
        const position = (minutesSinceStart / 60) * HOUR_HEIGHT;
        setCurrentTimePosition(position);
      } else {
        setCurrentTimePosition(-1);
      }
    };

    updateCurrentTime();
    const interval = setInterval(updateCurrentTime, 60000); // Update every minute
    return () => clearInterval(interval);
  }, [currentDate, startHour]);

  // Scroll to current time on mount
  useEffect(() => {
    if (containerRef.current && currentTimePosition > 0) {
      const scrollPosition = Math.max(0, currentTimePosition - 200);
      containerRef.current.scrollTop = scrollPosition;
    }
  }, []);

  // Get events for current day
  const dayEvents = useMemo(() => {
    return events.filter(event => {
      const eventDate = parseISO(event.start_time);
      return isSameDay(eventDate, currentDate);
    });
  }, [events, currentDate]);

  // Calculate event positions with overlap handling
  const positionedEvents = useMemo(() => {
    const sorted = [...dayEvents].sort((a, b) => 
      new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
    );

    const columns: CalendarEvent[][] = [];

    sorted.forEach(event => {
      const eventStart = new Date(event.start_time);
      const eventEnd = new Date(event.end_time);

      // Find a column where this event doesn't overlap
      let columnIndex = columns.findIndex(column =>
        column.every(colEvent => {
          const colStart = new Date(colEvent.start_time);
          const colEnd = new Date(colEvent.end_time);
          return eventEnd <= colStart || eventStart >= colEnd;
        })
      );

      if (columnIndex === -1) {
        columnIndex = columns.length;
        columns.push([]);
      }

      columns[columnIndex].push(event);
    });

    return columns.flatMap((column, colIndex) =>
      column.map(event => {
        const eventStart = parseISO(event.start_time);
        const eventEnd = parseISO(event.end_time);
        
        const startMinutes = (eventStart.getHours() - startHour) * 60 + eventStart.getMinutes();
        const endMinutes = (eventEnd.getHours() - startHour) * 60 + eventEnd.getMinutes();
        
        const top = (startMinutes / 60) * HOUR_HEIGHT;
        const height = ((endMinutes - startMinutes) / 60) * HOUR_HEIGHT;
        const width = 100 / columns.length;
        const left = colIndex * width;

        return {
          event,
          style: {
            top: `${top}px`,
            height: `${Math.max(height, 20)}px`,
            left: `${left}%`,
            width: `${width - 1}%`,
          },
        };
      })
    );
  }, [dayEvents, startHour]);

  // Mouse handlers for drag-to-create
  const getTimeFromPosition = useCallback((clientY: number): { hour: number; minute: number } => {
    if (!containerRef.current) return { hour: startHour, minute: 0 };
    
    const rect = containerRef.current.getBoundingClientRect();
    const scrollTop = containerRef.current.scrollTop;
    const y = clientY - rect.top + scrollTop;
    
    const totalMinutes = (y / HOUR_HEIGHT) * 60;
    const hour = Math.floor(totalMinutes / 60) + startHour;
    const minute = Math.round((totalMinutes % 60) / MIN_SLOT_DURATION) * MIN_SLOT_DURATION;
    
    return { 
      hour: Math.max(startHour, Math.min(endHour - 1, hour)), 
      minute: Math.min(45, minute) 
    };
  }, [startHour, endHour]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.target !== e.currentTarget) return; // Only on empty space
    
    const time = getTimeFromPosition(e.clientY);
    setIsDragging(true);
    setDragStart(time);
    setDragEnd({ hour: time.hour, minute: time.minute + 30 });
  }, [getTimeFromPosition]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging || !dragStart) return;
    
    const time = getTimeFromPosition(e.clientY);
    if (time.hour * 60 + time.minute > dragStart.hour * 60 + dragStart.minute) {
      setDragEnd(time);
    }
  }, [isDragging, dragStart, getTimeFromPosition]);

  const handleMouseUp = useCallback(() => {
    if (isDragging && dragStart && dragEnd) {
      const startTime = setMinutes(setHours(currentDate, dragStart.hour), dragStart.minute);
      const endTime = setMinutes(setHours(currentDate, dragEnd.hour), dragEnd.minute);
      
      if (endTime > startTime) {
        onCreateEvent(startTime, endTime);
      }
    }
    
    setIsDragging(false);
    setDragStart(null);
    setDragEnd(null);
  }, [isDragging, dragStart, dragEnd, currentDate, onCreateEvent]);

  // Calculate drag selection position
  const dragSelection = useMemo(() => {
    if (!isDragging || !dragStart || !dragEnd) return null;
    
    const startMinutes = (dragStart.hour - startHour) * 60 + dragStart.minute;
    const endMinutes = (dragEnd.hour - startHour) * 60 + dragEnd.minute;
    
    return {
      top: (startMinutes / 60) * HOUR_HEIGHT,
      height: ((endMinutes - startMinutes) / 60) * HOUR_HEIGHT,
    };
  }, [isDragging, dragStart, dragEnd, startHour]);

  const isToday = isSameDay(currentDate, new Date());

  return (
    <div className="space-y-4">
      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onDateChange(subDays(currentDate, 1))}
          aria-label="Période précédente"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="flex items-center gap-2">
          <h3 className="font-semibold">
            {format(currentDate, 'EEEE d MMMM yyyy', { locale: fr })}
          </h3>
          {isToday && <Badge>Aujourd'hui</Badge>}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onDateChange(addDays(currentDate, 1))}
          aria-label="Période suivante"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Timeline */}
      <Card>
        <CardContent className="p-0">
          <ScrollArea className="h-[600px]" ref={containerRef as any}>
            <div 
              className="relative ml-16"
              style={{ height: `${hours.length * HOUR_HEIGHT}px` }}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            >
              {/* Hour lines */}
              {hours.map((hour, index) => (
                <div
                  key={hour}
                  className="absolute w-full border-t border-border/50"
                  style={{ top: `${index * HOUR_HEIGHT}px` }}
                >
                  <span className="absolute -left-16 -top-3 text-xs text-muted-foreground w-12 text-right pr-2">
                    {format(setHours(new Date(), hour), 'HH:mm')}
                  </span>
                </div>
              ))}

              {/* Half-hour lines */}
              {hours.map((hour, index) => (
                <div
                  key={`${hour}-half`}
                  className="absolute w-full border-t border-border/20 border-dashed"
                  style={{ top: `${index * HOUR_HEIGHT + HOUR_HEIGHT / 2}px` }}
                />
              ))}

              {/* Current time indicator */}
              {currentTimePosition > 0 && currentTimePosition < hours.length * HOUR_HEIGHT && (
                <div
                  className="absolute left-0 right-0 z-20 pointer-events-none"
                  style={{ top: `${currentTimePosition}px` }}
                >
                  <div className="relative">
                    <div className="absolute -left-2 w-3 h-3 bg-destructive rounded-full" />
                    <div className="h-0.5 bg-destructive" />
                  </div>
                </div>
              )}

              {/* Events */}
              {positionedEvents.map(({ event, style }) => (
                <div
                  key={event.id}
                  className={cn(
                    'absolute rounded-md p-2 cursor-pointer transition-all hover:ring-2 hover:ring-primary overflow-hidden',
                    'border-l-4'
                  )}
                  style={{
                    ...style,
                    backgroundColor: `${event.color || event.calendar?.color || '#3B82F6'}20`,
                    borderLeftColor: event.color || event.calendar?.color || '#3B82F6',
                  }}
                  onClick={() => onEventClick(event)}
                >
                  <div className="text-sm font-medium truncate">{event.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {format(parseISO(event.start_time), 'HH:mm')} - {format(parseISO(event.end_time), 'HH:mm')}
                  </div>
                  {event.location && (
                    <div className="text-xs text-muted-foreground truncate mt-1">
                      📍 {event.location}
                    </div>
                  )}
                </div>
              ))}

              {/* Drag selection */}
              {dragSelection && (
                <div
                  className="absolute left-0 right-0 bg-primary/20 border-2 border-primary border-dashed rounded-md pointer-events-none z-10"
                  style={{
                    top: `${dragSelection.top}px`,
                    height: `${dragSelection.height}px`,
                  }}
                >
                  <div className="p-2 text-sm font-medium text-primary">
                    {dragStart && dragEnd && (
                      <>
                        {String(dragStart.hour).padStart(2, '0')}:{String(dragStart.minute).padStart(2, '0')} - 
                        {String(dragEnd.hour).padStart(2, '0')}:{String(dragEnd.minute).padStart(2, '0')}
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
