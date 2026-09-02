import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';
import { format, addWeeks, subWeeks, addMonths, subMonths } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface CalendarMiniNavProps {
  currentDate: Date;
  onDateChange: (date: Date) => void;
  view: 'timeline' | 'month' | 'day' | 'agenda' | 'planning';
  className?: string;
}

export function CalendarMiniNav({
  currentDate,
  onDateChange,
  view,
  className,
}: CalendarMiniNavProps) {
  const [calendarOpen, setCalendarOpen] = useState(false);

  const handlePrevious = () => {
    if (view === 'month') {
      onDateChange(subMonths(currentDate, 1));
    } else {
      onDateChange(subWeeks(currentDate, 1));
    }
  };

  const handleNext = () => {
    if (view === 'month') {
      onDateChange(addMonths(currentDate, 1));
    } else {
      onDateChange(addWeeks(currentDate, 1));
    }
  };

  const handleToday = () => {
    onDateChange(new Date());
  };

  const handleDateSelect = (date: Date | undefined) => {
    if (date) {
      onDateChange(date);
      setCalendarOpen(false);
    }
  };

  // Format display based on view (capitalize first letter)
  const getDisplayText = () => {
    let text: string;
    if (view === 'month') {
      text = format(currentDate, 'MMMM yyyy', { locale: fr });
    } else {
      text = format(currentDate, "'Semaine du' d MMMM", { locale: fr });
    }
    return text.charAt(0).toUpperCase() + text.slice(1);
  };
  
  // Check if current date is today
  const isToday = format(currentDate, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');

  return (
    <div className={cn("flex items-center gap-0.5", className)}>
      {/* Previous */}
      <Button
        variant="ghost"
        size="icon"
        onClick={handlePrevious}
        className="h-6 w-6 sm:h-7 sm:w-7"
        title={view === 'month' ? 'Mois précédent (←)' : 'Semaine précédente (←)'} aria-label="Précédent">
        <ChevronLeft className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
      </Button>

      {/* Today button */}
      <Button
        variant={isToday ? "default" : "outline"}
        size="sm"
        onClick={handleToday}
        className={cn("h-6 sm:h-7 px-1.5 sm:px-2 text-[11px] sm:text-xs", isToday && "bg-primary text-primary-foreground")}
        title="Aujourd'hui (H)"
      >
        Auj.
      </Button>

      {/* Date display with mini calendar popover */}
      <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 sm:h-7 px-1.5 sm:px-2 font-medium min-w-[80px] sm:min-w-[110px] justify-center gap-1 text-[11px] sm:text-xs"
          >
            <CalendarDays className="h-3 w-3 text-muted-foreground hidden sm:block" />
            <span className="capitalize truncate">{getDisplayText()}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="center">
          <Calendar
            mode="single"
            selected={currentDate}
            onSelect={handleDateSelect}
            locale={fr}
            className="pointer-events-auto"
          />
        </PopoverContent>
      </Popover>

      {/* Next */}
      <Button
        variant="ghost"
        size="icon"
        onClick={handleNext}
        className="h-6 w-6 sm:h-7 sm:w-7"
        title={view === 'month' ? 'Mois suivant (→)' : 'Semaine suivante (→)'} aria-label="Suivant">
        <ChevronRight className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
      </Button>
    </div>
  );
}
