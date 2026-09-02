import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/components/AuthProvider'
import { toast } from 'sonner'
import { debug } from '@/lib/debug'

export interface UserAvailability {
  id: string
  user_id: string
  title: string
  start_time: string
  end_time: string
  is_recurring: boolean
  recurrence_rule?: string | null
  type: 'unavailable' | 'busy' | 'tentative'
  notes?: string | null
  created_at: string
  updated_at: string
}

export interface CreateAvailabilityInput {
  title?: string
  start_time: string
  end_time: string
  is_recurring?: boolean
  recurrence_rule?: string
  type?: 'unavailable' | 'busy' | 'tentative'
  notes?: string
}

export function useAvailabilities(userId?: string, startDate?: string, endDate?: string) {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  const { data: availabilities, isLoading } = useQuery({
    queryKey: ['user-availabilities', userId, startDate, endDate],
    queryFn: async () => {
      if (!user) throw new Error('Non authentifié')

      let query = supabase
        .from('user_availabilities')
        .select(
          'id, user_id, title, start_time, end_time, is_recurring, recurrence_rule, type, notes, created_at, updated_at'
        )
        .order('start_time', { ascending: true })

      if (userId) {
        query = query.eq('user_id', userId)
      }
      if (startDate) {
        query = query.gte('start_time', startDate)
      }
      if (endDate) {
        query = query.lte('end_time', endDate)
      }

      const { data, error } = await query
      if (error) throw error
      return (data || []).map((item) => ({
        ...item,
        is_recurring: item.is_recurring ?? false,
        type: (item.type || 'unavailable') as 'unavailable' | 'busy' | 'tentative',
      })) as UserAvailability[]
    },
  })

  const createAvailability = useMutation({
    mutationFn: async (input: CreateAvailabilityInput) => {
      if (!user) throw new Error('Non authentifié')

      const { data, error } = await supabase
        .from('user_availabilities')
        .insert({
          user_id: user.id,
          title: input.title || 'Indisponible',
          start_time: input.start_time,
          end_time: input.end_time,
          is_recurring: input.is_recurring || false,
          recurrence_rule: input.recurrence_rule,
          type: input.type || 'unavailable',
          notes: input.notes,
        })
        .select()
        // safe: guaranteed-row
        .single() // safe: guaranteed-row

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-availabilities'] })
      toast.success('Indisponibilité créée')
    },
    onError: (error) => {
      debug.error('Error creating availability:', error)
      toast.error("Erreur lors de la création de l'indisponibilité")
    },
  })

  const updateAvailability = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<UserAvailability> & { id: string }) => {
      const { data, error } = await supabase
        .from('user_availabilities')
        .update(updates)
        .eq('id', id)
        .select()
        // safe: guaranteed-row
        .single() // safe: guaranteed-row

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-availabilities'] })
      toast.success('Indisponibilité mise à jour')
    },
    onError: (error) => {
      debug.error('Error updating availability:', error)
      toast.error('Erreur lors de la mise à jour')
    },
  })

  const deleteAvailability = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('user_availabilities').delete().eq('id', id)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-availabilities'] })
      toast.success('Indisponibilité supprimée')
    },
    onError: (error) => {
      debug.error('Error deleting availability:', error)
      toast.error('Erreur lors de la suppression')
    },
  })

  return {
    availabilities,
    isLoading,
    createAvailability: createAvailability.mutateAsync,
    updateAvailability: updateAvailability.mutateAsync,
    deleteAvailability: deleteAvailability.mutateAsync,
    isCreating: createAvailability.isPending,
  }
}

// Hook to get all team availabilities for slot finding
export function useTeamAvailabilities(userIds: string[], startDate?: string, endDate?: string) {
  return useQuery({
    queryKey: ['team-availabilities', userIds, startDate, endDate],
    queryFn: async () => {
      if (userIds.length === 0) return []

      let query = supabase
        .from('user_availabilities')
        .select(
          'id, user_id, title, start_time, end_time, is_recurring, recurrence_rule, type, notes, created_at, updated_at'
        )
        .in('user_id', userIds)
        .limit(500)

      if (startDate) {
        query = query.gte('start_time', startDate)
      }
      if (endDate) {
        query = query.lte('end_time', endDate)
      }

      const { data, error } = await query
      if (error) throw error
      return (data || []).map((item) => ({
        ...item,
        is_recurring: item.is_recurring ?? false,
        type: (item.type || 'unavailable') as 'unavailable' | 'busy' | 'tentative',
      })) as UserAvailability[]
    },
    enabled: userIds.length > 0,
  })
}
