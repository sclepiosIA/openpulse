import { useDroppable } from '@dnd-kit/core';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { UserStoryCard } from '@/components/rd/UserStoryCard';
import { cn } from '@/lib/utils';
import type { RDUserStory, RDUserStoryStatut } from '@/types/rd';

interface SprintKanbanColumnProps {
  column: { id: RDUserStoryStatut; label: string; color: string };
  stories: RDUserStory[];
  projetId: string;
}

export function SprintKanbanColumn({ column, stories, projetId }: SprintKanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });
  
  const totalPoints = stories.reduce((sum, s) => sum + (s.points || 0), 0);

  return (
    <Card 
      ref={setNodeRef}
      className={cn(
        "min-h-[400px] transition-colors",
        isOver && "ring-2 ring-primary bg-primary/5"
      )}
    >
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center justify-between">
          <span className="flex items-center gap-2">
            <div className="w-3 h-3 rounded" style={{ backgroundColor: column.color }} />
            {column.label}
          </span>
          <div className="flex items-center gap-1">
            <Badge variant="secondary" className="text-xs">{stories.length}</Badge>
            {totalPoints > 0 && (
              <Badge variant="outline" className="text-xs">{totalPoints} pts</Badge>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {stories.map(story => (
          <UserStoryCard 
            key={story.id} 
            story={story} 
            projetId={projetId}
            sprints={[]}
            compact
          />
        ))}
        {stories.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-4">
            Glissez des stories ici
          </p>
        )}
      </CardContent>
    </Card>
  );
}
