import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { debug } from '@/lib/debug'
import { useAuth } from '@/components/AuthProvider'
import { toast } from 'sonner'
import type { CalendarEvent, CreateEventInput, UpdateEventInput } from '@/types/calendar'
import { expandRecurringEvent } from '@/lib/recurrenceUtils'
import { queryPresets } from '@/lib/queryPresets'
import { format, parseISO } from 'date-fns'

interface EventsQueryParams {
  calendarIds?: string[]
  startDate?: Date
  endDate?: Date
}

/**
 * Pass-through: on ne réécrit plus les dates all-day.
 * La convention côté écriture est désormais :
 *   - start_time = YYYY-MM-DDT00:00:00.000Z (jour de début, minuit UTC)
 *   - end_time   = (jourDeFin + 1)T00:00:00.000Z (fin exclusive, minuit UTC)
 * Les vues (mois/semaine) détectent ce cas grâce à `all_day = true` et
 * ramènent la fin au dernier jour inclusif.
 */
function normalizeAllDayEvent(event: CalendarEvent): CalendarEvent {
  return event
}

/**
 * Hook pour récupérer et gérer les événements du calendrier.
 *
 * Récupère les événements des calendriers spécifiés, avec expansion
 * automatique des événements récurrents (RRULE) dans la plage de dates.
 * Déduplique les occurrences par date/titre/calendrier.
 *
 * @param {EventsQueryParams} params - Paramètres de filtrage
 * @param {string[]} [params.calendarIds] - IDs des calendriers à inclure
 * @param {Date} [params.startDate] - Date de début de la plage
 * @param {Date} [params.endDate] - Date de fin de la plage
 *
 * @returns {UseQueryResult<CalendarEvent[]>} Événements filtrés et expandus
 *
 * @example
 * ```tsx
 * function MonthView({ date }: { date: Date }) {
 *   const startDate = startOfMonth(date);
 *   const endDate = endOfMonth(date);
 *
 *   const { data: events, isLoading } = useCalendarEvents({
 *     calendarIds: visibleCalendarIds,
 *     startDate,
 *     endDate,
 *   });
 *
 *   return events?.map(event => (
 *     <EventCard key={event.id} event={event} />
 *   ));
 * }
 * ```
 *
 * @see {@link useCreateEvent} pour créer un événement
 * @see {@link useMoveEvent} pour déplacer un événement par drag-drop
 */
export function useCalendarEvents(params: EventsQueryParams = {}) {
  const { user } = useAuth()
  const { calendarIds, startDate, endDate } = params

  return useQuery({
    queryKey: [
      'calendar-events',
      calendarIds?.slice().sort().join(',') ?? '',
      startDate?.toISOString(),
      endDate?.toISOString(),
    ],
    queryFn: async () => {
      if (calendarIds && calendarIds.length === 0) {
        return []
      }

      let query = supabase
        .from('calendar_events')
        .select(
          'id, calendar_id, title, description, location, video_conference_url, start_time, end_time, all_day, status, visibility, recurrence_rule, recurrence_parent_id, recurrence_exception_dates, etablissement_id, tache_id, color, category_id, display_as_banner, availability, created_by, created_at, updated_at, calendar:calendars(id, name, color, type)'
        )

      // Filtrer par calendriers visibles
      if (calendarIds && calendarIds.length > 0) {
        query = query.in('calendar_id', calendarIds)
      }

      // Exclure les événements annulés par défaut
      query = query.neq('status', 'cancelled')

      // Apply date range filter at DB level to avoid hitting the limit
      // For recurring events, we also need events starting before the range
      // that might have occurrences within it, so we use a wider window
      if (startDate && endDate) {
        // Get recurring events that start before the range (they might repeat into it)
        // and all events that end after the range start
        // We use a 1-year lookback for recurring events
        const lookbackDate = new Date(startDate)
        lookbackDate.setFullYear(lookbackDate.getFullYear() - 1)

        query = query
          .gte('end_time', lookbackDate.toISOString())
          .lte('start_time', endDate.toISOString())
      }

      // Safety limit
      const { data, error } = await query.order('start_time').limit(1000)

      if (error) throw error

      const rawEvents = ((data || []) as unknown as CalendarEvent[]).map(normalizeAllDayEvent)

      // Expand recurring events if we have a date range
      if (startDate && endDate) {
        const expandedEvents = rawEvents.flatMap((event) => {
          if (event.recurrence_rule) {
            return expandRecurringEvent(event, startDate, endDate)
          }
          return [event]
        })

        // Filter to only include events within the range
        const filteredEvents = expandedEvents.filter((event) => {
          const eventEnd = new Date(event.end_time)
          const eventStart = new Date(event.start_time)
          return eventEnd >= startDate && eventStart <= endDate
        })

        // Deduplicate by id only (virtual occurrences already have unique
        // `{parentId}_occ_{date}` ids). Do NOT deduplicate by title+date+calendar
        // — that hid legitimate distinct events with the same title.
        const seen = new Set<string>()
        const uniqueEvents = filteredEvents.filter((event) => {
          if (seen.has(event.id)) return false
          seen.add(event.id)
          return true
        })

        return uniqueEvents
      }

      return rawEvents
    },
    enabled: !!user,
    ...queryPresets.frequent, // Events need quick refresh after creation
  })
}

