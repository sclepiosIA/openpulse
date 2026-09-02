import { differenceInDays, isBefore } from 'date-fns'
import { groupRecurringTasks } from '@/hooks/tasks/useRecurringTaskGrouping'

type SortField = 'date_debut' | 'echeance' | 'titre' | 'priorite' | 'statut' | 'responsable'
type SortDirection = 'asc' | 'desc'
type GroupByOption = 'etablissement' | 'categorie' | 'responsable' | 'statut'

export interface GanttStats {
  total: number
  completed: number
  inProgress: number
  blocked: number
  overdue: number
  completionRate: number
  nextDeadline: any
}

export interface GanttAlert {
  id: string
  type: 'critical' | 'warning' | 'info'
  message: string
  taskId?: string
}

export function computeGanttStats(filteredTasks: any[]): GanttStats {
  const total = filteredTasks.length
  const completed = filteredTasks.filter((t) => t.statut === 'Terminé').length
  const inProgress = filteredTasks.filter((t) => t.statut === 'En cours').length
  const blocked = filteredTasks.filter((t) => t.statut === 'Bloqué').length
  const overdue = filteredTasks.filter(
    (t) => t.statut !== 'Terminé' && t.echeance && isBefore(new Date(t.echeance), new Date())
  ).length
  const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0

  const upcomingDeadlines = filteredTasks
    .filter((t) => t.statut !== 'Terminé' && t.echeance)
    .map((t) => ({ ...t, daysUntil: differenceInDays(new Date(t.echeance), new Date()) }))
    .filter((t) => t.daysUntil >= 0)
    .sort((a, b) => a.daysUntil - b.daysUntil)

  return { total, completed, inProgress, blocked, overdue, completionRate, nextDeadline: upcomingDeadlines[0] }
}

export function computeGanttAlerts(filteredTasks: any[]): GanttAlert[] {
  const result: GanttAlert[] = []

  const veryOverdue = filteredTasks.filter((t) => {
    if (t.statut === 'Terminé' || !t.echeance) return false
    return differenceInDays(new Date(), new Date(t.echeance)) > 7
  })
  if (veryOverdue.length > 0) {
    result.push({ id: 'critical-overdue', type: 'critical', message: `${veryOverdue.length} tâche(s) en retard critique (>7j)` })
  }

  const blockedTasks = filteredTasks.filter((t) => t.statut === 'Bloqué')
  if (blockedTasks.length > 0) {
    result.push({ id: 'blocked', type: 'warning', message: `${blockedTasks.length} tâche(s) bloquée(s)` })
  }

  const urgentDeadlines = filteredTasks.filter((t) => {
    if (t.statut === 'Terminé' || !t.echeance) return false
    const days = differenceInDays(new Date(t.echeance), new Date())
    return days >= 0 && days <= 2
  })
  if (urgentDeadlines.length > 0) {
    result.push({ id: 'urgent', type: 'info', message: `${urgentDeadlines.length} deadline(s) dans 48h` })
  }

  return result
}

export function sortTasks(tasks: any[], sortField: SortField, sortDirection: SortDirection): any[] {
  return [...tasks].sort((a, b) => {
    let comparison = 0
    switch (sortField) {
      case 'date_debut': {
        const dA = a.date_debut ? new Date(a.date_debut).getTime() : Number.MAX_SAFE_INTEGER
        const dB = b.date_debut ? new Date(b.date_debut).getTime() : Number.MAX_SAFE_INTEGER
        comparison = dA - dB
        break
      }
      case 'echeance': {
        const eA = a.echeance ? new Date(a.echeance).getTime() : Number.MAX_SAFE_INTEGER
        const eB = b.echeance ? new Date(b.echeance).getTime() : Number.MAX_SAFE_INTEGER
        comparison = eA - eB
        break
      }
      case 'titre':
        comparison = (a.titre || '').localeCompare(b.titre || '', 'fr')
        break
      case 'priorite': {
        const order: Record<string, number> = { high: 0, medium: 1, low: 2 }
        comparison = (order[a.priorite] ?? 1) - (order[b.priorite] ?? 1)
        break
      }
      case 'statut': {
        const order: Record<string, number> = { 'Bloqué': 0, 'En cours': 1, 'A faire': 2, 'Terminé': 3 }
        comparison = (order[a.statut] ?? 2) - (order[b.statut] ?? 2)
        break
      }
      case 'responsable': {
        const rA = a.profiles?.nom || a.profiles?.prenom || ''
        const rB = b.profiles?.nom || b.profiles?.prenom || ''
        comparison = rA.localeCompare(rB, 'fr')
        break
      }
    }
    return sortDirection === 'desc' ? -comparison : comparison
  })
}

interface BuildParams {
  filteredTasks: any[]
  groupBy: GroupByOption
  etablissements: any[] | undefined
  categories: any[] | undefined
  profiles: any[] | undefined
  sortField: SortField
  sortDirection: SortDirection
}

export interface GanttGroup {
  id: string
  nom: string
  couleur: string
  tasks: any[]
  groupedTasks: any[]
}

export function buildGroupedTasks({
  filteredTasks, groupBy, etablissements, categories, profiles, sortField, sortDirection,
}: BuildParams): GanttGroup[] {
  if (!filteredTasks) return []
  const sort = (t: any[]) => sortTasks(t, sortField, sortDirection)

  switch (groupBy) {
    case 'etablissement':
      return etablissements?.map(etab => {
        const etabTasks = sort(filteredTasks.filter((t) => t.etablissement_id === etab.id))
        return { id: etab.id, nom: etab.nom, couleur: '#3b82f6', tasks: etabTasks, groupedTasks: groupRecurringTasks(etabTasks) }
      }).filter(g => g.tasks.length > 0) || []

    case 'categorie':
      return categories?.map(cat => {
        const catTasks = sort(filteredTasks.filter((t) => (t.categorie_id || t.categories_taches?.id) === cat.id))
        return { id: cat.id, nom: cat.nom, couleur: cat.couleur || '#888', tasks: catTasks, groupedTasks: groupRecurringTasks(catTasks) }
      }).filter(g => g.tasks.length > 0) || []

    case 'responsable': {
      const responsables = profiles?.filter((p) => filteredTasks.some((t) => t.responsable_id === p.id)) || []
      return responsables.map(resp => {
        const respTasks = sort(filteredTasks.filter((t) => t.responsable_id === resp.id))
        return {
          id: resp.id,
          nom: `${resp.prenom || ''} ${resp.nom || ''}`.trim() || resp.email || 'Sans nom',
          couleur: '#8b5cf6',
          tasks: respTasks,
          groupedTasks: groupRecurringTasks(respTasks),
        }
      })
    }

    case 'statut': {
      const statuts = ['A faire', 'En cours', 'Bloqué', 'Terminé']
      return statuts.map(statut => {
        const statusTasks = sort(filteredTasks.filter((t) => t.statut === statut))
        return {
          id: statut,
          nom: statut,
          couleur: statut === 'Terminé' ? '#10b981'
            : statut === 'En cours' ? '#3b82f6'
            : statut === 'Bloqué' ? '#ef4444' : '#6b7280',
          tasks: statusTasks,
          groupedTasks: groupRecurringTasks(statusTasks),
        }
      }).filter(g => g.tasks.length > 0)
    }

    default:
      return []
  }
}
