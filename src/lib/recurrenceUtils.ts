import {
  addDays,
  addWeeks,
  addMonths,
  addYears,
  parseISO,
  format,
  isBefore,
  isAfter,
  getISOWeek,
  startOfWeek,
} from 'date-fns'
import type { CalendarEvent } from '@/types/calendar'

/**
 * Normalize a stored exception value (Postgres timestamp, ISO date, Date) to YYYY-MM-DD.
 */
export function normalizeExceptionDate(value: unknown): string | null {
  if (!value) return null
  if (typeof value === 'string') {
    // Handles "2026-08-03", "2026-08-03T00:00:00+00:00", "2026-08-03 00:00:00+00"
    return value.substring(0, 10)
  }
  if (value instanceof Date) return format(value, 'yyyy-MM-dd')
  return null
}

/**
 * Check whether a given YYYY-MM-DD occurrence date is present in the stored exception list,
 * tolerating timestamp/date/string variants returned by Postgres.
 */
export function isExceptionDate(exceptions: unknown, occurrenceDateStr: string): boolean {
  if (!Array.isArray(exceptions)) return false
  for (const exc of exceptions) {
    if (normalizeExceptionDate(exc) === occurrenceDateStr) return true
  }
  return false
}

/**
 * Check if an ID is a virtual occurrence ID (not a real UUID)
 */
export function isOccurrenceId(id: string): boolean {
  return id.includes('_occ_')
}

/**
 * Parse a virtual occurrence ID to extract the parent ID and occurrence date
 */
export function parseOccurrenceId(id: string): { parentId: string; occurrenceDate: string } | null {
  const match = id.match(/^(.+)_occ_(\d{4}-\d{2}-\d{2})$/)
  if (!match) return null
  return { parentId: match[1], occurrenceDate: match[2] }
}

interface RRuleParams {
  freq: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY'
  interval: number
  byDay: string[] // MO, TU, WE, TH, FR, SA, SU
  count?: number
  until?: Date
}

const DAY_MAP: Record<string, number> = {
  SU: 0,
  MO: 1,
  TU: 2,
  WE: 3,
  TH: 4,
  FR: 5,
  SA: 6,
}

const DAY_NAMES: Record<string, string> = {
  MO: 'lundi',
  TU: 'mardi',
  WE: 'mercredi',
  TH: 'jeudi',
  FR: 'vendredi',
  SA: 'samedi',
  SU: 'dimanche',
}

/**
 * Parse an RRULE string into structured parameters
 */
export function parseRRule(rule: string): RRuleParams {
  const params: RRuleParams = {
    freq: 'WEEKLY',
    interval: 1,
    byDay: [],
  }

  if (!rule) return params

  const parts = rule.split(';')
  for (const part of parts) {
    const [key, value] = part.split('=')
    switch (key) {
      case 'FREQ':
        params.freq = value as RRuleParams['freq']
        break
      case 'INTERVAL':
        params.interval = parseInt(value, 10) || 1
        break
      case 'BYDAY':
        params.byDay = value.split(',')
        break
      case 'COUNT':
        params.count = parseInt(value, 10)
        break
      case 'UNTIL':
        params.until = parseISO(value)
        break
    }
  }

  return params
}

/**
 * Check if a given date is on an even ISO week
 */
export function isEvenWeek(date: Date): boolean {
  return getISOWeek(date) % 2 === 0
}

/**
 * Expand a recurring event into individual occurrences within a date range
 */
