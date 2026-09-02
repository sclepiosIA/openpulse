import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { sanitizeSupabaseError } from '@/lib/supabaseErrorSanitizer'
import { fromExtended } from '@/lib/supabaseTyped'
import type { CsmParcoursJalon } from '@/types/csm'

const QUERY_KEY = 'csm-parcours-jalons'

export function useCsmParcours(etablissementId?: string) {
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: [QUERY_KEY, etablissementId],
    queryFn: async () => {
      const builder = fromExtended('csm_parcours_jalons').select(
        'id, etablissement_id, jalon_type, statut, date_jalon, notes, created_at, updated_at'
      )
      if (etablissementId) {
        builder.eq('etablissement_id', etablissementId)
      }
      const { data, error } = await builder.order('jalon_type').limit(500)
      if (error) throw error
      return (data || []) as CsmParcoursJalon[]
    },
    staleTime: 5 * 60 * 1000,
  })

  const upsertMutation = useMutation({
    mutationFn: async (
      values: Partial<CsmParcoursJalon> & { etablissement_id: string; jalon_type: string }
    ) => {
      const { data, error } = await fromExtended('csm_parcours_jalons')
        .upsert(values, { onConflict: 'etablissement_id,jalon_type' })
        .select()
        // safe: guaranteed-row
        .single() // safe: guaranteed-row
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] })
    },
    onError: (error: Error) => {
      toast.error(sanitizeSupabaseError(error))
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await fromExtended('csm_parcours_jalons').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] })
    },
    onError: (error: Error) => {
      toast.error(sanitizeSupabaseError(error))
    },
  })

  return {
    data: query.data || [],
    isLoading: query.isPending,
    upsert: upsertMutation.mutateAsync,
    remove: deleteMutation.mutateAsync,
  }
}
