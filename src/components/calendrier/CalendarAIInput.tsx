import { useState, useCallback } from 'react';
import { debug } from '@/lib/debug';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Loader2, Check, X, Calendar as CalendarIcon, Clock, RefreshCw } from 'lucide-react';
import { callCalendarAiCreate } from '@/services/calendrier/calendarAiCreate';
import { useToast } from '@/hooks/shared/use-toast';
import { useCreateEvent } from '@/hooks/calendar/useCalendarEvents';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { formatRecurrenceRule } from '@/lib/recurrenceUtils';
import { useIsMobile } from '@/hooks/ui/use-mobile';

interface Calendar {
  id: string;
  name: string;
  color: string;
}

interface GeneratedEvent {
  title: string;
  calendar_id: string;
  calendar_name?: string;
  start_time: string;
  end_time: string;
  all_day: boolean;
  recurrence_rule?: string;
  description?: string;
}

interface CalendarAIInputProps {
  calendars: Calendar[];
  onEventsCreated: () => void;
}

export function CalendarAIInput({ calendars, onEventsCreated }: CalendarAIInputProps) {
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [generatedEvents, setGeneratedEvents] = useState<GeneratedEvent[]>([]);
  const [interpretation, setInterpretation] = useState('');
  const [error, setError] = useState('');
  const { toast } = useToast();
  const createEvent = useCreateEvent();
  const isMobile = useIsMobile();

  const handleGenerate = useCallback(async () => {
    if (!input.trim()) {
      toast({
        title: 'Texte requis',
        description: 'Veuillez saisir une description pour créer des événements.',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    setError('');
    setGeneratedEvents([]);
    setInterpretation('');

    try {
      const data = await callCalendarAiCreate({
        text: input,
        calendars: calendars.map(c => ({ id: c.id, name: c.name })),
      });

      if (data.error) {
        setError(data.error);
        return;
      }

      // Map calendar names to events
      const eventsWithNames = ((data.events || []) as GeneratedEvent[]).map((event) => {
        const calendar = calendars.find(c => c.id === event.calendar_id);
        return {
          ...event,
          calendar_name: calendar?.name || 'Calendrier par défaut',
        };
      });

      setGeneratedEvents(eventsWithNames);
      setInterpretation(data.interpretation || '');
    } catch (err) {
      debug.error('AI creation error:', err);
      setError('Erreur lors de la génération. Veuillez réessayer.');
    } finally {
      setIsLoading(false);
    }
  }, [input, calendars, toast]);

  const handleConfirmAll = useCallback(async () => {
    if (generatedEvents.length === 0) return;

    setIsLoading(true);
    let successCount = 0;

    try {
      for (const event of generatedEvents) {
        await createEvent.mutateAsync({
          title: event.title,
          calendar_id: event.calendar_id || calendars[0]?.id,
          start_time: event.start_time,
          end_time: event.end_time,
          all_day: event.all_day,
          recurrence_rule: event.recurrence_rule,
          description: event.description || 'Créé par IA',
        });
        successCount++;
      }

      toast({
        title: 'Événements créés',
        description: `${successCount} événement${successCount > 1 ? 's' : ''} ajouté${successCount > 1 ? 's' : ''} au calendrier.`,
      });

      // Reset state
      setInput('');
      setGeneratedEvents([]);
      setInterpretation('');
      onEventsCreated();
    } catch (err) {
      debug.error('Error creating events:', err);
      toast({
        title: 'Erreur',
        description: `${successCount} événement(s) créé(s), mais une erreur est survenue.`,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [generatedEvents, calendars, createEvent, toast, onEventsCreated]);

  const handleCancel = useCallback(() => {
    setGeneratedEvents([]);
    setInterpretation('');
    setError('');
  }, []);

  const formatEventDate = (startTime: string, endTime: string, allDay: boolean) => {
    const start = parseISO(startTime);
    const end = parseISO(endTime);
    
    if (allDay) {
      return format(start, 'EEEE d MMMM yyyy', { locale: fr });
    }
    
    return `${format(start, 'EEEE d MMM', { locale: fr })} ${format(start, 'HH:mm')} - ${format(end, 'HH:mm')}`;
  };

  const hasPreview = generatedEvents.length > 0;

  return (
    <div className="space-y-2">
      {/* Input area */}
      <div className="flex gap-1.5">
        <div className="relative flex-1">
          <Sparkles className={cn(
            "absolute left-2.5 text-muted-foreground",
            isMobile ? "top-1.5 h-3 w-3" : "top-2 h-3.5 w-3.5"
          )} />
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={isMobile ? "Ex: Réunion lundi 14h..." : "Ex: Réunion lundi 14h avec l'équipe..."}
            className={cn(
              "pl-7 resize-none text-xs",
              isMobile ? "min-h-[28px] h-7 py-1" : "min-h-[32px] h-8 py-1.5 pl-8"
            )}
            disabled={isLoading}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleGenerate();
              }
            }}
          />
        </div>
        <Button
          onClick={handleGenerate}
          disabled={isLoading || !input.trim()}
          size="sm"
          className={cn(
            isMobile ? "h-7 w-7 p-0" : "h-8 px-2.5"
          )}
        >
          {isLoading ? (
            <Loader2 className={cn("animate-spin", isMobile ? "h-3 w-3" : "h-3.5 w-3.5")} />
          ) : (
            <>
              <Sparkles className={cn(isMobile ? "h-3 w-3" : "h-3.5 w-3.5 sm:mr-1.5")} />
              {!isMobile && <span className="hidden sm:inline text-xs">IA</span>}
            </>
          )}
        </Button>
      </div>

      {/* Error display */}
      {error && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="py-3 px-4">
            <p className="text-sm text-destructive">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Preview of generated events */}
      {hasPreview && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="py-4 px-4 space-y-4">
            {/* Interpretation */}
            {interpretation && (
              <div className="text-sm text-muted-foreground italic border-l-2 border-primary/30 pl-3">
                {interpretation}
              </div>
            )}

            {/* Events list */}
            <div className="space-y-2">
              {generatedEvents.map((event, index) => {
                const calendar = calendars.find(c => c.id === event.calendar_id);

                return (
                  <div
                    key={`gen-event-${index}-${event.title}`}
                    className={cn(
                      'flex items-start gap-3 p-3 rounded-lg bg-background border',
                      'transition-colors hover:border-primary/40'
                    )}
                  >
                    <div
                      className="w-3 h-3 rounded-full mt-1 flex-shrink-0"
                      style={{ backgroundColor: calendar?.color || '#3b82f6' }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{event.title}</p>
                      <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                        <CalendarIcon className="h-3 w-3" />
                        <span>{event.calendar_name}</span>
                        <span>•</span>
                        <Clock className="h-3 w-3" />
                        <span>{formatEventDate(event.start_time, event.end_time, event.all_day)}</span>
                      </div>
                      {event.recurrence_rule && (
                        <Badge variant="secondary" className="mt-1.5 text-xs">
                          <RefreshCw className="h-3 w-3 mr-1" />
                          {formatRecurrenceRule(event.recurrence_rule)}
                        </Badge>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-2 pt-2 border-t">
              <Button
                onClick={handleConfirmAll}
                disabled={isLoading}
                className="flex-1 sm:flex-none"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Check className="h-4 w-4 mr-2" />
                )}
                Créer {generatedEvents.length > 1 ? `les ${generatedEvents.length} événements` : "l'événement"}
              </Button>
              <Button variant="outline" onClick={handleCancel} disabled={isLoading}>
                <X className="h-4 w-4 mr-2" />
                Annuler
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
