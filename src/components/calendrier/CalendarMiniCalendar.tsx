import { Calendar } from '@/components/ui/calendar';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface CalendarMiniCalendarProps {
  selected: Date;
  onSelect: (date: Date) => void;
  className?: string;
}

export function CalendarMiniCalendar({
  selected,
  onSelect,
  className,
}: CalendarMiniCalendarProps) {
  const handleSelect = (date: Date | undefined) => {
    if (date) {
      onSelect(date);
    }
  };

  return (
    <Calendar
      mode="single"
      selected={selected}
      onSelect={handleSelect}
      locale={fr}
      className={cn(
        "p-0 pointer-events-auto",
        "[&_table]:w-full",
        "[&_.rdp-head_cell]:text-[10px] [&_.rdp-head_cell]:font-medium [&_.rdp-head_cell]:text-muted-foreground",
        "[&_.rdp-cell]:p-0",
        "[&_.rdp-button]:h-7 [&_.rdp-button]:w-7 [&_.rdp-button]:text-xs [&_.rdp-button]:font-normal",
        "[&_.rdp-day_today]:bg-primary [&_.rdp-day_today]:text-primary-foreground [&_.rdp-day_today]:rounded-full",
        "[&_.rdp-day_selected]:bg-primary/20 [&_.rdp-day_selected]:text-primary [&_.rdp-day_selected]:font-semibold",
        "[&_.rdp-nav_button]:h-6 [&_.rdp-nav_button]:w-6",
        "[&_.rdp-caption]:text-sm [&_.rdp-caption]:font-medium",
        className
      )}
    />
  );
}
