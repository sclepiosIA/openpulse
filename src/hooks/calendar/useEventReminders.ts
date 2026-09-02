import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/components/AuthProvider'
import { toast } from 'sonner'
import type { EventReminder, CreateReminderInput } from '@/types/calendar'
import { debug } from '@/lib/debug'

export function useEventReminders(eventId: string | undefined) {
  const { user } = useAuth()

  return useQuery({
    queryKey: ['event-reminders', eventId, user?.id],
    queryFn: async () => {
      if (!eventId || !user) return []

      const { data, error } = await supabase
        .from('event_reminders')
        .select('id, event_id, user_id, minutes_before, type, is_sent, sent_at, created_at')
        .eq('event_id', eventId)
        .eq('user_id', user.id)
        .order('minutes_before')
        .limit(50)

      if (error) throw error
      return data as EventReminder[]
    },
    enabled: !!eventId && !!user,
  })
}

export function useAddReminder() {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  return useMutation({
    mutationFn: async (input: CreateReminderInput) => {
      if (!user) throw new Error('Non authentifié')

      const { data, error } = await supabase
        .from('event_reminders')
        .insert({
          ...input,
          user_id: user.id,
        })
        .select()
        // safe: guaranteed-row
        .single() // safe: guaranteed-row

      if (error) throw error
      return data as EventReminder
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['event-reminders', data.event_id] })
      queryClient.invalidateQueries({ queryKey: ['calendar-event', data.event_id] })
      toast.success('Rappel ajouté')
    },
    onError: (error) => {
      toast.error("Erreur lors de l'ajout du rappel")
      debug.error('Add reminder error:', error)
    },
  })
}

export function useAddMultipleReminders() {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  return useMutation({
    mutationFn: async (inputs: Omit<CreateReminderInput, 'user_id'>[]) => {
      if (!user || inputs.length === 0) return []

      const remindersWithUser = inputs.map((input) => ({
        ...input,
        user_id: user.id,
      }))

      const { data, error } = await supabase
        .from('event_reminders')
        .insert(remindersWithUser)
        .select()

      if (error) throw error
      return data as EventReminder[]
    },
    onSuccess: (data) => {
      if (data.length > 0) {
        queryClient.invalidateQueries({ queryKey: ['event-reminders', data[0].event_id] })
        queryClient.invalidateQueries({ queryKey: ['calendar-event', data[0].event_id] })
      }
    },
  })
}

export function useRemoveReminder() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, eventId }: { id: string; eventId: string }) => {
      const { error } = await supabase.from('event_reminders').delete().eq('id', id)

      if (error) throw error
      return { eventId }
    },
    onSuccess: ({ eventId }) => {
      queryClient.invalidateQueries({ queryKey: ['event-reminders', eventId] })
      queryClient.invalidateQueries({ queryKey: ['calendar-event', eventId] })
      toast.success('Rappel supprimé')
    },
    onError: (error) => {
      toast.error('Erreur lors de la suppression')
      debug.error('Remove reminder error:', error)
    },
  })
}

export function useUpdateEventReminders() {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  return useMutation({
    mutationFn: async ({
      eventId,
      reminders,
    }: {
      eventId: string
      reminders: { minutes_before: number; type: EventReminder['type'] }[]
    }) => {
      if (!user) throw new Error('Non authentifié')

      // Supprimer les rappels existants
      await supabase.from('event_reminders').delete().eq('event_id', eventId).eq('user_id', user.id)

      // Créer les nouveaux rappels
      if (reminders.length === 0) return []

      const { data, error } = await supabase
        .from('event_reminders')
        .insert(
          reminders.map((r) => ({
            event_id: eventId,
            user_id: user.id,
            minutes_before: r.minutes_before,
            type: r.type,
          }))
        )
        .select()

      if (error) throw error
      return data as EventReminder[]
    },
    onSuccess: (_, { eventId }) => {
      queryClient.invalidateQueries({ queryKey: ['event-reminders', eventId] })
      queryClient.invalidateQueries({ queryKey: ['calendar-event', eventId] })
    },
    onError: (error) => {
      toast.error('Erreur lors de la mise à jour des rappels')
      debug.error('Update reminders error:', error)
    },
  })
}

export function usePendingReminders() {
  const { user } = useAuth()

  return useQuery({
    queryKey: ['pending-reminders', user?.id],
    queryFn: async () => {
      if (!user) return []

      const now = new Date()
      const inOneHour = new Date(now.getTime() + 60 * 60 * 1000)

      const { data, error } = await supabase
        .from('event_reminders')
        .select(
          `
          id, event_id, user_id, minutes_before, type, is_sent, sent_at, created_at,
          event:calendar_events(
            id,
            title,
            start_time,
            location
          )
        `
        )
        .eq('user_id', user.id)
        .eq('is_sent', false)
        .order('created_at')
        .limit(100)

      if (error) throw error

      // Filtrer côté client les rappels à envoyer dans l'heure
      return data.filter((reminder) => {
        if (!reminder.event?.start_time) return false
        const eventTime = new Date(reminder.event.start_time)
        const reminderTime = new Date(eventTime.getTime() - reminder.minutes_before * 60 * 1000)
        return reminderTime >= now && reminderTime <= inOneHour
      })
    },
    enabled: !!user,
    staleTime: 60_000,
  })
}
