import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/components/AuthProvider'
import { useToast } from '@/hooks/shared/use-toast'

export interface CalendarCategory {
  id: string
  user_id: string
  name: string
  color: string
  ordre: number
  created_at: string
  updated_at: string
}

export function useCalendarCategories() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['calendar-event-categories', user?.id],
    queryFn: async () => {
      if (!user) return []
      const { data, error } = await supabase
        .from('calendar_event_categories')
        .select('*')
        .eq('user_id', user.id)
        .order('ordre', { ascending: true })
        .order('created_at', { ascending: true })
      if (error) throw error
      return (data ?? []) as CalendarCategory[]
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  })
}

export function useCreateCalendarCategory() {
  const qc = useQueryClient()
  const { user } = useAuth()
  const { toast } = useToast()
  return useMutation({
    mutationFn: async (payload: { name: string; color: string }) => {
      if (!user) throw new Error('Non authentifié')
      const { data, error } = await supabase
        .from('calendar_event_categories')
        .insert({ user_id: user.id, name: payload.name, color: payload.color })
        .select()
        .single()
      if (error) throw error
      return data as CalendarCategory
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['calendar-event-categories'] })
    },
    onError: (e: unknown) => {
      toast({ title: 'Erreur', description: (e as Error).message, variant: 'destructive' })
    },
  })
}

export function useUpdateCalendarCategory() {
  const qc = useQueryClient()
  const { toast } = useToast()
  return useMutation({
    mutationFn: async (payload: { id: string; name?: string; color?: string }) => {
      const { id, ...rest } = payload
      const { data, error } = await supabase
        .from('calendar_event_categories')
        .update(rest)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data as CalendarCategory
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['calendar-event-categories'] })
    },
    onError: (e: unknown) => {
      toast({ title: 'Erreur', description: (e as Error).message, variant: 'destructive' })
    },
  })
}

export function useDeleteCalendarCategory() {
  const qc = useQueryClient()
  const { toast } = useToast()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('calendar_event_categories').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['calendar-event-categories'] })
      qc.invalidateQueries({ queryKey: ['calendar-events'] })
    },
    onError: (e: unknown) => {
      toast({ title: 'Erreur', description: (e as Error).message, variant: 'destructive' })
    },
  })
}
