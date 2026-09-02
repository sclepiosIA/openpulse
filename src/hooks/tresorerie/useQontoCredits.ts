import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { useToast } from '@/hooks/shared/use-toast'

export interface QontoCredit {
  id: string
  date_operation: string
  libelle: string
  montant: number
  categorie_code: string | null
  recette_id: string | null
  notes: string | null
  qonto_transaction_id: string | null
  // Joined forecast revenue data
  recette_previsionnelle?: {
    id: string
    montant_prevu: number | null
    mois: string
    etablissement_nom: string | null
    statut: string
  } | null
}

export interface ForecastRevenue {
  id: string
  montant_prevu: number | null
  mois: string
  etablissement_id: string | null
  etablissement_nom: string | null
  statut: string
  type_revenu: string | null
  notes: string | null
}

export function useQontoCredits() {
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const { data: credits = [], isLoading } = useQuery({
    queryKey: ['qonto-credits'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tresorerie_operations_bancaires')
        .select(
          'id, date_operation, libelle, montant, categorie_code, recette_id, notes, qonto_transaction_id'
        )
        .eq('type_operation', 'credit')
        .order('date_operation', { ascending: false })

      if (error) throw error

      // Fetch linked forecast revenues
      const linkedIds = (data || []).map((d) => d.recette_id).filter(Boolean) as string[]

      const revenusMap: Record<string, QontoCredit['recette_previsionnelle']> = {}

      if (linkedIds.length > 0) {
        const { data: revenus } = await supabase
          .from('tresorerie_revenus')
          .select('id, montant_prevu, mois, statut, etablissement_id')
          .in('id', linkedIds)

        if (revenus && revenus.length > 0) {
          const etabIds = revenus.map((r) => r.etablissement_id).filter(Boolean) as string[]

          let etabMap: Record<string, string> = {}
          if (etabIds.length > 0) {
            const { data: etabs } = await supabase
              .from('etablissements')
              .select('id, nom')
              .in('id', etabIds)
            etabMap = Object.fromEntries((etabs || []).map((e) => [e.id, e.nom]))
          }

          for (const r of revenus) {
            revenusMap[r.id] = {
              id: r.id,
              montant_prevu: r.montant_prevu,
              mois: r.mois,
              etablissement_nom: r.etablissement_id ? etabMap[r.etablissement_id] || null : null,
              statut: r.statut,
            }
          }
        }
      }

      return (data || []).map((d) => ({
        ...d,
        recette_previsionnelle: d.recette_id ? revenusMap[d.recette_id] || null : null,
      })) as QontoCredit[]
    },
  })

  // Fetch unlinked forecast revenues for linking
  const { data: forecastRevenus = [] } = useQuery({
    queryKey: ['forecast-revenus-unlinked'],
    queryFn: async () => {
      // Get IDs already linked
      const { data: linked } = await supabase
        .from('tresorerie_operations_bancaires')
        .select('recette_id')
        .eq('type_operation', 'credit')
        .not('recette_id', 'is', null)

      const linkedIds = (linked || []).map((l) => l.recette_id).filter(Boolean) as string[]

      const query = supabase
        .from('tresorerie_revenus')
        .select('id, montant_prevu, mois, etablissement_id, statut, type_revenu, notes')
        .neq('statut', 'paye')
        .order('mois', { ascending: false })

      const { data, error } = await query
      if (error) throw error

      // Filter out already linked
      const filtered = (data || []).filter((r) => !linkedIds.includes(r.id))

      // Fetch establishment names
      const etabIds = filtered.map((r) => r.etablissement_id).filter(Boolean) as string[]
      let etabMap: Record<string, string> = {}
      if (etabIds.length > 0) {
        const { data: etabs } = await supabase
          .from('etablissements')
          .select('id, nom')
          .in('id', [...new Set(etabIds)])
        etabMap = Object.fromEntries((etabs || []).map((e) => [e.id, e.nom]))
      }

      return filtered.map((r) => ({
        ...r,
        etablissement_nom: r.etablissement_id ? etabMap[r.etablissement_id] || null : null,
      })) as ForecastRevenue[]
    },
  })

  const linkMutation = useMutation({
    mutationFn: async ({ operationId, recetteId }: { operationId: string; recetteId: string }) => {
      // Link the operation to the forecast revenue
      const { error: err1 } = await supabase
        .from('tresorerie_operations_bancaires')
        .update({ recette_id: recetteId })
        .eq('id', operationId)
      if (err1) throw err1

      // Mark forecast as paid
      const { error: err2 } = await supabase
        .from('tresorerie_revenus')
        .update({ statut: 'paye', date_paiement_reel: new Date().toISOString().split('T')[0] })
        .eq('id', recetteId)
      if (err2) throw err2
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['qonto-credits'] })
      queryClient.invalidateQueries({ queryKey: ['forecast-revenus-unlinked'] })
      toast({
        title: 'Lié avec succès',
        description: 'Le virement a été relié à la recette prévisionnelle',
      })
    },
    onError: (err: Error) => {
      toast({ title: 'Erreur', description: err.message, variant: 'destructive' })
    },
  })

  const unlinkMutation = useMutation({
    mutationFn: async ({ operationId, recetteId }: { operationId: string; recetteId: string }) => {
      const { error: err1 } = await supabase
        .from('tresorerie_operations_bancaires')
        .update({ recette_id: null })
        .eq('id', operationId)
      if (err1) throw err1

      const { error: err2 } = await supabase
        .from('tresorerie_revenus')
        .update({ statut: 'contractualise', date_paiement_reel: null })
        .eq('id', recetteId)
      if (err2) throw err2
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['qonto-credits'] })
      queryClient.invalidateQueries({ queryKey: ['forecast-revenus-unlinked'] })
      toast({
        title: 'Délié',
        description: 'Le lien avec la recette prévisionnelle a été supprimé',
      })
    },
    onError: (err: Error) => {
      toast({ title: 'Erreur', description: err.message, variant: 'destructive' })
    },
  })

  const updateCategorieMutation = useMutation({
    mutationFn: async ({ id, categorie_code }: { id: string; categorie_code: string }) => {
      const { error } = await supabase
        .from('tresorerie_operations_bancaires')
        .update({ categorie_code })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['qonto-credits'] })
    },
    onError: (err: Error) => {
      toast({ title: 'Erreur', description: err.message, variant: 'destructive' })
    },
  })

  return {
    credits,
    isLoading,
    forecastRevenus,
    linkToForecast: linkMutation.mutate,
    unlinkForecast: unlinkMutation.mutate,
    updateCategorie: updateCategorieMutation.mutate,
    isLinking: linkMutation.isPending,
  }
}
