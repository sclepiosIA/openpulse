import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/components/AuthProvider'

export interface CalendarSubscription {
  id: string
  user_id: string
  calendar_id: string
  name: string
  url: string
  color: string
  sync_frequency: 'hourly' | 'daily'
  last_sync_at: string | null
  last_sync_status: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export function useCalendarSubscriptions() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['calendar-subscriptions'],
    queryFn: async () => {
      if (!user) return []

      // Use raw query since table may not be in types yet
      const { data, error } = await supabase
        .from('calendar_subscriptions')
        .select(
          'id, user_id, calendar_id, name, url, color, sync_frequency, last_sync_at, last_sync_status, is_active, created_at, updated_at'
        )
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50)

      if (error) throw error
      return (data || []) as unknown as CalendarSubscription[]
    },
  })
}

export function useCreateCalendarSubscription() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (subscription: {
      calendar_id: string
      name: string
      url: string
      color?: string
      sync_frequency?: 'hourly' | 'daily'
    }) => {
      if (!user) throw new Error('Not authenticated')

      const { data, error } = await supabase
        .from('calendar_subscriptions')
        .insert({
          user_id: user.id,
          ...subscription,
        })
        .select()
        // safe: guaranteed-row
        .single() // safe: guaranteed-row

      if (error) throw error
      return data as unknown as CalendarSubscription
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar-subscriptions'] })
    },
  })
}

export function useDeleteCalendarSubscription() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (subscriptionId: string) => {
      const { error } = await supabase
        .from('calendar_subscriptions')
        .delete()
        .eq('id', subscriptionId)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar-subscriptions'] })
    },
  })
}

export function useSyncCalendarSubscription() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (subscription: CalendarSubscription) => {
      const { data, error } = await supabase.functions.invoke('sync-calendar-subscription', {
        body: {
          subscriptionId: subscription.id,
          subscriptionUrl: subscription.url,
          calendarId: subscription.calendar_id,
        },
      })

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar-subscriptions'] })
      queryClient.invalidateQueries({ queryKey: ['calendar-events'] })
    },
  })
}

export function useToggleSubscriptionActive() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from('calendar_subscriptions')
        .update({ is_active })
        .eq('id', id)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar-subscriptions'] })
    },
  })
}