export function useCalendarEvent(eventId: string | undefined) {
  return useQuery({
    queryKey: ['calendar-event', eventId],
    queryFn: async () => {
      if (!eventId) return null

      const { data, error } = await supabase
        .from('calendar_events')
        .select(
          'id, calendar_id, title, description, location, video_conference_url, start_time, end_time, all_day, status, visibility, recurrence_rule, recurrence_parent_id, recurrence_exception_dates, etablissement_id, tache_id, color, category_id, display_as_banner, availability, created_by, created_at, updated_at, calendar:calendars(id, name, color, type)'
        )
        .eq('id', eventId)
        .maybeSingle()

      if (error) throw error
      return data ? normalizeAllDayEvent(data as unknown as CalendarEvent) : null
    },
    enabled: !!eventId,
  })
}

export function useCreateEvent() {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  return useMutation({
    mutationFn: async (input: CreateEventInput) => {
      if (!user?.id) {
        throw new Error('Non authentifié')
      }
      if (!input.calendar_id) {
        throw new Error('Aucun calendrier disponible')
      }

      const insertPayload = {
        calendar_id: input.calendar_id,
        title: input.title,
        description: input.description,
        location: input.location,
        video_conference_url: input.video_conference_url,
        start_time: input.start_time,
        end_time: input.end_time,
        all_day: input.all_day,
        status: input.status ?? 'confirmed',
        visibility: input.visibility ?? 'private',
        recurrence_rule: input.recurrence_rule,
        etablissement_id: input.etablissement_id,
        tache_id: input.tache_id,
        color: input.color,
        display_as_banner: input.display_as_banner ?? false,
        availability: input.availability ?? 'busy',
        created_by: user.id,
        ...('category_id' in input ? { category_id: input.category_id ?? null } : {}),
      }

      const { data, error } = await supabase
        .from('calendar_events')
        .insert(insertPayload)
        .select(
          'id, calendar_id, title, description, location, video_conference_url, start_time, end_time, all_day, status, visibility, recurrence_rule, recurrence_parent_id, recurrence_exception_dates, etablissement_id, tache_id, color, category_id, display_as_banner, availability, created_by, created_at, updated_at'
        )
        // safe: guaranteed-row
        .single()

      if (error) throw error
      return normalizeAllDayEvent(data as unknown as CalendarEvent)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar-events'], refetchType: 'all' })
      toast.success('Événement créé')
    },
    onError: (error) => {
      toast.error('Erreur lors de la création')
      debug.error('Create event error:', error)
    },
  })
}

export function useUpdateEvent() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, ...input }: UpdateEventInput & { id: string }) => {
      const { data, error } = await supabase
        .from('calendar_events')
        .update(input)
        .eq('id', id)
        .select(
          'id, calendar_id, title, description, location, video_conference_url, start_time, end_time, all_day, status, visibility, recurrence_rule, recurrence_parent_id, recurrence_exception_dates, etablissement_id, tache_id, color, category_id, display_as_banner, availability, created_by, created_at, updated_at'
        )
        // safe: guaranteed-row
        .single()

      if (error) throw error
      return normalizeAllDayEvent(data as unknown as CalendarEvent)
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['calendar-events'], refetchType: 'all' })
      queryClient.invalidateQueries({ queryKey: ['calendar-event', data.id] })
      toast.success('Événement mis à jour')
    },
    onError: (error) => {
      toast.error('Erreur lors de la mise à jour')
      debug.error('Update event error:', error)
    },
  })
}

