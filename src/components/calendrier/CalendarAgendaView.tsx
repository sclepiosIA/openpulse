import { useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { CalendarCheck, List, Grid3x3, Plus } from 'lucide-react';
import { AgendaTimelineSection } from './AgendaTimelineSection';
import { AgendaQuickFilters } from './AgendaQuickFilters';
import { getSmartTaskGroups } from '@/lib/agendaUtils';
import { isBefore, parseISO, addDays, format } from 'date-fns';
import { useToast } from '@/hooks/shared/use-toast';
import { useUpdateTache, useArchiveTache } from '@/hooks/tasks/useTaches';
import { Task } from '@/types/gantt';
import { TASK_STATUSES } from '@/constants/taskStatuses';

interface CalendarAgendaViewProps {
  tasks: Task[];
  onTaskClick: (task: Task) => void;
  currentUserId?: string;
  onCreateTask?: () => void;
}

export function CalendarAgendaView({ 
  tasks, 
  onTaskClick,
  currentUserId,
  onCreateTask,
}: CalendarAgendaViewProps) {
  const { toast } = useToast();
  const updateTache = useUpdateTache();
  const archiveTache = useArchiveTache();
  const [viewMode, setViewMode] = useState<'compact' | 'detailed'>('detailed');
  const [showOnlyOverdue, setShowOnlyOverdue] = useState(false);
  const [showOnlyHighPriority, setShowOnlyHighPriority] = useState(false);
  const [showOnlyMyTasks, setShowOnlyMyTasks] = useState(false);

  // Appliquer les filtres rapides
  const filteredTasks = useMemo(() => {
    let filtered = tasks;

    if (showOnlyOverdue) {
      filtered = filtered.filter(
        t => t.echeance && isBefore(parseISO(t.echeance), new Date()) && t.statut !== 'Terminé'
      );
    }

    if (showOnlyHighPriority) {
      filtered = filtered.filter(t => t.priorite === 'high');
    }

    if (showOnlyMyTasks && currentUserId) {
      filtered = filtered.filter(t => t.responsable_id === currentUserId);
    }

    return filtered;
  }, [tasks, showOnlyOverdue, showOnlyHighPriority, showOnlyMyTasks, currentUserId]);

  // Grouper les tâches de manière intelligente
  const taskGroups = useMemo(() => {
    return getSmartTaskGroups(filteredTasks);
  }, [filteredTasks]);

  // Compter pour les filtres rapides
  const overdueCount = useMemo(() => 
    tasks.filter(t => 
      t.echeance && isBefore(parseISO(t.echeance), new Date()) && t.statut !== 'Terminé'
    ).length,
    [tasks]
  );

  const highPriorityCount = useMemo(() => 
    tasks.filter(t => t.priorite === 'high').length,
    [tasks]
  );

  const myTasksCount = useMemo(() => 
    currentUserId ? tasks.filter(t => t.responsable_id === currentUserId).length : 0,
    [tasks, currentUserId]
  );

  // Actions rapides avec vraies mutations
  const handleMarkDone = async (taskId: string) => {
    try {
      await updateTache.mutateAsync({
        id: taskId,
        data: {
          statut: TASK_STATUSES.DONE,
        }
      });
      toast({
        title: 'Tâche terminée',
        description: 'La tâche a été marquée comme terminée.',
      });
    } catch (error) {
      toast({
        title: 'Erreur',
        description: 'Impossible de terminer la tâche.',
        variant: 'destructive',
      });
    }
  };

  const handlePostpone = async (taskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    const currentDate = task?.echeance ? parseISO(task.echeance) : new Date();
    const newDate = addDays(currentDate, 1);
    
    try {
      await updateTache.mutateAsync({
        id: taskId,
        data: {
          echeance: format(newDate, 'yyyy-MM-dd'),
        }
      });
      toast({
        title: 'Tâche reportée',
        description: `Nouvelle échéance : ${format(newDate, 'dd/MM/yyyy')}`,
      });
    } catch (error) {
      toast({
        title: 'Erreur',
        description: 'Impossible de reporter la tâche.',
        variant: 'destructive',
      });
    }
  };

  const handleArchive = async (taskId: string) => {
    try {
      await archiveTache.mutateAsync({ id: taskId, archive: true });
      toast({
        title: 'Tâche archivée',
        description: 'La tâche a été archivée avec succès.',
      });
    } catch (error) {
      toast({
        title: 'Erreur',
        description: 'Impossible d\'archiver la tâche.',
        variant: 'destructive',
      });
    }
  };

  const handleResetFilters = () => {
    setShowOnlyOverdue(false);
    setShowOnlyHighPriority(false);
    setShowOnlyMyTasks(false);
  };

  // Empty state
  if (tasks.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16 space-y-4">
          <CalendarCheck className="h-24 w-24 text-muted-foreground/50" />
          <div className="text-center space-y-2">
            <h3 className="text-xl font-semibold">Vous êtes à jour ! 🎉</h3>
            <p className="text-sm text-muted-foreground max-w-md">
              Aucune tâche planifiée pour le moment. Créez une nouvelle tâche pour commencer.
            </p>
          </div>
          {onCreateTask && (
            <Button onClick={onCreateTask} className="gap-2">
              <Plus className="h-4 w-4" />
              Créer une tâche
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  // Empty state après filtrage
  if (filteredTasks.length === 0) {
    return (
      <div className="space-y-4">
        <AgendaQuickFilters
          overdueCount={overdueCount}
          highPriorityCount={highPriorityCount}
          myTasksCount={myTasksCount}
          showOnlyOverdue={showOnlyOverdue}
          showOnlyHighPriority={showOnlyHighPriority}
          showOnlyMyTasks={showOnlyMyTasks}
          onToggleOverdue={() => setShowOnlyOverdue(!showOnlyOverdue)}
          onToggleHighPriority={() => setShowOnlyHighPriority(!showOnlyHighPriority)}
          onToggleMyTasks={() => setShowOnlyMyTasks(!showOnlyMyTasks)}
          onResetFilters={handleResetFilters}
        />

        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 space-y-4">
            <CalendarCheck className="h-16 w-16 text-muted-foreground/50" />
            <div className="text-center space-y-2">
              <h3 className="text-lg font-semibold">Aucune tâche trouvée</h3>
              <p className="text-sm text-muted-foreground">
                Aucune tâche ne correspond à vos filtres actuels.
              </p>
            </div>
            <Button variant="outline" onClick={handleResetFilters}>
              Réinitialiser les filtres
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header avec contrôles */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Agenda</h2>
          <p className="text-sm text-muted-foreground">
            {filteredTasks.length} tâche{filteredTasks.length > 1 ? 's' : ''} planifiée{filteredTasks.length > 1 ? 's' : ''}
          </p>
        </div>

        <ToggleGroup
          type="single"
          value={viewMode}
          onValueChange={(value) => value && setViewMode(value as 'compact' | 'detailed')}
          className="border rounded-lg p-1"
        >
          <ToggleGroupItem value="compact" className="gap-2">
            <List className="h-4 w-4" />
            <span className="hidden sm:inline">Compact</span>
          </ToggleGroupItem>
          <ToggleGroupItem value="detailed" className="gap-2">
            <Grid3x3 className="h-4 w-4" />
            <span className="hidden sm:inline">Détaillé</span>
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      {/* Filtres rapides */}
      <AgendaQuickFilters
        overdueCount={overdueCount}
        highPriorityCount={highPriorityCount}
        myTasksCount={myTasksCount}
        showOnlyOverdue={showOnlyOverdue}
        showOnlyHighPriority={showOnlyHighPriority}
        showOnlyMyTasks={showOnlyMyTasks}
        onToggleOverdue={() => setShowOnlyOverdue(!showOnlyOverdue)}
        onToggleHighPriority={() => setShowOnlyHighPriority(!showOnlyHighPriority)}
        onToggleMyTasks={() => setShowOnlyMyTasks(!showOnlyMyTasks)}
        onResetFilters={handleResetFilters}
      />

      {/* Timeline avec groupes */}
      <div className="space-y-6 relative">
        {/* Timeline line globale */}
        <div className="absolute left-2 top-0 bottom-0 w-0.5 bg-border" />

        {taskGroups.map((group) => (
          <AgendaTimelineSection
            key={group.id}
            group={group}
            onTaskClick={onTaskClick}
            viewMode={viewMode}
            onMarkDone={handleMarkDone}
            onPostpone={handlePostpone}
            onArchive={handleArchive}
          />
        ))}
      </div>
    </div>
  );
}
