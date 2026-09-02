import { parseISO, isSameDay } from 'date-fns'
import { CalendarEvent } from '@/types/calendar'
import { CalendarAbsence } from '@/hooks/calendar/useCalendarAbsences'
import { getStatusSolidColor } from '@/lib/calendarUtils'

export interface TimelineTask {
  id: string
  titre: string
  echeance?: string
  statut: string
  priorite?: string
  categories_taches?: { nom: string; couleur?: string } | null
}

export interface DayEventMeta {
  event: CalendarEvent
  isStartDay: boolean
  isEndDay: boolean
  effectiveStartMinutes: number
  effectiveEndMinutes: number
}

export interface AllDayEventMeta {
  event: CalendarEvent
  isStartDay: boolean
  isEndDay: boolean
}

export interface ContinuousBanner {
  id: string
  title: string
  color: string
  startColumn: number
  endColumn: number
  row: number
  type: 'event' | 'task' | 'absence'
  originalItem: CalendarEvent | TimelineTask | CalendarAbsence
}

export interface ContentFiltersLite {
  showEvents: boolean
  showTasks: boolean
  showAbsences: boolean
}

export function calculateBannerRows(banners: Omit<ContinuousBanner, 'row'>[]): ContinuousBanner[] {
  const sorted = [...banners].sort(
    (a, b) => a.startColumn - b.startColumn || a.endColumn - b.endColumn
  )
  const rows: { endColumn: number }[] = []

  return sorted.map((banner) => {
    let row = rows.findIndex((r) => r.endColumn < banner.startColumn)
    if (row === -1) {
      row = rows.length
      rows.push({ endColumn: banner.endColumn })
    } else {
      rows[row].endColumn = banner.endColumn
    }
    return { ...banner, row }
  })
}

export function buildContinuousBanners(params: {
  events: CalendarEvent[]
  absences: CalendarAbsence[]
  tasks: TimelineTask[]
  weekDays: Date[]
  contentFilters: ContentFiltersLite
}): ContinuousBanner[] {
  const { events, absences, tasks, weekDays, contentFilters } = params
  const banners: Omit<ContinuousBanner, 'row'>[] = []
  const processedEventIds = new Set<string>()
  const processedAbsenceIds = new Set<string>()

  if (contentFilters.showEvents) {
    events.forEach((event) => {
      if (processedEventIds.has(event.id)) return
      const treatAsBanner = event.display_as_banner === true || event.all_day === true
      if (!treatAsBanner) return

      const eventStart = parseISO(event.start_time)
      const eventEnd = parseISO(event.end_time)

      let startCol = -1
      let endCol = -1

      weekDays.forEach((day, index) => {
        const dayStart = new Date(day)
        dayStart.setHours(0, 0, 0, 0)
        const dayEnd = new Date(day)
        dayEnd.setHours(23, 59, 59, 999)

        if (eventStart <= dayEnd && eventEnd >= dayStart) {
          if (startCol === -1) startCol = index
          endCol = index
        }
      })

      if (startCol !== -1) {
        banners.push({
          id: event.id,
          title: event.title,
          color: event.color || event.calendar?.color || '#1a73e8',
          startColumn: startCol,
          endColumn: endCol,
          type: 'event',
          originalItem: event,
        })
        processedEventIds.add(event.id)
      }
    })
  }

  if (contentFilters.showAbsences) {
    absences.forEach((absence) => {
      if (processedAbsenceIds.has(absence.id)) return

      let startCol = -1
      let endCol = -1

      weekDays.forEach((day, index) => {
        if (
          (day >= absence.start && day <= absence.end) ||
          isSameDay(day, absence.start) ||
          isSameDay(day, absence.end)
        ) {
          if (startCol === -1) startCol = index
          endCol = index
        }
      })

      if (startCol !== -1) {
        banners.push({
          id: absence.id,
          title: absence.profile_name.split(' ')[0],
          color: absence.color,
          startColumn: startCol,
          endColumn: endCol,
          type: 'absence',
          originalItem: absence,
        })
        processedAbsenceIds.add(absence.id)
      }
    })
  }

  if (contentFilters.showTasks) {
    tasks.forEach((task) => {
      if (!task.echeance) return
      const taskDate = parseISO(task.echeance)
      const colIndex = weekDays.findIndex((day) => isSameDay(day, taskDate))
      if (colIndex !== -1) {
        const categoryColor = task.categories_taches?.couleur
        const solidBgColor = categoryColor || getStatusSolidColor(task.statut)
        banners.push({
          id: task.id,
          title: task.titre,
          color: solidBgColor,
          startColumn: colIndex,
          endColumn: colIndex,
          type: 'task',
          originalItem: task,
        })
      }
    })
  }

  return calculateBannerRows(banners)
}

export function splitEventsByDay(params: {
  events: CalendarEvent[]
  weekDays: Date[]
  contentFilters: ContentFiltersLite
  startHour: number
  endHour: number
}): {
  allDayEventsByDay: Record<number, AllDayEventMeta[]>
  timedEventsByDay: Record<number, DayEventMeta[]>
} {
  const { events, weekDays, contentFilters, startHour, endHour } = params
  if (!contentFilters.showEvents) {
    return { allDayEventsByDay: {}, timedEventsByDay: {} }
  }

  const allDay: Record<number, AllDayEventMeta[]> = {}
  const timed: Record<number, DayEventMeta[]> = {}

  weekDays.forEach((day, index) => {
    allDay[index] = []
    timed[index] = []

    events.forEach((event) => {
      const eventStart = parseISO(event.start_time)
      const eventEnd = parseISO(event.end_time)

      const dayStart = new Date(day)
      dayStart.setHours(0, 0, 0, 0)
      const dayEnd = new Date(day)
      dayEnd.setHours(23, 59, 59, 999)

      const isOnThisDay = eventStart <= dayEnd && eventEnd >= dayStart
      if (!isOnThisDay) return

      const treatAsBanner = event.display_as_banner === true || event.all_day === true
      const isStartDay = isSameDay(eventStart, day)
      const isEndDay = isSameDay(eventEnd, day)

      if (treatAsBanner) {
        allDay[index].push({ event, isStartDay, isEndDay })
      } else {
        let effectiveStartMinutes = isStartDay
          ? (eventStart.getHours() - startHour) * 60 + eventStart.getMinutes()
          : 0
        let effectiveEndMinutes = isEndDay
          ? (eventEnd.getHours() - startHour) * 60 + eventEnd.getMinutes()
          : (endHour - startHour) * 60

        effectiveStartMinutes = Math.max(0, effectiveStartMinutes)
        effectiveEndMinutes = Math.min((endHour - startHour) * 60, effectiveEndMinutes)

        if (effectiveEndMinutes > effectiveStartMinutes) {
          timed[index].push({
            event,
            isStartDay,
            isEndDay,
            effectiveStartMinutes,
            effectiveEndMinutes,
          })
        }
      }
    })
  })

  return { allDayEventsByDay: allDay, timedEventsByDay: timed }
}
