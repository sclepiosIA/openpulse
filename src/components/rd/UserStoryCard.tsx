import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { MoreHorizontal, ArrowRight, User, Building2 } from 'lucide-react';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { cn } from '@/lib/utils';
import type { RDUserStory, RDSprint } from '@/types/rd';
import { PRIORITE_CONFIG } from '@/types/rd';

interface UserStoryCardProps {
  story: RDUserStory;
  projetId: string;
  sprints: RDSprint[];
  onMoveToSprint?: (storyId: string, sprintId: string) => void;
  compact?: boolean;
}

export function UserStoryCard({ story, projetId, sprints, onMoveToSprint, compact }: UserStoryCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: story.id,
  });

  const style = transform ? {
    transform: CSS.Transform.toString(transform),
  } : undefined;

  const priorityConfig = PRIORITE_CONFIG[story.priorite];
  const plannableSprints = sprints.filter(s => s.statut === 'planifie' || s.statut === 'actif');

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={cn(
        "p-3 cursor-grab active:cursor-grabbing transition-shadow",
        isDragging && "opacity-50 shadow-lg",
        compact && "p-2"
      )}
      {...attributes}
      {...listeners}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {story.epic && (
              <div 
                className="w-2 h-2 rounded-full shrink-0" 
                style={{ backgroundColor: story.epic.couleur }} 
              />
            )}
            <span className={cn("font-medium truncate", compact && "text-sm")}>
              {story.titre}
            </span>
          </div>
          
          {!compact && story.description && (
            <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
              {story.description.replace(/<[^>]*>/g, '')}
            </p>
          )}
          
          <div className="flex items-center gap-2 flex-wrap">
            {story.points && (
              <Badge variant="secondary" className="text-xs">
                {story.points} pts
              </Badge>
            )}
            <Badge 
              variant="outline" 
              className="text-xs"
              style={{ borderColor: priorityConfig.color, color: priorityConfig.color }}
            >
              {priorityConfig.label}
            </Badge>
            {story.responsable && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <User className="h-3 w-3" />
                {story.responsable.prenom}
              </span>
            )}
            {story.etablissement && (
              <Badge
                variant="outline"
                className="text-[10px] px-1.5 py-0 gap-1 border-primary/30 bg-primary/5 text-primary max-w-[140px]"
                title={`Client : ${story.etablissement.nom}`}
              >
                <Building2 className="h-3 w-3 shrink-0" />
                <span className="truncate">{story.etablissement.nom}</span>
              </Badge>
            )}
          </div>
        </div>
        
        {!compact && onMoveToSprint && plannableSprints.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" aria-label="Plus d'options">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuSeparator />
              {plannableSprints.map(sprint => (
                <DropdownMenuItem 
                  key={sprint.id}
                  onClick={() => onMoveToSprint(story.id, sprint.id)}
                >
                  <ArrowRight className="h-4 w-4 mr-2" />
                  {sprint.nom}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </Card>
  );
}
