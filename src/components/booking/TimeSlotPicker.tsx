import { useMemo } from 'react';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Clock, Sun, Sunset, Moon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TimeSlot {
  start: string;
  end: string;
  available?: boolean;
}

interface TimeSlotPickerProps {
  slots: TimeSlot[];
  selectedSlot: TimeSlot | null;
  onSelectSlot: (slot: TimeSlot) => void;
  isLoading?: boolean;
  date?: Date;
  duration?: number;
  className?: string;
}

type Period = 'morning' | 'afternoon' | 'evening';

interface GroupedSlots {
  morning: TimeSlot[];
  afternoon: TimeSlot[];
  evening: TimeSlot[];
}

const PERIOD_CONFIG: Record<Period, { label: string; icon: typeof Sun; color: string }> = {
  morning: { label: 'Matin', icon: Sun, color: 'text-amber-500' },
  afternoon: { label: 'Après-midi', icon: Sunset, color: 'text-orange-500' },
  evening: { label: 'Soir', icon: Moon, color: 'text-indigo-500' },
};

export function TimeSlotPicker({
  slots,
  selectedSlot,
  onSelectSlot,
  isLoading,
  date,
  duration,
  className,
}: TimeSlotPickerProps) {
  const groupedSlots = useMemo<GroupedSlots>(() => {
    const groups: GroupedSlots = { morning: [], afternoon: [], evening: [] };
    
    slots.forEach((slot) => {
      const hour = parseInt(slot.start.split('T')[1]?.split(':')[0] || format(parseISO(slot.start), 'H'));
      
      if (hour < 12) {
        groups.morning.push(slot);
      } else if (hour < 18) {
        groups.afternoon.push(slot);
      } else {
        groups.evening.push(slot);
      }
    });
    
    return groups;
  }, [slots]);

  if (isLoading) {
    return (
      <div className={cn("flex items-center justify-center py-12", className)}>
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="mt-2 text-sm text-muted-foreground">Chargement des créneaux...</p>
        </div>
      </div>
    );
  }

  if (slots.length === 0) {
    return (
      <div className={cn("flex flex-col items-center justify-center py-12 text-center", className)}>
        <Clock className="h-12 w-12 text-muted-foreground/50 mb-3" />
        <p className="text-muted-foreground font-medium">Aucun créneau disponible</p>
        <p className="text-sm text-muted-foreground/70 mt-1">
          Sélectionnez une autre date
        </p>
      </div>
    );
  }

  const renderPeriodSection = (period: Period, periodSlots: TimeSlot[]) => {
    if (periodSlots.length === 0) return null;
    
    const config = PERIOD_CONFIG[period];
    const Icon = config.icon;

    return (
      <div key={period} className="space-y-3">
        <div className="flex items-center gap-2 px-1">
          <Icon className={cn("h-4 w-4", config.color)} />
          <span className="text-sm font-medium text-muted-foreground">
            {config.label}
          </span>
          <span className="text-xs text-muted-foreground/60">
            ({periodSlots.length} créneaux)
          </span>
        </div>
        <div className="space-y-1.5">
          {periodSlots.map((slot) => {
            const isSelected = selectedSlot?.start === slot.start;
            const startTime = format(parseISO(slot.start), 'HH:mm');
            const endTime = format(parseISO(slot.end), 'HH:mm');

            return (
              <Button
                key={slot.start}
                variant={isSelected ? 'default' : 'outline'}
                className={cn(
                  "w-full justify-between h-12 transition-all",
                  isSelected && "ring-2 ring-primary ring-offset-2",
                  !isSelected && "hover:border-primary hover:bg-primary/5"
                )}
                onClick={() => onSelectSlot(slot)}
              >
                <span className="font-medium">{startTime}</span>
                <span className="text-xs text-muted-foreground">
                  → {endTime}
                </span>
              </Button>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <ScrollArea className={cn("h-[400px] pr-4", className)}>
      <div className="space-y-6">
        {date && (
          <div className="text-center pb-2 border-b">
            <p className="font-medium capitalize">
              {format(date, 'EEEE d MMMM', { locale: fr })}
            </p>
            {duration && (
              <p className="text-sm text-muted-foreground">
                Durée : {duration} minutes
              </p>
            )}
          </div>
        )}
        {renderPeriodSection('morning', groupedSlots.morning)}
        {renderPeriodSection('afternoon', groupedSlots.afternoon)}
        {renderPeriodSection('evening', groupedSlots.evening)}
      </div>
    </ScrollArea>
  );
}
