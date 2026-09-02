import { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Filter, Users, Tag, Plus } from 'lucide-react';
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
import { useDroppable } from '@dnd-kit/core';
import {
  useRDUserStories,
  useRDEpics,
  useUpdateStoryStatus,
} from '@/hooks/rd/useRD';
import { useProfiles } from '@/hooks/profile/useProfiles';
import { RDKanbanCard } from './RDKanbanCard';
import { CreateUserStoryDialog } from './CreateUserStoryDialog';
import { KANBAN_COLUMNS, PRIORITE_CONFIG, type RDUserStory, type RDUserStoryStatut, type RDEpic } from '@/types/rd';
import { cn } from '@/lib/utils';

interface RDKanbanBoardProps {
  projetId: string;
  sprintId?: string | null;
  showBacklog?: boolean;
}

interface ColumnProps {
  column: typeof KANBAN_COLUMNS[0];
  stories: RDUserStory[];
  projetId: string;
  epics: RDEpic[];
  onAddStory: (epicId?: string) => void;
}

// WIP Limits configuration
const WIP_LIMITS: Partial<Record<RDUserStoryStatut, number>> = {
  in_progress: 5,
  review: 3,
};

function KanbanColumn({ column, stories, projetId, epics, onAddStory }: ColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });
  
  const totalPoints = stories.reduce((sum, s) => sum + (s.points || 0), 0);
  const wipLimit = WIP_LIMITS[column.id];
  const isOverWip = wipLimit && stories.length > wipLimit;

  return (
    <div 
      ref={setNodeRef}
      className={cn(
        "flex flex-col min-w-[260px] sm:min-w-[280px] max-w-[320px] bg-muted/30 rounded-lg border snap-start",
        isOver && "ring-2 ring-primary bg-primary/5",
        isOverWip && "border-destructive/50"
      )}
    >
      {/* Column Header */}
      <div 
        className="flex items-center justify-between p-2 sm:p-3 border-b"
        style={{ borderLeftColor: column.color, borderLeftWidth: 4 }}
      >
        <div className="flex items-center gap-1.5 sm:gap-2">
          <span className="font-semibold text-xs sm:text-sm">{column.label}</span>
          <Badge variant="secondary" className="text-[10px] sm:text-xs h-5">
            {stories.length}
          </Badge>
          {/* WIP Warning */}
          {isOverWip && (
            <Badge variant="destructive" className="text-[10px] h-5 animate-pulse">
              WIP {stories.length}/{wipLimit}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1 sm:gap-2">
          <Badge variant="outline" className="text-[10px] sm:text-xs h-5">
            {totalPoints} pts
          </Badge>
          <Button 
            size="icon" 
            variant="ghost" 
            className="h-6 w-6"
            onClick={() => onAddStory()} aria-label="Ajouter">
            <Plus className="h-3 w-3" />
          </Button>
        </div>
      </div>
      
      {/* Column Content */}
      <div className="flex-1 p-1.5 sm:p-2 space-y-1.5 sm:space-y-2 overflow-y-auto max-h-[calc(100vh-400px)] min-h-[200px]">
        {stories.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-xs sm:text-sm">
            Glissez des stories ici
          </div>
        ) : (
          stories.map(story => (
            <RDKanbanCard 
              key={story.id} 
              story={story} 
              projetId={projetId}
              epics={epics}
            />
          ))
        )}
      </div>
    </div>
  );
}

