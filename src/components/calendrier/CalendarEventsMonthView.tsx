import { useState, useMemo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import {
  format,
  parseISO,
  isSameDay,
  isSameMonth,
  addMonths,
  subMonths,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isToday as isDateToday,
} from 'date-fns'
import { fr } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, Plus, Clock, Video } from 'lucide-react'
import { cn } from '@/lib/utils'
import { CalendarEvent } from '@/types/calendar'
import { ClickableLocation } from './ClickableLocation'

interface CalendarEventsMonthViewProps {
  events: CalendarEvent[]
  currentMonth: Date
  onMonthChange: (date: Date) => void
  onEventClick: (event: CalendarEvent) => void
  onCreateEvent: (date: Date) => void
}

export function CalendarEventsMonthView({
  events,
  currentMonth,
  onMonthChange,
  onEventClick,
  onCreateEvent,
}: CalendarEventsMonthViewProps) {
  const [selectedDay, setSelectedDay] = useState<Date | null>(null)
  const [showHeatmap, setShowHeatmap] = useState(false)

  // Calendar days calculation
  const calendarDays = useMemo(() => {
    const monthStart = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1)
    const monthEnd = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0)
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 })
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })
    return eachDayOfInterval({ start: calendarStart, end: calendarEnd })
  }, [currentMonth])

  const getEventsForDay = (day: Date) => {
    return events.filter((event) => {
      const start = parseISO(event.start_time)
      const end = event.end_time ? parseISO(event.end_time) : start
      // Événement all_day : end_time exclusif (jour+1 00:00) → on retire 1 jour.
      let effectiveEnd = end
      if (
        (event as any).all_day &&
        end.getTime() > start.getTime() &&
        end.getHours() === 0 &&
        end.getMinutes() === 0
      ) {
        effectiveEnd = new Date(end.getTime() - 24 * 60 * 60 * 1000)
      }
      const dayStart = new Date(day.getFullYear(), day.getMonth(), day.getDate()).getTime()
      const startDay = new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime()
      const endDay = new Date(
        effectiveEnd.getFullYear(),
        effectiveEnd.getMonth(),
        effectiveEnd.getDate()
      ).getTime()
      return dayStart >= startDay && dayStart <= endDay
    })
  }

  const selectedDayEvents = selectedDay ? getEventsForDay(selectedDay) : []

  return (
    <div className="space-y-4">
      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onMonthChange(subMonths(currentMonth, 1))}
          aria-label="Période précédente"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <h3 className="font-semibold text-lg">
          {format(currentMonth, 'MMMM yyyy', { locale: fr })}
        </h3>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Switch
              id="heatmap-toggle-events"
              checked={showHeatmap}
              onCheckedChange={setShowHeatmap}
            />
            <Label htmlFor="heatmap-toggle-events" className="text-sm cursor-pointer">
              Carte de charge
            </Label>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onMonthChange(addMonths(currentMonth, 1))}
            aria-label="Période suivante"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Calendar Grid */}
      <Card>
        <CardContent className="p-4">
          {/* Day headers */}
          <div className="grid grid-cols-7 gap-2 mb-2">
            {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map((day) => (
              <div key={day} className="text-center text-sm font-medium text-muted-foreground py-2">
                {day}
              </div>
            ))}
          </div>

          {/* Days grid */}
          <div className="grid grid-cols-7 gap-2">
            {calendarDays.map((day) => {
              const dayEvents = getEventsForDay(day)
              const isCurrentMonth = isSameMonth(day, currentMonth)
              const isToday = isDateToday(day)
              const isSelected = selectedDay && isSameDay(day, selectedDay)

              // Heatmap intensity
              const eventCount = dayEvents.length
              const heatmapColor =
                eventCount === 0
                  ? 'transparent'
                  : eventCount <= 2
                    ? 'hsl(var(--primary) / 0.15)'
                    : eventCount <= 4
                      ? 'hsl(var(--primary) / 0.3)'
                      : 'hsl(var(--primary) / 0.5)'

              return (
                <button
                  key={day.toISOString()}
                  onClick={() => setSelectedDay(day)}
                  onDoubleClick={() => onCreateEvent(day)}
                  className={cn(
                    'min-h-[60px] md:min-h-[100px] p-1.5 md:p-2 rounded-lg border transition-all hover:border-primary relative text-left',
                    !isCurrentMonth && 'opacity-40',
                    isToday && 'border-primary bg-primary/5',
                    isSelected && 'ring-2 ring-primary'
                  )}
                  style={
                    showHeatmap && eventCount > 0
                      ? {
                          backgroundColor: heatmapColor,
                        }
                      : undefined
                  }
                >
                  <div className="flex flex-col h-full">
                    <div
                      className={cn(
                        'text-xs md:text-sm font-semibold mb-0.5 md:mb-1',
                        isToday && 'text-primary'
                      )}
                    >
                      {format(day, 'd')}
                    </div>

                    {dayEvents.length > 0 && (
                      <>
                        {/* Mobile: show count */}
                        <div className="md:hidden flex-1 flex items-center justify-center">
                          <span className="text-xs font-medium text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">
                            {dayEvents.length}
                          </span>
                        </div>

                        {/* Desktop: show event previews */}
                        <div className="hidden md:block space-y-1 flex-1 overflow-hidden">
                          {dayEvents.slice(0, 3).map((event) => (
                            <div
                              key={event.id}
                              className="text-xs p-1 rounded truncate cursor-pointer hover:opacity-80"
                              style={{
                                backgroundColor: `${event.color || event.calendar?.color || '#3B82F6'}20`,
                                borderLeft: `2px solid ${event.color || event.calendar?.color || '#3B82F6'}`,
                              }}
                              title={event.title}
                              onClick={(e) => {
                                e.stopPropagation()
                                onEventClick(event)
                              }}
                            >
                              {!event.all_day && (
                                <span className="font-medium">
                                  {format(parseISO(event.start_time), 'HH:mm')}
                                </span>
                              )}{' '}
                              {event.title}
                            </div>
                          ))}
                          {dayEvents.length > 3 && (
                            <div className="text-xs text-muted-foreground">
                              +{dayEvents.length - 3} autres
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Day detail sheet */}
      <Sheet open={selectedDay !== null} onOpenChange={(open) => !open && setSelectedDay(null)}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle className="flex items-center justify-between">
              <span>{selectedDay && format(selectedDay, 'EEEE d MMMM yyyy', { locale: fr })}</span>
              <Button size="sm" onClick={() => selectedDay && onCreateEvent(selectedDay)}>
                <Plus className="h-4 w-4 mr-1" />
                Ajouter
              </Button>
            </SheetTitle>
          </SheetHeader>
          <div className="mt-6">
            <ScrollArea className="h-[calc(100vh-120px)]">
              {selectedDayEvents.length === 0 ? (
                <div className="text-center text-muted-foreground py-12">
                  <p>Aucun événement ce jour</p>
                  <Button
                    variant="outline"
                    className="mt-4"
                    onClick={() => selectedDay && onCreateEvent(selectedDay)}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Créer un événement
                  </Button>
                </div>
              ) : (
                <div className="space-y-3 pr-4">
                  {selectedDayEvents
                    .sort(
                      (a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
                    )
                    .map((event) => (
                      <Card
                        key={event.id}
                        className="cursor-pointer hover:shadow-md transition-shadow"
                        onClick={() => {
                          onEventClick(event)
                          setSelectedDay(null)
                        }}
                        style={{
                          borderLeft: `4px solid ${event.color || event.calendar?.color || '#3B82F6'}`,
                        }}
                      >
                        <CardContent className="p-3">
                          <div className="font-medium">{event.title}</div>
                          <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            {event.all_day ? (
                              'Toute la journée'
                            ) : (
                              <>
                                {format(parseISO(event.start_time), 'HH:mm')} -{' '}
                                {format(parseISO(event.end_time), 'HH:mm')}
                              </>
                            )}
                          </div>
                          {event.location && (
                            <div className="mt-1">
                              <ClickableLocation
                                location={event.location}
                                iconClassName="h-3 w-3"
                                className="text-sm"
                              />
                            </div>
                          )}
                          {event.video_conference_url && (
                            <a
                              href={event.video_conference_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-2 mt-1 text-sm text-primary hover:underline"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Video className="h-3 w-3" />
                              Rejoindre la visio
                            </a>
                          )}
                          {event.calendar && (
                            <Badge
                              variant="outline"
                              className="mt-2"
                              style={{ borderColor: event.calendar.color }}
                            >
                              {event.calendar.name}
                            </Badge>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                </div>
              )}
            </ScrollArea>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
