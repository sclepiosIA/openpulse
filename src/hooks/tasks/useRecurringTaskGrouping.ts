import { useMemo } from 'react'

// NOTE DEBT-01: les tâches viennent de sources hétérogènes (Supabase, recurrence engine, mocks).
// Garder `any` ici (sinon cascade d'erreurs dans GlobalGanttContainer qui suppose des champs `Task`).
 
export interface GroupedTask {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  parentTask: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  occurrences: any[]
  isRecurring: boolean
}

/**
 * Group task occurrences by their parent recurring task
 * Non-recurring tasks are returned as single-occurrence groups
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function groupRecurringTasks(tasks: any[]): GroupedTask[] {
  const parentMap = new Map<string, GroupedTask>()

  for (const task of tasks) {
    if (task._isRecurrenceOccurrence && task._parentTaskId) {
      const parentId = task._parentTaskId
      if (!parentMap.has(parentId)) {
        parentMap.set(parentId, {
          parentTask: null,
          occurrences: [],
          isRecurring: true,
        })
      }
      parentMap.get(parentId)!.occurrences.push(task)
    } else if (task.recurrence_rule) {
      if (!parentMap.has(task.id)) {
        parentMap.set(task.id, {
          parentTask: task,
          occurrences: [task],
          isRecurring: true,
        })
      } else {
        const group = parentMap.get(task.id)!
        group.parentTask = task
        group.occurrences.unshift(task)
      }
    } else {
      parentMap.set(task.id, {
        parentTask: task,
        occurrences: [task],
        isRecurring: false,
      })
    }
  }

  for (const group of parentMap.values()) {
    group.occurrences.sort((a, b) => {
      const dateA = new Date(a.date_debut || a.created_at).getTime()
      const dateB = new Date(b.date_debut || b.created_at).getTime()
      return dateA - dateB
    })
  }

  return Array.from(parentMap.values()).filter((g) => g.parentTask)
}

/**
 * Hook to group recurring tasks for Gantt display
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function useRecurringTaskGrouping(tasks: any[]): GroupedTask[] {
  return useMemo(() => groupRecurringTasks(tasks), [tasks])
}
