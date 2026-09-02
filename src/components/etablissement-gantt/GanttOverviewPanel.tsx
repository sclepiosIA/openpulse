import { memo, useMemo } from 'react'
import { Card } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { CheckCircle, Clock, AlertCircle, Circle, TrendingUp } from 'lucide-react'
import { TimelineConfig } from './hooks/useGanttZoom'
import { differenceInDays, format, isBefore } from 'date-fns'
import { fr } from 'date-fns/locale'
import { cn } from '@/lib/utils'

interface GanttOverviewPanelProps {
  tasks: any[]
  timeline: TimelineConfig | null
  onNavigateTo?: (date: Date) => void
  currentViewStart: Date
  currentViewEnd: Date
}

export const GanttOverviewPanel = memo(({ 
  tasks, 
  timeline, 
  onNavigateTo,
  currentViewStart,
  currentViewEnd
}: GanttOverviewPanelProps) => {
  const stats = useMemo(() => {
    const total = tasks.length
    const completed = tasks.filter(t => t.statut === "Terminé").length
    const inProgress = tasks.filter(t => t.statut === "En cours").length
    const blocked = tasks.filter(t => t.statut === "Bloqué").length
    const todo = tasks.filter(t => t.statut === "A faire").length
    const overdue = tasks.filter(t => 
      t.statut !== "Terminé" && 
      t.echeance && 
      isBefore(new Date(t.echeance), new Date())
    ).length
    
    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0
    
    // Calcul de la charge par période (density heatmap)
    const allDates = tasks
      .filter(t => t.echeance || t.created_at)
      .flatMap(t => {
        const dates: Date[] = []
        if (t.created_at) dates.push(new Date(t.created_at))
        if (t.echeance) dates.push(new Date(t.echeance))
        return dates
      })
      .filter(d => !isNaN(d.getTime()))
    
    const minDate = allDates.length > 0 ? new Date(Math.min(...allDates.map(d => d.getTime()))) : new Date()
    const maxDate = allDates.length > 0 ? new Date(Math.max(...allDates.map(d => d.getTime()))) : new Date()
    const totalSpan = differenceInDays(maxDate, minDate) || 1

    // Jalons (milestones) - tâches prioritaires ou deadlines critiques
    const milestones = tasks
      .filter(t => t.priorite === 'high' && t.echeance)
      .slice(0, 3)
      .map(t => ({
        title: t.titre,
        date: new Date(t.echeance),
        type: 'high_priority'
      }))

    return {
      total,
      completed,
      inProgress,
      blocked,
      todo,
      overdue,
      completionRate,
      minDate,
      maxDate,
      totalSpan,
      milestones
    }
  }, [tasks])

  const getMiniMapPosition = (date: Date) => {
    if (!stats.totalSpan) return 0
    const offset = differenceInDays(date, stats.minDate)
    return Math.max(0, Math.min(100, (offset / stats.totalSpan) * 100))
  }

  const currentViewLeftPos = getMiniMapPosition(currentViewStart)
  const currentViewWidth = Math.max(5, getMiniMapPosition(currentViewEnd) - currentViewLeftPos)

  return (
    <Card className="mb-4">
      <div className="p-4 space-y-4">
        {/* Stats header */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          {/* Progression globale */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              <div>
                <p className="text-sm font-semibold">Progression globale</p>
                <p className="text-2xl font-bold">{stats.completionRate}%</p>
              </div>
            </div>
            <Progress value={stats.completionRate} className="w-32 h-3" />
          </div>

          {/* Compteurs par statut */}
          <div className="flex items-center gap-3 flex-wrap">
            <Badge variant="outline" className="gap-1">
              <Circle className="h-3 w-3 text-muted-foreground" />
              <span>{stats.todo} à faire</span>
            </Badge>
            <Badge variant="outline" className="gap-1">
              <Clock className="h-3 w-3 text-primary" />
              <span>{stats.inProgress} en cours</span>
            </Badge>
            <Badge variant="outline" className="gap-1">
              <AlertCircle className="h-3 w-3 text-destructive" />
              <span>{stats.blocked} bloquées</span>
            </Badge>
            <Badge variant="outline" className="gap-1">
              <CheckCircle className="h-3 w-3 text-success" />
              <span>{stats.completed} terminées</span>
            </Badge>
            {stats.overdue > 0 && (
              <Badge variant="destructive">
                {stats.overdue} en retard
              </Badge>
            )}
          </div>
        </div>

        {/* Mini-carte timeline */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{format(stats.minDate, 'dd MMM yyyy', { locale: fr })}</span>
            <span>Vue d'ensemble du planning</span>
            <span>{format(stats.maxDate, 'dd MMM yyyy', { locale: fr })}</span>
          </div>
          
          <div 
            className="relative h-12 bg-muted/30 rounded-md border border-border overflow-hidden cursor-pointer"
            onClick={(e) => {
              if (onNavigateTo) {
                const rect = e.currentTarget.getBoundingClientRect()
                const clickX = e.clientX - rect.left
                const percentage = clickX / rect.width
                const targetDate = new Date(stats.minDate.getTime() + (stats.totalSpan * 24 * 60 * 60 * 1000 * percentage))
                onNavigateTo(targetDate)
              }
            }}
          >
            {/* Density heatmap - zones de charge */}
            {tasks.map((task) => {
              if (!task.echeance) return null
              const taskDate = new Date(task.echeance)
              const pos = getMiniMapPosition(taskDate)
              return (
                <div
                  key={`density-${task.id ?? task.echeance}`}
                  className={cn(
                    "absolute top-0 bottom-0 w-1 opacity-30",
                    task.statut === "Terminé" ? "bg-success" :
                    task.statut === "En cours" ? "bg-primary" :
                    task.statut === "Bloqué" ? "bg-destructive" :
                    "bg-muted-foreground"
                  )}
                  style={{ left: `${pos}%` }}
                />
              )
            })}

            {/* Jalons (milestones) */}
            {stats.milestones.map((milestone, i) => {
              const pos = getMiniMapPosition(milestone.date)
              return (
                <div
                  key={`milestone-${i}`}
                  className="absolute top-0 bottom-0 w-0.5 bg-destructive"
                  style={{ left: `${pos}%` }}
                >
                  <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-3 h-3 bg-destructive border-2 border-background rotate-45" />
                </div>
              )
            })}

            {/* Vue actuelle (rectangle surligné) */}
            <div
              className="absolute top-0 bottom-0 bg-primary/20 border-2 border-primary rounded pointer-events-none"
              style={{
                left: `${currentViewLeftPos}%`,
                width: `${currentViewWidth}%`
              }}
            />

            {/* Ligne aujourd'hui */}
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-destructive pointer-events-none z-10"
              style={{ left: `${getMiniMapPosition(new Date())}%` }}
            >
              <div className="absolute -top-2 left-1/2 -translate-x-1/2 text-xs bg-destructive text-destructive-foreground px-1 rounded whitespace-nowrap">
                ⚡
              </div>
            </div>
          </div>

          {/* Jalons texte */}
          {stats.milestones.length > 0 && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
              <span className="font-medium">Jalons:</span>
              {stats.milestones.map((m) => (
                <span key={`milestone-text-${m.title}-${m.date.getTime()}`} className="flex items-center gap-1">
                  <span className="inline-block w-2 h-2 bg-destructive rotate-45" />
                  {m.title} ({format(m.date, 'dd/MM', { locale: fr })})
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </Card>
  )
})

GanttOverviewPanel.displayName = 'GanttOverviewPanel'
