import { Calendar } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Calendar as CalendarComp } from '@/components/ui/calendar';
import type { DashboardFilters } from '@/types/report';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface Props {
  filters: DashboardFilters;
  onChange: (next: DashboardFilters) => void;
}

export function GlobalFiltersBar({ filters, onChange }: Props) {
  const start = filters.date_start ? new Date(filters.date_start) : undefined;
  const end = filters.date_end ? new Date(filters.date_end) : undefined;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            <Calendar className="h-3.5 w-3.5" />
            {start ? format(start, 'dd MMM yyyy', { locale: fr }) : 'Début'}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0 z-50 bg-popover" align="start">
          <CalendarComp mode="single" selected={start} onSelect={(d) => onChange({ ...filters, date_start: d?.toISOString().slice(0, 10) })} initialFocus />
        </PopoverContent>
      </Popover>
      <span className="text-muted-foreground text-xs">→</span>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            <Calendar className="h-3.5 w-3.5" />
            {end ? format(end, 'dd MMM yyyy', { locale: fr }) : 'Fin'}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0 z-50 bg-popover" align="start">
          <CalendarComp mode="single" selected={end} onSelect={(d) => onChange({ ...filters, date_end: d?.toISOString().slice(0, 10) })} initialFocus />
        </PopoverContent>
      </Popover>
      <div className="flex gap-1">
        {[
          { label: '7j', days: 7 },
          { label: '30j', days: 30 },
          { label: '90j', days: 90 },
          { label: '1an', days: 365 },
        ].map(p => (
          <Button
            key={p.label}
            variant="ghost"
            size="sm"
            onClick={() => {
              const e = new Date();
              const s = new Date();
              s.setDate(s.getDate() - p.days);
              onChange({ ...filters, date_start: s.toISOString().slice(0, 10), date_end: e.toISOString().slice(0, 10) });
            }}
          >
            {p.label}
          </Button>
        ))}
      </div>
    </div>
  );
}
