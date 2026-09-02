import React, { useMemo, memo } from 'react';
import { format, parseISO, isWithinInterval } from 'date-fns';

import { motion } from 'framer-motion';
import { MapPin, Video, Building2, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { CalendarItemTooltip } from '@/components/calendrier/CalendarItemTooltip';
import { cn } from '@/lib/utils';
import type { UpcomingAppointment } from '@/hooks/bookings/useUpcomingAppointments';

interface AgendaWidgetItemProps {
  appointment: UpcomingAppointment;
  index: number;
  onClick: () => void;
}

const typeStyles: Record<string, { border: string; bg: string }> = {
  rdv: { border: 'border-l-blue-500', bg: 'bg-blue-50/50 dark:bg-blue-950/30' },
  presentation: { border: 'border-l-purple-500', bg: 'bg-purple-50/50 dark:bg-purple-950/30' },
  negociation: { border: 'border-l-orange-500', bg: 'bg-orange-50/50 dark:bg-orange-950/30' },
  autre: { border: 'border-l-gray-400', bg: 'bg-gray-50/50 dark:bg-gray-900/30' },
};

export const AgendaWidgetItem = memo(function AgendaWidgetItem({ appointment, index, onClick }: AgendaWidgetItemProps) {
  const style = typeStyles[appointment.type] || typeStyles.autre;
  
  const { startTime, endTime, isHappeningNow } = useMemo(() => {
    const start = parseISO(appointment.start_time);
    const end = parseISO(appointment.end_time);
    const now = new Date();
    const happening = isWithinInterval(now, { start, end });
    
    return {
      startTime: format(start, 'HH:mm'),
      endTime: format(end, 'HH:mm'),
      isHappeningNow: happening
    };
  }, [appointment.start_time, appointment.end_time]);

  // Convert to CalendarEvent format for tooltip (compatible shape)
  const eventForTooltip = useMemo(() => ({
    id: appointment.id,
    title: appointment.title,
    start_time: appointment.start_time,
    end_time: appointment.end_time,
    location: appointment.location,
    description: appointment.description,
    video_conference_url: appointment.video_conference_url,
    all_day: appointment.all_day || false,
    calendar: appointment.calendar_name ? {
      name: appointment.calendar_name,
      color: appointment.calendar_color
    } : undefined,
    color: appointment.calendar_color,
    recurrence_rule: null
  } as Parameters<typeof CalendarItemTooltip>[0]['item']), [appointment]);

  return (
    <HoverCard openDelay={400}>
      <HoverCardTrigger asChild>
        <motion.div
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: index * 0.04 }}
          onClick={onClick}
          className={cn(
            "flex items-start gap-2 p-1.5 rounded-lg cursor-pointer border-l-[3px]",
            "hover:scale-[1.01] hover:shadow-sm transition-all",
            style.border,
            style.bg,
            appointment.hasConflict && "ring-1 ring-amber-400/50"
          )}
        >
          {/* Time block */}
          <div className="shrink-0 text-center min-w-[36px]">
            <span className="text-xs font-semibold text-foreground block">{startTime}</span>
            <span className="text-[10px] text-muted-foreground block">{endTime}</span>
          </div>
          
          {/* Content */}
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm truncate leading-tight">{appointment.title}</p>
            
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              {appointment.location && (
                <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                  <MapPin className="h-2.5 w-2.5 shrink-0" />
                  <span className="truncate max-w-[80px]">{appointment.location}</span>
                </span>
              )}
              
              {appointment.video_conference_url && (
                <a 
                  href={appointment.video_conference_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="text-[10px] text-primary flex items-center gap-0.5 hover:underline"
                >
                  <Video className="h-2.5 w-2.5 shrink-0" />
                  <span>Visio</span>
                </a>
              )}
            </div>
          </div>
          
          {/* Right side: establishment + indicators */}
          <div className="flex items-center gap-1.5 shrink-0">
            {appointment.etablissement_nom && (
              <Badge variant="outline" className="text-[9px] px-1 py-0 max-w-[70px] truncate h-4">
                <Building2 className="h-2 w-2 mr-0.5 shrink-0" />
                {appointment.etablissement_nom.slice(0, 8)}
              </Badge>
            )}
            
            {/* Conflict indicator */}
            {appointment.hasConflict && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="relative flex h-2.5 w-2.5 shrink-0">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-500 opacity-50" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500" />
                  </span>
                </TooltipTrigger>
                <TooltipContent side="left" className="text-xs">
                  <div className="flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3 text-amber-500" />
                    Conflit horaire détecté
                  </div>
                </TooltipContent>
              </Tooltip>
            )}
            
            {/* "Now" indicator */}
            {isHappeningNow && !appointment.hasConflict && (
              <span className="relative flex h-2.5 w-2.5 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-50" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-success" />
              </span>
            )}
          </div>
        </motion.div>
      </HoverCardTrigger>
      
      <HoverCardContent 
        side="left" 
        align="start" 
        sideOffset={8}
        avoidCollisions={true}
        collisionPadding={16}
        className="w-72 sm:w-80"
      >
        <CalendarItemTooltip item={eventForTooltip as any} type="event" />
      </HoverCardContent>
    </HoverCard>
  );
}, (prevProps, nextProps) => {
  // Custom comparator - only re-render if critical props change
  return (
    prevProps.appointment.id === nextProps.appointment.id &&
    prevProps.appointment.start_time === nextProps.appointment.start_time &&
    prevProps.appointment.end_time === nextProps.appointment.end_time &&
    prevProps.appointment.title === nextProps.appointment.title &&
    prevProps.appointment.hasConflict === nextProps.appointment.hasConflict &&
    prevProps.index === nextProps.index
  );
});
