import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { useToast } from '@/hooks/shared/use-toast'
import { debug } from '@/lib/debug'

export function useRegenerateTasks() {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  return useMutation({
    mutationFn: async (etablissementId: string) => {
      const { data, error } = await supabase.rpc('regenerate_missing_tasks', {
        p_etablissement_id: etablissementId
      })
      
      if (error) throw error
      return data as number
    },
    onSuccess: (count, etablissementId) => {
      queryClient.invalidateQueries({ queryKey: ['taches'] })
      queryClient.invalidateQueries({ queryKey: ['etablissement', etablissementId] })
      
      toast({
        title: "Tâches régénérées",
        description: `${count} tâche(s) manquante(s) créée(s) avec succès`
      })
    },
    onError: (error) => {
      debug.error('Error regenerating tasks:', error)
      toast({
        title: "Erreur",
        description: "Impossible de régénérer les tâches",
        variant: "destructive"
      })
    }
  })
}
