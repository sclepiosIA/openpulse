import { useMemo } from 'react';
import { DayPicker } from 'react-day-picker';
import { fr } from 'date-fns/locale';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { buttonVariants } from '@/components/ui/button';
import { startOfDay, addDays, isSameDay, getDay } from 'date-fns';

interface BookingCalendarProps {
  selected?: Date;
  onSelect: (date: Date | undefined) => void;
  availableDays?: number[]; // 0-6, where 0 = Sunday
  maxFutureDays?: number;
  minNoticeHours?: number;
  className?: string;
}

export function BookingCalendar({
  selected,
  onSelect,
  availableDays = [1, 2, 3, 4, 5], // Default: Mon-Fri
  maxFutureDays = 60,
  minNoticeHours = 24,
  className,
}: BookingCalendarProps) {
  const today = startOfDay(new Date());
  const minDate = addDays(today, Math.ceil(minNoticeHours / 24));
  const maxDate = addDays(today, maxFutureDays);

  // Map available days (convert 0 = Monday to JS format where 0 = Sunday)
  // Our DB uses 0 = Monday, but JS uses 0 = Sunday
  const jsAvailableDays = useMemo(() => {
    return availableDays.map(d => (d + 1) % 7); // Convert 0=Mon to JS 1=Mon
  }, [availableDays]);

  const isDateAvailable = (date: Date) => {
    const dayOfWeek = getDay(date); // JS: 0 = Sunday
    return jsAvailableDays.includes(dayOfWeek);
  };

  const disabledMatcher = (date: Date) => {
    if (date < minDate) return true;
    if (date > maxDate) return true;
    if (!isDateAvailable(date)) return true;
    return false;
  };

  // Custom day renderer with availability dot
  const DayContent = ({ date, ...props }: { date: Date }) => {
    const isAvailable = !disabledMatcher(date);
    const isSelected = selected && isSameDay(date, selected);
    
    return (
      <div className="relative w-full h-full flex items-center justify-center">
        <span>{date.getDate()}</span>
        {isAvailable && !isSelected && (
          <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-primary" />
        )}
      </div>
    );
  };

  return (
    <DayPicker
      mode="single"
      selected={selected}
      onSelect={onSelect}
      locale={fr}
      disabled={disabledMatcher}
      showOutsideDays={false}
      className={cn("p-0", className)}
      classNames={{
        months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
        month: "space-y-4",
        caption: "flex justify-center pt-1 relative items-center",
        caption_label: "text-sm font-medium capitalize",
        nav: "space-x-1 flex items-center",
        nav_button: cn(
          buttonVariants({ variant: "outline" }),
          "h-8 w-8 bg-transparent p-0 opacity-50 hover:opacity-100"
        ),
        nav_button_previous: "absolute left-1",
        nav_button_next: "absolute right-1",
        table: "w-full border-collapse space-y-1",
        head_row: "flex",
        head_cell: "text-muted-foreground rounded-md w-10 font-normal text-[0.8rem]",
        row: "flex w-full mt-2",
        cell: cn(
          "relative p-0 text-center text-sm focus-within:relative focus-within:z-20",
          "h-10 w-10",
          "[&:has([aria-selected])]:bg-primary/10 [&:has([aria-selected])]:rounded-md"
        ),
        day: cn(
          buttonVariants({ variant: "ghost" }),
          "h-10 w-10 p-0 font-normal aria-selected:opacity-100 hover:bg-primary/10"
        ),
        day_selected: "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground rounded-md",
        day_today: "bg-accent text-accent-foreground font-semibold",
        day_outside: "text-muted-foreground opacity-50",
        day_disabled: "text-muted-foreground opacity-30 cursor-not-allowed",
        day_range_middle: "aria-selected:bg-accent aria-selected:text-accent-foreground",
        day_hidden: "invisible",
      }}
      components={{
        IconLeft: () => <ChevronLeft className="h-4 w-4" />,
        IconRight: () => <ChevronRight className="h-4 w-4" />,
      }}
    />
  );
}
