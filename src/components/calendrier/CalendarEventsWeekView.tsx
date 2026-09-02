import { useState, useRef, useCallback, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'

import {
  format,
  parseISO,
  isSameDay,
  addWeeks,
  subWeeks,
  startOfWeek,
  addDays,
  setHours,
  setMinutes,
  isToday as isDateToday,
} from 'date-fns'
import { fr } from 'date-fns/locale'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { CalendarEvent } from '@/types/calendar'

interface CalendarEventsWeekViewProps {
  events: CalendarEvent[]
  currentWeek: Date
  onWeekChange: (date: Date) => void
  onEventClick: (event: CalendarEvent) => void
  onCreateEvent: (startTime: Date, endTime: Date) => void
  startHour?: number
  endHour?: number
}

const HOUR_HEIGHT = 48 // pixels per hour
const MIDNIGHT_ISO_RE = /T00:00(?::00(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})?$/

const parseCivilDay = (value: string): Date => {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value)
  if (!match) return parseISO(value)
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
}

export function CalendarEventsWeekView({
  events,
  currentWeek,
  onWeekChange,
  onEventClick,
  onCreateEvent,
  startHour = 7,
  endHour = 21,
}: CalendarEventsWeekViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [currentTimePosition, setCurrentTimePosition] = useState<number>(0)
  const [isDragging, setIsDragging] = useState(false)
  const [dragDay, setDragDay] = useState<Date | null>(null)
  const [dragStart, setDragStart] = useState<{ hour: number; minute: number } | null>(null)
  const [dragEnd, setDragEnd] = useState<{ hour: number; minute: number } | null>(null)

  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 })
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  const hours = Array.from({ length: endHour - startHour }, (_, i) => startHour + i)

  // Current time indicator
  useEffect(() => {
    const updateCurrentTime = () => {
      const now = new Date()
      const minutesSinceStart = (now.getHours() - startHour) * 60 + now.getMinutes()
      const position = (minutesSinceStart / 60) * HOUR_HEIGHT
      setCurrentTimePosition(position)
    }

    updateCurrentTime()
    const interval = setInterval(updateCurrentTime, 60000)
    return () => clearInterval(interval)
  }, [startHour])

  // Get TIMED events for a specific day (excludes all-day; all-day rendered
  // in the banner strip above the grid). Includes events that span across `day`.
  const getEventsForDay = useCallback(
    (day: Date) => {
      return events.filter((event) => {
        if (event.all_day) return false
        const eventStart = parseISO(event.start_time)
        const eventEnd = parseISO(event.end_time)
        const dayStart = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 0, 0, 0, 0)
        const dayEnd = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 23, 59, 59, 999)
        return eventStart <= dayEnd && eventEnd >= dayStart
      })
    },
    [events]
  )

  // All-day events touching the visible week, with column span info.
  const allDayBanners = (() => {
    const weekStartTs = weekDays[0].getTime()
    const weekEndDay = weekDays[6]
    const weekEndTs = new Date(
      weekEndDay.getFullYear(),
      weekEndDay.getMonth(),
      weekEndDay.getDate(),
      23,
      59,
      59,
      999
    ).getTime()
    return events
      .filter((e) => e.all_day)
      .map((e) => {
        // All-day values are civil dates: their YYYY-MM-DD must not shift with
        // the browser timezone, even when the backend serializes them with Z.
        const start = parseCivilDay(e.start_time)
        const end = parseCivilDay(e.end_time)
        // end_time is exclusive when midnight — bring back to inclusive last day
        const isExclusiveEnd =
          MIDNIGHT_ISO_RE.test(e.end_time) && end.getTime() > start.getTime()
        const inclusiveEnd = isExclusiveEnd ? addDays(end, -1) : end
        const startTs = start.getTime()
        const endTs = new Date(
          inclusiveEnd.getFullYear(),
          inclusiveEnd.getMonth(),
          inclusiveEnd.getDate(),
          23,
          59,
          59,
          999
        ).getTime()
        if (endTs < weekStartTs || startTs > weekEndTs) return null
        const startCol = Math.max(
          0,
          weekDays.findIndex((d) => d.getTime() >= startTs)
        )
        let endCol = -1
        for (let i = weekDays.length - 1; i >= 0; i--) {
          const dTs = new Date(
            weekDays[i].getFullYear(),
            weekDays[i].getMonth(),
            weekDays[i].getDate()
          ).getTime()
          if (dTs <= endTs) {
            endCol = i
            break
          }
        }
        if (endCol < 0) return null
        return { event: e, startCol, endCol }
      })
      .filter((b): b is { event: CalendarEvent; startCol: number; endCol: number } => b !== null)
  })()

  // Calculate event positions with overlap handling
  const getPositionedEventsForDay = useCallback(
    (day: Date) => {
      const dayEvents = getEventsForDay(day)
      const sorted = [...dayEvents].sort(
        (a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
      )

      const columns: CalendarEvent[][] = []

      sorted.forEach((event) => {
        const eventStart = new Date(event.start_time)
        const eventEnd = new Date(event.end_time)

        let columnIndex = columns.findIndex((column) =>
          column.every((colEvent) => {
            const colStart = new Date(colEvent.start_time)
            const colEnd = new Date(colEvent.end_time)
            return eventEnd <= colStart || eventStart >= colEnd
          })
        )

        if (columnIndex === -1) {
          columnIndex = columns.length
          columns.push([])
        }

        columns[columnIndex].push(event)
      })

      return columns.flatMap((column, colIndex) =>
        column.map((event) => {
          const eventStart = parseISO(event.start_time)
          const eventEnd = parseISO(event.end_time)
          // Clip to the current day so events spanning multiple days display on each day.
          const dayStart = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 0, 0, 0, 0)
          const dayEnd = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 23, 59, 59, 999)
          const clippedStart = eventStart < dayStart ? dayStart : eventStart
          const clippedEnd = eventEnd > dayEnd ? dayEnd : eventEnd

          const startMinutes =
            (clippedStart.getHours() - startHour) * 60 + clippedStart.getMinutes()
          const endMinutes = (clippedEnd.getHours() - startHour) * 60 + clippedEnd.getMinutes()

          const top = (startMinutes / 60) * HOUR_HEIGHT
          const height = ((endMinutes - startMinutes) / 60) * HOUR_HEIGHT
          const width = 100 / columns.length
          const left = colIndex * width

          return {
            event,
            style: {
              top: `${top}px`,
              height: `${Math.max(height, 16)}px`,
              left: `${left}%`,
              width: `${width - 2}%`,
            },
          }
        })
      )
    },
    [getEventsForDay, startHour]
  )

  // Mouse handlers for drag-to-create
  const getTimeFromPosition = useCallback(
    (clientY: number): { hour: number; minute: number } => {
      if (!containerRef.current) return { hour: startHour, minute: 0 }

      const rect = containerRef.current.getBoundingClientRect()
      const scrollTop = containerRef.current.scrollTop
      const y = clientY - rect.top + scrollTop

      const totalMinutes = (y / HOUR_HEIGHT) * 60
      const hour = Math.floor(totalMinutes / 60) + startHour
      const minute = Math.round((totalMinutes % 60) / 15) * 15

      return {
        hour: Math.max(startHour, Math.min(endHour - 1, hour)),
        minute: Math.min(45, minute),
      }
    },
    [startHour, endHour]
  )

  const handleMouseDown = useCallback(
    (e: React.MouseEvent, day: Date) => {
      const target = e.target
      if (target instanceof Element && target.closest('.event-item')) return

      const time = getTimeFromPosition(e.clientY)
      setIsDragging(true)
      setDragDay(day)
      setDragStart(time)
      setDragEnd({ hour: time.hour, minute: time.minute + 30 })
    },
    [getTimeFromPosition]
  )

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isDragging || !dragStart) return

      const time = getTimeFromPosition(e.clientY)
      if (time.hour * 60 + time.minute > dragStart.hour * 60 + dragStart.minute) {
        setDragEnd(time)
      }
    },
    [isDragging, dragStart, getTimeFromPosition]
  )

  const handleMouseUp = useCallback(() => {
    if (isDragging && dragDay && dragStart && dragEnd) {
      const startTime = setMinutes(setHours(dragDay, dragStart.hour), dragStart.minute)
      const endTime = setMinutes(setHours(dragDay, dragEnd.hour), dragEnd.minute)

      if (endTime > startTime) {
        onCreateEvent(startTime, endTime)
      }
    }

    setIsDragging(false)
    setDragDay(null)
    setDragStart(null)
    setDragEnd(null)
  }, [isDragging, dragDay, dragStart, dragEnd, onCreateEvent])

  // Calculate drag selection position
  const getDragSelection = useCallback(
    (day: Date) => {
      if (!isDragging || !dragDay || !dragStart || !dragEnd || !isSameDay(day, dragDay)) return null

      const startMinutes = (dragStart.hour - startHour) * 60 + dragStart.minute
      const endMinutes = (dragEnd.hour - startHour) * 60 + dragEnd.minute

      return {
        top: (startMinutes / 60) * HOUR_HEIGHT,
        height: ((endMinutes - startMinutes) / 60) * HOUR_HEIGHT,
      }
    },
    [isDragging, dragDay, dragStart, dragEnd, startHour]
  )

  const todayIndex = weekDays.findIndex((day) => isDateToday(day))

  return (
    <div className="space-y-4">
      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onWeekChange(subWeeks(currentWeek, 1))}
          aria-label="Période précédente"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <h3 className="font-semibold">
          Semaine du {format(weekDays[0], 'd MMM', { locale: fr })} au{' '}
          {format(weekDays[6], 'd MMM yyyy', { locale: fr })}
        </h3>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onWeekChange(addWeeks(currentWeek, 1))}
          aria-label="Période suivante"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Week Grid */}
      <Card>
        <CardContent className="p-0">
          {/* Day headers */}
          <div className="grid grid-cols-8 border-b">
            <div className="w-14" /> {/* Time column spacer */}
            {weekDays.map((day, index) => {
              const isToday = isDateToday(day)
              return (
                <div
                  key={day.toISOString()}
                  className={cn('py-2 text-center border-l', isToday && 'bg-primary/5')}
                >
                  <div className="text-xs text-muted-foreground uppercase">
                    {format(day, 'EEE', { locale: fr })}
                  </div>
                  <div className={cn('text-lg font-semibold', isToday && 'text-primary')}>
                    {format(day, 'd')}
                  </div>
                </div>
              )
            })}
          </div>

          {/* All-day banners row */}
          {allDayBanners.length > 0 && (
            <div className="grid grid-cols-8 border-b bg-muted/20 py-1 px-1 gap-y-1">
              <div className="w-14 text-[10px] text-muted-foreground pr-1 text-right pt-0.5">
                Journée
              </div>
              <div
                className="col-span-7 relative"
                style={{ minHeight: `${allDayBanners.length * 22}px` }}
              >
                {allDayBanners.map((b, idx) => {
                  const span = b.endCol - b.startCol + 1
                  const leftPct = (b.startCol / 7) * 100
                  const widthPct = (span / 7) * 100
                  const color = b.event.color || b.event.calendar?.color || '#3B82F6'
                  return (
                    <button
                      key={b.event.id}
                      type="button"
                      onClick={() => onEventClick(b.event)}
                      className="absolute rounded px-2 py-0.5 text-[11px] font-medium text-white truncate hover:brightness-95 transition text-left"
                      style={{
                        left: `calc(${leftPct}% + 2px)`,
                        width: `calc(${widthPct}% - 4px)`,
                        top: `${idx * 22}px`,
                        backgroundColor: color,
                      }}
                      title={b.event.title}
                    >
                      {b.event.title}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Time grid */}
          <ScrollArea className="h-[600px]" ref={containerRef as any}>
            <div
              className="grid grid-cols-8"
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            >
              {/* Time labels */}
              <div className="w-14 relative">
                {hours.map((hour, index) => (
                  <div
                    key={hour}
                    className="absolute right-2 text-xs text-muted-foreground"
                    style={{ top: `${index * HOUR_HEIGHT - 6}px` }}
                  >
                    {format(setHours(new Date(), hour), 'HH:mm')}
                  </div>
                ))}
              </div>

              {/* Day columns */}
              {weekDays.map((day) => {
                const isToday = isDateToday(day)
                const positionedEvents = getPositionedEventsForDay(day)
                const dragSelection = getDragSelection(day)

                return (
                  <div
                    key={day.toISOString()}
                    className={cn('relative border-l', isToday && 'bg-primary/5')}
                    style={{ height: `${hours.length * HOUR_HEIGHT}px` }}
                    onMouseDown={(e) => handleMouseDown(e, day)}
                  >
                    {/* Hour lines */}
                    {hours.map((hour, index) => (
                      <div
                        key={hour}
                        className="absolute w-full border-t border-border/50"
                        style={{ top: `${index * HOUR_HEIGHT}px` }}
                      />
                    ))}

                    {/* Half-hour lines */}
                    {hours.map((hour, index) => (
                      <div
                        key={`${hour}-half`}
                        className="absolute w-full border-t border-border/20 border-dashed"
                        style={{ top: `${index * HOUR_HEIGHT + HOUR_HEIGHT / 2}px` }}
                      />
                    ))}

                    {/* Current time indicator */}
                    {isToday &&
                      currentTimePosition > 0 &&
                      currentTimePosition < hours.length * HOUR_HEIGHT && (
                        <div
                          className="absolute left-0 right-0 z-20 pointer-events-none"
                          style={{ top: `${currentTimePosition}px` }}
                        >
                          <div className="relative">
                            <div className="absolute -left-1 w-2 h-2 bg-destructive rounded-full" />
                            <div className="h-0.5 bg-destructive" />
                          </div>
                        </div>
                      )}

                    {/* Events */}
                    {positionedEvents.map(({ event, style }) => (
                      <div
                        key={event.id}
                        className="event-item absolute rounded p-1 cursor-pointer transition-all hover:ring-2 hover:ring-primary overflow-hidden text-xs"
                        style={{
                          ...style,
                          backgroundColor: `${event.color || event.calendar?.color || '#3B82F6'}30`,
                          borderLeft: `3px solid ${event.color || event.calendar?.color || '#3B82F6'}`,
                        }}
                        onClick={() => onEventClick(event)}
                      >
                        <div className="font-medium truncate">{event.title}</div>
                        <div className="text-muted-foreground">
                          {format(parseISO(event.start_time), 'HH:mm')}
                        </div>
                      </div>
                    ))}

                    {/* Drag selection */}
                    {dragSelection && (
                      <div
                        className="absolute left-0 right-0 bg-primary/20 border-2 border-primary border-dashed rounded pointer-events-none z-10"
                        style={{
                          top: `${dragSelection.top}px`,
                          height: `${dragSelection.height}px`,
                        }}
                      />
                    )}
                  </div>
                )
              })}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  )
}
