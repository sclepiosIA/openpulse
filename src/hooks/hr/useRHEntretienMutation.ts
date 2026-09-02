import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { toast } from 'sonner'
import { sanitizeSupabaseError } from '@/lib/supabaseErrorSanitizer'
import { debug } from '@/lib/debug'

interface CreateEntretienData {
  profile_id: string
  manager_id: string
  type: string
  date_entretien: string
}

export function useRHEntretienMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: CreateEntretienData) => {
      const { error } = await supabase.from('rh_entretiens').insert({
        profile_id: data.profile_id,
        manager_id: data.manager_id,
        type: data.type,
        date_entretien: data.date_entretien,
        statut: 'planifie',
      })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rh-entretiens'] })
      toast.success('Entretien planifié avec succès')
    },
    onError: (error: Error) => {
      debug.error('Erreur création entretien:', error)
      toast.error(sanitizeSupabaseError(error))
    },
  })
}
