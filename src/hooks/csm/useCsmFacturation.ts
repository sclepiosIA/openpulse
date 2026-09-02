import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { sanitizeSupabaseError } from '@/lib/supabaseErrorSanitizer'
import { fromExtended } from '@/lib/supabaseTyped'
import type { CsmFacturationSuivi } from '@/types/csm'

const QUERY_KEY = 'csm-facturation-suivi'

export function useCsmFacturation(etablissementId?: string) {
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: [QUERY_KEY, etablissementId],
    queryFn: async () => {
      const builder = fromExtended('csm_facturation_suivi').select(
        'id, etablissement_id, modele_facturation, date_deploiement, date_debut_periode, date_fin_periode, derniere_relance, facturation_effectuee, notes, created_at, updated_at'
      )
      if (etablissementId) {
        const { data, error } = await builder.eq('etablissement_id', etablissementId).maybeSingle()
        if (error) throw error
        return data ? [data as CsmFacturationSuivi] : []
      }
      const { data, error } = await builder.limit(500)
      if (error) throw error
      return (data || []) as CsmFacturationSuivi[]
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })

  const upsertMutation = useMutation({
    mutationFn: async (values: Partial<CsmFacturationSuivi> & { etablissement_id: string }) => {
      const { data, error } = await fromExtended('csm_facturation_suivi')
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
    single: etablissementId ? query.data?.[0] || null : null,
    isLoading: query.isPending,
    upsert: upsertMutation.mutateAsync,
  }
}
