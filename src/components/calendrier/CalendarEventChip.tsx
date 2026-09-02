import { cn } from '@/lib/utils';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';

interface CalendarEventChipProps {
  title: string;
  color: string;
  startTime?: string;
  isAllDay?: boolean;
  isMultiDay?: boolean;
  isStart?: boolean;
  isEnd?: boolean;
  compact?: boolean;
  onClick?: () => void;
  className?: string;
}

export function CalendarEventChip({
  title,
  color,
  startTime,
  isAllDay = false,
  isMultiDay = false,
  isStart = true,
  isEnd = true,
  compact = false,
  onClick,
  className,
}: CalendarEventChipProps) {
  const timeDisplay = startTime && !isAllDay ? format(parseISO(startTime), 'HH:mm', { locale: fr }) : null;

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full text-left transition-all",
        "hover:brightness-95 hover:shadow-sm",
        compact ? "text-[10px] px-1 py-0.5" : "text-xs px-2 py-1",
        // Multi-day event styling
        isMultiDay && isStart && !isEnd && "rounded-l-md rounded-r-none",
        isMultiDay && !isStart && isEnd && "rounded-l-none rounded-r-md",
        isMultiDay && !isStart && !isEnd && "rounded-none",
        !isMultiDay && "rounded-md",
        className
      )}
      style={{
        backgroundColor: color,
        color: 'white',
      }}
    >
      <span className="truncate block">
        {timeDisplay && <span className="font-medium mr-1">{timeDisplay}</span>}
        {title}
      </span>
    </button>
  );
}