export function useDeleteEvent() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase
        .from('calendar_events')
        .delete()
        .eq('id', id)
        .select('id')

      if (error) {
        debug.error('[useDeleteEvent] Supabase delete error', { id, error })
        throw error
      }
      if (Array.isArray(data) && data.length === 0) {
        debug.error('[useDeleteEvent] Delete returned 0 rows (RLS or already deleted)', { id })
        throw new Error(
          "Suppression refusée : vous n'avez pas les droits sur ce calendrier ou l'événement n'existe plus."
        )
      }
      return { id, data }
    },
    onMutate: async (id: string) => {
      // Optimistic removal from every cached calendar-events query
      await queryClient.cancelQueries({ queryKey: ['calendar-events'] })
      const previous = queryClient.getQueriesData<CalendarEvent[]>({
        queryKey: ['calendar-events'],
      })
      previous.forEach(([key, events]) => {
        if (!Array.isArray(events)) return
        queryClient.setQueryData<CalendarEvent[]>(
          key,
          events.filter((e) => {
            // Remove the event itself, its virtual occurrences, and any children
            if (e.id === id) return false
            if (typeof e.id === 'string' && e.id.startsWith(`${id}_occ_`)) return false
            if ((e as any).recurrence_parent_id === id) return false
            return true
          })
        )
      })
      return { previous }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar-events'], refetchType: 'all' })
      toast.success('Événement supprimé')
    },
    onError: (error: any, _id, context: any) => {
      // Rollback optimistic removal
      if (context?.previous) {
        context.previous.forEach(([key, events]: [any, any]) => {
          queryClient.setQueryData(key, events)
        })
      }
      toast.error('Erreur lors de la suppression')
      debug.error('Delete event error:', error)
    },
  })
}

/**
 * Apply optimistic patch to every cached calendar-events query.
 * Handles virtual recurring occurrences (id === `${parentId}_occ_${date}`) too.
 */
function patchCachedEvent(
  queryClient: ReturnType<typeof useQueryClient>,
  id: string,
  patch: Partial<CalendarEvent>
) {
  const parentId = id.includes('_occ_') ? id.split('_occ_')[0] : id
  const previous = queryClient.getQueriesData<CalendarEvent[]>({ queryKey: ['calendar-events'] })
  previous.forEach(([key, events]) => {
    if (!Array.isArray(events)) return
    queryClient.setQueryData<CalendarEvent[]>(
      key,
      events.map((e) => {
        if (e.id === id || e.id === parentId) return { ...e, ...patch }
        return e
      })
    )
  })
  return previous
}

export function useMoveEvent() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      id,
      start_time,
      end_time,
    }: {
      id: string
      start_time: string
      end_time: string
    }) => {
      // If id is a virtual recurring occurrence, patch the parent event
      const realId = id.includes('_occ_') ? id.split('_occ_')[0] : id
      const { data, error } = await supabase
        .from('calendar_events')
        .update({ start_time, end_time })
        .eq('id', realId)
        .select()
        // safe: guaranteed-row
        .single()

      if (error) throw error
      return normalizeAllDayEvent(data as unknown as CalendarEvent)
    },
    onMutate: async ({ id, start_time, end_time }) => {
      await queryClient.cancelQueries({ queryKey: ['calendar-events'] })
      const previous = patchCachedEvent(queryClient, id, { start_time, end_time })
      return { previous }
    },
    onError: (error, _vars, context: any) => {
      if (context?.previous) {
        context.previous.forEach(([key, events]: [any, any]) => {
          queryClient.setQueryData(key, events)
        })
      }
      toast.error("Impossible de déplacer l'événement")
      debug.error('Move event error:', error)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar-events'] })
    },
  })
}

