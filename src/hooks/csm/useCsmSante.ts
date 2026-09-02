import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { sanitizeSupabaseError } from '@/lib/supabaseErrorSanitizer'
import { fromExtended } from '@/lib/supabaseTyped'
import type { CsmSanteCompte } from '@/types/csm'

const QUERY_KEY = 'csm-sante-comptes'

export function useCsmSante(etablissementId?: string) {
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: [QUERY_KEY, etablissementId],
    queryFn: async () => {
      const builder = fromExtended('csm_sante_comptes').select(`
        id, etablissement_id, weather,
        taux_utilisation, taux_utilisation_trend,
        taux_uhcd, taux_uhcd_dim, taux_uhcd_trend,
        objectif_eme, dossiers_traites, passages_total,
        periode_reference, paliers_uhcd,
        resume_sante, actions,
        created_at, updated_at
      `)
      
      if (etablissementId) {
        const { data, error } = await builder.eq('etablissement_id', etablissementId).maybeSingle()
        if (error) throw error
        return data ? [data as CsmSanteCompte] : []
      }
      
      const { data, error } = await builder.limit(500)
      if (error) throw error
      return (data || []) as CsmSanteCompte[]
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })

  const upsertMutation = useMutation({
    mutationFn: async (values: Partial<CsmSanteCompte> & { etablissement_id: string }) => {
      const { data, error } = await fromExtended('csm_sante_comptes')
        .upsert(values, { onConflict: 'etablissement_id' })
        .select()
        // safe: guaranteed-row
        .single()
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

  return {
    data: query.data || [],
    single: etablissementId ? (query.data?.[0] || null) : null,
    isLoading: query.isPending,
    upsert: upsertMutation.mutateAsync,
    isUpserting: upsertMutation.isPending,
  }
}
