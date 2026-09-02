import { useState, useMemo, useRef, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Loader2,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Calendar,
  Target,
  Boxes,
  ZoomIn,
  ZoomOut,
  CalendarDays,
  Tag,
  Filter,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, differenceInDays, addDays, startOfWeek, endOfWeek, eachWeekOfInterval } from 'date-fns';
import { fr } from 'date-fns/locale';

import { useRDSprints, useRDEpics, useRDUserStories } from '@/hooks/rd/useRD';
import { GanttDualLayout } from '@/components/etablissement-gantt/GanttDualLayout';
import { type RDUserStory, PRIORITE_CONFIG } from '@/types/rd';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface RDGanttContainerProps {
  projetId: string;
}

type ZoomLevel = 'week' | 'month' | 'quarter';

interface TimelineConfig {
  start: Date;
  end: Date;
  totalDays: number;
  pixelsPerDay: number;
}

const ZOOM_PIXELS: Record<ZoomLevel, number> = {
  week: 30,
  month: 12,
  quarter: 4,
};

export function RDGanttContainer({ projetId }: RDGanttContainerProps) {
  const [zoomLevel, setZoomLevel] = useState<ZoomLevel>('week');
  const [collapsedSprints, setCollapsedSprints] = useState<Set<string>>(new Set());
  const [collapsedEpics, setCollapsedEpics] = useState<Set<string>>(new Set());
  const [filterEpic, setFilterEpic] = useState<string>('all');
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const scrollableRef = useRef<HTMLDivElement>(null);

  const { data: sprints, isLoading: loadingSprints } = useRDSprints(projetId);
  const { data: epics } = useRDEpics(projetId);
  const { data: allStories } = useRDUserStories(projetId);

  // Filter stories
  const filteredStories = useMemo(() => {
    if (!allStories) return [];
    return allStories.filter(story => {
      if (filterEpic !== 'all' && story.epic_id !== filterEpic) return false;
      if (filterPriority !== 'all' && story.priorite !== filterPriority) return false;
      return true;
    });
  }, [allStories, filterEpic, filterPriority]);

  // Calculate timeline bounds - INCLUDE STORY DATES
  const timeline = useMemo<TimelineConfig | null>(() => {
    const dates: Date[] = [];
    
    // Include sprint dates
    sprints?.forEach(s => {
      dates.push(new Date(s.date_debut));
      dates.push(new Date(s.date_fin));
    });
    
    // ALSO include story dates (critical fix)
    filteredStories?.forEach(story => {
      if (story.date_debut) dates.push(new Date(story.date_debut));
      if (story.date_fin) dates.push(new Date(story.date_fin));
    });
    
    // Fallback if no dates - show 90 days from today
    if (dates.length === 0) {
      dates.push(new Date());
      dates.push(addDays(new Date(), 90));
    }

    const minDate = new Date(Math.min(...dates.map(d => d.getTime())));
    const maxDate = new Date(Math.max(...dates.map(d => d.getTime())));
    
    // Add padding
    const start = addDays(startOfWeek(minDate, { weekStartsOn: 1 }), -7);
    const end = addDays(endOfWeek(maxDate, { weekStartsOn: 1 }), 14);
    const totalDays = differenceInDays(end, start);
    
    const pixelsPerDay = ZOOM_PIXELS[zoomLevel];

    return { start, end, totalDays, pixelsPerDay };
  }, [sprints, filteredStories, zoomLevel]);

  // Generate weeks for header
  const weeks = useMemo(() => {
    if (!timeline) return [];
    return eachWeekOfInterval(
      { start: timeline.start, end: timeline.end },
      { weekStartsOn: 1 }
    );
  }, [timeline]);

  // Calculate bar position with REAL durations
  const getBarStyle = useCallback((startDate: string, endDate: string) => {
    if (!timeline) return { left: 0, width: 0 };
    
    const start = new Date(startDate);
    const end = new Date(endDate);
    const daysFromStart = differenceInDays(start, timeline.start);
    const duration = differenceInDays(end, start) + 1;
    
    return {
      left: daysFromStart * timeline.pixelsPerDay,
      width: Math.max(duration * timeline.pixelsPerDay, 30),
    };
  }, [timeline]);

  // Calculate story bar style with REAL dates or fallback
  const getStoryBarStyle = useCallback((story: RDUserStory, fallbackStart?: string, fallbackEnd?: string) => {
    const start = story.date_debut || fallbackStart;
    const end = story.date_fin || fallbackEnd || start;
    
    if (!start || !end || !timeline) {
      return { left: 0, width: 60 }; // Minimum visible
    }
    
    const startDate = new Date(start);
    const endDate = new Date(end);
    const daysFromStart = differenceInDays(startDate, timeline.start);
    const duration = differenceInDays(endDate, startDate) + 1;
    
    return {
      left: Math.max(daysFromStart * timeline.pixelsPerDay, 0),
      width: Math.max(duration * timeline.pixelsPerDay, 40),
    };
  }, [timeline]);

  // Today marker position
  const todayPosition = useMemo(() => {
    if (!timeline) return -1;
    const daysFromStart = differenceInDays(new Date(), timeline.start);
    return daysFromStart * timeline.pixelsPerDay;
  }, [timeline]);

  // Navigation functions
  const scrollToToday = useCallback(() => {
    if (!scrollableRef.current || !timeline) return;
    const todayOffset = differenceInDays(new Date(), timeline.start) * timeline.pixelsPerDay;
    scrollableRef.current.scrollTo({
      left: todayOffset - 200,
      behavior: 'smooth'
    });
  }, [timeline]);

  const navigatePeriod = useCallback((direction: number) => {
    if (!scrollableRef.current) return;
    const scrollAmount = direction * 7 * ZOOM_PIXELS[zoomLevel]; // Scroll by a week
    scrollableRef.current.scrollBy({
      left: scrollAmount,
      behavior: 'smooth'
    });
  }, [zoomLevel]);

  const toggleSprint = (id: string) => {
    setCollapsedSprints(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleEpic = (id: string) => {
    setCollapsedEpics(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // Priority badge color
  const getPriorityColor = (priority: string) => {
    const config = PRIORITE_CONFIG[priority as keyof typeof PRIORITE_CONFIG];
    return config?.color || 'hsl(var(--muted-foreground))';
  };

  if (loadingSprints) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  // Show message if no content at all (no sprints AND no stories with dates)
  const hasContent = (sprints && sprints.length > 0) || 
    filteredStories?.some(s => s.date_debut || s.date_fin);
  
  if (!timeline || !hasContent) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Calendar className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
          <p className="text-muted-foreground mb-2">
            Créez des sprints ou ajoutez des dates aux stories pour voir le Gantt
          </p>
          <p className="text-xs text-muted-foreground">
            Les stories avec date_debut et date_fin s'afficheront automatiquement
          </p>
        </CardContent>
      </Card>
    );
  }

  const ganttWidth = timeline.totalDays * timeline.pixelsPerDay;

  return (
    <div className="space-y-4">
      {/* Controls */}
      <Card>
        <CardContent className="p-3 flex flex-wrap items-center gap-3">
          {/* Navigation */}
          <div className="flex items-center gap-1">
            <Button size="icon" variant="outline" onClick={() => navigatePeriod(-1)} className="h-8 w-8" aria-label="Précédent">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="outline" onClick={scrollToToday} className="h-8">
              <CalendarDays className="h-4 w-4 mr-1" />
              Aujourd'hui
            </Button>
            <Button size="icon" variant="outline" onClick={() => navigatePeriod(1)} className="h-8 w-8" aria-label="Suivant">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {/* Zoom */}
          <div className="flex items-center gap-1 border-l pl-3">
            <ZoomOut className="h-4 w-4 text-muted-foreground" />
            {(['week', 'month', 'quarter'] as ZoomLevel[]).map(level => (
              <Button
                key={level}
                size="sm"
                variant={zoomLevel === level ? 'default' : 'ghost'}
                onClick={() => setZoomLevel(level)}
                className="h-8 px-2 text-xs"
              >
                {level === 'week' ? 'Sem' : level === 'month' ? 'Mois' : 'Trim'}
              </Button>
            ))}
            <ZoomIn className="h-4 w-4 text-muted-foreground" />
          </div>

          {/* Filters */}
          <div className="flex items-center gap-2 border-l pl-3">
            <Select value={filterEpic} onValueChange={setFilterEpic}>
              <SelectTrigger className="w-[140px] h-8">
                <Tag className="h-3 w-3 mr-1" />
                <SelectValue placeholder="Epic" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les epics</SelectItem>
                {epics?.map(epic => (
                  <SelectItem key={epic.id} value={epic.id}>
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-2 h-2 rounded-full" 
                        style={{ backgroundColor: epic.couleur }}
                      />
                      {epic.titre}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filterPriority} onValueChange={setFilterPriority}>
              <SelectTrigger className="w-[120px] h-8">
                <Filter className="h-3 w-3 mr-1" />
                <SelectValue placeholder="Priorité" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes</SelectItem>
                {Object.entries(PRIORITE_CONFIG).map(([key, config]) => (
                  <SelectItem key={key} value={key}>{config.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex-1" />
          
          {/* Legend */}
          <div className="hidden md:flex items-center gap-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-2 bg-primary rounded-sm" />
              <span>Sprints</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-2 bg-secondary rounded-sm" />
              <span>Epics</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-2 bg-muted-foreground/40 rounded-sm" />
              <span>Stories</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Gantt Chart */}
      <Card className="overflow-hidden">
        <GanttDualLayout
          leftColumnWidth={280}
          scrollableRef={scrollableRef}
          className="h-[calc(100vh-320px)]"
          fixedContent={
            <div className="bg-background">
              {/* Header spacer */}
              <div className="h-12 border-b border-border bg-muted/50 flex items-center px-3">
                <span className="text-sm font-semibold">Éléments</span>
                <Badge variant="secondary" className="ml-auto text-xs">
                  {filteredStories?.length || 0} stories
                </Badge>
              </div>
              
              {/* Sprints Section */}
              {sprints && sprints.length > 0 && (
                <div className="border-b border-border">
                  <div className="flex items-center gap-2 px-3 py-2 bg-primary/5">
                    <Calendar className="h-4 w-4 text-primary" />
                    <span className="font-semibold text-sm">Sprints</span>
                    <Badge variant="secondary">{sprints.length}</Badge>
                  </div>
                  
                  {sprints.map(sprint => {
                    const isCollapsed = collapsedSprints.has(sprint.id);
                    const sprintStories = filteredStories?.filter(s => s.sprint_id === sprint.id) || [];
                    
                    return (
                      <div key={sprint.id}>
                        <div 
                          className="flex items-center gap-2 px-3 py-2 border-b border-border hover:bg-muted/30 cursor-pointer"
                          onClick={() => toggleSprint(sprint.id)}
                        >
                          {sprintStories.length > 0 ? (
                            isCollapsed ? (
                              <ChevronRight className="h-4 w-4 flex-shrink-0" />
                            ) : (
                              <ChevronDown className="h-4 w-4 flex-shrink-0" />
                            )
                          ) : (
                            <div className="w-4" />
                          )}
                          <span className="text-sm font-medium truncate flex-1">{sprint.nom}</span>
                          <Badge variant={sprint.statut === 'actif' ? 'default' : 'secondary'} className="text-[10px]">
                            {sprint.statut}
                          </Badge>
                        </div>
                        
                        {!isCollapsed && sprintStories.map(story => (
                          <div 
                            key={story.id}
                            className="flex items-center gap-2 px-3 py-1.5 border-b border-border/50 pl-8 text-xs text-muted-foreground hover:bg-muted/20"
                          >
                            <Target className="h-3 w-3 flex-shrink-0" />
                            <span className="truncate flex-1">{story.titre}</span>
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div 
                                    className="w-2 h-2 rounded-full flex-shrink-0"
                                    style={{ backgroundColor: getPriorityColor(story.priorite) }}
                                  />
                                </TooltipTrigger>
                                <TooltipContent>
                                  {PRIORITE_CONFIG[story.priorite]?.label}
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                            {story.points && (
                              <Badge variant="outline" className="text-[10px]">
                                {story.points}pts
                              </Badge>
                            )}
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Epics Section */}
              <div>
                <div className="flex items-center gap-2 px-3 py-2 bg-secondary/10">
                  <Boxes className="h-4 w-4 text-secondary-foreground" />
                  <span className="font-semibold text-sm">Epics</span>
                  <Badge variant="secondary">{epics?.length || 0}</Badge>
                </div>
                
                {epics?.map(epic => {
                  const isCollapsed = collapsedEpics.has(epic.id);
                  const epicStories = filteredStories?.filter(s => s.epic_id === epic.id) || [];
                  
                  // Skip if filtering and no stories
                  if (filterEpic !== 'all' && epicStories.length === 0) return null;
                  
                  return (
                    <div key={epic.id}>
                      <div 
                        className="flex items-center gap-2 px-3 py-2 border-b border-border hover:bg-muted/30 cursor-pointer"
                        style={{ borderLeftWidth: 3, borderLeftColor: epic.couleur }}
                        onClick={() => toggleEpic(epic.id)}
                      >
                        {epicStories.length > 0 ? (
                          isCollapsed ? (
                            <ChevronRight className="h-4 w-4 flex-shrink-0" />
                          ) : (
                            <ChevronDown className="h-4 w-4 flex-shrink-0" />
                          )
                        ) : (
                          <div className="w-4" />
                        )}
                        <span className="text-sm font-medium truncate flex-1">{epic.titre}</span>
                        <Badge variant="outline" className="text-[10px]">
                          {epicStories.length}
                        </Badge>
                      </div>
                      
                      {!isCollapsed && epicStories.map(story => (
                        <div 
                          key={story.id}
                          className="flex items-center gap-2 px-3 py-1.5 border-b border-border/50 pl-8 text-xs text-muted-foreground hover:bg-muted/20"
                        >
                          <Target className="h-3 w-3 flex-shrink-0" />
                          <span className="truncate flex-1">{story.titre}</span>
                          <div 
                            className="w-2 h-2 rounded-full flex-shrink-0"
                            style={{ backgroundColor: getPriorityColor(story.priorite) }}
                          />
                          <Badge 
                            variant="outline" 
                            className="text-[10px]"
                            style={{ borderColor: epic.couleur }}
                          >
                            {story.statut}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>
          }
          scrollableContent={
            <div style={{ width: `${ganttWidth}px`, minWidth: '100%' }}>
              {/* Timeline Header */}
              <div className="h-12 border-b border-border bg-muted/50 relative">
                {weeks.map((week, i) => {
                  const weekStart = differenceInDays(week, timeline.start);
                  const left = weekStart * timeline.pixelsPerDay;
                  const width = 7 * timeline.pixelsPerDay;
                  
                  return (
                    <div
                      key={i}
                      className="absolute flex items-center justify-center h-12 text-xs font-medium border-r border-border"
                      style={{ left: `${left}px`, width: `${width}px` }}
                    >
                      {format(week, 'dd MMM', { locale: fr })}
                    </div>
                  );
                })}
                
                {/* Today marker in header */}
                {todayPosition > 0 && todayPosition < ganttWidth && (
                  <div 
                    className="absolute top-0 bottom-0 w-0.5 bg-destructive z-10"
                    style={{ left: `${todayPosition}px` }}
                  />
                )}
              </div>

              {/* Sprints Section */}
              {sprints && sprints.length > 0 && (
                <div className="border-b border-border">
                  <div className="h-8 bg-primary/5" />
                  
                  {sprints.map(sprint => {
                    const isCollapsed = collapsedSprints.has(sprint.id);
                    const sprintStories = filteredStories?.filter(s => s.sprint_id === sprint.id) || [];
                    const barStyle = getBarStyle(sprint.date_debut, sprint.date_fin);
                    
                    return (
                      <div key={sprint.id}>
                        {/* Sprint Bar */}
                        <div className="h-10 relative border-b border-border">
                          <div
                            className={cn(
                              "absolute top-1 h-8 rounded-md flex items-center px-2 text-xs font-medium text-primary-foreground shadow-sm",
                              sprint.statut === 'actif' ? 'bg-primary' : 'bg-primary/60'
                            )}
                            style={{ left: `${barStyle.left}px`, width: `${barStyle.width}px` }}
                          >
                            <span className="truncate">{sprint.nom}</span>
                            {sprint.velocity_prevue && (
                              <Badge variant="secondary" className="ml-2 text-[10px]">
                                {sprint.velocity_prevue}pts
                              </Badge>
                            )}
                          </div>
                        </div>
                        
                        {/* Sprint Stories - with REAL widths */}
                        {!isCollapsed && sprintStories.map(story => {
                          const storyBarStyle = getStoryBarStyle(story, sprint.date_debut, sprint.date_fin);
                          
                          return (
                            <div key={story.id} className="h-7 relative border-b border-border/50">
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <div
                                      className={cn(
                                        "absolute top-1 h-5 rounded flex items-center px-2 text-[10px] cursor-pointer transition-all hover:brightness-110",
                                        story.statut === 'done' && "opacity-60"
                                      )}
                                      style={{ 
                                        left: `${storyBarStyle.left}px`, 
                                        width: `${storyBarStyle.width}px`,
                                        backgroundColor: 'hsl(var(--muted))',
                                        borderLeft: `3px solid ${getPriorityColor(story.priorite)}`
                                      }}
                                    >
                                      <span className="truncate">{story.titre}</span>
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent className="max-w-xs">
                                    <p className="font-medium">{story.titre}</p>
                                    <p className="text-xs text-muted-foreground">
                                      {story.date_debut && story.date_fin 
                                        ? `${format(new Date(story.date_debut), 'dd/MM')} - ${format(new Date(story.date_fin), 'dd/MM')}`
                                        : 'Dates non définies'
                                      }
                                    </p>
                                    {story.points && <p className="text-xs">{story.points} points</p>}
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Epics Section */}
              <div>
                <div className="h-8 bg-secondary/10" />
                
                {epics?.map(epic => {
                  const isCollapsed = collapsedEpics.has(epic.id);
                  const epicStories = filteredStories?.filter(s => s.epic_id === epic.id) || [];
                  
                  // Skip if filtering and no stories
                  if (filterEpic !== 'all' && epicStories.length === 0) return null;
                  
                  // Epic bar spans from earliest to latest story
                  let epicBarStyle = { left: 0, width: 100 };
                  
                  // First try to use story dates directly
                  const storyDates = epicStories
                    .filter(s => s.date_debut || s.date_fin)
                    .flatMap(s => [
                      s.date_debut ? new Date(s.date_debut).getTime() : null,
                      s.date_fin ? new Date(s.date_fin).getTime() : null
                    ])
                    .filter((d): d is number => d !== null);
                  
                  if (storyDates.length > 0) {
                    const earliest = new Date(Math.min(...storyDates));
                    const latest = new Date(Math.max(...storyDates));
                    epicBarStyle = getBarStyle(
                      format(earliest, 'yyyy-MM-dd'),
                      format(latest, 'yyyy-MM-dd')
                    );
                  } else {
                    // Fallback to sprint dates
                    const epicSprints = sprints?.filter(sp => 
                      epicStories.some(s => s.sprint_id === sp.id)
                    ) || [];
                    
                    if (epicSprints.length > 0) {
                      const earliest = epicSprints.reduce((a, b) => 
                        new Date(a.date_debut) < new Date(b.date_debut) ? a : b
                      );
                      const latest = epicSprints.reduce((a, b) => 
                        new Date(a.date_fin) > new Date(b.date_fin) ? a : b
                      );
                      epicBarStyle = getBarStyle(earliest.date_debut, latest.date_fin);
                    }
                  }
                  
                  return (
                    <div key={epic.id}>
                      {/* Epic Bar */}
                      <div className="h-10 relative border-b border-border">
                        <div
                          className="absolute top-1 h-8 rounded-md flex items-center px-2 text-xs font-medium shadow-sm"
                          style={{ 
                            left: `${epicBarStyle.left}px`, 
                            width: `${epicBarStyle.width}px`,
                            backgroundColor: `${epic.couleur}40`,
                            borderLeft: `3px solid ${epic.couleur}`
                          }}
                        >
                          <span className="truncate">{epic.titre}</span>
                          <Badge variant="outline" className="ml-2 text-[10px]">
                            {epicStories.length}
                          </Badge>
                        </div>
                      </div>
                      
                      {/* Epic Stories - with REAL widths */}
                      {!isCollapsed && epicStories.map(story => {
                        const sprint = sprints?.find(s => s.id === story.sprint_id);
                        const storyBarStyle = getStoryBarStyle(
                          story, 
                          sprint?.date_debut, 
                          sprint?.date_fin
                        );
                        
                        return (
                          <div key={story.id} className="h-7 relative border-b border-border/50">
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div
                                    className={cn(
                                      "absolute top-1 h-5 rounded flex items-center px-2 text-[10px] cursor-pointer transition-all hover:brightness-110",
                                      story.statut === 'done' && "opacity-60"
                                    )}
                                    style={{ 
                                      left: `${storyBarStyle.left}px`, 
                                      width: `${storyBarStyle.width}px`,
                                      backgroundColor: `${epic.couleur}20`,
                                      borderLeft: `2px solid ${epic.couleur}`
                                    }}
                                  >
                                    <span className="truncate">{story.titre}</span>
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent className="max-w-xs">
                                  <p className="font-medium">{story.titre}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {story.date_debut && story.date_fin 
                                      ? `${format(new Date(story.date_debut), 'dd/MM')} - ${format(new Date(story.date_fin), 'dd/MM')}`
                                      : 'Dates non définies'
                                    }
                                  </p>
                                  {story.points && <p className="text-xs">{story.points} points</p>}
                                  <p className="text-xs">Statut: {story.statut}</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>

              {/* Today line across entire chart */}
              {todayPosition > 0 && todayPosition < ganttWidth && (
                <div 
                  className="absolute top-12 bottom-0 w-0.5 bg-destructive/50 pointer-events-none"
                  style={{ left: `${todayPosition}px` }}
                />
              )}
            </div>
          }
        />
      </Card>
    </div>
  );
}