export function useResizeEvent() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, end_time }: { id: string; end_time: string }) => {
      const realId = id.includes('_occ_') ? id.split('_occ_')[0] : id
      const { data, error } = await supabase
        .from('calendar_events')
        .update({ end_time })
        .eq('id', realId)
        .select()
        // safe: guaranteed-row
        .single()

      if (error) throw error
      return normalizeAllDayEvent(data as unknown as CalendarEvent)
    },
    onMutate: async ({ id, end_time }) => {
      await queryClient.cancelQueries({ queryKey: ['calendar-events'] })
      const previous = patchCachedEvent(queryClient, id, { end_time })
      return { previous }
    },
    onError: (error, _vars, context: any) => {
      if (context?.previous) {
        context.previous.forEach(([key, events]: [any, any]) => {
          queryClient.setQueryData(key, events)
        })
      }
      toast.error("Impossible de redimensionner l'événement")
      debug.error('Resize event error:', error)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar-events'] })
    },
  })
}

/**
 * Hook to delete a single occurrence of a recurring event
 * by adding the occurrence date to recurrence_exception_dates
 */
export function useDeleteOccurrence() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      parentId,
      occurrenceDate,
    }: {
      parentId: string
      occurrenceDate: string
    }) => {
      // 1. Fetch the parent event to get existing exception dates
      const { data: parent, error: fetchError } = await supabase
        .from('calendar_events')
        .select('recurrence_exception_dates')
        .eq('id', parentId)
        .maybeSingle()

      if (fetchError) throw fetchError
      if (!parent) throw new Error('Événement parent introuvable')

      // 2. Add the new exception date (normalize to YYYY-MM-DD, dedupe)
      // Column type is timestamp[], Postgres casts YYYY-MM-DD to midnight UTC.
      const existingExceptions = (parent?.recurrence_exception_dates || []) as unknown[]
      const normalizedExisting = existingExceptions
        .map((d) => (typeof d === 'string' ? d.substring(0, 10) : null))
        .filter((d): d is string => !!d)
      const newExceptions = Array.from(new Set([...normalizedExisting, occurrenceDate]))

      // 3. Update the parent event
      const { error: updateError } = await supabase
        .from('calendar_events')
        .update({ recurrence_exception_dates: newExceptions })
        .eq('id', parentId)

      if (updateError) throw updateError
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar-events'] })
      toast.success('Occurrence supprimée')
    },
    onError: (error) => {
      toast.error("Erreur lors de la suppression de l'occurrence")
      debug.error('Delete occurrence error:', error)
    },
  })
}

export function useDuplicateEvent() {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  return useMutation({
    mutationFn: async (eventId: string) => {
      // Récupérer l'événement original
      const { data: original, error: fetchError } = await supabase
        .from('calendar_events')
        .select(
          'calendar_id, title, description, location, video_conference_url, start_time, end_time, all_day, status, visibility, recurrence_rule, etablissement_id, tache_id, color'
        )
        .eq('id', eventId)
        .maybeSingle()

      if (fetchError) throw fetchError
      if (!original) throw new Error('Event not found')

      // Créer une copie
      const { data, error } = await supabase
        .from('calendar_events')
        .insert({
          calendar_id: original.calendar_id,
          title: `${original.title} (copie)`,
          description: original.description,
          location: original.location,
          video_conference_url: original.video_conference_url,
          start_time: original.start_time,
          end_time: original.end_time,
          all_day: original.all_day,
          status: original.status,
          visibility: original.visibility,
          recurrence_rule: original.recurrence_rule,
          etablissement_id: original.etablissement_id,
          tache_id: original.tache_id,
          color: original.color,
          created_by: user?.id,
        })
        .select(
          'id, calendar_id, title, description, location, video_conference_url, start_time, end_time, all_day, status, visibility, recurrence_rule, recurrence_parent_id, recurrence_exception_dates, etablissement_id, tache_id, color, created_by, created_at, updated_at'
        )
        // safe: guaranteed-row
        .single()

      if (error) throw error
      return normalizeAllDayEvent(data as unknown as CalendarEvent)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar-events'] })
      toast.success('Événement dupliqué')
    },
    onError: (error) => {
      toast.error('Erreur lors de la duplication')
      debug.error('Duplicate event error:', error)
    },
  })
}
