import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { CalendarSidebar } from './CalendarSidebar';
import { SlidersHorizontal } from 'lucide-react';
import { useState } from 'react';

interface CalendarMobileSidebarProps {
  selectedCalendarIds: string[];
  onCalendarToggle: (calendarId: string) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  showEstablishmentTasks?: boolean;
  onToggleEstablishmentTasks?: () => void;
  establishmentTaskCount?: number;
}

export function CalendarMobileSidebar({
  selectedCalendarIds,
  onCalendarToggle,
  onSelectAll,
  onDeselectAll,
  showEstablishmentTasks,
  onToggleEstablishmentTasks,
  establishmentTaskCount,
}: CalendarMobileSidebarProps) {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="lg:hidden">
          <SlidersHorizontal className="h-4 w-4 mr-2" />
          Calendriers
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-80 p-0">
        <SheetHeader className="p-4 border-b">
          <SheetTitle>Calendriers</SheetTitle>
        </SheetHeader>
        <div className="p-2">
          <CalendarSidebar
            selectedCalendarIds={selectedCalendarIds}
            onCalendarToggle={(id) => {
              onCalendarToggle(id);
            }}
            onSelectAll={onSelectAll}
            onDeselectAll={onDeselectAll}
            showEstablishmentTasks={showEstablishmentTasks}
            onToggleEstablishmentTasks={onToggleEstablishmentTasks}
            establishmentTaskCount={establishmentTaskCount}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
