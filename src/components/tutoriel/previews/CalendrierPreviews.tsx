/**
 * Live Previews pour le module Calendrier
 */
import { memo, useEffect, useState } from 'react'
import { TutorielPreviewWrapper } from '../TutorielMockProviders'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  Calendar,
  Clock,
  MapPin,
  Users,
  Video,
  ChevronLeft,
  ChevronRight,
  Bell,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// Mock data
export const mockCalendarEvents = [
  { 
    id: '1', 
    title: 'Démo OpenPulse - Cabinet Les Tilleuls', 
    start: '09:00', 
    end: '10:30', 
    type: 'meeting',
    color: 'bg-blue-500',
    location: 'Visio Teams',
    attendees: ['Marie Dupont', 'Pierre Martin']
  },
  { 
    id: '2', 
    title: 'Point hebdo équipe', 
    start: '11:00', 
    end: '11:30', 
    type: 'internal',
    color: 'bg-purple-500',
    location: 'Salle de réunion A',
    attendees: ['Toute l\'équipe']
  },
  { 
    id: '3', 
    title: 'Formation utilisateurs CH Le Villeneuve', 
    start: '14:00', 
    end: '17:00', 
    type: 'training',
    color: 'bg-amber-500',
    location: 'Sur site',
    attendees: ['Thomas Martin', 'Julie Petit']
  },
]

export const mockReminders = [
  { id: '1', title: 'Préparer démo Cabinet', time: '30 min avant', event: 'Démo OpenPulse' },
  { id: '2', title: 'Vérifier visio', time: '15 min avant', event: 'Point hebdo' },
]

const hours = ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00']
const days = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven']

/**
 * Vue Timeline du calendrier
 */
