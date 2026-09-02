import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/components/AuthProvider'
import { toast } from 'sonner'
import type { Calendar, CreateCalendarInput, UpdateCalendarInput } from '@/types/calendar'
import { debug } from '@/lib/debug'
import { queryPresets } from '@/lib/queryPresets'

export function useCalendars() {
  const { user } = useAuth()

  return useQuery({
    queryKey: ['calendars', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('calendars')
        .select(
          'id, owner_id, name, description, color, type, is_default, is_visible, timezone, created_at, updated_at'
        )
        .eq('owner_id', user!.id)
        .order('is_default', { ascending: false })
        .order('name')

      if (error) throw error
      return (data || []) as unknown as Calendar[]
    },
    enabled: !!user,
    ...queryPresets.reference, // 30 min staleTime - calendars rarely change
  })
}

export function useCalendar(calendarId: string | undefined) {
  return useQuery({
    queryKey: ['calendar', calendarId],
    queryFn: async () => {
      if (!calendarId) return null

      const { data, error } = await supabase
        .from('calendars')
        .select(
          'id, owner_id, name, description, color, type, is_default, is_visible, timezone, created_at, updated_at'
        )
        .eq('id', calendarId)
        .maybeSingle()

      if (error) throw error
      return data as unknown as Calendar | null
    },
    enabled: !!calendarId,
  })
}

export function useDefaultCalendar() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useQuery({
    queryKey: ['default-calendar', user?.id],
    queryFn: async () => {
      if (!user) throw new Error('User not authenticated')

      const { data, error } = await supabase
        .from('calendars')
        .select(
          'id, owner_id, name, description, color, type, is_default, is_visible, timezone, created_at, updated_at'
        )
        .eq('owner_id', user.id)
        .eq('is_default', true)
        .maybeSingle()

      if (error) throw error

      // Si pas de calendrier par défaut, en créer un
      if (!data) {
        const { data: newCalendar, error: createError } = await supabase
          .from('calendars')
          .insert({
            owner_id: user.id,
            name: 'Mon calendrier',
            color: '#3B82F6',
            type: 'personal',
            is_default: true,
          })
          .select()
          // safe: guaranteed-row
          .single()

        if (createError) throw createError
        queryClient.setQueryData<Calendar[]>(['calendars', user.id], (existing) => {
          const current = existing ?? []
          if (current.some((calendar) => calendar.id === newCalendar.id)) return current
          return [newCalendar as unknown as Calendar, ...current]
        })
        return newCalendar as unknown as Calendar
      }

      return data as unknown as Calendar
    },
    enabled: !!user,
  })
}

export function useCreateCalendar() {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  return useMutation({
    mutationFn: async (input: CreateCalendarInput) => {
      if (!user) throw new Error('User not authenticated')

      const { data, error } = await supabase
        .from('calendars')
        .insert({
          owner_id: user.id,
          name: input.name,
          description: input.description,
          color: input.color || '#3B82F6',
          type: input.type || 'personal',
          is_default: input.is_default || false,
          timezone: input.timezone || 'Europe/Paris',
        })
        .select()
        // safe: guaranteed-row
        .single()

      if (error) throw error
      return data as unknown as Calendar
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendars'] })
      toast.success('Calendrier créé')
    },
    onError: (error) => {
      toast.error('Erreur lors de la création du calendrier')
      debug.error('Create calendar error:', error)
    },
  })
}

export function useUpdateCalendar() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, ...input }: UpdateCalendarInput & { id: string }) => {
      const { data, error } = await supabase
        .from('calendars')
        .update(input)
        .eq('id', id)
        .select()
        // safe: guaranteed-row
        .single()

      if (error) throw error
      return data as unknown as Calendar
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['calendars'] })
      queryClient.invalidateQueries({ queryKey: ['calendar', data.id] })
      toast.success('Calendrier mis à jour')
    },
    onError: (error) => {
      toast.error('Erreur lors de la mise à jour')
      debug.error('Update calendar error:', error)
    },
  })
}

export function useDeleteCalendar() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('calendars').delete().eq('id', id)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendars'] })
      toast.success('Calendrier supprimé')
    },
    onError: (error) => {
      toast.error('Erreur lors de la suppression')
      debug.error('Delete calendar error:', error)
    },
  })
}

export function useToggleCalendarVisibility() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, is_visible }: { id: string; is_visible: boolean }) => {
      const { data, error } = await supabase
        .from('calendars')
        .update({ is_visible })
        .eq('id', id)
        .select()
        // safe: guaranteed-row
        .single()

      if (error) throw error
      return data as unknown as Calendar
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendars'] })
    },
  })
}
