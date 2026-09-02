import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/components/AuthProvider'
import { toast } from 'sonner'
import type { EventAttendee, CreateAttendeeInput, UpdateAttendeeInput } from '@/types/calendar'
import { debug } from '@/lib/debug'

export function useEventAttendees(eventId: string | undefined) {
  return useQuery({
    queryKey: ['event-attendees', eventId],
    queryFn: async () => {
      if (!eventId) return []

      const { data, error } = await supabase
        .from('event_attendees')
        .select(
          'id, event_id, email, display_name, role, status, user_id, responded_at, created_at'
        )
        .eq('event_id', eventId)
        .order('role')
        .order('display_name')

      if (error) throw error
      return data as EventAttendee[]
    },
    enabled: !!eventId,
  })
}

export function useAddAttendee() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: CreateAttendeeInput) => {
      const { data, error } = await supabase
        .from('event_attendees')
        .insert(input)
        .select()
        // safe: guaranteed-row
        .single() // safe: guaranteed-row

      if (error) throw error
      return data as EventAttendee
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['event-attendees', data.event_id] })
      queryClient.invalidateQueries({ queryKey: ['calendar-event', data.event_id] })
      toast.success('Participant ajouté')
    },
    onError: (error) => {
      toast.error("Erreur lors de l'ajout du participant")
      debug.error('Add attendee error:', error)
    },
  })
}

export function useAddMultipleAttendees() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (inputs: CreateAttendeeInput[]) => {
      if (inputs.length === 0) return []

      const { data, error } = await supabase.from('event_attendees').insert(inputs).select()

      if (error) throw error
      return data as EventAttendee[]
    },
    onSuccess: (data) => {
      if (data.length > 0) {
        queryClient.invalidateQueries({ queryKey: ['event-attendees', data[0].event_id] })
        queryClient.invalidateQueries({ queryKey: ['calendar-event', data[0].event_id] })
      }
      toast.success(`${data.length} participant(s) ajouté(s)`)
    },
    onError: (error) => {
      // Don't show toast - caller handles errors (e.g. resilient retry in EventFormDialog)
      debug.error('Add attendees error:', error)
    },
  })
}

export function useUpdateAttendee() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      id,
      eventId,
      ...input
    }: UpdateAttendeeInput & { id: string; eventId: string }) => {
      const updateData: Record<string, unknown> = { ...input }
      if (input.status) {
        updateData.responded_at = new Date().toISOString()
      }

      const { data, error } = await supabase
        .from('event_attendees')
        .update(updateData as never)
        .eq('id', id)
        .select()
        // safe: guaranteed-row
        .single() // safe: guaranteed-row

      if (error) throw error
      return { ...data, eventId } as EventAttendee & { eventId: string }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['event-attendees', data.eventId] })
      queryClient.invalidateQueries({ queryKey: ['calendar-event', data.eventId] })
    },
  })
}

export function useRespondToInvitation() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      eventId,
      status,
    }: {
      eventId: string
      status: EventAttendee['status']
    }) => {
      if (!user) throw new Error('Non authentifié')

      const { data, error } = await supabase
        .from('event_attendees')
        .update({
          status,
          responded_at: new Date().toISOString(),
        })
        .eq('event_id', eventId)
        .eq('user_id', user.id)
        .select()
        .maybeSingle()

      if (error) throw error
      if (!data) throw new Error('Invitation introuvable')
      return data as EventAttendee
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['event-attendees', data.event_id] })
      queryClient.invalidateQueries({ queryKey: ['calendar-event', data.event_id] })
      queryClient.invalidateQueries({ queryKey: ['calendar-events'] })

      const statusLabels: Record<string, string> = {
        accepted: 'Invitation acceptée',
        declined: 'Invitation refusée',
        tentative: 'Réponse enregistrée',
      }
      toast.success(statusLabels[data.status] || 'Réponse enregistrée')
    },
    onError: (error) => {
      toast.error('Erreur lors de la réponse')
      debug.error('Respond to invitation error:', error)
    },
  })
}

export function useRemoveAttendee() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, eventId }: { id: string; eventId: string }) => {
      const { error } = await supabase.from('event_attendees').delete().eq('id', id)

      if (error) throw error
      return { eventId }
    },
    onSuccess: ({ eventId }) => {
      queryClient.invalidateQueries({ queryKey: ['event-attendees', eventId] })
      queryClient.invalidateQueries({ queryKey: ['calendar-event', eventId] })
      toast.success('Participant retiré')
    },
    onError: (error) => {
      toast.error('Erreur lors de la suppression')
      debug.error('Remove attendee error:', error)
    },
  })
}

export function useMyInvitations() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['my-invitations'],
    queryFn: async () => {
      if (!user) return []

      const { data, error } = await supabase
        .from('event_attendees')
        .select(
          `
          *,
          event:calendar_events(
            *,
            calendar:calendars(*)
          )
        `
        )
        .eq('user_id', user.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })

      if (error) throw error
      return data
    },
  })
}
