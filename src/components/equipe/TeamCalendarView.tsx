import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { useState } from "react";
import { useTaches } from "@/hooks/tasks/useTaches";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Clock } from "lucide-react";

interface Profile {
  id: string;
  prenom: string;
  nom: string;
  email: string;
}

interface TeamCalendarViewProps {
  profiles: Profile[];
}

export function TeamCalendarView({ profiles }: TeamCalendarViewProps) {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const { data: allTaches } = useTaches();

  // Get tasks for selected date
  const tasksForDate = allTaches?.filter(task => {
    if (!task.echeance || !selectedDate) return false;
    const taskDate = new Date(task.echeance);
    return (
      taskDate.getDate() === selectedDate.getDate() &&
      taskDate.getMonth() === selectedDate.getMonth() &&
      taskDate.getFullYear() === selectedDate.getFullYear()
    );
  }) || [];

  // Get dates with tasks
  const datesWithTasks = allTaches?.reduce((acc, task) => {
    if (task.echeance) {
      const dateStr = new Date(task.echeance).toDateString();
      acc[dateStr] = (acc[dateStr] || 0) + 1;
    }
    return acc;
  }, {} as Record<string, number>) || {};

  const modifiers = {
    hasTasks: (date: Date) => {
      const dateStr = date.toDateString();
      return dateStr in datesWithTasks;
    },
  };

  const modifiersStyles = {
    hasTasks: {
      fontWeight: 'bold',
      backgroundColor: 'hsl(var(--primary) / 0.1)',
    },
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Calendar */}
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Calendrier des échéances</CardTitle>
        </CardHeader>
        <CardContent className="flex justify-center">
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={setSelectedDate}
            modifiers={modifiers}
            modifiersStyles={modifiersStyles}
            className="rounded-md border"
          />
        </CardContent>
      </Card>

      {/* Tasks for selected date */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Tâches pour le {selectedDate?.toLocaleDateString('fr-FR')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[400px]">
            {tasksForDate.length > 0 ? (
              <div className="space-y-3">
                {tasksForDate.map((task) => {
                  const assignee = profiles.find(p => p.id === task.responsable_id);
                  const isOverdue = new Date(task.echeance!) < new Date() && task.statut !== 'Terminé';

                  return (
                    <Card key={task.id} className={isOverdue ? 'border-red-500' : ''}>
                      <CardContent className="p-3">
                        <div className="space-y-2">
                          <div className="font-medium text-sm">{task.titre}</div>
                          {assignee && (
                            <div className="text-xs text-muted-foreground">
                              Assigné à: {assignee.prenom} {assignee.nom}
                            </div>
                          )}
                          <div className="flex items-center gap-2">
                            <Badge variant={task.statut === 'Terminé' ? 'default' : 'outline'} className="text-xs">
                              {task.statut}
                            </Badge>
                            {task.priorite && (
                              <Badge variant="outline" className="text-xs">
                                {task.priorite === 'high' ? 'Haute' : task.priorite === 'medium' ? 'Moyenne' : 'Basse'}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground py-8">
                <Clock className="w-12 h-12 mb-2 opacity-50" />
                <p>Aucune tâche pour cette date</p>
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
