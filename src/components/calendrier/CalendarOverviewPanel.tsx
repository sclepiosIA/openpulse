import { memo, useMemo } from 'react'
import { Card } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { CheckCircle, Clock, AlertCircle, Circle, TrendingUp } from 'lucide-react'
import { differenceInDays, format, isBefore } from 'date-fns'
import { fr } from 'date-fns/locale'
interface CalendarOverviewPanelProps {
  tasks: any[]
  currentView: 'day' | 'week' | 'month' | 'agenda' | 'timeline' | 'events-month' | 'events-week'
  currentDate: Date
  onNavigateTo?: (date: Date) => void
}

export const CalendarOverviewPanel = memo(({ 
  tasks, 
  currentView,
  currentDate,
  onNavigateTo
}: CalendarOverviewPanelProps) => {
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
    
    // Calcul de la plage temporelle
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

    // Jalons (milestones) - tâches prioritaires haute priorité
    const milestones = tasks
      .filter(t => t.priorite === 'high' && t.echeance)
      .slice(0, 3)
      .map(t => ({
        title: t.titre,
        date: new Date(t.echeance),
        type: 'high_priority'
      }))

    // Calcul de la densité par jour pour heatmap
    const densityByDay = new Map<string, number>()
    tasks.forEach(task => {
      if (task.echeance) {
        const dateKey = format(new Date(task.echeance), 'yyyy-MM-dd')
        densityByDay.set(dateKey, (densityByDay.get(dateKey) || 0) + 1)
      }
    })

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
      milestones,
      densityByDay
    }
  }, [tasks])

  const getMiniMapPosition = (date: Date) => {
    if (!stats.totalSpan) return 0
    const offset = differenceInDays(date, stats.minDate)
    return Math.max(0, Math.min(100, (offset / stats.totalSpan) * 100))
  }

  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!onNavigateTo) return
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const percentage = x / rect.width
    const dayOffset = Math.round(percentage * stats.totalSpan)
    const targetDate = new Date(stats.minDate)
    targetDate.setDate(targetDate.getDate() + dayOffset)
    onNavigateTo(targetDate)
  }

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

        {/* Mini-timeline */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>{format(stats.minDate, 'dd MMM yyyy', { locale: fr })}</span>
            <span className="font-medium">Vue d'ensemble du planning ({stats.total} tâches)</span>
            <span>{format(stats.maxDate, 'dd MMM yyyy', { locale: fr })}</span>
          </div>

          {/* Barre de timeline interactive */}
          <div 
            className="relative h-16 bg-muted/30 rounded-lg border border-border cursor-pointer hover:border-primary/50 transition-colors overflow-hidden"
            onClick={handleTimelineClick}
            title="Cliquer pour naviguer vers une date"
          >
            {/* Heatmap de densité */}
            {Array.from(stats.densityByDay.entries()).map(([dateKey, count]) => {
              const date = new Date(dateKey)
              const pos = getMiniMapPosition(date)
              const intensity = Math.min(count / 5, 1)
              const color = `hsl(var(--primary) / ${intensity * 0.5})`
              
              return (
                <div
                  key={dateKey}
                  className="absolute top-0 bottom-0"
                  style={{
                    left: `${pos}%`,
                    width: '2px',
                    backgroundColor: color,
                  }}
                />
              )
            })}

            {/* Jalons */}
            {stats.milestones.map((milestone, idx) => {
              const pos = getMiniMapPosition(milestone.date)
              return (
                <div
                  key={idx}
                  className="absolute top-1/2 -translate-y-1/2 z-10"
                  style={{ left: `${pos}%` }}
                  title={`${milestone.title} - ${format(milestone.date, 'dd MMM yyyy', { locale: fr })}`}
                >
                  <div className="relative">
                    <div className="w-3 h-3 bg-destructive rounded-full border-2 border-background shadow-lg" />
                    <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 text-[10px] font-medium whitespace-nowrap">
                      {format(milestone.date, 'dd/MM', { locale: fr })}
                    </div>
                  </div>
                </div>
              )
            })}

            {/* Marqueur aujourd'hui */}
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-primary z-20"
              style={{ left: `${getMiniMapPosition(new Date())}%` }}
            >
              <div className="absolute -top-1 left-1/2 -translate-x-1/2">
                <div className="w-2 h-2 bg-primary rounded-full" />
              </div>
              <div className="absolute -bottom-1 left-1/2 -translate-x-1/2">
                <div className="w-2 h-2 bg-primary rounded-full" />
              </div>
            </div>
          </div>

          {/* Légende des jalons */}
          {stats.milestones.length > 0 && (
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span className="font-medium">Jalons haute priorité :</span>
              {stats.milestones.map((milestone, idx) => (
                <div key={idx} className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-destructive rounded-full" />
                  <span className="truncate max-w-[150px]" title={milestone.title}>
                    {milestone.title}
                  </span>
                  <span className="text-muted-foreground/70">
                    ({format(milestone.date, 'dd MMM', { locale: fr })})
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Card>
  )
})

CalendarOverviewPanel.displayName = 'CalendarOverviewPanel'