export const CalendarTimelinePreview = memo(() => {
  const [isVisible, setIsVisible] = useState(false)
  
  useEffect(() => {
    setIsVisible(true)
  }, [])

  return (
    <TutorielPreviewWrapper>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Aujourd'hui
            </CardTitle>
            <div className="flex items-center gap-1">
              <ChevronLeft className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">15 Janvier 2024</span>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="relative">
            {/* Time slots */}
            <div className="space-y-0">
              {hours.slice(0, 6).map((hour, index) => (
                <div key={hour} className="flex gap-3 h-16 border-t border-border/50">
                  <span className="text-xs text-muted-foreground w-12 -mt-2">{hour}</span>
                  <div className="flex-1 relative" />
                </div>
              ))}
            </div>
            
            {/* Events overlaid */}
            <div className="absolute top-0 left-14 right-0">
              {mockCalendarEvents.map((event, index) => {
                const startHour = parseInt(event.start.split(':')[0])
                const endHour = parseInt(event.end.split(':')[0])
                const top = (startHour - 8) * 64
                const height = (endHour - startHour) * 64 + (parseInt(event.end.split(':')[1]) / 60) * 64

                return (
                  <div
                    key={event.id}
                    className={cn(
                      "absolute left-0 right-2 rounded-lg p-2 text-white transition-all duration-500",
                      event.color,
                      isVisible ? "opacity-100 scale-100" : "opacity-0 scale-95"
                    )}
                    style={{ 
                      top: `${top}px`, 
                      height: `${Math.min(height, 180)}px`,
                      transitionDelay: `${index * 150}ms`
                    }}
                  >
                    <p className="text-xs font-semibold truncate">{event.title}</p>
                    <p className="text-xs opacity-80">{event.start} - {event.end}</p>
                    <div className="flex items-center gap-1 mt-1 text-xs opacity-80">
                      <MapPin className="h-3 w-3" />
                      <span className="truncate">{event.location}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </CardContent>
      </Card>
    </TutorielPreviewWrapper>
  )
})
CalendarTimelinePreview.displayName = 'CalendarTimelinePreview'

/**
 * Vue Mois du calendrier
 */
export const CalendarMonthPreview = memo(() => {
  const [isVisible, setIsVisible] = useState(false)
  const [selectedDay, setSelectedDay] = useState(15)
  
  useEffect(() => {
    setIsVisible(true)
  }, [])

  const daysInMonth = Array.from({ length: 31 }, (_, i) => i + 1)
  const eventsOnDay = (day: number) => {
    if (day === 15) return [{ color: 'bg-blue-500' }, { color: 'bg-purple-500' }, { color: 'bg-amber-500' }]
    if (day === 18) return [{ color: 'bg-green-500' }]
    if (day === 22) return [{ color: 'bg-red-500' }, { color: 'bg-blue-500' }]
    return []
  }

  return (
    <TutorielPreviewWrapper>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Janvier 2024</CardTitle>
            <div className="flex gap-1">
              <ChevronLeft className="h-4 w-4 text-muted-foreground cursor-pointer" />
              <ChevronRight className="h-4 w-4 text-muted-foreground cursor-pointer" />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Day headers */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((day, i) => (
              <div key={`day-${i}-${day}`} className="text-center text-xs font-medium text-muted-foreground py-1">
                {day}
              </div>
            ))}
          </div>
          
          {/* Calendar grid */}
          <div className="grid grid-cols-7 gap-1">
            {/* Empty cells for first week offset */}
            {[...Array(1)].map((_, i) => (
              <div key={`empty-${i}`} className="h-10" />
            ))}
            
            {daysInMonth.map((day) => {
              const events = eventsOnDay(day)
              const isSelected = day === selectedDay
              const isToday = day === 15
              
              return (
                <div
                  key={day}
                  className={cn(
                    "h-10 rounded-md flex flex-col items-center justify-center transition-all duration-300 cursor-pointer",
                    isSelected && "bg-primary text-primary-foreground",
                    isToday && !isSelected && "ring-2 ring-primary",
                    !isSelected && "hover:bg-muted",
                    isVisible ? "opacity-100" : "opacity-0"
                  )}
                  style={{ transitionDelay: `${day * 10}ms` }}
                >
                  <span className="text-xs font-medium">{day}</span>
                  {events.length > 0 && (
                    <div className="flex gap-0.5 mt-0.5">
                      {events.slice(0, 3).map((event, i) => (
                        <div key={`evt-${day}-${i}`} className={cn("w-1 h-1 rounded-full", event.color)} />
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </TutorielPreviewWrapper>
  )
})
CalendarMonthPreview.displayName = 'CalendarMonthPreview'

/**
 * Détail d'un événement
 */
export const CalendarEventDetailPreview = memo(() => {
  const [isVisible, setIsVisible] = useState(false)
  
  useEffect(() => {
    setIsVisible(true)
  }, [])

  const event = mockCalendarEvents[0]

  return (
    <TutorielPreviewWrapper>
      <Card className={cn(
        "transition-all duration-500",
        isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
      )}>
        <CardContent className="p-4">
          {/* Color indicator */}
          <div className={cn("h-2 w-full rounded-t-lg -mt-4 -mx-4 mb-4", event.color)} />
          
          {/* Title */}
          <h3 className="font-semibold text-lg mb-3">{event.title}</h3>
          
          {/* Details */}
          <div className="space-y-3">
            <div className="flex items-center gap-3 text-sm">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span>{event.start} - {event.end}</span>
              <Badge variant="outline" className="ml-auto">1h30</Badge>
            </div>
            
            <div className="flex items-center gap-3 text-sm">
              <Video className="h-4 w-4 text-muted-foreground" />
              <span>{event.location}</span>
            </div>
            
            <div className="flex items-start gap-3 text-sm">
              <Users className="h-4 w-4 text-muted-foreground mt-0.5" />
              <div className="flex flex-wrap gap-2">
                {event.attendees.map((attendee, i) => (
                  <div key={`att-${attendee}-${i}`} className="flex items-center gap-1.5">
                    <Avatar className="h-6 w-6">
                      <AvatarFallback className="text-xs bg-primary/10 text-primary">
                        {attendee.split(' ').map(n => n[0]).join('')}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-xs">{attendee}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </TutorielPreviewWrapper>
  )
})
CalendarEventDetailPreview.displayName = 'CalendarEventDetailPreview'

/**
 * Rappels de calendrier
 */
export const CalendarRemindersPreview = memo(() => {
  const [isVisible, setIsVisible] = useState(false)
  
  useEffect(() => {
    setIsVisible(true)
  }, [])

  return (
    <TutorielPreviewWrapper>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Bell className="h-4 w-4" />
            Rappels à venir
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {mockReminders.map((reminder, index) => (
              <div
                key={reminder.id}
                className={cn(
                  "flex items-center gap-3 p-3 rounded-lg bg-warning/10 border border-warning/20 transition-all duration-500",
                  isVisible ? "opacity-100 translate-x-0" : "opacity-0 translate-x-4"
                )}
                style={{ transitionDelay: `${index * 150}ms` }}
              >
                <Bell className="h-4 w-4 text-warning animate-bounce-gentle" />
                <div className="flex-1">
                  <p className="text-sm font-medium">{reminder.title}</p>
                  <p className="text-xs text-muted-foreground">{reminder.event}</p>
                </div>
                <Badge variant="outline" className="text-xs">
                  {reminder.time}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </TutorielPreviewWrapper>
  )
})
CalendarRemindersPreview.displayName = 'CalendarRemindersPreview'
