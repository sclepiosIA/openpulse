import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { useToast } from '@/hooks/shared/use-toast'
import { sanitizeSupabaseError } from '@/lib/supabaseErrorSanitizer';

export interface CreateTacheData {
  titre: string
  description?: string
  etablissement_id: string
  categorie_id: string
  priorite?: 'low' | 'medium' | 'high'
  date_debut?: string
  echeance?: string
  responsable_id?: string
  recurrence_rule?: string
  ordre?: number
}

export function useCreateTache() {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  return useMutation({
    mutationFn: async (data: CreateTacheData) => {
      const { data: result, error } = await supabase
        .from('taches')
        .insert([{
          ...data,
          date_debut: data.date_debut ? new Date(data.date_debut).toISOString().split('T')[0] : null,
          echeance: data.echeance ? new Date(data.echeance).toISOString().split('T')[0] : null
        }])
        .select(`
          *,
          etablissements (nom),
          categories_taches (nom, couleur),
          profiles!taches_responsable_id_fkey (user_id, prenom, nom, email)
        `)
        .single() // safe: guaranteed-row

      if (error) throw error
      return result
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['taches'] })
      queryClient.invalidateQueries({ queryKey: ['etablissements'] })
      toast({
        title: "Succès",
        description: "Tâche créée avec succès"
      })
    },
    onError: (error: unknown) => {
      toast({
        title: "Erreur",
        description: sanitizeSupabaseError(error) || "Erreur lors de la création de la tâche",
        variant: "destructive"
      })
    }
  })
}