export function expandRecurringEvent(
  event: CalendarEvent,
  rangeStart: Date,
  rangeEnd: Date
): CalendarEvent[] {
  if (!event.recurrence_rule) {
    return [event]
  }

  const params = parseRRule(event.recurrence_rule)
  const occurrences: CalendarEvent[] = []
  const eventStart = parseISO(event.start_time)
  const eventEnd = parseISO(event.end_time)
  const duration = eventEnd.getTime() - eventStart.getTime()

  // For all_day events, use date-only comparison to avoid timezone issues
  // Extract YYYY-MM-DD from event.start_time for comparison
  const eventStartDateStr = event.start_time.substring(0, 10)

  // For INTERVAL=2 (bi-weekly), track the starting week parity
  const startWeekIsEven = isEvenWeek(eventStart)

  // Determine which days to generate for weekly recurrence with BYDAY
  const daysToGenerate =
    params.byDay.length > 0 ? params.byDay.map((d) => DAY_MAP[d]) : [eventStart.getDay()]

  // Maximum occurrences to prevent infinite loops
  const maxOccurrences = params.count || 365
  let occurrenceCount = 0

  // Start from the Monday of the event's starting week
  let currentWeekStart = startOfWeek(eventStart, { weekStartsOn: 1 })

  // Track generated dates to avoid duplicates
  const generatedDates = new Set<string>()

  while (isBefore(currentWeekStart, rangeEnd) && occurrenceCount < maxOccurrences) {
    // Check UNTIL constraint
    if (params.until && isAfter(currentWeekStart, params.until)) {
      break
    }

    // For INTERVAL=2, check week parity matches the original event
    const currentWeekIsEven = isEvenWeek(currentWeekStart)
    const shouldGenerateThisWeek =
      params.interval === 1 || (params.interval === 2 && currentWeekIsEven === startWeekIsEven)

    if (params.freq === 'WEEKLY' && shouldGenerateThisWeek) {
      // Generate occurrences for each day in BYDAY
      for (const dayNum of daysToGenerate) {
        // dayNum: 0=SU, 1=MO, 2=TU, 3=WE, 4=TH, 5=FR, 6=SA
        // currentWeekStart is Monday (day 1)
        // Offset from Monday: SU = 6, MO = 0, TU = 1, WE = 2, TH = 3, FR = 4, SA = 5
        const offsetFromMonday = dayNum === 0 ? 6 : dayNum - 1
        const occurrenceDate = addDays(currentWeekStart, offsetFromMonday)
        const occurrenceDateStr = format(occurrenceDate, 'yyyy-MM-dd')

        // Skip if before the original event start
        // For all_day events, compare dates only (YYYY-MM-DD) to avoid timezone issues
        if (event.all_day) {
          // Date comparison: occurrence must be >= event start date
          if (occurrenceDateStr < eventStartDateStr) continue
        } else {
          if (isBefore(occurrenceDate, eventStart)) continue
        }

        // Skip if outside range
        if (isBefore(occurrenceDate, rangeStart) || isAfter(occurrenceDate, rangeEnd)) continue

        // Skip if this date is in the exception dates (deleted occurrences)
        if (isExceptionDate(event.recurrence_exception_dates, occurrenceDateStr)) continue

        // Skip if already generated (deduplication)
        const dedupeKey = `${event.id}_${occurrenceDateStr}`
        if (generatedDates.has(dedupeKey)) continue
        generatedDates.add(dedupeKey)

        // Create the occurrence - use local format to avoid timezone issues
        const occurrenceStart = new Date(occurrenceDate)
        occurrenceStart.setHours(eventStart.getHours(), eventStart.getMinutes(), 0, 0)
        const occurrenceEnd = new Date(occurrenceStart.getTime() + duration)

        // For all_day events, use local date format without timezone offset
        let startTimeStr: string
        let endTimeStr: string
        if (event.all_day) {
          startTimeStr = `${occurrenceDateStr}T00:00:00`
          endTimeStr = `${occurrenceDateStr}T23:59:59`
        } else {
          // Use format to avoid UTC conversion issues
          startTimeStr = format(occurrenceStart, "yyyy-MM-dd'T'HH:mm:ss")
          endTimeStr = format(occurrenceEnd, "yyyy-MM-dd'T'HH:mm:ss")
        }

        occurrences.push({
          ...event,
          id: `${event.id}_occ_${occurrenceDateStr}`,
          start_time: startTimeStr,
          end_time: endTimeStr,
          recurrence_parent_id: event.id,
        })
        occurrenceCount++

        if (params.count && occurrenceCount >= params.count) break
      }
    } else if (params.freq === 'DAILY') {
      if (!isBefore(currentWeekStart, eventStart) && !isBefore(currentWeekStart, rangeStart)) {
        const occurrenceStart = new Date(currentWeekStart)
        occurrenceStart.setHours(eventStart.getHours(), eventStart.getMinutes(), 0, 0)
        const occurrenceEnd = new Date(occurrenceStart.getTime() + duration)

        if (!isAfter(occurrenceStart, rangeEnd)) {
          occurrences.push({
            ...event,
            id: `${event.id}_occ_${format(currentWeekStart, 'yyyy-MM-dd')}`,
            start_time: occurrenceStart.toISOString(),
            end_time: occurrenceEnd.toISOString(),
            recurrence_parent_id: event.id,
          })
          occurrenceCount++
        }
      }
    } else if (params.freq === 'MONTHLY') {
      if (!isBefore(currentWeekStart, eventStart) && !isBefore(currentWeekStart, rangeStart)) {
        const occurrenceStart = new Date(currentWeekStart)
        occurrenceStart.setDate(eventStart.getDate())
        occurrenceStart.setHours(eventStart.getHours(), eventStart.getMinutes(), 0, 0)
        const occurrenceEnd = new Date(occurrenceStart.getTime() + duration)

        if (!isAfter(occurrenceStart, rangeEnd)) {
          occurrences.push({
            ...event,
            id: `${event.id}_occ_${format(occurrenceStart, 'yyyy-MM-dd')}`,
            start_time: occurrenceStart.toISOString(),
            end_time: occurrenceEnd.toISOString(),
            recurrence_parent_id: event.id,
          })
          occurrenceCount++
        }
      }
    } else if (params.freq === 'YEARLY') {
      if (!isBefore(currentWeekStart, eventStart) && !isBefore(currentWeekStart, rangeStart)) {
        const occurrenceStart = new Date(currentWeekStart)
        occurrenceStart.setMonth(eventStart.getMonth(), eventStart.getDate())
        occurrenceStart.setHours(eventStart.getHours(), eventStart.getMinutes(), 0, 0)
        const occurrenceEnd = new Date(occurrenceStart.getTime() + duration)

        if (!isAfter(occurrenceStart, rangeEnd)) {
          occurrences.push({
            ...event,
            id: `${event.id}_occ_${format(occurrenceStart, 'yyyy-MM-dd')}`,
            start_time: occurrenceStart.toISOString(),
            end_time: occurrenceEnd.toISOString(),
            recurrence_parent_id: event.id,
          })
          occurrenceCount++
        }
      }
    }

    // Advance to next period
    switch (params.freq) {
      case 'DAILY':
        currentWeekStart = addDays(currentWeekStart, params.interval)
        break
      case 'WEEKLY':
        currentWeekStart = addWeeks(currentWeekStart, 1)
        break
      case 'MONTHLY':
        currentWeekStart = addMonths(currentWeekStart, params.interval)
        break
      case 'YEARLY':
        currentWeekStart = addYears(currentWeekStart, params.interval)
        break
    }
  }

  return occurrences.length > 0 ? occurrences : [event]
}

