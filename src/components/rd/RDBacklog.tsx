import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Plus,
  Search,
  Filter,
  Layers,
  Target,
} from 'lucide-react';

import { useRDEpics, useBacklog, useRDSprints, useMoveStoryToSprint } from '@/hooks/rd/useRD';
import { CreateEpicDialog } from '@/components/rd/CreateEpicDialog';
import { CreateUserStoryDialog } from '@/components/rd/CreateUserStoryDialog';
import { UserStoryCard } from '@/components/rd/UserStoryCard';

import type { RDUserStory } from '@/types/rd';

interface RDBacklogProps {
  projetId: string;
}

export function RDBacklog({ projetId }: RDBacklogProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateEpic, setShowCreateEpic] = useState(false);
  const [showCreateStory, setShowCreateStory] = useState(false);
  const [selectedEpicId, setSelectedEpicId] = useState<string | undefined>();
  
  const { data: epics } = useRDEpics(projetId);
  const { data: backlogStories } = useBacklog(projetId);
  const { data: sprints } = useRDSprints(projetId);
  const moveToSprint = useMoveStoryToSprint();

  // Filter stories
  const filteredStories = backlogStories?.filter(story => 
    story.titre.toLowerCase().includes(searchQuery.toLowerCase()) ||
    story.description?.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  // Group stories by epic
  const storiesByEpic = filteredStories.reduce((acc, story) => {
    const epicId = story.epic_id || 'no-epic';
    if (!acc[epicId]) acc[epicId] = [];
    acc[epicId].push(story);
    return acc;
  }, {} as Record<string, RDUserStory[]>);

  // Unassigned stories
  const unassignedStories = storiesByEpic['no-epic'] || [];

  // Total backlog points
  const totalPoints = filteredStories.reduce((sum, s) => sum + (s.points || 0), 0);

  const handleMoveToSprint = (storyId: string, sprintId: string) => {
    moveToSprint.mutate({ storyId, sprintId, projetId });
  };

  const handleCreateStoryInEpic = (epicId: string) => {
    setSelectedEpicId(epicId);
    setShowCreateStory(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">Product Backlog</h2>
          <p className="text-sm text-muted-foreground">
            {filteredStories.length} stories • {totalPoints} points
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 w-[200px]"
            />
          </div>
          
          <Button variant="outline" onClick={() => setShowCreateEpic(true)}>
            <Layers className="h-4 w-4 mr-2" />
            Epic
          </Button>
          
          <Button onClick={() => {
            setSelectedEpicId(undefined);
            setShowCreateStory(true);
          }}>
            <Plus className="h-4 w-4 mr-2" />
            Story
          </Button>
        </div>
      </div>

      {/* Epics Accordion */}
      <Accordion type="multiple" defaultValue={epics?.map(e => e.id) || []} className="space-y-4">
        {epics?.map(epic => {
          const epicStories = storiesByEpic[epic.id] || [];
          const epicPoints = epicStories.reduce((sum, s) => sum + (s.points || 0), 0);
          
          return (
            <AccordionItem 
              key={epic.id} 
              value={epic.id}
              className="border rounded-lg overflow-hidden"
            >
              <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-muted/50">
                <div className="flex items-center gap-3 flex-1">
                  <div 
                    className="w-4 h-4 rounded" 
                    style={{ backgroundColor: epic.couleur }} 
                  />
                  <span className="font-medium">{epic.titre}</span>
                  <Badge variant="secondary" className="ml-2">
                    {epicStories.length} stories
                  </Badge>
                  <Badge variant="outline">
                    {epicPoints} pts
                  </Badge>
                  <Badge 
                    variant={epic.statut === 'done' ? 'default' : 'outline'}
                    className="ml-auto mr-4"
                  >
                    {epic.statut === 'done' ? 'Terminé' : epic.statut === 'in_progress' ? 'En cours' : 'À faire'}
                  </Badge>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4">
                <div className="space-y-2">
                  {epicStories.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      Aucune story dans cet epic
                    </p>
                  ) : (
                    epicStories.map(story => (
                      <UserStoryCard 
                        key={story.id} 
                        story={story}
                        projetId={projetId}
                        sprints={sprints || []}
                        onMoveToSprint={handleMoveToSprint}
                      />
                    ))
                  )}
                  
                  <Button 
                    variant="ghost" 
                    className="w-full mt-2 border-dashed border"
                    onClick={() => handleCreateStoryInEpic(epic.id)}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Ajouter une story
                  </Button>
                </div>
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>

      {/* Unassigned Stories */}
      {unassignedStories.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Target className="h-5 w-5" />
              Sans Epic
              <Badge variant="secondary" className="ml-2">
                {unassignedStories.length} stories
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {unassignedStories.map(story => (
              <UserStoryCard 
                key={story.id} 
                story={story}
                projetId={projetId}
                sprints={sprints || []}
                onMoveToSprint={handleMoveToSprint}
              />
            ))}
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {filteredStories.length === 0 && (
        <Card className="py-12">
          <CardContent className="text-center">
            <Target className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
            <h3 className="font-medium mb-2">Backlog vide</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Commencez par créer des epics et des user stories
            </p>
            <div className="flex justify-center gap-2">
              <Button variant="outline" onClick={() => setShowCreateEpic(true)}>
                <Layers className="h-4 w-4 mr-2" />
                Créer un epic
              </Button>
              <Button onClick={() => setShowCreateStory(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Créer une story
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Dialogs */}
      <CreateEpicDialog
        open={showCreateEpic}
        onOpenChange={setShowCreateEpic}
        projetId={projetId}
      />
      
      <CreateUserStoryDialog
        open={showCreateStory}
        onOpenChange={setShowCreateStory}
        projetId={projetId}
        defaultEpicId={selectedEpicId}
      />
    </div>
  );
}
