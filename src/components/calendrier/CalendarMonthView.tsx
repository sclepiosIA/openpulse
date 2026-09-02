import { Card, CardContent } from '@/components/ui/card';

import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { TaskCard } from './TaskCard';
import { formatDate } from '@/lib/dateUtils';
import { format, parseISO, isSameDay, isSameMonth, addMonths, subMonths, startOfWeek, endOfWeek, eachDayOfInterval } from 'date-fns';
import { fr } from 'date-fns/locale';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import type { CalendarViewProps } from '@/types/calendar-tasks';

interface CalendarMonthViewProps extends CalendarViewProps {
  // Extends base props, no additional props needed
}

export function CalendarMonthView({ tasks, currentMonth, onMonthChange, onTaskClick }: CalendarMonthViewProps) {
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [showHeatmap, setShowHeatmap] = useState(false);

  // Obtenir tous les jours à afficher (incluant les jours des mois précédent/suivant)
  const monthStart = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
  const monthEnd = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const getTasksForDay = (day: Date) => {
    return tasks.filter(
      (task) => task.echeance && isSameDay(parseISO(task.echeance), day)
    );
  };

  const selectedDayTasks = selectedDay ? getTasksForDay(selectedDay) : [];

  return (
    <div className="space-y-4">
      {/* Navigation mois */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onMonthChange(subMonths(currentMonth, 1))}
          aria-label="Période précédente"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <h3 className="font-semibold text-lg">
          {format(currentMonth, 'MMMM yyyy', { locale: fr })}
        </h3>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Switch
              id="heatmap-toggle"
              checked={showHeatmap}
              onCheckedChange={setShowHeatmap}
            />
            <Label htmlFor="heatmap-toggle" className="text-sm cursor-pointer">
              Carte de charge
            </Label>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onMonthChange(addMonths(currentMonth, 1))}
          aria-label="Période suivante"
        >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Grille du calendrier */}
      <Card>
        <CardContent className="p-4">
          {/* En-têtes des jours */}
          <div className="grid grid-cols-7 gap-2 mb-2">
            {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map((day) => (
              <div
                key={day}
                className="text-center text-sm font-medium text-muted-foreground py-2"
              >
                {day}
              </div>
            ))}
          </div>

          {/* Grille des jours */}
          <div className="grid grid-cols-7 gap-2 relative">
            {calendarDays.map((day) => {
              const dayTasks = getTasksForDay(day);
              const isCurrentMonth = isSameMonth(day, currentMonth);
              const isToday = isSameDay(day, new Date());
              const isSelected = selectedDay && isSameDay(day, selectedDay);

              // Calcul de l'intensité de la heatmap
              const taskCount = dayTasks.length;
              const heatmapIntensity = taskCount === 0 ? 0 : Math.min(taskCount / 5, 1);
              const heatmapColor = taskCount === 0 ? 'transparent' 
                : taskCount <= 2 ? 'hsl(var(--warning) / 0.2)'
                : taskCount <= 4 ? 'hsl(var(--warning) / 0.4)'
                : 'hsl(var(--destructive) / 0.3)';

              return (
                <button
                  key={day.toISOString()}
                  onClick={() => setSelectedDay(day)}
                  className={cn(
                    'min-h-[60px] md:min-h-[100px] p-1.5 md:p-2 rounded-lg border transition-all hover:border-primary relative',
                    !isCurrentMonth && 'opacity-40',
                    isToday && 'border-primary bg-primary/5',
                    isSelected && 'ring-2 ring-primary'
                  )}
                  style={showHeatmap && taskCount > 0 ? {
                    backgroundColor: heatmapColor
                  } : undefined}
                >
                  <div className="flex flex-col h-full">
                    <div className={cn(
                      'text-xs md:text-sm font-semibold mb-0.5 md:mb-1',
                      isToday && 'text-primary'
                    )}>
                      {format(day, 'd')}
                    </div>
                    
                    {dayTasks.length > 0 && (
                      <>
                        {/* Mobile: afficher juste le compteur */}
                        <div className="md:hidden flex-1 flex items-center justify-center">
                          <span className="text-xs font-medium text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">
                            {dayTasks.length}
                          </span>
                        </div>
                        
                        {/* Desktop: afficher les titres */}
                        <div className="hidden md:block space-y-1 flex-1">
                          {dayTasks.slice(0, 3).map((task) => (
                            <div
                              key={task.id}
                              className="text-xs p-1 rounded truncate"
                              style={{
                                backgroundColor: task.categories_taches?.couleur
                                  ? `${task.categories_taches.couleur}20`
                                  : 'hsl(var(--muted))',
                                borderLeft: `2px solid ${task.categories_taches?.couleur || 'hsl(var(--muted))'}`,
                              }}
                              title={task.titre}
                            >
                              {task.titre}
                            </div>
                          ))}
                          {dayTasks.length > 3 && (
                            <div className="text-xs text-muted-foreground">
                              +{dayTasks.length - 3} autres
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Drawer pour les tâches du jour sélectionné */}
      <Sheet open={selectedDay !== null} onOpenChange={(open) => !open && setSelectedDay(null)}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>
              {selectedDay && formatDate(selectedDay, 'EEEE d MMMM yyyy')}
            </SheetTitle>
          </SheetHeader>
          <div className="mt-6">
            <ScrollArea className="h-[calc(100vh-120px)]">
              {selectedDayTasks.length === 0 ? (
                <div className="text-center text-muted-foreground py-12">
                  Aucune tâche ce jour
                </div>
              ) : (
                <div className="space-y-3 pr-4">
                  {selectedDayTasks.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      onClick={() => {
                        onTaskClick(task);
                        setSelectedDay(null);
                      }}
                    />
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}