/**
 * Format an RRULE for human-readable display
 */
export function formatRecurrenceRule(rule: string): string {
  if (!rule) return ''

  const params = parseRRule(rule)
  const parts: string[] = []

  // Frequency
  switch (params.freq) {
    case 'DAILY':
      parts.push(params.interval === 1 ? 'Tous les jours' : `Tous les ${params.interval} jours`)
      break
    case 'WEEKLY':
      if (params.interval === 1) {
        parts.push('Toutes les semaines')
      } else if (params.interval === 2) {
        parts.push('1 semaine sur 2')
      } else {
        parts.push(`Toutes les ${params.interval} semaines`)
      }
      break
    case 'MONTHLY':
      if (params.interval === 1) {
        parts.push('Tous les mois')
      } else if (params.interval === 3) {
        parts.push('Tous les trimestres')
      } else {
        parts.push(`Tous les ${params.interval} mois`)
      }
      break
    case 'YEARLY':
      parts.push(params.interval === 1 ? 'Tous les ans' : `Tous les ${params.interval} ans`)
      break
  }

  // Days of week
  if (params.byDay.length > 0) {
    const dayNames = params.byDay.map((d) => DAY_NAMES[d] || d)
    if (dayNames.length === 7) {
      // All days - don't add anything
    } else if (
      dayNames.length === 5 &&
      !params.byDay.includes('SA') &&
      !params.byDay.includes('SU')
    ) {
      parts.push('(jours ouvrés)')
    } else if (
      dayNames.length === 2 &&
      params.byDay.includes('SA') &&
      params.byDay.includes('SU')
    ) {
      parts.push('(week-ends)')
    } else {
      parts.push(`(${dayNames.join(', ')})`)
    }
  }

  return parts.join(' ')
}

