import { useMemo } from 'react';
import { parseISO, isWithinInterval, addDays, isBefore, format } from 'date-fns';

export interface CalendarStats {
  period: { start: Date; end: Date };
  totalTasks: number;
  completedTasks: number;
  completionRate: number;
  overdueTasks: number;
  upcomingTasks: {
    next7Days: number;
    next30Days: number;
  };
  avgTasksPerDay: number;
  tasksByCategory: Array<{
    categoryId: string;
    categoryName: string;
    count: number;
    percentage: number;
    color: string;
  }>;
  tasksByAssignee: Array<{
    assigneeId: string;
    assigneeName: string;
    count: number;
    workload: 'low' | 'medium' | 'high';
  }>;
  timeDistribution: Array<{
    date: string;
    count: number;
  }>;
}

export function useCalendarStats<T extends {
  echeance?: string;
  date_realisation?: string;
  statut?: string;
  responsable_id?: string;
  categorie_id?: string;
  categories_taches?: { nom: string; couleur: string };
  responsable?: { prenom: string; nom: string };
}>(
  tasks: T[],
  startDate: Date,
  endDate: Date
): CalendarStats {
  return useMemo(() => {
    const now = new Date();
    const next7Days = addDays(now, 7);
    const next30Days = addDays(now, 30);

    // Filtrer les tâches dans la période
    const tasksInPeriod = tasks.filter(task => {
      if (!task.echeance) return false;
      const taskDate = parseISO(task.echeance);
      return isWithinInterval(taskDate, { start: startDate, end: endDate });
    });

    // Total et tâches terminées
    const totalTasks = tasksInPeriod.length;
    const completedTasks = tasksInPeriod.filter(t => t.statut === 'terminee').length;
    const completionRate = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

    // Tâches en retard
    const overdueTasks = tasks.filter(task => {
      if (!task.echeance || task.statut === 'terminee') return false;
      return isBefore(parseISO(task.echeance), now);
    }).length;

    // Tâches à venir
    const upcomingNext7 = tasks.filter(task => {
      if (!task.echeance || task.statut === 'terminee') return false;
      const taskDate = parseISO(task.echeance);
      return isWithinInterval(taskDate, { start: now, end: next7Days });
    }).length;

    const upcomingNext30 = tasks.filter(task => {
      if (!task.echeance || task.statut === 'terminee') return false;
      const taskDate = parseISO(task.echeance);
      return isWithinInterval(taskDate, { start: now, end: next30Days });
    }).length;

    // Moyenne de tâches par jour
    const daysDiff = Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));
    const avgTasksPerDay = totalTasks / daysDiff;

    // Répartition par catégorie
    const categoryMap = new Map<string, { name: string; count: number; color: string }>();
    tasksInPeriod.forEach(task => {
      if (task.categorie_id) {
        const existing = categoryMap.get(task.categorie_id);
        if (existing) {
          existing.count++;
        } else {
          categoryMap.set(task.categorie_id, {
            name: task.categories_taches?.nom || 'Sans catégorie',
            count: 1,
            color: task.categories_taches?.couleur || 'hsl(var(--muted))',
          });
        }
      }
    });

    const tasksByCategory = Array.from(categoryMap.entries()).map(([id, data]) => ({
      categoryId: id,
      categoryName: data.name,
      count: data.count,
      percentage: (data.count / totalTasks) * 100,
      color: data.color,
    })).sort((a, b) => b.count - a.count);

    // Répartition par responsable
    const assigneeMap = new Map<string, { name: string; count: number }>();
    tasksInPeriod.forEach(task => {
      if (task.responsable_id && task.responsable) {
        const existing = assigneeMap.get(task.responsable_id);
        const name = `${task.responsable.prenom} ${task.responsable.nom}`;
        if (existing) {
          existing.count++;
        } else {
          assigneeMap.set(task.responsable_id, { name, count: 1 });
        }
      }
    });

    const tasksByAssignee = Array.from(assigneeMap.entries()).map(([id, data]) => ({
      assigneeId: id,
      assigneeName: data.name,
      count: data.count,
      workload: data.count <= 3 ? 'low' as const : data.count <= 6 ? 'medium' as const : 'high' as const,
    })).sort((a, b) => b.count - a.count);

    // Distribution temporelle
    const dateMap = new Map<string, number>();
    tasksInPeriod.forEach(task => {
      if (task.echeance) {
        const dateKey = format(parseISO(task.echeance), 'yyyy-MM-dd');
        dateMap.set(dateKey, (dateMap.get(dateKey) || 0) + 1);
      }
    });

    const timeDistribution = Array.from(dateMap.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return {
      period: { start: startDate, end: endDate },
      totalTasks,
      completedTasks,
      completionRate,
      overdueTasks,
      upcomingTasks: {
        next7Days: upcomingNext7,
        next30Days: upcomingNext30,
      },
      avgTasksPerDay,
      tasksByCategory,
      tasksByAssignee,
      timeDistribution,
    };
  }, [tasks, startDate, endDate]);
}