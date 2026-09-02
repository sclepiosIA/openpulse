import { memo, useState } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  CheckSquare,
  Square,
  AlertCircle,
  CalendarClock,
  Building2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { PRIORITE_CONFIG, type RDUserStory, type RDEpic } from '@/types/rd';
import { format, isPast, isToday, addDays, isBefore } from 'date-fns';
import { fr } from 'date-fns/locale';
import { StoryDetailDialog } from './StoryDetailDialog';

interface RDKanbanCardProps {
  story: RDUserStory;
  projetId: string;
  epics: RDEpic[];
  isDragging?: boolean;
  onClick?: () => void;
}

const priorityColors = {
  low: 'border-l-muted-foreground/40',
  medium: 'border-l-warning',
  high: 'border-l-orange-500',
  critical: 'border-l-destructive',
};

export const RDKanbanCard = memo(({ story, projetId, epics, isDragging }: RDKanbanCardProps) => {
  const [showDetail, setShowDetail] = useState(false);
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: story.id,
    data: story,
  });

  const style = transform ? {
    transform: CSS.Translate.toString(transform),
  } : undefined;

  const epic = epics.find(e => e.id === story.epic_id);
  const priorityConfig = PRIORITE_CONFIG[story.priorite];
  
  // Calculate task completion
  const tasksTotal = story._count?.tasks || 0;
  const tasksDone = story._count?.done_tasks || 0;

  const handleClick = (e: React.MouseEvent) => {
    // Only open if it's a real click, not end of drag
    if (!transform) {
      setShowDetail(true);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.key === 'Enter' || e.key === ' ') && !transform) {
      e.preventDefault();
      setShowDetail(true);
    }
  };

  return (
    <>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Card
              ref={setNodeRef}
              style={style}
              className={cn(
                "p-3 cursor-grab active:cursor-grabbing transition-all border-l-4 hover:shadow-md hover:ring-2 hover:ring-primary/20",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                priorityColors[story.priorite],
                isDragging && "opacity-50 shadow-lg rotate-2",
                story.statut === 'done' && "opacity-70"
              )}
              {...attributes}
              {...listeners}
              onClick={handleClick}
              onKeyDown={handleKeyDown}
              role="button"
              tabIndex={0}
              aria-label={`Ouvrir la user story : ${story.titre}`}
            >
            {/* Header: Epic Badge (prominent) + Points */}
            <div className="flex items-center justify-between mb-2 gap-2">
              {epic ? (
                <Badge 
                  variant="secondary" 
                  className="text-xs px-2 py-0.5 font-medium truncate max-w-[180px]"
                  style={{ 
                    borderColor: epic.couleur,
                    borderWidth: 2,
                    backgroundColor: `${epic.couleur}20`,
                    color: epic.couleur
                  }}
                >
                  {epic.titre}
                </Badge>
              ) : (
                <Badge variant="outline" className="text-xs px-2 py-0.5 text-muted-foreground">
                  Sans epic
                </Badge>
              )}
              
              {story.points && (
                <Badge variant="secondary" className="text-xs font-bold shrink-0">
                  {story.points} pts
                </Badge>
              )}
            </div>
            
            {/* Title */}
            <h4 className={cn(
              "text-sm font-medium mb-2 line-clamp-2",
              story.statut === 'done' && "line-through text-muted-foreground"
            )}>
              {story.titre}
            </h4>
            
            {/* Description preview */}
            {story.description && (
              <p className="text-xs text-muted-foreground line-clamp-1 mb-2">
                {story.description.replace(/<[^>]*>/g, '')}
              </p>
            )}

            {/* Client assigné */}
            {story.etablissement && (
              <Badge
                variant="outline"
                className="text-[10px] px-1.5 py-0 mb-2 max-w-full truncate gap-1 border-primary/30 bg-primary/5 text-primary"
                title={`Synchronisé avec le portail client : ${story.etablissement.nom}`}
              >
                <Building2 className="h-3 w-3 shrink-0" />
                <span className="truncate">{story.etablissement.nom}</span>
              </Badge>
            )}
            
            {/* Footer: Meta info */}
            <div className="flex items-center justify-between mt-auto">
              <div className="flex items-center gap-2 flex-wrap">
                {/* Date indicator */}
                {story.date_fin && story.statut !== 'done' && (() => {
                  const endDate = new Date(story.date_fin);
                  const isOverdue = isPast(endDate) && !isToday(endDate);
                  const isApproaching = isBefore(endDate, addDays(new Date(), 3)) && !isPast(endDate);
                  
                  return (
                    <div className={cn(
                      "flex items-center gap-1 text-xs",
                      isOverdue && "text-destructive font-medium",
                      isApproaching && !isOverdue && "text-warning font-medium",
                      !isOverdue && !isApproaching && "text-muted-foreground"
                    )}>
                      <CalendarClock className="h-3.5 w-3.5" />
                      <span>{format(endDate, 'dd MMM', { locale: fr })}</span>
                    </div>
                  );
                })()}
                
                {/* Priority indicator */}
                {story.priorite === 'critical' && (
                  <AlertCircle className="h-3.5 w-3.5 text-destructive" />
                )}
                {story.priorite === 'high' && (
                  <AlertCircle className="h-3.5 w-3.5 text-orange-500" />
                )}
                
                {/* Tasks progress */}
                {tasksTotal > 0 && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    {tasksDone === tasksTotal ? (
                      <CheckSquare className="h-3.5 w-3.5 text-success" />
                    ) : (
                      <Square className="h-3.5 w-3.5" />
                    )}
                    <span>{tasksDone}/{tasksTotal}</span>
                  </div>
                )}
                
                {/* Acceptance criteria count */}
                {story.criteres_acceptation && story.criteres_acceptation.length > 0 && (
                  <Badge variant="outline" className="text-[10px] px-1 py-0">
                    {story.criteres_acceptation.length} CA
                  </Badge>
                )}
              </div>
              
              {/* Assignee */}
              {story.responsable && (
                <Avatar className="h-6 w-6">
                  <AvatarFallback className="text-[10px] bg-primary/10">
                    {story.responsable.prenom?.[0]?.toUpperCase()}
                    {story.responsable.nom?.[0]?.toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              )}
            </div>
            </Card>
          </TooltipTrigger>
          <TooltipContent side="right" className="max-w-xs">
            <div className="space-y-2">
              <p className="font-semibold">{story.titre}</p>
              {story.description && (
                <p className="text-xs text-muted-foreground">{story.description.replace(/<[^>]*>/g, '')}</p>
              )}
              <div className="text-xs space-y-1">
                <p>🎯 Priorité: {priorityConfig.label}</p>
                {story.points && <p>📊 Points: {story.points}</p>}
                {story.responsable && (
                  <p>👤 {story.responsable.prenom} {story.responsable.nom}</p>
                )}
                {story.criteres_acceptation && story.criteres_acceptation.length > 0 && (
                  <div>
                    <p className="font-medium mt-1">Critères d'acceptation:</p>
                    <ul className="list-disc list-inside">
                      {story.criteres_acceptation.slice(0, 3).map((c, i) => (
                        <li key={i} className="truncate">{c}</li>
                      ))}
                      {story.criteres_acceptation.length > 3 && (
                        <li>+{story.criteres_acceptation.length - 3} autres...</li>
                      )}
                    </ul>
                  </div>
                )}
              </div>
              <p className="text-[10px] text-muted-foreground italic mt-2">
                Cliquez pour voir les détails
              </p>
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <StoryDetailDialog
        story={story}
        projetId={projetId}
        open={showDetail}
        onOpenChange={setShowDetail}
      />
    </>
  );
});

RDKanbanCard.displayName = 'RDKanbanCard';
