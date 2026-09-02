import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useRDSprints, useRDEpics, useRDUserStories } from '@/hooks/rd/useRD';
import {
  format,
  differenceInDays,
  addDays,
  startOfWeek,
  endOfWeek,
  eachWeekOfInterval,
} from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { GanttChart, Calendar, Layers } from 'lucide-react';

interface RDGanttViewProps {
  projetId: string;
}

export function RDGanttView({ projetId }: RDGanttViewProps) {
  const { data: sprints } = useRDSprints(projetId);
  const { data: epics } = useRDEpics(projetId);
  const { data: stories } = useRDUserStories(projetId);

  // Calculate timeline bounds
  const timelineBounds = useMemo(() => {
    const allDates: Date[] = [];
    
    sprints?.forEach(s => {
      allDates.push(new Date(s.date_debut));
      allDates.push(new Date(s.date_fin));
    });
    
    if (allDates.length === 0) {
      const today = new Date();
      return {
        start: startOfWeek(today, { locale: fr }),
        end: addDays(today, 60),
      };
    }
    
    const minDate = new Date(Math.min(...allDates.map(d => d.getTime())));
    const maxDate = new Date(Math.max(...allDates.map(d => d.getTime())));
    
    return {
      start: startOfWeek(addDays(minDate, -7), { locale: fr }),
      end: endOfWeek(addDays(maxDate, 14), { locale: fr }),
    };
  }, [sprints]);

  // Generate weeks for timeline
  const weeks = useMemo(() => {
    return eachWeekOfInterval(timelineBounds, { locale: fr });
  }, [timelineBounds]);

  // Total days for width calculation
  const totalDays = differenceInDays(timelineBounds.end, timelineBounds.start);
  const dayWidth = 100 / totalDays;

  // Calculate bar position and width
  const getBarStyle = (startDate: string, endDate: string) => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    const startOffset = differenceInDays(start, timelineBounds.start);
    const duration = differenceInDays(end, start) + 1;
    
    return {
      left: `${startOffset * dayWidth}%`,
      width: `${duration * dayWidth}%`,
    };
  };

  // Check if today is within a range
  const today = new Date();
  const todayOffset = differenceInDays(today, timelineBounds.start);
  const todayPosition = `${todayOffset * dayWidth}%`;

  if (!sprints?.length && !epics?.length) {
    return (
      <Card className="py-12">
        <CardContent className="text-center">
          <GanttChart className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
          <h3 className="font-medium mb-2">Aucune donnée à afficher</h3>
          <p className="text-sm text-muted-foreground">
            Créez des sprints et des epics pour voir le diagramme de Gantt
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Timeline Header */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2">
            <GanttChart className="h-5 w-5" />
            Roadmap & Planning
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative">
            {/* Week Headers */}
            <div className="flex border-b mb-4 pb-2">
              <div className="w-48 shrink-0" />
              <div className="flex-1 relative">
                <div className="flex">
                  {weeks.map((week, i) => (
                    <div 
                      key={i}
                      className="flex-1 text-center text-xs text-muted-foreground border-l first:border-l-0"
                      style={{ minWidth: `${7 * dayWidth}%` }}
                    >
                      {format(week, 'dd MMM', { locale: fr })}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Sprints Section */}
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <Calendar className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">Sprints</span>
              </div>
              
              {sprints?.map(sprint => (
                <div key={sprint.id} className="flex items-center mb-2">
                  <div className="w-48 shrink-0 pr-4">
                    <div className="flex items-center gap-2">
                      <Badge 
                        variant={sprint.statut === 'actif' ? 'default' : 'secondary'}
                        className="text-xs"
                      >
                        {sprint.statut}
                      </Badge>
                      <span className="text-sm truncate">{sprint.nom}</span>
                    </div>
                  </div>
                  <div className="flex-1 relative h-8">
                    <div 
                      className={cn(
                        "absolute h-6 rounded-md flex items-center px-2 text-xs text-white",
                        sprint.statut === 'actif' ? 'bg-primary' : 
                        sprint.statut === 'termine' ? 'bg-success' : 'bg-muted-foreground'
                      )}
                      style={getBarStyle(sprint.date_debut, sprint.date_fin)}
                    >
                      {sprint.velocity_prevue && (
                        <span className="truncate">{sprint.velocity_prevue} pts</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Epics Section */}
            {epics && epics.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Layers className="h-4 w-4 text-secondary-foreground" />
                  <span className="text-sm font-medium">Epics</span>
                </div>
                
                {epics.map(epic => {
                  // Calculate epic dates from its stories
                  const epicStories = stories?.filter(s => s.epic_id === epic.id) || [];
                  const storiesInSprints = epicStories
                    .filter(s => s.sprint_id)
                    .map(s => sprints?.find(sp => sp.id === s.sprint_id))
                    .filter(Boolean);
                  
                  if (storiesInSprints.length === 0) {
                    return (
                      <div key={epic.id} className="flex items-center mb-2 opacity-50">
                        <div className="w-48 shrink-0 pr-4">
                          <div className="flex items-center gap-2">
                            <div 
                              className="w-3 h-3 rounded" 
                              style={{ backgroundColor: epic.couleur }} 
                            />
                            <span className="text-sm truncate">{epic.titre}</span>
                          </div>
                        </div>
                        <div className="flex-1 text-xs text-muted-foreground">
                          Non planifié
                        </div>
                      </div>
                    );
                  }
                  
                  const minDate = storiesInSprints.reduce((min, s) => 
                    !min || new Date(s!.date_debut) < new Date(min) ? s!.date_debut : min
                  , null as string | null);
                  
                  const maxDate = storiesInSprints.reduce((max, s) => 
                    !max || new Date(s!.date_fin) > new Date(max) ? s!.date_fin : max
                  , null as string | null);
                  
                  if (!minDate || !maxDate) return null;
                  
                  return (
                    <div key={epic.id} className="flex items-center mb-2">
                      <div className="w-48 shrink-0 pr-4">
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-3 h-3 rounded" 
                            style={{ backgroundColor: epic.couleur }} 
                          />
                          <span className="text-sm truncate">{epic.titre}</span>
                          <Badge variant="outline" className="text-xs">
                            {epicStories.length}
                          </Badge>
                        </div>
                      </div>
                      <div className="flex-1 relative h-8">
                        <div 
                          className="absolute h-6 rounded-md opacity-60"
                          style={{
                            ...getBarStyle(minDate, maxDate),
                            backgroundColor: epic.couleur,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Today Marker */}
            {todayOffset >= 0 && todayOffset <= totalDays && (
              <div 
                className="absolute top-0 bottom-0 w-0.5 bg-destructive z-10"
                style={{ left: todayPosition }}
              >
                <div className="absolute -top-1 -left-1.5 w-3 h-3 rounded-full bg-destructive" />
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
