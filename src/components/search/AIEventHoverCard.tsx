import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, Clock, MapPin, Video, Building2, ExternalLink } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { format, isPast, isToday, isTomorrow, differenceInMinutes } from "date-fns";
import { fr } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  eventId: string;
  children: React.ReactNode;
}

export function AIEventHoverCard({ eventId, children }: Props) {
  const { data: event } = useQuery({
    queryKey: ['event-hover', eventId],
    queryFn: async () => {
      const { data } = await supabase
        .from('calendar_events')
        .select(`
          id,
          title,
          description,
          start_time,
          end_time,
          all_day,
          location,
          video_conference_url,
          status,
          etablissement:etablissements(id, nom)
        `)
        .eq('id', eventId)
        .maybeSingle();

      return data;
    },
    enabled: !!eventId,
    staleTime: 60000,
  });

  if (!event) return <>{children}</>;

  const startTime = new Date(event.start_time);
  const endTime = event.end_time ? new Date(event.end_time) : null;
  const isVisio = !!event.video_conference_url;
  
  // Time status
  let timeStatus: 'past' | 'today' | 'tomorrow' | 'upcoming' = 'upcoming';
  let timeLabel = '';
  
  if (isPast(startTime)) {
    timeStatus = 'past';
    timeLabel = format(startTime, 'dd MMM yyyy', { locale: fr });
  } else if (isToday(startTime)) {
    timeStatus = 'today';
    const minutesUntil = differenceInMinutes(startTime, new Date());
    if (minutesUntil <= 60 && minutesUntil > 0) {
      timeLabel = `Dans ${minutesUntil} min`;
    } else {
      timeLabel = "Aujourd'hui";
    }
  } else if (isTomorrow(startTime)) {
    timeStatus = 'tomorrow';
    timeLabel = "Demain";
  } else {
    timeLabel = format(startTime, 'EEEE dd MMM', { locale: fr });
  }

  // Duration
  let durationText = '';
  if (event.all_day) {
    durationText = 'Journée entière';
  } else if (endTime) {
    const durationMins = differenceInMinutes(endTime, startTime);
    if (durationMins >= 60) {
      const hours = Math.floor(durationMins / 60);
      const mins = durationMins % 60;
      durationText = mins > 0 ? `${hours}h${mins}` : `${hours}h`;
    } else {
      durationText = `${durationMins} min`;
    }
  }

  return (
    <HoverCard openDelay={200}>
      <HoverCardTrigger asChild>
        {children}
      </HoverCardTrigger>
      <HoverCardContent className="w-80" side="right" align="start">
        <div className="space-y-3">
          {/* Header */}
          <div className="flex items-start gap-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
              isVisio ? 'bg-blue-500' : 'bg-purple-100 dark:bg-purple-900/30'
            }`}>
              {isVisio ? (
                <Video className="h-5 w-5 text-white" />
              ) : (
                <Calendar className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="font-semibold text-sm leading-tight line-clamp-2">
                {event.title}
              </h4>
              {isVisio && (
                <Badge className="mt-1 bg-blue-500 text-white text-xs">
                  Visioconférence
                </Badge>
              )}
            </div>
          </div>

          {/* Date and time */}
          <div className={`flex items-center gap-2 text-xs rounded-md px-2 py-2 ${
            timeStatus === 'today' ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 font-medium' :
            timeStatus === 'tomorrow' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300' :
            timeStatus === 'past' ? 'bg-muted/50 text-muted-foreground' :
            'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'
          }`}>
            <Calendar className="h-3.5 w-3.5 shrink-0" />
            <span className="font-medium">{timeLabel}</span>
            {!event.all_day && (
              <>
                <span className="opacity-60">•</span>
                <Clock className="h-3 w-3 shrink-0" />
                <span>{format(startTime, 'HH:mm', { locale: fr })}</span>
                {endTime && (
                  <span>- {format(endTime, 'HH:mm', { locale: fr })}</span>
                )}
              </>
            )}
            {durationText && (
              <>
                <span className="opacity-60">•</span>
                <span className="text-xs opacity-80">{durationText}</span>
              </>
            )}
          </div>

          {/* Location */}
          {event.location && !isVisio && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <MapPin className="h-3 w-3 shrink-0" />
              <span className="truncate">{event.location}</span>
            </div>
          )}

          {/* Établissement lié */}
          {event.etablissement && (
            <div className="flex items-center gap-2 text-xs bg-muted/50 rounded-md px-2 py-1.5">
              <Building2 className="h-3 w-3 text-muted-foreground shrink-0" />
              <span className="text-muted-foreground">Établissement:</span>
              <span className="font-medium truncate">{event.etablissement.nom}</span>
            </div>
          )}

          {/* Description */}
          {event.description && (
            <div className="pt-2 border-t">
              <p className="text-xs text-muted-foreground line-clamp-3">
                {event.description}
              </p>
            </div>
          )}

          {/* Video conference button - PROMINENT */}
          {isVisio && event.video_conference_url && (
            <div className="pt-2 border-t">
              <Button 
                className="w-full bg-blue-500 hover:bg-blue-600 text-white"
                onClick={() => window.open(event.video_conference_url!, '_blank')}
              >
                <Video className="h-4 w-4 mr-2" />
                Rejoindre la visio
                <ExternalLink className="h-3 w-3 ml-2 opacity-70" />
              </Button>
            </div>
          )}
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}
