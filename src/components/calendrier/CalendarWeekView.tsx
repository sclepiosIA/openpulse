import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { TaskCard } from './TaskCard';
import { getWeekDays } from '@/lib/dateUtils';
import { format, parseISO, isSameDay, addWeeks, subWeeks } from 'date-fns';
import { fr } from 'date-fns/locale';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { DndContext, DragOverlay, useDroppable } from '@dnd-kit/core';
import { useCalendarDragDrop } from '@/hooks/calendar/useCalendarDragDrop';
import { useState } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Task } from '@/types/gantt';
import { cn } from '@/lib/utils';

// Composant pour les zones de drop
function DroppableDay({ day, children, isToday }: { day: Date; children: React.ReactNode; isToday: boolean }) {
  const { setNodeRef, isOver } = useDroppable({
    id: format(day, 'yyyy-MM-dd'),
  });

  return (
    <Card
      ref={setNodeRef}
      className={cn(
        'transition-all',
        isToday && 'border-primary',
        isOver && 'ring-2 ring-primary bg-primary/5'
      )}
    >
      {children}
    </Card>
  );
}

interface CalendarWeekViewProps {
  tasks: Task[];
  currentWeek: Date;
  onWeekChange: (date: Date) => void;
  onTaskClick: (task: Task) => void;
}

export function CalendarWeekView({ tasks, currentWeek, onWeekChange, onTaskClick }: CalendarWeekViewProps) {
  const weekDays = getWeekDays(currentWeek);
  const [activeId, setActiveId] = useState<string | null>(null);
  const { sensors, handleDragEnd } = useCalendarDragDrop();

  const getTasksForDay = (day: Date) => {
    return tasks.filter(
      (task) => task.echeance && isSameDay(parseISO(task.echeance), day)
    );
  };

  const activeTask = activeId ? tasks.find(t => t.id === activeId) : null;

  return (
    <div className="space-y-4">
      {/* Navigation semaine */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onWeekChange(subWeeks(currentWeek, 1))}
          aria-label="Période précédente"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <h3 className="font-semibold">
          Semaine du {format(weekDays[0], 'd MMM', { locale: fr })} au{' '}
          {format(weekDays[6], 'd MMM yyyy', { locale: fr })}
        </h3>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onWeekChange(addWeeks(currentWeek, 1))}
          aria-label="Période suivante"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Grille de la semaine */}
      <DndContext
        sensors={sensors}
        onDragStart={(event) => setActiveId(event.active.id as string)}
        onDragEnd={(event) => {
          handleDragEnd(event, (taskId, newDate) => {
            // Le callback est appelé après la mise à jour réussie
            // La liste se rafraîchit automatiquement via invalidateQueries
          });
          setActiveId(null);
        }}
      >
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-7 gap-4">
          {weekDays.map((day) => {
            const dayTasks = getTasksForDay(day);
            const isToday = isSameDay(day, new Date());

            return (
              <DroppableDay key={day.toISOString()} day={day} isToday={isToday}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">
                    <div className={isToday ? 'text-primary' : ''}>
                      {format(day, 'EEE', { locale: fr })}
                    </div>
                    <div className="text-2xl font-bold">
                      {format(day, 'd', { locale: fr })}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {dayTasks.length} tâche{dayTasks.length > 1 ? 's' : ''}
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-3 pt-0">
                  <ScrollArea className="h-[300px] md:h-[400px]">
                    <div className="space-y-2">
                      {dayTasks.map((task) => (
                        <div
                          key={task.id}
                          draggable
                          onDragStart={(e) => {
                            e.dataTransfer.effectAllowed = 'move';
                            e.dataTransfer.setData('taskId', task.id);
                            setActiveId(task.id);
                          }}
                          className="cursor-grab active:cursor-grabbing"
                        >
                          <TaskCard
                            task={task}
                            onClick={() => onTaskClick(task)}
                            compact
                          />
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </DroppableDay>
            );
          })}
        </div>

        <DragOverlay>
          {activeTask ? (
            <div className="opacity-90 rotate-2 scale-105">
              <TaskCard task={activeTask} compact />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}