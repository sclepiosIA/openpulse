import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { useToast } from '@/hooks/shared/use-toast'
import { sanitizeSupabaseError } from '@/lib/supabaseErrorSanitizer';
import type { Json } from '@/integrations/supabase/types'

interface NotificationRule {
  id: string
  name: string
  description: string | null
  event_type: string
  conditions: Json
  recipients: string[]
  email_template: string | null
  is_active: boolean
  created_at: string
  updated_at: string
  created_by: string | null
}

interface NotificationHistory {
  id: string
  rule_id: string | null
  event_type: string
  recipient_email: string
  subject: string
  content: string
  status: string
  error_message: string | null
  sent_at: string
  metadata: Json
}

export function useNotificationRules() {
  return useQuery({
    queryKey: ['notification-rules'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notifications_rules')
        .select('id, name, description, event_type, conditions, recipients, email_template, is_active, created_at, updated_at, created_by')
        .order('created_at', { ascending: false })
        .limit(100)

      if (error) throw error
      return data as NotificationRule[]
    }
  })
}

export function useNotificationHistory() {
  return useQuery({
    queryKey: ['notification-history'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notifications_history')
        .select(`
          *,
          notifications_rules (name)
        `)
        .order('sent_at', { ascending: false })
        .limit(100)

      if (error) throw error
      return data as (NotificationHistory & { notifications_rules?: { name: string } })[]
    }
  })
}

export function useCreateNotificationRule() {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  return useMutation({
    mutationFn: async (data: Omit<NotificationRule, 'id' | 'created_at' | 'updated_at' | 'created_by'>) => {
      const { data: result, error } = await supabase
        .from('notifications_rules')
        .insert([data])
        .select()
        .single()

      if (error) throw error
      return result
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notification-rules'] })
      toast({
        title: "Succès",
        description: "Règle de notification créée avec succès"
      })
    },
    onError: (error: unknown) => {
      toast({
        title: "Erreur",
        description: sanitizeSupabaseError(error),
        variant: "destructive"
      })
    }
  })
}

export function useUpdateNotificationRule() {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<NotificationRule> & { id: string }) => {
      const { data: result, error } = await supabase
        .from('notifications_rules')
        .update(data)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return result
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notification-rules'] })
      toast({
        title: "Succès",
        description: "Règle de notification mise à jour avec succès"
      })
    },
    onError: (error: unknown) => {
      toast({
        title: "Erreur", 
        description: sanitizeSupabaseError(error),
        variant: "destructive"
      })
    }
  })
}

export function useDeleteNotificationRule() {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('notifications_rules')
        .delete()
        .eq('id', id)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notification-rules'] })
      toast({
        title: "Succès",
        description: "Règle de notification supprimée avec succès"
      })
    },
    onError: (error: unknown) => {
      toast({
        title: "Erreur",
        description: sanitizeSupabaseError(error), 
        variant: "destructive"
      })
    }
  })
}

export function useSendTestEmail() {
  const { toast } = useToast()

  return useMutation({
    mutationFn: async ({ recipient, subject, content }: { recipient: string; subject?: string; content?: string }) => {
      const { data, error } = await supabase.functions.invoke('send-test-email', {
        body: { recipient, subject, content }
      })

      if (error) throw error
      return data
    },
    onSuccess: (data) => {
      toast({
        title: "Succès",
        description: data.message || "Email de test envoyé avec succès"
      })
    },
    onError: (error: unknown) => {
      toast({
        title: "Erreur",
        description: sanitizeSupabaseError(error),
        variant: "destructive"
      })
    }
  })
}