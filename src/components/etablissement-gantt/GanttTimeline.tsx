import { memo } from 'react'
import { format, eachDayOfInterval, isWeekend, getWeek, startOfWeek } from 'date-fns'
import { fr } from 'date-fns/locale'
import { TimelineConfig, ZoomLevel } from './hooks/useGanttZoom'
import { cn } from '@/lib/utils'

interface GanttTimelineProps {
  timeline: TimelineConfig
  zoomLevel: ZoomLevel
  todayPosition: number
  width?: number
}

export const GanttTimeline = memo(({ timeline, zoomLevel, todayPosition, width }: GanttTimelineProps) => {
  // Générer les jours pour la vue détaillée
  const days = zoomLevel === 'day' ? eachDayOfInterval({
    start: timeline.start,
    end: timeline.end
  }) : []

  // Générer les semaines pour afficher les numéros
  const weeks = zoomLevel === 'day' ? (() => {
    const result: { weekNum: number; startIndex: number; span: number }[] = []
    let currentWeek = -1
    let currentStart = 0
    
    days.forEach((day, index) => {
      const weekNum = getWeek(day, { weekStartsOn: 1, locale: fr })
      if (weekNum !== currentWeek) {
        if (currentWeek !== -1) {
          result.push({ weekNum: currentWeek, startIndex: currentStart, span: index - currentStart })
        }
        currentWeek = weekNum
        currentStart = index
      }
    })
    // Ajouter la dernière semaine
    if (currentWeek !== -1) {
      result.push({ weekNum: currentWeek, startIndex: currentStart, span: days.length - currentStart })
    }
    return result
  })() : []

  return (
    <div className="bg-background" style={width ? { width: `${width}px` } : undefined}>
      {/* Header principal (semaines ou mois) */}
      <div className="relative border-b border-border bg-muted/50 h-10">
        {timeline.headerLevels.map((level, index) => {
          const leftPx = width ? (level.left / 100) * width : `${level.left}%`
          const widthPx = width ? (level.width / 100) * width : `${level.width}%`

          return (
            <div
              key={`${level.label}-${index}`}
              className="absolute flex items-center justify-center h-10 text-xs font-medium px-1 border-r border-border/50 whitespace-nowrap overflow-hidden"
              style={{
                left: typeof leftPx === 'number' ? `${leftPx}px` : leftPx,
                width: typeof widthPx === 'number' ? `${widthPx}px` : widthPx,
              }}
            >
              {level.label}
            </div>
          )
        })}
      </div>

      {/* Header secondaire (jours si zoom = day) */}
      {zoomLevel === 'day' && (
        <div className="relative border-b border-border bg-muted/20 h-8">
          {days.map((day, index) => {
            const isWeekendDay = isWeekend(day)
            const isToday = new Date().toDateString() === day.toDateString()
            const dayWidth = (100 / timeline.totalDays)
            const dayLeft = (index / timeline.totalDays) * 100
            
            // Vérifier si c'est le premier jour d'une semaine pour afficher le numéro
            const weekStart = startOfWeek(day, { weekStartsOn: 1 })
            const isWeekStart = day.getTime() === weekStart.getTime()
            const weekNum = getWeek(day, { weekStartsOn: 1, locale: fr })
            
            return (
              <div
                key={day.toISOString()}
                className={cn(
                  "absolute flex flex-col items-center justify-center h-8 text-[10px] border-r border-border/30",
                  isWeekendDay && "bg-muted/30",
                  isToday && "bg-primary/10"
                )}
                style={{ 
                  left: `${dayLeft}%`,
                  width: `${dayWidth}%` 
                }}
              >
                <span className={cn(
                  "font-medium uppercase",
                  isWeekendDay && "text-muted-foreground",
                  isToday && "text-primary font-bold"
                )}>
                  {format(day, 'EEE', { locale: fr }).slice(0, 2)}
                </span>
                <span className={cn(
                  "text-muted-foreground",
                  isToday && "text-primary font-bold"
                )}>
                  {format(day, 'd', { locale: fr })}
                </span>
              </div>
            )
          })}
          
          {/* Indicateurs de numéro de semaine en superposition */}
          {weeks.map((week, index) => {
            const leftPercent = (week.startIndex / timeline.totalDays) * 100
            return (
              <div
                key={`week-${index}`}
                className="absolute top-0 flex items-center justify-start h-8 pointer-events-none"
                style={{ left: `${leftPercent}%` }}
              >
                <span className="text-[9px] font-bold text-primary bg-primary/10 px-1 rounded-sm ml-0.5">
                  S{week.weekNum}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
})

GanttTimeline.displayName = 'GanttTimeline'
