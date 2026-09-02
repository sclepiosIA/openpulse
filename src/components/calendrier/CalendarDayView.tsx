
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { TaskCard } from './TaskCard';
import { TaskQuickAdd } from './TaskQuickAdd';
import { format, parseISO, isSameDay } from 'date-fns';
import { fr } from 'date-fns/locale';
import { CalendarDays } from 'lucide-react';
import { Task } from '@/types/gantt';

interface CalendarDayViewProps {
  tasks: Task[];
  selectedDate: Date;
  onDateChange: (date: Date) => void;
  onTaskClick: (task: Task) => void;
  datesWithTasks: Date[];
}

export function CalendarDayView({
  tasks,
  selectedDate,
  onDateChange,
  onTaskClick,
  datesWithTasks,
}: CalendarDayViewProps) {
  const selectedDayTasks = tasks.filter((task) =>
    task.echeance && isSameDay(parseISO(task.echeance), selectedDate)
  );

  const modifiers = {
    hasTasks: datesWithTasks,
  };

  const modifiersStyles = {
    hasTasks: {
      fontWeight: 'bold',
      textDecoration: 'underline',
    },
  };

  return (
    <div className="grid gap-6 md:grid-cols-2">
      {/* Calendrier */}
      <Card>
        <CardHeader>
          <CardTitle>Sélectionner une date</CardTitle>
        </CardHeader>
        <CardContent className="flex justify-center">
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={(date) => date && onDateChange(date)}
            modifiers={modifiers}
            modifiersStyles={modifiersStyles}
            className="rounded-md border"
          />
        </CardContent>
      </Card>

      {/* Tâches du jour */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5" />
            {format(selectedDate, 'EEEE d MMMM yyyy', { locale: fr })}
            <span className="text-sm font-normal text-muted-foreground ml-auto">
              {selectedDayTasks.length} tâche{selectedDayTasks.length > 1 ? 's' : ''}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <TaskQuickAdd defaultDate={selectedDate} onSuccess={() => {}} />
          
          <ScrollArea className="h-[500px] pr-4">
            {selectedDayTasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <CalendarDays className="h-12 w-12 mb-4 opacity-50" />
                <p>Aucune tâche prévue ce jour</p>
              </div>
            ) : (
              <div className="space-y-3">
                {selectedDayTasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    onClick={() => onTaskClick(task)}
                  />
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}