/**
 * Minimal contract for a task with recurrence support.
 * Uses an open record so callers with richer task shapes (TacheEtablissement,
 * GanttTask, etc.) can pass their objects without extra adapters.
 */
export interface RecurringTaskLike {
  id: string
  date_debut?: string | null
  echeance?: string | null
  recurrence_rule?: string | null
  _isRecurrenceOccurrence?: boolean
  _parentTaskId?: string
  [key: string]: unknown
}

/** @deprecated kept for back-compat; use RecurringTaskLike directly. */
export type ExpandedRecurringTask = RecurringTaskLike

/**
 * Expand a recurring task into individual occurrences within a date range
 * Returns virtual tasks with generated IDs for display in Gantt
 */
type WithRecurrenceMeta<T> = T & { _isRecurrenceOccurrence?: boolean; _parentTaskId?: string }

export function expandRecurringTask<T extends RecurringTaskLike>(
  task: T,
  rangeStart: Date,
  rangeEnd: Date
): WithRecurrenceMeta<T>[] {
  if (!task.recurrence_rule || !task.date_debut || !task.echeance) {
    return [task]
  }

  const params = parseRRule(task.recurrence_rule)
  const occurrences: WithRecurrenceMeta<T>[] = []
  const taskStart = parseISO(task.date_debut)
  const taskEnd = parseISO(task.echeance)
  const duration = taskEnd.getTime() - taskStart.getTime()

  // Maximum occurrences to prevent infinite loops
  const maxOccurrences = 52 // Max 1 year of weekly occurrences
  let occurrenceCount = 0

  // Always include the original task first
  occurrences.push(task)
  occurrenceCount++

  // Start generating from the task's start date
  let currentDate = new Date(taskStart)

  // Advance to first future occurrence
  const advanceDate = () => {
    switch (params.freq) {
      case 'DAILY':
        currentDate = addDays(currentDate, params.interval)
        break
      case 'WEEKLY':
        currentDate = addWeeks(currentDate, params.interval)
        break
      case 'MONTHLY':
        currentDate = addMonths(currentDate, params.interval)
        break
      case 'YEARLY':
        currentDate = addYears(currentDate, params.interval)
        break
    }
  }

  // Generate occurrences
  while (occurrenceCount < maxOccurrences) {
    advanceDate()

    // Stop if past range end
    if (isAfter(currentDate, rangeEnd)) {
      break
    }

    // Check UNTIL constraint
    if (params.until && isAfter(currentDate, params.until)) {
      break
    }

    // Skip if before range start
    if (isBefore(currentDate, rangeStart)) {
      continue
    }

    // Calculate new dates for this occurrence
    const occurrenceStart = new Date(currentDate)
    const occurrenceEnd = new Date(currentDate.getTime() + duration)
    const occurrenceDateStr = format(occurrenceStart, 'yyyy-MM-dd')

    // Create the virtual occurrence
    occurrences.push({
      ...task,
      id: `${task.id}_occ_${occurrenceDateStr}`,
      date_debut: format(occurrenceStart, 'yyyy-MM-dd'),
      echeance: format(occurrenceEnd, 'yyyy-MM-dd'),
      _isRecurrenceOccurrence: true,
      _parentTaskId: task.id,
    })
    occurrenceCount++
  }

  return occurrences
}

/**
 * Expand all recurring tasks in a list
 */
export function expandAllRecurringTasks<T extends RecurringTaskLike>(
  tasks: T[],
  rangeStart: Date,
  rangeEnd: Date
): WithRecurrenceMeta<T>[] {
  const expanded: WithRecurrenceMeta<T>[] = []

  for (const task of tasks) {
    const occurrences = expandRecurringTask(task, rangeStart, rangeEnd)
    expanded.push(...occurrences)
  }

  return expanded
}
