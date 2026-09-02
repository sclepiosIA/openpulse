import React, { useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Calendar, ArrowRight, Loader2, Plus } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useUpcomingAppointments } from '@/hooks/bookings/useUpcomingAppointments'
import { AgendaWidgetItem } from './AgendaWidgetItem'
import { AgendaWeekView } from './AgendaWeekView'
import { EventFormDialog } from '@/components/calendrier/EventFormDialog'
import { parseISO, isToday, isTomorrow, format } from 'date-fns'
import { fr } from 'date-fns/locale'

interface AgendaWidgetProps {
  maxItems?: number
}

function getDayLabel(dateStr: string): string {
  const date = parseISO(dateStr)
  if (isToday(date)) return "Aujourd'hui"
  if (isTomorrow(date)) return 'Demain'
  return format(date, 'EEEE', { locale: fr })
}

export function AgendaWidget({ maxItems = 8 }: AgendaWidgetProps) {
  const navigate = useNavigate()
  const { data: appointments, isLoading } = useUpcomingAppointments(maxItems)
  const [viewMode, setViewMode] = useState<'list' | 'week'>('list')
  const [eventFormOpen, setEventFormOpen] = useState(false)
  const [eventFormDefaultDate, setEventFormDefaultDate] = useState<Date | undefined>()

  const { groupedAppointments, todayCount, hasConflicts } = useMemo(() => {
    if (!appointments?.length)
      return { groupedAppointments: {}, todayCount: 0, hasConflicts: false }

    const grouped = appointments.reduce(
      (acc, apt) => {
        const dayKey = getDayLabel(apt.start_time)
        if (!acc[dayKey]) acc[dayKey] = []
        acc[dayKey].push(apt)
        return acc
      },
      {} as Record<string, typeof appointments>
    )

    const today = appointments.filter((apt) => isToday(parseISO(apt.start_time))).length
    const conflicts = appointments.some((apt) => apt.hasConflict)

    return { groupedAppointments: grouped, todayCount: today, hasConflicts: conflicts }
  }, [appointments])

  const dayOrder = ["Aujourd'hui", 'Demain']

  const handleDayClick = (date: Date) => {
    setEventFormDefaultDate(date)
    setEventFormOpen(true)
  }

  const handleQuickCreate = () => {
    setEventFormDefaultDate(new Date())
    setEventFormOpen(true)
  }

  return (
    <>
      <Card className="bg-card/80 backdrop-blur-sm border-l-4 border-l-primary h-[340px] [.compact_&]:h-[280px] flex flex-col">
        <CardHeader className="py-2 px-3 shrink-0 [.compact_&]:py-1.5">
          <CardTitle className="flex items-center justify-between text-base">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-primary/10">
                <Calendar className="h-4 w-4 text-primary" />
              </div>
              <span>Agenda</span>
            </div>

            <div className="flex items-center gap-1.5">
              {/* Sélecteur de vue — PAS des onglets : le contenu correspondant
                  est rendu plus bas dans <CardContent>, hors de ce composant.
                  Avec <Tabs>, Radix posait un `aria-controls` vers un panneau
                  qui n'existait nulle part (axe `aria-valid-attr-value`,
                  critical, sur le dashboard). ToggleGroup exprime exactement
                  ce qu'est ce contrôle : un choix unique entre deux vues. */}
              <ToggleGroup
                type="single"
                value={viewMode}
                onValueChange={(v) => v && setViewMode(v as 'list' | 'week')}
                aria-label="Mode d'affichage de l'agenda"
                className="h-6 p-0.5 bg-muted/50 rounded-md"
              >
                <ToggleGroupItem value="list" className="text-[10px] h-5 px-2">
                  Liste
                </ToggleGroupItem>
                <ToggleGroupItem value="week" className="text-[10px] h-5 px-2">
                  Semaine
                </ToggleGroupItem>
              </ToggleGroup>

              {/* Quick create button */}
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={handleQuickCreate}
                aria-label="Ajouter"
              >
                <Plus className="h-3.5 w-3.5" />
              </Button>

              {/* Count badge */}
              {todayCount > 0 ? (
                <Badge
                  className={`text-xs ${hasConflicts ? 'bg-amber-500' : 'bg-primary'} text-primary-foreground`}
                >
                  {todayCount}
                </Badge>
              ) : (
                <Badge variant="secondary" className="text-xs">
                  {isLoading ? '...' : appointments?.length || 0}
                </Badge>
              )}
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col px-2 pt-0 pb-2 overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : !appointments?.length ? (
            <div className="text-center py-4 text-muted-foreground text-sm">
              <Calendar className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>Aucun événement à venir</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-2 text-xs"
                onClick={handleQuickCreate}
              >
                <Plus className="h-3 w-3 mr-1" />
                Créer un événement
              </Button>
            </div>
          ) : viewMode === 'week' ? (
            <div className="flex-1 min-h-0">
              <AgendaWeekView appointments={appointments} onDayClick={handleDayClick} />
            </div>
          ) : (
            <div className="flex-1 min-h-0">
              <ScrollArea className="h-full -mx-1 px-1">
                <div className="space-y-1.5 pb-1">
                  {Object.entries(groupedAppointments)
                    .sort(([a], [b]) => {
                      const aIdx = dayOrder.indexOf(a)
                      const bIdx = dayOrder.indexOf(b)
                      if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx
                      if (aIdx !== -1) return -1
                      if (bIdx !== -1) return 1
                      return 0
                    })
                    .map(([day, dayAppointments]) => (
                      <div key={day}>
                        {/* Day separator - compact */}
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                            {day}
                          </span>
                          <div className="flex-1 h-px bg-border/50" />
                          <Badge variant="secondary" className="text-[9px] px-1 py-0 h-3.5">
                            {dayAppointments.length}
                          </Badge>
                        </div>

                        {/* Day appointments */}
                        <div className="space-y-0.5">
                          {dayAppointments.map((apt, idx) => (
                            <AgendaWidgetItem
                              key={apt.id}
                              appointment={apt}
                              index={idx}
                              onClick={() => navigate('/calendrier')}
                            />
                          ))}
                        </div>
                      </div>
                    ))}
                </div>
              </ScrollArea>
            </div>
          )}

          <Button
            variant="ghost"
            size="sm"
            className="w-full mt-1 text-xs gap-1 shrink-0 h-7 text-primary hover:text-primary hover:bg-primary/10"
            onClick={() => navigate('/calendrier')}
          >
            Voir le calendrier
            <ArrowRight className="h-3 w-3" />
          </Button>
        </CardContent>
      </Card>

      {/* Event Form Dialog */}
      <EventFormDialog
        open={eventFormOpen}
        onOpenChange={setEventFormOpen}
        defaultStartTime={eventFormDefaultDate}
      />
    </>
  )
}
