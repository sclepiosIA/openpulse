import { useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import {
  format,
  parseISO,
  isSameMonth,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isToday as isDateToday,
  startOfDay,
  endOfDay,
  getISOWeek,
} from 'date-fns'

import { CheckSquare, Plus, UserMinus, Flag } from 'lucide-react'
import { cn } from '@/lib/utils'
import { CalendarEvent } from '@/types/calendar'
import { ContentFilters } from './CalendarContentToggle'
import { CalendarItemTooltip } from './CalendarItemTooltip'
import { CalendarItemContextMenu } from './CalendarItemContextMenu'
import { useDeleteTache } from '@/hooks/tasks/useTaches'
import { useIsMobile } from '@/hooks/ui/use-mobile'

interface Task {
  id: string
  titre: string
  echeance?: string
  statut: string
  priorite?: string
  categories_taches?: { nom: string; couleur?: string } | null
}

interface CalendarAbsence {
  id: string
  title: string
  profile_name: string
  start: Date
  end: Date
  type: string
  color: string
}

interface CalendarUnifiedMonthViewProps {
  tasks: Task[]
  events: CalendarEvent[]
  absences?: CalendarAbsence[]
  currentMonth: Date
  onMonthChange: (date: Date) => void
  onTaskClick: (task: Task) => void
  onEventClick: (event: CalendarEvent) => void
  onCreateEvent: (date: Date) => void
  onDayClick?: (date: Date) => void
  contentFilters: ContentFilters
  currentAuthUserId?: string
}

const MAX_VISIBLE_ITEMS = 3

export function CalendarUnifiedMonthView({
  tasks,
  events,
  absences = [],
  currentMonth,
  onMonthChange,
  onTaskClick,
  onEventClick,
  onCreateEvent,
  onDayClick,
  contentFilters,
  currentAuthUserId,
}: CalendarUnifiedMonthViewProps) {
  const deleteTache = useDeleteTache()
  const isMobile = useIsMobile()
  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(currentMonth)
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 })
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })

  const days = useMemo(
    () => eachDayOfInterval({ start: calendarStart, end: calendarEnd }),
    [calendarStart, calendarEnd]
  )

  const weeks = useMemo(() => {
    const result: Date[][] = []
    for (let i = 0; i < days.length; i += 7) {
      result.push(days.slice(i, i + 7))
    }
    return result
  }, [days])

  // Helper: date de fin effective d'un event (gère le end exclusif à 00:00 pour all_day)
  const getEffectiveEndStr = (event: CalendarEvent) => {
    const startStr = event.start_time.substring(0, 10)
    const endStr = (event.end_time || event.start_time).substring(0, 10)
    if (
      event.all_day &&
      endStr > startStr &&
      (event.end_time || '').substring(11, 16) === '00:00'
    ) {
      const d = new Date(endStr + 'T00:00:00')
      d.setDate(d.getDate() - 1)
      return format(d, 'yyyy-MM-dd')
    }
    return endStr
  }

  const isMultiDayEvent = (event: CalendarEvent) => {
    const startStr = event.start_time.substring(0, 10)
    return getEffectiveEndStr(event) > startStr
  }

  // Get items per day (events bannière / multi-jours exclus, gérés séparément)
  const itemsByDay = useMemo(() => {
    const map: Record<
      string,
      { tasks: Task[]; events: CalendarEvent[]; absences: CalendarAbsence[] }
    > = {}

    days.forEach((day) => {
      const key = format(day, 'yyyy-MM-dd')
      map[key] = { tasks: [], events: [], absences: [] }

      if (contentFilters.showTasks) {
        map[key].tasks = tasks.filter((task) => {
          if (!task.echeance) return false
          const taskDateStr = task.echeance.substring(0, 10)
          return taskDateStr === key
        })
      }

      if (contentFilters.showEvents) {
        map[key].events = events.filter((event) => {
          if (event.display_as_banner) return false
          if (isMultiDayEvent(event)) return false // rendu comme barre continue
          return event.start_time.substring(0, 10) === key
        })
      }

      if (contentFilters.showAbsences) {
        map[key].absences = absences.filter((absence) => {
          return day >= absence.start && day <= absence.end
        })
      }
    })

    return map
  }, [days, tasks, events, absences, contentFilters])

  // Bannières par semaine : events bannière ET events multi-jours,
  // rendus en barre continue avec titre écrit une seule fois et alignés
  // sur une même "voie" (row) d'une semaine à l'autre (style Google Agenda).
  const { bannersByWeek, bannerRowCount } = useMemo(() => {
    const emptyResult = { bannersByWeek: weeks.map(() => [] as any[]), bannerRowCount: 0 }
    if (!contentFilters.showEvents) return emptyResult

    const banners = events
      .filter((e) => e.display_as_banner || isMultiDayEvent(e))
      .slice()
      .sort((a, b) => a.start_time.localeCompare(b.start_time))

    // Attribution d'une "voie" (row) globale par event : algo glouton par intervalle
    const rowEnds: string[] = [] // dernière date occupée par voie
    const rowByEventId = new Map<string, number>()
    for (const e of banners) {
      const startStr = e.start_time.substring(0, 10)
      const endStr = getEffectiveEndStr(e)
      let assigned = -1
      for (let i = 0; i < rowEnds.length; i++) {
        if (rowEnds[i] < startStr) {
          assigned = i
          break
        }
      }
      if (assigned === -1) {
        assigned = rowEnds.length
        rowEnds.push(endStr)
      } else rowEnds[assigned] = endStr
      rowByEventId.set(e.id, assigned)
    }

    const byWeek = weeks.map((week, weekIndex) => {
      const weekStartStr = format(week[0], 'yyyy-MM-dd')
      const weekEndStr = format(week[6], 'yyyy-MM-dd')
      return banners
        .filter((e) => {
          const startStr = e.start_time.substring(0, 10)
          const endStr = getEffectiveEndStr(e)
          return startStr <= weekEndStr && endStr >= weekStartStr
        })
        .map((e) => {
          const startStr = e.start_time.substring(0, 10)
          const endStr = getEffectiveEndStr(e)
          const continuesLeft = startStr < weekStartStr
          const continuesRight = endStr > weekEndStr
          const colStart = continuesLeft
            ? 0
            : Math.max(
                0,
                week.findIndex((d) => format(d, 'yyyy-MM-dd') === startStr)
              )
          const endIdx = continuesRight
            ? 6
            : week.findIndex((d) => format(d, 'yyyy-MM-dd') === endStr)
          const span = Math.max(1, (endIdx === -1 ? 6 : endIdx) - colStart + 1)
          return {
            event: e,
            colStart,
            span,
            continuesLeft,
            continuesRight,
            showLabel: !continuesLeft || weekIndex === 0,
            isBannerType: !!e.display_as_banner,
            row: rowByEventId.get(e.id) ?? 0,
          }
        })
    })

    return { bannersByWeek: byWeek, bannerRowCount: rowEnds.length }
  }, [weeks, events, contentFilters.showEvents])

  const getTaskColor = (task: Task) => {
    if (task.statut === 'Terminé') return { bg: '#22c55e', text: 'white' }
    if (task.statut === 'Bloqué') return { bg: '#ef4444', text: 'white' }
    if (task.statut === 'En cours') return { bg: '#3b82f6', text: 'white' }
    return { bg: '#e5e7eb', text: '#374151' }
  }

  return (
    <div className="gcal-container rounded-lg overflow-hidden">
      {/* Day headers - Google Calendar Style */}
      <div className="gcal-header flex border-b gcal-grid-line">
        <div className="w-10 shrink-0 py-2 text-center text-[11px] font-medium text-muted-foreground tracking-wide border-r gcal-grid-line">
          Sem.
        </div>
        <div className="grid grid-cols-7 flex-1">
          {['LUN', 'MAR', 'MER', 'JEU', 'VEN', 'SAM', 'DIM'].map((day) => (
            <div
              key={day}
              className="py-2 text-center text-[11px] font-medium text-muted-foreground tracking-wide"
            >
              {day}
            </div>
          ))}
        </div>
      </div>

      {/* Weeks Grid */}
      <div className="divide-y gcal-grid-line">
        {weeks.map((week, weekIndex) => {
          const weekBanners = bannersByWeek[weekIndex] || []
          return (
            <div key={weekIndex} className="relative flex">
              <div className="w-10 shrink-0 border-r gcal-grid-line flex items-start justify-center pt-1 text-[11px] font-medium text-muted-foreground bg-muted/20">
                S{getISOWeek(week[0])}
              </div>
              <div className="flex-1 min-w-0 relative">
                {/* Bannières (gardes, congés...) en haut de la semaine */}
                {weekBanners.length > 0 && (
                  <div
                    className="grid grid-cols-7 px-1 pt-1 pb-0.5 bg-transparent"
                    style={{
                      gridTemplateRows: `repeat(${Math.max(1, bannerRowCount)}, 20px)`,
                      rowGap: '2px',
                    }}
                  >
                    {weekBanners.map((b, idx) => {
                      const ev = b.event
                      const eventColor = ev.color || ev.calendar?.color || '#1a73e8'
                      const isFree = ev.availability === 'free'
                      return (
                        <TooltipProvider key={`${weekIndex}-${ev.id}-${idx}`}>
                          <CalendarItemContextMenu
                            item={ev}
                            type="event"
                            onEdit={() => onEventClick(ev)}
                            triggerClassName="min-w-0"
                            triggerStyle={{
                              gridColumn: `${b.colStart + 1} / span ${b.span}`,
                              gridRow: `${b.row + 1} / span 1`,
                            }}
                          >
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div
                                  className={cn(
                                    'w-full text-[11px] px-1.5 truncate cursor-pointer hover:opacity-90 transition-opacity flex items-center gap-1 h-[18px] leading-[18px]',
                                    b.continuesLeft ? 'rounded-l-none' : 'rounded-l-md',
                                    b.continuesRight ? 'rounded-r-none' : 'rounded-r-md',
                                    isFree && 'border border-dashed'
                                  )}
                                  style={{
                                    backgroundColor: isFree ? `${eventColor}33` : eventColor,
                                    color: isFree ? eventColor : 'white',
                                    borderColor: isFree ? eventColor : undefined,
                                  }}
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    onEventClick(ev)
                                  }}
                                  title={ev.title}
                                >
                                  {b.isBannerType && b.showLabel && (
                                    <Flag className="h-3 w-3 flex-shrink-0" />
                                  )}
                                  <span className="truncate">
                                    {b.showLabel && !b.isBannerType && !ev.all_day && (
                                      <span className="opacity-80 mr-1">
                                        {format(parseISO(ev.start_time), 'HH:mm')}
                                      </span>
                                    )}
                                    {b.showLabel && ev.title}
                                  </span>
                                </div>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="p-3">
                                <CalendarItemTooltip item={ev} type="event" />
                              </TooltipContent>
                            </Tooltip>
                          </CalendarItemContextMenu>
                        </TooltipProvider>
                      )
                    })}
                  </div>
                )}

                <div
                  className={cn(
                    'grid grid-cols-7 divide-x gcal-grid-line',
                    isMobile ? 'min-h-[80px]' : 'min-h-[120px]'
                  )}
                >
                  {week.map((day) => {
                    const key = format(day, 'yyyy-MM-dd')
                    const dayItems = itemsByDay[key] || { tasks: [], events: [], absences: [] }
                    const isCurrentMonth = isSameMonth(day, currentMonth)
                    const isToday = isDateToday(day)
                    const totalItems =
                      dayItems.tasks.length + dayItems.events.length + dayItems.absences.length

                    const handleDayClick = (e: React.MouseEvent<HTMLDivElement>) => {
                      // Ignore clicks originating from a portaled menu / dialog
                      // (React synthetic events propagate through portals to the ancestor cell)
                      if (e.defaultPrevented) return
                      const target = e.target as HTMLElement | null
                      if (
                        target &&
                        target.closest(
                          '[role="menu"], [role="dialog"], [role="alertdialog"], [data-radix-popper-content-wrapper]'
                        )
                      ) {
                        return
                      }
                      if (isMobile && onDayClick) {
                        onDayClick(day)
                      } else {
                        onCreateEvent(day)
                      }
                    }

                    return (
                      <div
                        key={key}
                        className={cn(
                          'relative group cursor-pointer transition-colors',
                          !isCurrentMonth && 'bg-muted/30 text-muted-foreground',
                          isToday && 'gcal-today-col',
                          'hover:bg-muted/20'
                        )}
                        onClick={handleDayClick}
                      >
                        {/* Day number - top right Google style */}
                        <div
                          className={cn(
                            'flex items-start p-1.5',
                            isMobile ? 'justify-center' : 'justify-end'
                          )}
                        >
                          <span
                            className={cn(
                              'transition-colors',
                              isMobile ? 'text-xs font-medium' : 'text-sm',
                              isToday
                                ? 'gcal-today-number w-7 h-7 flex items-center justify-center rounded-full text-sm'
                                : 'hover:bg-muted rounded-full w-7 h-7 flex items-center justify-center'
                            )}
                          >
                            {format(day, 'd')}
                          </span>
                        </div>

                        {/* Create button on hover (desktop) */}
                        {!isMobile && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="absolute top-1 left-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={(e) => {
                              e.stopPropagation()
                              onCreateEvent(day)
                            }}
                            aria-label="Ajouter"
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </Button>
                        )}

                        {/* Mobile: Colored dots */}
                        {isMobile ? (
                          <div className="flex gap-0.5 flex-wrap justify-center px-1 pb-1">
                            {dayItems.absences.slice(0, 2).map((absence) => (
                              <div
                                key={absence.id}
                                className="w-2 h-2 rounded-full"
                                style={{ backgroundColor: absence.color }}
                              />
                            ))}
                            {dayItems.events.slice(0, 3).map((event) => (
                              <div
                                key={event.id}
                                className="w-2 h-2 rounded-full"
                                style={{
                                  backgroundColor:
                                    event.color || event.calendar?.color || '#1a73e8',
                                }}
                              />
                            ))}
                            {dayItems.tasks.slice(0, 2).map((task) => {
                              const colors = getTaskColor(task)
                              return (
                                <div
                                  key={task.id}
                                  className="w-2 h-2 rounded-full"
                                  style={{ backgroundColor: colors.bg }}
                                />
                              )
                            })}
                            {totalItems > 5 && (
                              <div className="text-[8px] text-muted-foreground ml-0.5">
                                +{totalItems - 5}
                              </div>
                            )}
                          </div>
                        ) : (
                          /* Desktop: Event banners - Google Calendar style */
                          <div className="space-y-0.5 px-1 pb-1 overflow-hidden max-h-[calc(100%-32px)]">
                            {/* Absences as colored banners */}
                            {dayItems.absences.slice(0, 1).map((absence) => (
                              <div
                                key={absence.id}
                                className="gcal-event-chip text-[11px] px-1.5 py-0.5 rounded truncate"
                                style={{
                                  backgroundColor: absence.color,
                                  color: 'white',
                                }}
                              >
                                <UserMinus className="h-3 w-3 inline mr-1" />
                                {absence.profile_name.split(' ')[0]}
                              </div>
                            ))}

                            {/* Events as colored banners */}
                            {dayItems.events
                              .slice(0, MAX_VISIBLE_ITEMS - dayItems.absences.length)
                              .map((event) => {
                                const eventColor = event.color || event.calendar?.color || '#1a73e8'
                                const isColleagueEvent =
                                  currentAuthUserId &&
                                  event.calendar?.owner_id &&
                                  event.calendar.owner_id !== currentAuthUserId
                                const isFree = event.availability === 'free'
                                return (
                                  <TooltipProvider key={event.id}>
                                    <CalendarItemContextMenu
                                      item={event}
                                      type="event"
                                      onEdit={() => onEventClick(event)}
                                    >
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <div
                                            className={cn(
                                              'gcal-event-chip text-[11px] px-1.5 py-0.5 rounded truncate cursor-pointer hover:opacity-90 transition-opacity',
                                              isColleagueEvent && 'opacity-60',
                                              isFree && 'border border-dashed'
                                            )}
                                            style={{
                                              backgroundColor: isFree
                                                ? `${eventColor}33`
                                                : eventColor,
                                              color: isFree ? eventColor : 'white',
                                              borderColor: isFree ? eventColor : undefined,
                                            }}
                                            onClick={(e) => {
                                              e.stopPropagation()
                                              onEventClick(event)
                                            }}
                                          >
                                            {isColleagueEvent && <span className="mr-0.5">👤</span>}
                                            {!event.all_day && (
                                              <span className="opacity-80 mr-1">
                                                {format(parseISO(event.start_time), 'HH:mm')}
                                              </span>
                                            )}
                                            {event.title}
                                          </div>
                                        </TooltipTrigger>
                                        <TooltipContent side="right" className="p-3">
                                          <CalendarItemTooltip item={event} type="event" />
                                        </TooltipContent>
                                      </Tooltip>
                                    </CalendarItemContextMenu>
                                  </TooltipProvider>
                                )
                              })}

                            {/* Tasks as colored banners with left border */}
                            {dayItems.tasks
                              .slice(
                                0,
                                Math.max(
                                  0,
                                  MAX_VISIBLE_ITEMS -
                                    dayItems.events.length -
                                    dayItems.absences.length
                                )
                              )
                              .map((task) => {
                                const colors = getTaskColor(task)
                                return (
                                  <TooltipProvider key={task.id}>
                                    <CalendarItemContextMenu
                                      item={task}
                                      type="task"
                                      onEdit={() => onTaskClick(task)}
                                      onDelete={() => deleteTache.mutate(task.id)}
                                    >
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <div
                                            className="gcal-event-chip text-[11px] px-1.5 py-0.5 rounded truncate cursor-pointer hover:opacity-90 transition-opacity flex items-center gap-1"
                                            style={{
                                              backgroundColor: colors.bg,
                                              color: colors.text,
                                            }}
                                            onClick={(e) => {
                                              e.stopPropagation()
                                              onTaskClick(task)
                                            }}
                                          >
                                            <CheckSquare className="h-3 w-3 flex-shrink-0" />
                                            <span className="truncate">{task.titre}</span>
                                          </div>
                                        </TooltipTrigger>
                                        <TooltipContent side="right" className="p-3">
                                          <CalendarItemTooltip item={task} type="task" />
                                        </TooltipContent>
                                      </Tooltip>
                                    </CalendarItemContextMenu>
                                  </TooltipProvider>
                                )
                              })}

                            {/* More indicator */}
                            {totalItems > MAX_VISIBLE_ITEMS && (
                              <div className="text-[10px] text-muted-foreground px-1 font-medium">
                                +{totalItems - MAX_VISIBLE_ITEMS} autres
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
