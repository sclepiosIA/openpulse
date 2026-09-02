import { memo, useMemo, useState } from 'react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { AlertTriangle, AlertCircle, Info, CheckCircle2, X, ChevronDown, ChevronUp } from 'lucide-react'
import { differenceInDays } from 'date-fns'
import { cn } from '@/lib/utils'

interface GanttAlertsProps {
  tasks: any[]
  onTaskClick?: (taskId: string) => void
  defaultCollapsed?: boolean
}

interface Alert {
  id: string
  type: 'critical' | 'warning' | 'info' | 'success'
  title: string
  message: string
  taskIds: string[]
}

export const GanttAlerts = memo(({ tasks, onTaskClick, defaultCollapsed = true }: GanttAlertsProps) => {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed)
  const [dismissedAlerts, setDismissedAlerts] = useState<Set<string>>(new Set())

  const alerts = useMemo((): Alert[] => {
    const alertList: Alert[] = []
    const now = new Date()

    // Alerte critique : tâches en retard de +7 jours
    const criticalOverdue = tasks.filter(t => 
      t.statut !== "Terminé" && 
      t.echeance && 
      differenceInDays(now, new Date(t.echeance)) > 7
    )
    if (criticalOverdue.length > 0) {
      alertList.push({
        id: 'critical_overdue',
        type: 'critical',
        title: 'Tâches critiques en retard',
        message: `${criticalOverdue.length} tâche${criticalOverdue.length > 1 ? 's' : ''} en retard de plus de 7 jours`,
        taskIds: criticalOverdue.map(t => t.id)
      })
    }

    // Alerte attention : tâches bloquées depuis +3 jours
    const blockedTasks = tasks.filter(t => 
      t.statut === "Bloqué" && 
      t.updated_at &&
      differenceInDays(now, new Date(t.updated_at)) > 3
    )
    if (blockedTasks.length > 0) {
      alertList.push({
        id: 'blocked_tasks',
        type: 'warning',
        title: 'Tâches bloquées',
        message: `${blockedTasks.length} tâche${blockedTasks.length > 1 ? 's' : ''} bloquée${blockedTasks.length > 1 ? 's' : ''} depuis plus de 3 jours`,
        taskIds: blockedTasks.map(t => t.id)
      })
    }

    // Alerte info : deadlines dans les 48h
    const upcomingDeadlines = tasks.filter(t => {
      if (t.statut === "Terminé" || !t.echeance) return false
      const daysUntil = differenceInDays(new Date(t.echeance), now)
      return daysUntil >= 0 && daysUntil <= 2
    })
    if (upcomingDeadlines.length > 0) {
      alertList.push({
        id: 'upcoming_deadlines',
        type: 'info',
        title: 'Deadlines imminentes',
        message: `${upcomingDeadlines.length} tâche${upcomingDeadlines.length > 1 ? 's' : ''} à terminer dans les 48h`,
        taskIds: upcomingDeadlines.map(t => t.id)
      })
    }

    // Alerte succès : phase complétée à 100%
    const categoryCompletion = new Map<string, { total: number; completed: number; name: string }>()
    tasks.forEach(t => {
      const catId = t.categorie_id || t.categories_taches?.id
      const catName = t.categories_taches?.nom || 'Sans catégorie'
      if (!catId) return
      
      if (!categoryCompletion.has(catId)) {
        categoryCompletion.set(catId, { total: 0, completed: 0, name: catName })
      }
      const cat = categoryCompletion.get(catId)!
      cat.total++
      if (t.statut === "Terminé") cat.completed++
    })

    categoryCompletion.forEach((cat, catId) => {
      if (cat.total > 0 && cat.completed === cat.total && cat.total >= 3) {
        alertList.push({
          id: `success_${catId}`,
          type: 'success',
          title: 'Phase complétée',
          message: `${cat.name} : toutes les tâches sont terminées (${cat.total}/${cat.total})`,
          taskIds: []
        })
      }
    })

    return alertList
  }, [tasks])

  const visibleAlerts = alerts.filter(a => !dismissedAlerts.has(a.id))

  if (visibleAlerts.length === 0) return null

  const getAlertIcon = (type: Alert['type']) => {
    switch (type) {
      case 'critical': return AlertTriangle
      case 'warning': return AlertCircle
      case 'info': return Info
      case 'success': return CheckCircle2
    }
  }

  const getAlertVariant = (type: Alert['type']): 'destructive' | 'default' => {
    return type === 'critical' || type === 'warning' ? 'destructive' : 'default'
  }

  return (
    <div className="space-y-2 mb-4">
      {/* Header avec toggle */}
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="gap-2"
        >
          {isCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
          <span className="font-semibold">
            Alertes ({visibleAlerts.length})
          </span>
        </Button>
      </div>

      {/* Liste des alertes */}
      {!isCollapsed && (
        <div className="space-y-2">
          {visibleAlerts.map(alert => {
            const Icon = getAlertIcon(alert.type)
            return (
              <Alert 
                key={alert.id} 
                variant={getAlertVariant(alert.type)}
                className={cn(
                  "relative",
                  alert.type === 'success' && "border-success bg-success/10",
                  alert.type === 'info' && "border-primary bg-primary/10"
                )}
              >
                <Icon className="h-4 w-4" />
                <AlertTitle className="flex items-center justify-between">
                  {alert.title}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    onClick={() => setDismissedAlerts(prev => new Set(prev).add(alert.id))}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </AlertTitle>
                <AlertDescription className="flex items-center justify-between">
                  <span>{alert.message}</span>
                  {alert.taskIds.length > 0 && onTaskClick && (
                    <Badge 
                      variant="outline" 
                      className="cursor-pointer hover:bg-background/50"
                      onClick={() => onTaskClick(alert.taskIds[0])}
                    >
                      Voir les tâches
                    </Badge>
                  )}
                </AlertDescription>
              </Alert>
            )
          })}
        </div>
      )}
    </div>
  )
})

GanttAlerts.displayName = 'GanttAlerts'
