import { memo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { Clock, Building2, Flag, FileText, MessageSquare } from 'lucide-react';
import { format, parseISO, isBefore, differenceInDays } from 'date-fns';
import { fr } from 'date-fns/locale';
import { getPriorityColor, getPriorityLabel, getStatusColor, getStatusLabel } from '@/lib/calendarUtils';
import { AgendaQuickActions } from './AgendaQuickActions';
import { cn } from '@/lib/utils';

interface TaskCardProps {
  task: any;
  onClick?: () => void;
  showDate?: boolean;
  compact?: boolean;
  className?: string;
  showQuickActions?: boolean;
  onMarkDone?: (taskId: string) => void;
  onPostpone?: (taskId: string) => void;
  onArchive?: (taskId: string) => void;
}

function TaskCardComponent({ 
  task, 
  onClick, 
  showDate = false, 
  compact = false, 
  className,
  showQuickActions = false,
  onMarkDone,
  onPostpone,
  onArchive,
}: TaskCardProps) {
  const priorityColor = getPriorityColor(task.priorite || 'low');
  const statusColor = getStatusColor(task.statut || 'en_attente');
  const isCompleted = task.statut === 'terminee';

  // Calcul du retard
  const daysOverdue = task.echeance && !isCompleted && isBefore(new Date(task.echeance), new Date())
    ? differenceInDays(new Date(), new Date(task.echeance))
    : 0;

  // Compteur de documents et commentaires
  const documentsCount = task.documents?.length || 0;
  const commentsCount = task.commentaires?.length || 0;

  // Progression (si disponible)
  const progression = task.progression ?? (isCompleted ? 100 : 0);

  return (
    <Card
      className={cn(
        'group relative cursor-pointer transition-all duration-200',
        'hover:shadow-lg hover:scale-[1.01]',
        compact ? 'p-2' : 'p-4',
        isCompleted && 'opacity-75',
        className
      )}
      onClick={onClick}
      style={{
        borderLeftWidth: '4px',
        borderLeftColor: priorityColor,
      }}
    >
      {/* Quick actions (visible au hover) */}
      {showQuickActions && onMarkDone && onPostpone && onArchive && (
        <AgendaQuickActions
          taskId={task.id}
          isCompleted={isCompleted}
          onMarkDone={onMarkDone}
          onPostpone={onPostpone}
          onArchive={onArchive}
        />
      )}

      <CardContent className={cn('space-y-2', compact ? 'p-0' : 'p-0')}>
        <div className="flex items-start justify-between gap-2">
          <h4 className={cn(
            'font-medium',
            compact ? 'text-sm' : 'text-base',
            isCompleted && 'line-through text-muted-foreground'
          )}>
            {task.titre}
          </h4>
          <Badge
            variant="secondary"
            style={{
              backgroundColor: `${statusColor}20`,
              color: statusColor,
              borderColor: statusColor,
            }}
            className="text-xs shrink-0"
          >
            {getStatusLabel(task.statut || '')}
          </Badge>
        </div>

        {!compact && task.description && (
          <p className="text-sm text-muted-foreground line-clamp-2">
            {task.description}
          </p>
        )}

        {/* Barre de progression */}
        {!compact && progression > 0 && (
          <div className="flex items-center gap-2 text-xs">
            <Progress value={progression} className="h-2 flex-1" />
            <span className="text-muted-foreground shrink-0">{progression}%</span>
          </div>
        )}

        <div className={cn('flex flex-wrap items-center gap-3', compact ? 'text-xs' : 'text-sm')}>
          {showDate && task.echeance && (
            <div className="flex items-center gap-1 text-muted-foreground">
              <Clock className="h-3 w-3" />
              <span>{format(parseISO(task.echeance), 'PPP', { locale: fr })}</span>
            </div>
          )}

          {task.responsable && (
            <div className="flex items-center gap-1">
              <Avatar className="h-5 w-5">
                <AvatarFallback className="text-xs">
                  {task.responsable.prenom?.[0]}{task.responsable.nom?.[0]}
                </AvatarFallback>
              </Avatar>
              <span className="text-muted-foreground">
                {task.responsable.prenom} {task.responsable.nom}
              </span>
            </div>
          )}

          {task.etablissements && (
            <div className="flex items-center gap-1 text-muted-foreground">
              <Building2 className="h-3 w-3" />
              <span className="truncate max-w-[150px]">{task.etablissements.nom}</span>
            </div>
          )}

          {task.categories_taches && (
            <Badge
              variant="outline"
              className="text-xs"
              style={{
                borderColor: task.categories_taches.couleur,
                color: task.categories_taches.couleur,
              }}
            >
              {task.categories_taches.nom}
            </Badge>
          )}

          <div className="flex items-center gap-1 text-muted-foreground">
            <Flag className="h-3 w-3" style={{ color: priorityColor }} />
            <span>{getPriorityLabel(task.priorite || 'low')}</span>
          </div>

          {/* Badges enrichis du Gantt */}
          {documentsCount > 0 && (
            <Badge variant="secondary" className="h-5 px-1.5 gap-1">
              <FileText className="h-3 w-3" />
              {documentsCount}
            </Badge>
          )}
          
          {commentsCount > 0 && (
            <Badge variant="secondary" className="h-5 px-1.5 gap-1">
              <MessageSquare className="h-3 w-3" />
              {commentsCount}
            </Badge>
          )}
          
          {daysOverdue > 0 && (
            <Badge variant="destructive" className="h-5 px-1.5 gap-1 font-semibold">
              <Clock className="h-3 w-3" />
              {daysOverdue}j
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// Memoized export to prevent unnecessary re-renders in lists
export const TaskCard = memo(TaskCardComponent, (prevProps, nextProps) => {
  return (
    prevProps.task.id === nextProps.task.id &&
    prevProps.task.statut === nextProps.task.statut &&
    prevProps.task.titre === nextProps.task.titre &&
    prevProps.task.echeance === nextProps.task.echeance &&
    prevProps.compact === nextProps.compact &&
    prevProps.showDate === nextProps.showDate &&
    prevProps.showQuickActions === nextProps.showQuickActions
  );
});