import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { sanitizeSupabaseError } from '@/lib/supabaseErrorSanitizer'
import { fromExtended } from '@/lib/supabaseTyped'
import type { CsmKpiTrimestriel } from '@/types/csm'

const QUERY_KEY = 'csm-kpis-trimestriels'

export function useCsmKpisTrimestriels(etablissementId?: string) {
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: [QUERY_KEY, etablissementId],
    queryFn: async () => {
      const builder = fromExtended('csm_kpis_trimestriels').select(`
        id, etablissement_id, periode,
        taux_satisfaction, dossiers_traites,
        taux_utilisation_formatage, taux_utilisation_ocr,
        taux_utilisation_cotations, taux_utilisation_courriers,
        taux_utilisation_traduction, taux_utilisation_examens,
        taux_utilisation_chatbot,
        taux_uhcd_marque, taux_uhcd_compte,
        ccm2_plus, ccmu3_plus, avis_specialise,
        temps_passage_urgences, sort_order,
        created_at, updated_at
      `)
      if (etablissementId) {
        builder.eq('etablissement_id', etablissementId)
      }
      const { data, error } = await builder.order('sort_order', { ascending: true }).limit(500)
      if (error) throw error
      return (data || []) as CsmKpiTrimestriel[]
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })

  const upsertMutation = useMutation({
    mutationFn: async (
      values: Partial<CsmKpiTrimestriel> & { etablissement_id: string; periode: string }
    ) => {
      const payload = { ...values }
      if (!payload.id) delete payload.id
      const { data, error } = await fromExtended('csm_kpis_trimestriels')
        .upsert(payload)
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

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await fromExtended('csm_kpis_trimestriels').delete().eq('id', id)
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
