import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Copy, X, Loader2 } from 'lucide-react';
import { format, parseISO, differenceInMilliseconds } from 'date-fns';
import { fr } from 'date-fns/locale';
import { CalendarEvent } from '@/types/calendar';
import { duplicateCalendarEvent } from '@/services/calendrier/duplicateCalendarEvent';
import { useAuth } from '@/components/AuthProvider';
import { useQueryClient } from '@tanstack/react-query';
import { isOccurrenceId, parseOccurrenceId } from '@/lib/recurrenceUtils';
import { toast } from 'sonner';

interface DuplicateEventDialogProps {
  event: CalendarEvent;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Boîte de dialogue pour dupliquer un événement vers plusieurs dates.
 * Conserve l'heure de début/fin et la durée. Crée des copies non-récurrentes.
 */
export function DuplicateEventDialog({ event, open, onOpenChange }: DuplicateEventDialogProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedDates, setSelectedDates] = useState<Date[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const originalStart = useMemo(() => parseISO(event.start_time), [event.start_time]);
  const originalEnd = useMemo(() => parseISO(event.end_time), [event.end_time]);
  const durationMs = useMemo(
    () => differenceInMilliseconds(originalEnd, originalStart),
    [originalStart, originalEnd]
  );

  const handleRemoveDate = (date: Date) => {
    setSelectedDates((prev) => prev.filter((d) => d.getTime() !== date.getTime()));
  };

  const handleSubmit = async () => {
    if (selectedDates.length === 0) {
      toast.error('Sélectionnez au moins une date');
      return;
    }

    setIsSubmitting(true);
    try {
      const sourceId = isOccurrenceId(event.id)
        ? parseOccurrenceId(event.id)?.parentId || event.id
        : event.id;

      const count = await duplicateCalendarEvent({
        sourceId,
        selectedDates,
        originalStart,
        durationMs,
        createdBy: user?.id,
      });

      queryClient.invalidateQueries({ queryKey: ['calendar-events'] });
      toast.success(
        `${count} copie${count > 1 ? 's' : ''} créée${count > 1 ? 's' : ''}`
      );
      setSelectedDates([]);
      onOpenChange(false);
    } catch (err: any) {
      console.error('Duplicate to dates error:', err);
      toast.error(err.message || 'Erreur lors de la duplication');
    } finally {
      setIsSubmitting(false);
    }
  };

  const sortedDates = [...selectedDates].sort((a, b) => a.getTime() - b.getTime());

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[min(900px,95vw)] max-h-[90vh] flex flex-col gap-0 p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Copy className="h-5 w-5 text-primary" />
            Dupliquer vers d'autres dates
          </DialogTitle>
          <DialogDescription className="mt-1">
            Sélectionnez les dates auxquelles dupliquer «&nbsp;{event.title}&nbsp;».
            <br />
            <span className="text-xs">
              L'heure et la durée ({format(originalStart, 'HH:mm', { locale: fr })} – {format(originalEnd, 'HH:mm', { locale: fr })}) seront conservées.
            </span>
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          <div className="grid gap-6 md:grid-cols-[auto_1fr] items-start">
            {/* Calendar */}
            <div className="flex justify-center md:justify-start">
              <Calendar
                mode="multiple"
                selected={selectedDates}
                onSelect={(dates) => setSelectedDates(dates ?? [])}
                locale={fr}
                className="rounded-md border bg-card"
              />
            </div>

            {/* Selected dates panel */}
            <div className="flex flex-col min-h-[300px]">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">
                  Dates sélectionnées
                </span>
                <Badge variant={selectedDates.length > 0 ? 'default' : 'secondary'}>
                  {selectedDates.length}
                </Badge>
              </div>
              <ScrollArea className="flex-1 max-h-[340px] min-h-[200px] border rounded-md bg-muted/30 p-3">
                {sortedDates.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center py-10 text-muted-foreground">
                    <Copy className="h-8 w-8 mb-2 opacity-30" />
                    <p className="text-sm">Aucune date sélectionnée</p>
                    <p className="text-xs mt-1">Cliquez sur le calendrier pour ajouter</p>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {sortedDates.map((date) => (
                      <Badge
                        key={date.getTime()}
                        variant="secondary"
                        className="gap-1 pr-1 py-1 pl-2.5 text-xs"
                      >
                        {format(date, 'EEE d MMM', { locale: fr })}
                        <button
                          type="button"
                          onClick={() => handleRemoveDate(date)}
                          className="ml-0.5 rounded-sm hover:bg-destructive/20 hover:text-destructive p-0.5 transition-colors"
                          aria-label="Retirer cette date"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
              </ScrollArea>
              {selectedDates.length > 0 && (
                <button
                  type="button"
                  onClick={() => setSelectedDates([])}
                  className="text-xs text-muted-foreground hover:text-destructive mt-2 self-end transition-colors"
                >
                  Tout effacer
                </button>
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="px-6 py-4 border-t bg-muted/20 flex-row justify-end gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Annuler
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || selectedDates.length === 0}
            className="gap-2 min-w-[140px]"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Duplication…
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" />
                Dupliquer ({selectedDates.length})
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
