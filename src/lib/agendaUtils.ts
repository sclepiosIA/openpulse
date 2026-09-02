import { parseISO, isToday, isWithinInterval, addDays, isBefore, startOfDay, differenceInDays } from 'date-fns';

export interface AgendaTaskLike {
  id?: string;
  echeance?: string | null;
  statut?: string | null;
  responsable_id?: string | null;
}

export type TaskGroup = {
  id: string;
  title: string;
  emoji: string;
  tasks: AgendaTaskLike[];
  priority: number;
  defaultOpen: boolean;
  color: string;
};

/**
 * Groupe les tâches de manière intelligente par périodes contextuelles
 */
export function getSmartTaskGroups<T extends AgendaTaskLike>(tasks: T[]): TaskGroup[] {
  const now = new Date();
  const today = startOfDay(now);
  const weekEnd = addDays(today, 7);
  const nextWeekEnd = addDays(today, 14);

  // Filtrer et trier les tâches par date
  const tasksWithDates = tasks
    .filter(t => t.echeance)
    .map(t => ({
      ...t,
      echeanceDate: parseISO(t.echeance!)
    }))
    .sort((a, b) => a.echeanceDate.getTime() - b.echeanceDate.getTime());

  // Groupement intelligent
  const overdueTasks = tasksWithDates.filter(
    t => isBefore(t.echeanceDate, today) && t.statut !== 'terminee'
  );

  const todayTasks = tasksWithDates.filter(
    t => isToday(t.echeanceDate)
  );

  const thisWeekTasks = tasksWithDates.filter(
    t => isWithinInterval(t.echeanceDate, { start: addDays(today, 1), end: weekEnd }) 
  );

  const nextWeekTasks = tasksWithDates.filter(
    t => isWithinInterval(t.echeanceDate, { start: addDays(weekEnd, 1), end: nextWeekEnd })
  );

  const laterTasks = tasksWithDates.filter(
    t => t.echeanceDate > nextWeekEnd
  );

  const groups: TaskGroup[] = [];

  if (overdueTasks.length > 0) {
    groups.push({
      id: 'overdue',
      title: 'En retard',
      emoji: '🔴',
      tasks: overdueTasks,
      priority: 1,
      defaultOpen: true,
      color: 'hsl(var(--destructive))'
    });
  }

  if (todayTasks.length > 0) {
    groups.push({
      id: 'today',
      title: "Aujourd'hui",
      emoji: '🟢',
      tasks: todayTasks,
      priority: 2,
      defaultOpen: true,
      color: 'hsl(var(--success))'
    });
  }

  if (thisWeekTasks.length > 0) {
    groups.push({
      id: 'thisWeek',
      title: 'Cette semaine',
      emoji: '🔵',
      tasks: thisWeekTasks,
      priority: 3,
      defaultOpen: false,
      color: 'hsl(var(--primary))'
    });
  }

  if (nextWeekTasks.length > 0) {
    groups.push({
      id: 'nextWeek',
      title: 'Semaine prochaine',
      emoji: '🟡',
      tasks: nextWeekTasks,
      priority: 4,
      defaultOpen: false,
      color: 'hsl(var(--warning))'
    });
  }

  if (laterTasks.length > 0) {
    groups.push({
      id: 'later',
      title: 'Plus tard',
      emoji: '⚪',
      tasks: laterTasks,
      priority: 5,
      defaultOpen: false,
      color: 'hsl(var(--muted-foreground))'
    });
  }

  return groups;
}

/**
 * Calcule les statistiques d'un groupe de tâches
 */
export function getGroupStats<T extends AgendaTaskLike>(tasks: T[]) {
  const total = tasks.length;
  const completed = tasks.filter(t => t.statut === 'terminee').length;
  const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;
  
  // Calcul du retard moyen pour les tâches en retard
  const now = new Date();
  const overdueTasks = tasks.filter(
    t => t.echeance && isBefore(parseISO(t.echeance), now) && t.statut !== 'terminee'
  );
  
  const avgDelay = overdueTasks.length > 0
    ? Math.round(
        overdueTasks.reduce((sum, t) => 
          sum + differenceInDays(now, parseISO(t.echeance!)), 0
        ) / overdueTasks.length
      )
    : 0;

  // Nombre de responsables uniques
  const assignees = new Set(tasks.filter(t => t.responsable_id).map(t => t.responsable_id));

  return {
    total,
    completed,
    completionRate,
    avgDelay,
    assigneeCount: assignees.size,
  };
}

/**
 * Obtient l'icône et le style pour une priorité de tâche
 */
export function getPriorityStyle(priority: string): { icon: string; className: string } {
  switch (priority) {
    case 'high':
      return { icon: '⚠️', className: 'text-destructive' };
    case 'medium':
      return { icon: '📊', className: 'text-warning' };
    case 'low':
      return { icon: '📝', className: 'text-muted-foreground' };
    default:
      return { icon: '📋', className: 'text-muted-foreground' };
  }
}
