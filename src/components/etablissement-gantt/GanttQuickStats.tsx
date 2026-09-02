import { memo, useMemo } from 'react'
import { Badge } from '@/components/ui/badge'
import { BarChart3, AlertTriangle, Zap, Clock, Users } from 'lucide-react'
import { isBefore, differenceInDays } from 'date-fns'
import { cn } from '@/lib/utils'
import { Task } from '@/types/gantt'

interface GanttQuickStatsProps {
  tasks: Task[]
  onStatClick?: (filterType: string) => void
}

export const GanttQuickStats = memo(({ tasks, onStatClick }: GanttQuickStatsProps) => {
  const stats = useMemo(() => {
    const total = tasks.length
    const completed = tasks.filter((t) => t.statut === 'Terminé').length
    const inProgress = tasks.filter((t) => t.statut === 'En cours').length
    const overdue = tasks.filter(
      (t) => t.statut !== 'Terminé' && t.echeance && isBefore(new Date(t.echeance), new Date())
    ).length

    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0

    // Calculer les jours restants jusqu'à la prochaine deadline
    const upcomingDeadlines = tasks
      .filter((t) => t.statut !== 'Terminé' && t.echeance)
      .map((t) => ({
        ...t,
        daysUntil: differenceInDays(new Date(t.echeance!), new Date()),
      }))
      .filter((t) => t.daysUntil >= 0)
      .sort((a, b) => a.daysUntil - b.daysUntil)

    const daysToNextDeadline = upcomingDeadlines.length > 0 ? upcomingDeadlines[0].daysUntil : null

    // Nombre de personnes assignées
    const uniqueResponsables = new Set(
      tasks.filter((t) => t.responsable_id).map((t) => t.responsable_id)
    )
    const peopleCount = uniqueResponsables.size

    return {
      completionRate,
      overdue,
      inProgress,
      daysToNextDeadline,
      peopleCount,
      total,
    }
  }, [tasks])

  return (
    <div className="flex items-center justify-center gap-3 p-3 bg-card/60 backdrop-blur-sm border border-primary/10 rounded-xl shadow-sm mx-4 flex-wrap">
      {/* Progression */}
      <Badge
        variant="outline"
        className={cn(
          'gap-2 px-3 py-1.5 cursor-pointer hover:bg-card/80 transition-colors rounded-lg bg-card/50 border-primary/10',
          stats.completionRate >= 75 && 'border-success/50 text-success bg-success/10'
        )}
        onClick={() => onStatClick?.('completed')}
      >
        <BarChart3 className="h-4 w-4" />
        <span className="font-semibold">{stats.completionRate}% complété</span>
      </Badge>

      {/* En retard */}
      {stats.overdue > 0 && (
        <Badge
          variant="destructive"
          className="gap-2 px-3 py-1.5 cursor-pointer hover:opacity-80 transition-opacity rounded-lg shadow-sm"
          onClick={() => onStatClick?.('overdue')}
        >
          <AlertTriangle className="h-4 w-4" />
          <span className="font-semibold">{stats.overdue} en retard</span>
        </Badge>
      )}

      {/* En cours */}
      {stats.inProgress > 0 && (
        <Badge
          variant="outline"
          className="gap-2 px-3 py-1.5 cursor-pointer hover:bg-primary/10 transition-colors border-primary/50 text-primary bg-primary/10 rounded-lg"
          onClick={() => onStatClick?.('in_progress')}
        >
          <Zap className="h-4 w-4" />
          <span className="font-semibold">{stats.inProgress} en cours</span>
        </Badge>
      )}

      {/* Prochaine deadline */}
      {stats.daysToNextDeadline !== null && (
        <Badge
          variant="outline"
          className={cn(
            'gap-2 px-3 py-1.5 cursor-pointer hover:bg-card/80 transition-colors rounded-lg bg-card/50 border-primary/10',
            stats.daysToNextDeadline <= 2 && 'border-warning/50 text-warning bg-warning/10'
          )}
          onClick={() => onStatClick?.('upcoming')}
        >
          <Clock className="h-4 w-4" />
          <span className="font-semibold">
            {stats.daysToNextDeadline === 0
              ? "Aujourd'hui"
              : stats.daysToNextDeadline === 1
                ? 'Demain'
                : `${stats.daysToNextDeadline}j restants`}
          </span>
        </Badge>
      )}

      {/* Nombre de personnes */}
      {stats.peopleCount > 0 && (
        <Badge
          variant="outline"
          className="gap-2 px-3 py-1.5 rounded-lg bg-card/50 border-primary/10"
        >
          <Users className="h-4 w-4" />
          <span className="font-semibold">
            {stats.peopleCount} personne{stats.peopleCount > 1 ? 's' : ''}
          </span>
        </Badge>
      )}

      {/* Total de tâches */}
      <span className="text-sm text-muted-foreground ml-2 px-2 py-1 bg-card/30 rounded-md">
        {stats.total} tâche{stats.total > 1 ? 's' : ''} au total
      </span>
    </div>
  )
})

GanttQuickStats.displayName = 'GanttQuickStats'
