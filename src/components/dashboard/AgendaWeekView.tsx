import React from 'react';
import { eachDayOfInterval, startOfWeek, endOfWeek, isSameDay, format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { UpcomingAppointment } from '@/hooks/bookings/useUpcomingAppointments';

interface AgendaWeekViewProps {
  appointments: UpcomingAppointment[];
  onDayClick?: (date: Date) => void;
}

const typeColors: Record<string, string> = {
  rdv: 'bg-blue-500',
  presentation: 'bg-purple-500',
  negociation: 'bg-orange-500',
  autre: 'bg-gray-400',
};

export function AgendaWeekView({ appointments, onDayClick }: AgendaWeekViewProps) {
  const now = new Date();
  const days = eachDayOfInterval({
    start: startOfWeek(now, { weekStartsOn: 1 }),
    end: endOfWeek(now, { weekStartsOn: 1 })
  });

  return (
    <div className="grid grid-cols-7 gap-1 py-2">
      {days.map(day => {
        const dayEvents = appointments.filter(apt => 
          isSameDay(parseISO(apt.start_time), day)
        );
        const isToday = isSameDay(day, now);
        const isPast = day < now && !isToday;

        return (
          <Tooltip key={day.toISOString()}>
            <TooltipTrigger asChild>
              <button
                onClick={() => onDayClick?.(day)}
                className={cn(
                  "flex flex-col items-center p-1.5 rounded-lg transition-all",
                  "hover:bg-accent/50 hover:scale-105",
                  isToday && "bg-primary/10 ring-1 ring-primary/30",
                  isPast && "opacity-50"
                )}
              >
                <span className="text-[10px] text-muted-foreground uppercase">
                  {format(day, 'EEE', { locale: fr })}
                </span>
                <span className={cn(
                  "text-sm font-semibold",
                  isToday && "text-primary"
                )}>
                  {format(day, 'd')}
                </span>
                
                {/* Event dots */}
                <div className="flex gap-0.5 mt-1 h-2 items-center">
                  {dayEvents.slice(0, 3).map((evt) => (
                    <span
                      key={`dot-${evt.id ?? evt.start_time}`}
                      className={cn(
                        "h-1.5 w-1.5 rounded-full",
                        typeColors[evt.type] || typeColors.autre
                      )}
                    />
                  ))}
                  {dayEvents.length > 3 && (
                    <span className="text-[8px] text-muted-foreground ml-0.5">
                      +{dayEvents.length - 3}
                    </span>
                  )}
                </div>
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-[200px]">
              <p className="font-medium text-xs mb-1">
                {format(day, 'EEEE d MMMM', { locale: fr })}
              </p>
              {dayEvents.length === 0 ? (
                <p className="text-xs text-muted-foreground">Aucun événement</p>
              ) : (
                <div className="space-y-0.5">
                  {dayEvents.slice(0, 4).map((evt) => (
                    <p key={`tip-${evt.id}`} className="text-xs truncate">
                      <span className="text-muted-foreground">
                        {format(parseISO(evt.start_time), 'HH:mm')}
                      </span>
                      {' '}{evt.title}
                    </p>
                  ))}
                  {dayEvents.length > 4 && (
                    <p className="text-xs text-muted-foreground">
                      +{dayEvents.length - 4} autres
                    </p>
                  )}
                </div>
              )}
            </TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}
