import { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Plus,
  Play,
  Square,
  Calendar,
  Target,
} from 'lucide-react';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  useRDSprints,
  useActiveSprint,
  useRDUserStories,
  useSprintStats,
  useUpdateStoryStatus,
  useUpdateRDSprint,
} from '@/hooks/rd/useRD';
import { CreateSprintDialog } from '@/components/rd/CreateSprintDialog';
import { SprintKanbanColumn } from '@/components/rd/SprintKanbanColumn';
import { UserStoryCard } from '@/components/rd/UserStoryCard';
import { KANBAN_COLUMNS, type RDUserStory, type RDUserStoryStatut } from '@/types/rd';
import { format, differenceInDays } from 'date-fns';
import { fr } from 'date-fns/locale';

interface RDSprintBoardProps {
  projetId: string;
}

export function RDSprintBoard({ projetId }: RDSprintBoardProps) {
  const [showCreateSprint, setShowCreateSprint] = useState(false);
  const [selectedSprintId, setSelectedSprintId] = useState<string | null>(null);
  const [activeStory, setActiveStory] = useState<RDUserStory | null>(null);
  
  const { data: sprints } = useRDSprints(projetId);
  const { data: activeSprint } = useActiveSprint(projetId);
  const updateSprint = useUpdateRDSprint();
  const updateStoryStatus = useUpdateStoryStatus();
  
  // Use active sprint or selected sprint
  const currentSprintId = selectedSprintId || activeSprint?.id;
  const currentSprint = sprints?.find(s => s.id === currentSprintId);
  
  const { data: sprintStories } = useRDUserStories(projetId, currentSprintId);
  const { data: sprintStats } = useSprintStats(currentSprintId);

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  // Group stories by status
  const storiesByStatus = useMemo(() => {
    const grouped: Record<RDUserStoryStatut, RDUserStory[]> = {
      backlog: [],
      todo: [],
      in_progress: [],
      review: [],
      done: [],
    };
    
    sprintStories?.forEach(story => {
      if (grouped[story.statut]) {
        grouped[story.statut].push(story);
      }
    });
    
    return grouped;
  }, [sprintStories]);

  // Sprint days
  const sprintDaysRemaining = currentSprint 
    ? Math.max(0, differenceInDays(new Date(currentSprint.date_fin), new Date()))
    : 0;
  const sprintTotalDays = currentSprint
    ? differenceInDays(new Date(currentSprint.date_fin), new Date(currentSprint.date_debut))
    : 0;

  const handleDragStart = (event: DragStartEvent) => {
    const story = sprintStories?.find(s => s.id === event.active.id);
    setActiveStory(story || null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveStory(null);
    
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const storyId = active.id as string;
    const newStatus = over.id as RDUserStoryStatut;
    
    if (KANBAN_COLUMNS.find(c => c.id === newStatus)) {
      updateStoryStatus.mutate({
        storyId,
        statut: newStatus,
        projetId,
      });
    }
  };

  const handleStartSprint = () => {
    if (!currentSprint) return;
    updateSprint.mutate({
      id: currentSprint.id,
      projet_id: projetId,
      statut: 'actif',
    });
  };

  const handleEndSprint = () => {
    if (!currentSprint) return;
    updateSprint.mutate({
      id: currentSprint.id,
      projet_id: projetId,
      statut: 'termine',
      velocity_reelle: sprintStats?.donePoints || 0,
    });
  };

  return (
    <div className="space-y-6">
      {/* Sprint Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Select 
            value={currentSprintId || ''} 
            onValueChange={setSelectedSprintId}
          >
            <SelectTrigger className="w-[240px]">
              <SelectValue placeholder="Sélectionner un sprint" />
            </SelectTrigger>
            <SelectContent>
              {sprints?.map(sprint => (
                <SelectItem key={sprint.id} value={sprint.id}>
                  <div className="flex items-center gap-2">
                    {sprint.statut === 'actif' && (
                      <Play className="h-3 w-3 text-success" />
                    )}
                    {sprint.nom}
                    <Badge variant="outline" className="ml-2">
                      {sprint.statut}
                    </Badge>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          {currentSprint && (
            <div className="flex items-center gap-2">
              {currentSprint.statut === 'planifie' && (
                <Button size="sm" onClick={handleStartSprint}>
                  <Play className="h-4 w-4 mr-2" />
                  Démarrer
                </Button>
              )}
              {currentSprint.statut === 'actif' && (
                <Button size="sm" variant="outline" onClick={handleEndSprint}>
                  <Square className="h-4 w-4 mr-2" />
                  Terminer
                </Button>
              )}
            </div>
          )}
        </div>
        
        <Button onClick={() => setShowCreateSprint(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Nouveau Sprint
        </Button>
      </div>

      {/* Sprint Info Card */}
      {currentSprint && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-semibold">{currentSprint.nom}</h3>
                  <Badge variant={currentSprint.statut === 'actif' ? 'default' : 'secondary'}>
                    {currentSprint.statut}
                  </Badge>
                </div>
                {currentSprint.objectif && (
                  <p className="text-sm text-muted-foreground">{currentSprint.objectif}</p>
                )}
                <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    {format(new Date(currentSprint.date_debut), 'dd MMM', { locale: fr })} - {format(new Date(currentSprint.date_fin), 'dd MMM', { locale: fr })}
                  </span>
                  <span className="flex items-center gap-1">
                    <Target className="h-4 w-4" />
                    {sprintStats?.totalPoints || 0} points
                  </span>
                </div>
              </div>
              
              <div className="flex items-center gap-6">
                <div className="text-center">
                  <p className="text-2xl font-bold">{sprintDaysRemaining}</p>
                  <p className="text-xs text-muted-foreground">jours restants</p>
                </div>
                <div className="w-32">
                  <Progress value={sprintStats?.progress || 0} className="h-2" />
                  <p className="text-xs text-muted-foreground mt-1 text-center">
                    {sprintStats?.progress || 0}% complet
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Kanban Board */}
      {currentSprintId ? (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {KANBAN_COLUMNS.map(column => (
              <SprintKanbanColumn
                key={column.id}
                column={column}
                stories={storiesByStatus[column.id]}
                projetId={projetId}
              />
            ))}
          </div>
          
          <DragOverlay>
            {activeStory && (
              <div className="opacity-80">
                <UserStoryCard 
                  story={activeStory} 
                  projetId={projetId}
                  sprints={[]}
                  compact
                />
              </div>
            )}
          </DragOverlay>
        </DndContext>
      ) : (
        <Card className="py-12">
          <CardContent className="text-center">
            <Calendar className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
            <h3 className="font-medium mb-2">Aucun sprint</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Créez votre premier sprint pour commencer
            </p>
            <Button onClick={() => setShowCreateSprint(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Créer un sprint
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Create Sprint Dialog */}
      <CreateSprintDialog
        open={showCreateSprint}
        onOpenChange={setShowCreateSprint}
        projetId={projetId}
        nextSprintNumber={(sprints?.length || 0) + 1}
      />
    </div>
  );
}
