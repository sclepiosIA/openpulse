import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { useState } from "react";
import { useTaches } from "@/hooks/tasks/useTaches";
import { useRHAbsences } from "@/hooks/hr/useRHAbsences";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Clock, Calendar as CalendarIcon, User, ChevronLeft, ChevronRight } from "lucide-react";
import { useRolePermissions } from "@/hooks/auth/useRolePermissions";
import { Skeleton } from "@/components/ui/skeleton";
import { useIsMobile } from "@/hooks/ui/use-mobile";
import { Button } from "@/components/ui/button";

interface UnifiedCalendarProps {
  showTasks?: boolean;
  showAbsences?: boolean;
  profileFilter?: string;
}

export function UnifiedCalendar({ 
  showTasks = true, 
  showAbsences = true, 
  profileFilter 
}: UnifiedCalendarProps) {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const permissions = useRolePermissions();
  const isMobile = useIsMobile();

  const navigateDate = (direction: 'prev' | 'next') => {
    if (!selectedDate) return;
    const newDate = new Date(selectedDate);
    if (direction === 'prev') {
      newDate.setDate(newDate.getDate() - 1);
    } else {
      newDate.setDate(newDate.getDate() + 1);
    }
    setSelectedDate(newDate);
  };
  
  const { data: allTaches, isLoading: tasksLoading } = useTaches();
  const { absences, isLoading: absencesLoading } = useRHAbsences(profileFilter);

  const isLoading = tasksLoading || absencesLoading;

  // Filtrer les événements pour la date sélectionnée
  const eventsForDate = {
    tasks: showTasks && allTaches?.filter(task => {
      if (!task.echeance || !selectedDate) return false;
      const taskDate = new Date(task.echeance);
      return (
        taskDate.getDate() === selectedDate.getDate() &&
        taskDate.getMonth() === selectedDate.getMonth() &&
        taskDate.getFullYear() === selectedDate.getFullYear()
      );
    }) || [],

    absences: showAbsences && permissions.canViewAllAbsences && absences?.filter(absence => {
      if (!selectedDate) return false;
      const startDate = new Date(absence.date_debut);
      const endDate = new Date(absence.date_fin);
      return selectedDate >= startDate && selectedDate <= endDate;
    }) || [],
  };

  // Marquer les dates avec événements
  const datesWithEvents = {
    tasks: allTaches?.reduce((acc, task) => {
      if (task.echeance) {
        const dateStr = new Date(task.echeance).toDateString();
        acc[dateStr] = (acc[dateStr] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>) || {},

    absences: absences?.reduce((acc, absence) => {
      const start = new Date(absence.date_debut);
      const end = new Date(absence.date_fin);
      const current = new Date(start);
      
      while (current <= end) {
        const dateStr = current.toDateString();
        acc[dateStr] = (acc[dateStr] || 0) + 1;
        current.setDate(current.getDate() + 1);
      }
      return acc;
    }, {} as Record<string, number>) || {}
  };

  const modifiers = {
    hasTasks: (date: Date) => date.toDateString() in datesWithEvents.tasks,
    hasAbsences: (date: Date) => date.toDateString() in datesWithEvents.absences,
  };

  const modifiersStyles = {
    hasTasks: { fontWeight: 'bold', backgroundColor: 'hsl(var(--primary) / 0.1)' },
    hasAbsences: { fontWeight: 'bold', backgroundColor: 'hsl(var(--destructive) / 0.1)' },
  };

  const getAbsenceBadgeVariant = (type: string) => {
    switch (type) {
      case 'conges_payes': return 'default';
      case 'maladie': return 'destructive';
      case 'formation': return 'secondary';
      default: return 'outline';
    }
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <Skeleton className="h-6 w-48" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-[300px] w-full" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-32" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-[300px] w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
      {/* Calendrier */}
      <Card className={isMobile ? "" : "lg:col-span-2"}>
        <CardHeader>
          <CardTitle className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <CalendarIcon className="w-5 h-5" />
              Calendrier Unifié
            </div>
            {isMobile && (
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={() => navigateDate('prev')}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => navigateDate('next')}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center">
          {!isMobile && (
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={setSelectedDate}
              modifiers={modifiers}
              modifiersStyles={modifiersStyles}
              className="rounded-md border w-full"
            />
          )}
          
          {/* Légende */}
          <div className="flex flex-wrap gap-3 mt-4 text-xs">
            {showTasks && (
              <Badge variant="outline" className="gap-1">
                <div className="w-2 h-2 rounded-full bg-primary" />
                Tâches
              </Badge>
            )}
            {showAbsences && permissions.canViewAllAbsences && (
              <Badge variant="outline" className="gap-1">
                <div className="w-2 h-2 rounded-full bg-destructive" />
                Absences
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Événements du jour sélectionné */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {selectedDate?.toLocaleDateString('fr-FR', { 
              weekday: 'long', 
              day: 'numeric', 
              month: 'long' 
            })}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[300px] md:h-[400px]">
            <div className="space-y-3">
              {/* Tâches */}
              {eventsForDate.tasks.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-semibold text-sm flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    Tâches ({eventsForDate.tasks.length})
                  </h4>
                  {eventsForDate.tasks.map((task) => (
                    <Card key={task.id} className="p-2">
                      <div className="space-y-1">
                        <div className="font-medium text-sm">{task.titre}</div>
                        <div className="flex gap-2">
                          <Badge variant={task.statut === 'Terminé' ? 'default' : 'outline'} className="text-xs">
                            {task.statut}
                          </Badge>
                          {task.priorite && (
                            <Badge variant="secondary" className="text-xs">
                              {task.priorite}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}

              {/* Absences */}
              {eventsForDate.absences.length > 0 && permissions.canViewAllAbsences && (
                <div className="space-y-2">
                  <h4 className="font-semibold text-sm flex items-center gap-2">
                    <User className="w-4 h-4" />
                    Absences ({eventsForDate.absences.length})
                  </h4>
                  {eventsForDate.absences.map((absence) => (
                    <Card key={absence.id} className="p-2">
                      <div className="space-y-1">
                        <div className="font-medium text-sm">
                          {absence.profiles?.prenom} {absence.profiles?.nom}
                        </div>
                        <Badge variant={getAbsenceBadgeVariant(absence.type_absence)} className="text-xs">
                          {absence.type_absence}
                        </Badge>
                      </div>
                    </Card>
                  ))}
                </div>
              )}

              {/* Message si aucun événement */}
              {eventsForDate.tasks.length === 0 && 
               eventsForDate.absences.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground py-8">
                  <Clock className="w-12 h-12 mb-2 opacity-50" />
                  <p>Aucun événement pour cette date</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
