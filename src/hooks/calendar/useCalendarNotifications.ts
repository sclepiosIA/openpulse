import { useMemo } from 'react';
import { parseISO, differenceInDays, isBefore, isToday } from 'date-fns';

export interface Notification {
  id: string;
  type: 'deadline' | 'overdue' | 'assigned' | 'today';
  taskId: string;
  taskTitle: string;
  message: string;
  priority: 'low' | 'medium' | 'high';
  date: Date;
}

export function useCalendarNotifications<T extends {
  id: string;
  titre: string;
  echeance?: string;
  statut?: string;
  priorite?: string;
  responsable_id?: string;
}>(
  tasks: T[],
  currentUserId?: string,
  daysBeforeDeadline: number = 3
): Notification[] {
  return useMemo(() => {
    const notifications: Notification[] = [];
    const now = new Date();

    tasks.forEach(task => {
      // Ignorer les tâches terminées
      if (task.statut === 'terminee') return;

      // Ignorer les tâches non assignées à l'utilisateur courant
      if (currentUserId && task.responsable_id !== currentUserId) return;

      if (task.echeance) {
        const dueDate = parseISO(task.echeance);
        const daysUntil = differenceInDays(dueDate, now);

        // Tâche en retard
        if (isBefore(dueDate, now) && !isToday(dueDate)) {
          notifications.push({
            id: `overdue-${task.id}`,
            type: 'overdue',
            taskId: task.id,
            taskTitle: task.titre,
            message: `Tâche en retard de ${Math.abs(daysUntil)} jour(s)`,
            priority: 'high',
            date: dueDate,
          });
        }
        // Tâche due aujourd'hui
        else if (isToday(dueDate)) {
          notifications.push({
            id: `today-${task.id}`,
            type: 'today',
            taskId: task.id,
            taskTitle: task.titre,
            message: 'Tâche à terminer aujourd\'hui',
            priority: task.priorite === 'high' ? 'high' : 'medium',
            date: dueDate,
          });
        }
        // Tâche approchant de l'échéance
        else if (daysUntil > 0 && daysUntil <= daysBeforeDeadline) {
          notifications.push({
            id: `deadline-${task.id}`,
            type: 'deadline',
            taskId: task.id,
            taskTitle: task.titre,
            message: `Échéance dans ${daysUntil} jour(s)`,
            priority: daysUntil === 1 ? 'high' : 'medium',
            date: dueDate,
          });
        }
      }
    });

    // Trier par priorité puis par date
    return notifications.sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      }
      return a.date.getTime() - b.date.getTime();
    });
  }, [tasks, currentUserId, daysBeforeDeadline]);
}