export function RDKanbanBoard({ projetId, sprintId, showBacklog = false }: RDKanbanBoardProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterEpic, setFilterEpic] = useState<string>('all');
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [filterAssignee, setFilterAssignee] = useState<string>('all');
  // Swimlanes désactivées par défaut pour un Kanban plus simple
  const [collapsedEpics, setCollapsedEpics] = useState<Set<string>>(new Set());
  const [activeStory, setActiveStory] = useState<RDUserStory | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [createEpicId, setCreateEpicId] = useState<string | undefined>();
  
  const { data: allStories } = useRDUserStories(projetId, showBacklog ? null : sprintId);
  const { data: epics } = useRDEpics(projetId);
  const { data: profiles } = useProfiles();
  const updateStoryStatus = useUpdateStoryStatus();
  
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  // Filter stories
  const filteredStories = useMemo(() => {
    if (!allStories) return [];
    
    return allStories.filter(story => {
      if (searchQuery && !story.titre.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }
      if (filterEpic !== 'all' && story.epic_id !== filterEpic) {
        return false;
      }
      if (filterPriority !== 'all' && story.priorite !== filterPriority) {
        return false;
      }
      if (filterAssignee !== 'all' && story.responsable_id !== filterAssignee) {
        return false;
      }
      return true;
    });
  }, [allStories, searchQuery, filterEpic, filterPriority, filterAssignee]);

  // Group by status
  const storiesByStatus = useMemo(() => {
    const grouped: Record<RDUserStoryStatut, RDUserStory[]> = {
      backlog: [],
      todo: [],
      in_progress: [],
      review: [],
      done: [],
    };
    
    filteredStories.forEach(story => {
      if (grouped[story.statut]) {
        grouped[story.statut].push(story);
      }
    });
    
    return grouped;
  }, [filteredStories]);

  // Get all team members from profiles
  const assignees = useMemo(() => {
    if (!profiles) return [];
    return profiles.map(p => ({
      id: p.id,
      prenom: p.prenom || '',
      nom: p.nom || ''
    })).sort((a, b) => `${a.prenom} ${a.nom}`.localeCompare(`${b.prenom} ${b.nom}`));
  }, [profiles]);

  const toggleEpic = (epicId: string) => {
    setCollapsedEpics(prev => {
      const next = new Set(prev);
      if (next.has(epicId)) {
        next.delete(epicId);
      } else {
        next.add(epicId);
      }
      return next;
    });
  };

  const handleDragStart = (event: DragStartEvent) => {
    const story = allStories?.find(s => s.id === event.active.id);
    setActiveStory(story || null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveStory(null);
    
    const { active, over } = event;
    if (!over) return;
    
    const storyId = active.id as string;
    const targetId = over.id as string;
    
    // Check if dropping on a status column
    const targetStatus = KANBAN_COLUMNS.find(c => c.id === targetId);
    if (targetStatus) {
      updateStoryStatus.mutate({
        storyId,
        statut: targetStatus.id,
        projetId,
      });
    }
  };

  const handleAddStory = (epicId?: string) => {
    setCreateEpicId(epicId);
    setShowCreateDialog(true);
  };

  return (
    <div className="flex flex-col h-full space-y-4">
      {/* Filters Bar */}
      <Card>
        <CardContent className="p-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px] max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9"
              />
            </div>
            
            <Select value={filterEpic} onValueChange={setFilterEpic}>
              <SelectTrigger className="w-[160px] h-9">
                <Tag className="h-4 w-4 mr-2" />
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
              <SelectTrigger className="w-[140px] h-9">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Priorité" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes</SelectItem>
                {Object.entries(PRIORITE_CONFIG).map(([key, config]) => (
                  <SelectItem key={key} value={key}>{config.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Select value={filterAssignee} onValueChange={setFilterAssignee}>
              <SelectTrigger className="w-[160px] h-9">
                <Users className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Assigné" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous</SelectItem>
                {assignees.map(a => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.prenom} {a.nom}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Button size="sm" onClick={() => handleAddStory()}>
              <Plus className="h-4 w-4 mr-2" />
              Story
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Kanban Board */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex-1 overflow-x-auto pb-4 -mx-1 px-1 snap-x snap-mandatory">
          {/* Simple Kanban columns - all stories with Epic badges */}
          <div className="flex gap-2 sm:gap-3 min-w-max">
            {KANBAN_COLUMNS.map(column => (
              <KanbanColumn
                key={column.id}
                column={column}
                stories={storiesByStatus[column.id]}
                projetId={projetId}
                epics={epics || []}
                onAddStory={() => handleAddStory()}
              />
            ))}
          </div>
        </div>
        
        <DragOverlay>
          {activeStory && (
            <div className="opacity-90 rotate-2">
              <RDKanbanCard 
                story={activeStory} 
                projetId={projetId}
                epics={epics || []}
                isDragging
              />
            </div>
          )}
        </DragOverlay>
      </DndContext>

      {/* Create Story Dialog */}
      <CreateUserStoryDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        projetId={projetId}
        defaultEpicId={createEpicId}
      />
    </div>
  );
}
