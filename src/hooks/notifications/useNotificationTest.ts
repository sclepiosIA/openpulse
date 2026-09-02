import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/hooks/shared/useAuth'
import { toast } from 'sonner'
import { debug } from '@/lib/debug'

/**
 * Hook pour créer des notifications de test
 */
export function useNotificationTest() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  const createTestNotification = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error('User not authenticated')

      // Insérer directement dans la table
      const { data: inserted, error: insertError } = await supabase
        .from('in_app_notifications')
        .insert({
          user_id: user.id,
          title: '🔔 Notification de test',
          message: `Test créé le ${new Date().toLocaleString('fr-FR')}. Cette notification confirme que le système fonctionne correctement.`,
          type: 'other',
          is_read: false,
        })
        .select()
        // safe: guaranteed-row
        .single() // safe: guaranteed-row

      if (insertError) throw insertError
      return inserted
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['in-app-notifications', user?.id] })
      toast.success('Notification de test créée !')
    },
    onError: (error) => {
      debug.error('Error creating test notification:', error)
      toast.error('Erreur lors de la création de la notification')
    },
  })

  return {
    createTestNotification: createTestNotification.mutate,
    isCreating: createTestNotification.isPending,
  }
}
