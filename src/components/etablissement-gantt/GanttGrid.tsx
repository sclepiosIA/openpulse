import { memo } from 'react'
import { eachDayOfInterval, eachWeekOfInterval, eachMonthOfInterval, isWeekend, startOfMonth, endOfMonth, differenceInCalendarDays } from 'date-fns'
import { TimelineConfig, ZoomLevel } from './hooks/useGanttZoom'
import { cn } from '@/lib/utils'

interface GanttGridProps {
  timeline: TimelineConfig
  zoomLevel: ZoomLevel
  height: number
}

export const GanttGrid = memo(({ timeline, zoomLevel, height }: GanttGridProps) => {
  // Générer les lignes verticales selon le zoom
  let gridLines: Array<{ date: Date; isWeekend?: boolean; isSubdivision?: boolean; positionDays?: number }> = []

  if (zoomLevel === 'day') {
    // Vue jour : une ligne par jour
    gridLines = eachDayOfInterval({ start: timeline.start, end: timeline.end }).map(date => ({
      date,
      isWeekend: isWeekend(date)
    }))
  } else if (zoomLevel === 'month') {
    // Vue mois : 1 colonne par mois avec 4 sous-colonnes égales
    const months = eachMonthOfInterval({ start: timeline.start, end: timeline.end })
    
    months.forEach(monthDate => {
      const monthStart = startOfMonth(monthDate)
      const monthEnd = endOfMonth(monthDate)
      const monthDurationDays = differenceInCalendarDays(monthEnd, monthStart)
      const monthStartOffsetDays = differenceInCalendarDays(monthStart, timeline.start)

      // Ligne de début de mois (bordure principale)
      gridLines.push({
        date: monthStart,
        isSubdivision: false
      })

      // 3 lignes de subdivision (pour créer 4 colonnes égales)
      for (let k = 1; k <= 3; k++) {
        const subOffsetInMonthDays = (monthDurationDays * k) / 4
        const subOffsetDays = monthStartOffsetDays + subOffsetInMonthDays
        const subDate = new Date(monthStart)
        subDate.setDate(subDate.getDate() + Math.floor(subOffsetInMonthDays))
        gridLines.push({
          date: subDate,
          isSubdivision: true,
          positionDays: Math.floor(subOffsetDays),
        })
      }
    })
  } else {
    // Vue semaine/trimestre/année : une ligne par semaine
    gridLines = eachWeekOfInterval({ start: timeline.start, end: timeline.end }, { weekStartsOn: 1 }).map(date => ({
      date
    }))
  }

  return (
    <div className="absolute inset-0 pointer-events-none">
      {/* Lignes verticales */}
      {gridLines.map((item, index) => {
        const isWeekendDay = item.isWeekend
        const isSubdivision = item.isSubdivision
        const daysFromStart = item.positionDays ?? differenceInCalendarDays(item.date, timeline.start)
        const position = daysFromStart * timeline.pixelsPerDay
        const width = timeline.pixelsPerDay

        return (
          <div key={`gridline-${item.date.getTime()}-${index}`}>
            {/* Zone de weekend (uniquement en vue jour) - plus subtil */}
            {isWeekendDay && (
              <div
                className="absolute top-0 bg-muted/10"
                style={{
                  left: `${position}px`,
                  width: `${width}px`,
                  height: `${height}px`
                }}
              />
            )}
            
            {/* Ligne verticale - plus légère */}
            <div
              className={cn(
                "absolute top-0 w-px",
                isSubdivision ? "bg-border/20" : "bg-border/40"
              )}
              style={{
                left: `${position}px`,
                height: `${height}px`
              }}
            />
          </div>
        )
      })}
    </div>
  )
})

GanttGrid.displayName = 'GanttGrid'
