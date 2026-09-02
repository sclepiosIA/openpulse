import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/components/AuthProvider'
import { debug } from '@/lib/debug'

/**
 * Realtime subscription for calendar_events, event_attendees, event_reminders.
 * Invalidates React Query caches on any INSERT/UPDATE/DELETE, with a 250ms
 * debounce to coalesce burst changes.
 *
 * Mount once at the top of the Calendrier page (or any calendar-heavy layout).
 */
export function useCalendarRealtime() {
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!user?.id) return

    const scheduleInvalidate = (keys: string[][]) => {
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => {
        keys.forEach((key) => {
          queryClient.invalidateQueries({ queryKey: key })
        })
      }, 250)
    }

    const channel = supabase
      .channel(`calendar-realtime-${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'calendar_events' },
        (payload) => {
          debug.log('[calendar-realtime] calendar_events', payload.eventType)
          scheduleInvalidate([
            ['calendar-events'],
            ['calendar-event'],
            ['calendar-today-count'],
            ['my-invitations'],
          ])
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'event_attendees' },
        (payload) => {
          debug.log('[calendar-realtime] event_attendees', payload.eventType)
          scheduleInvalidate([['event-attendees'], ['calendar-events'], ['my-invitations']])
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'event_reminders' },
        (payload) => {
          debug.log('[calendar-realtime] event_reminders', payload.eventType)
          scheduleInvalidate([['event-reminders'], ['pending-reminders']])
        }
      )
      .subscribe((status) => {
        debug.log('[calendar-realtime] channel status', status)
      })

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      supabase.removeChannel(channel)
    }
  }, [user?.id, queryClient])
}
