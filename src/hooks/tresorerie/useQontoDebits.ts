import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { useToast } from '@/hooks/shared/use-toast'

export interface QontoDebit {
  id: string
  date_operation: string
  libelle: string
  montant: number
  categorie_code: string | null
  depense_id: string | null
  notes: string | null
  qonto_transaction_id: string | null
  depense_liee?: {
    id: string
    nom: string
    montant: number
    statut: string | null
  } | null
}

export function useQontoDebits() {
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const { data: debits = [], isLoading } = useQuery({
    queryKey: ['qonto-debits'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tresorerie_operations_bancaires')
        .select(
          'id, date_operation, libelle, montant, categorie_code, depense_id, notes, qonto_transaction_id'
        )
        .eq('type_operation', 'debit')
        .order('date_operation', { ascending: false })

      if (error) throw error

      // Fetch linked depenses
      const linkedIds = (data || []).map((d) => d.depense_id).filter(Boolean) as string[]

      const depensesMap: Record<string, QontoDebit['depense_liee']> = {}

      if (linkedIds.length > 0) {
        const { data: depenses } = await supabase
          .from('tresorerie_depenses')
          .select('id, nom, montant, statut')
          .in('id', linkedIds)

        if (depenses) {
          for (const d of depenses) {
            depensesMap[d.id] = { id: d.id, nom: d.nom, montant: d.montant, statut: d.statut }
          }
        }
      }

      return (data || []).map((d) => ({
        ...d,
        depense_liee: d.depense_id ? depensesMap[d.depense_id] || null : null,
      })) as QontoDebit[]
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
      queryClient.invalidateQueries({ queryKey: ['qonto-debits'] })
    },
    onError: (err: Error) => {
      toast({ title: 'Erreur', description: err.message, variant: 'destructive' })
    },
  })

  return {
    debits,
    isLoading,
    updateCategorie: updateCategorieMutation.mutate,
  }
}
