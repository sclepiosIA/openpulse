import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { sanitizeSupabaseError } from '@/lib/supabaseErrorSanitizer'
import { fromExtended } from '@/lib/supabaseTyped'
import type { CsmKpiMensuel } from '@/types/csm'

const QUERY_KEY = 'csm-kpis-mensuels'

export function useCsmKpisMensuels(etablissementId?: string) {
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: [QUERY_KEY, etablissementId],
    queryFn: async () => {
      const builder = fromExtended('csm_kpis_mensuels').select(
        'id, etablissement_id, mois, taux_uhcd_backend, taux_uhcd_compte, palier_eme, objectif_eme, taux_utilisation, passages_total, dossiers_traites, eme, sort_order, created_at, updated_at'
      )
      if (etablissementId) {
        builder.eq('etablissement_id', etablissementId)
      }
      const { data, error } = await builder.order('sort_order', { ascending: true }).limit(500)
      if (error) throw error
      return (data || []) as CsmKpiMensuel[]
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })

  const upsertMutation = useMutation({
    mutationFn: async (
      values: Partial<CsmKpiMensuel> & { etablissement_id: string; mois: string }
    ) => {
      const payload = { ...values }
      if (!payload.id) delete payload.id
      const { data, error } = await fromExtended('csm_kpis_mensuels')
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
      const { error } = await fromExtended('csm_kpis_mensuels').delete().eq('id', id)
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
