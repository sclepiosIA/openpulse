import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { toast } from 'sonner'
import { sanitizeSupabaseError } from '@/lib/supabaseErrorSanitizer'

export interface QontoTransaction {
  id: string
  qonto_transaction_id: string | null
  date_operation: string
  date_valeur: string
  montant: number
  libelle: string
  type_operation: string | null
  categorie_code: string | null
  reconcilie: boolean | null
  recette_id: string | null
  depense_id: string | null
  notes: string | null
  qonto_account_id: string | null
  raw_qonto_data: Record<string, unknown> | null
  created_at: string | null
}

export interface QontoBankAccount {
  iban: string
  balance: number
  balance_cents?: number
  name: string
  slug?: string
  currency?: string
}

export interface QontoConnection {
  id: string
  organization_id: string
  is_active: boolean | null
  last_sync_at: string | null
  bank_accounts: QontoBankAccount[] | null
  last_error: string | null
  sync_count: number | null
}

export function useQontoTransactions(filters?: {
  type?: 'credit' | 'debit' | 'all'
  reconciled?: boolean | null
  fromDate?: string
  toDate?: string
}) {
  const queryClient = useQueryClient()

  // Fetch transactions - pas de limite pour voir toutes les transactions
  const transactionsQuery = useQuery({
    queryKey: ['qonto-transactions', filters],
    staleTime: 2 * 60 * 1000,
    retry: 2,
    queryFn: async () => {
      let query = supabase
        .from('tresorerie_operations_bancaires')
        .select(
          'id, qonto_transaction_id, date_operation, date_valeur, montant, libelle, type_operation, categorie_code, reconcilie, recette_id, depense_id, notes, qonto_account_id, raw_qonto_data, created_at'
        )
        .order('date_operation', { ascending: false })
        .limit(2000)

      if (filters?.type && filters.type !== 'all') {
        query = query.eq('type_operation', filters.type)
      }

      if (filters?.reconciled === true) {
        query = query.eq('reconcilie', true)
      } else if (filters?.reconciled === false) {
        query = query.or('reconcilie.is.null,reconcilie.eq.false')
      }

      if (filters?.fromDate) {
        query = query.gte('date_operation', filters.fromDate)
      }

      if (filters?.toDate) {
        query = query.lte('date_operation', filters.toDate)
      }

      const { data, error } = await query
      if (error) throw error
      return (data || []) as QontoTransaction[]
    },
  })

  // Fetch connection status avec les bons noms de colonnes
  const connectionQuery = useQuery({
    queryKey: ['qonto-connection'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tresorerie_qonto_connections')
        .select(
          'id, organization_id, is_active, last_sync_at, bank_accounts, last_error, sync_count'
        )
        .limit(1)
        .maybeSingle()

      if (error) throw error
      return data as QontoConnection | null
    },
  })

  // Sync transactions mutation
  const syncMutation = useMutation({
    mutationFn: async (params?: { days_back?: number; force_relink?: boolean }) => {
      const { data, error } = await supabase.functions.invoke('qonto-sync-transactions', {
        body: params || {},
      })

      if (error) throw error
      if (!data.success) {
        if (data.config_missing) {
          throw new Error(
            'Configuration Qonto manquante. Vérifiez que QONTO_API_KEY et QONTO_ORGANIZATION_ID sont configurés dans les secrets Supabase.'
          )
        }
        if (data.api_error) {
          throw new Error(`Erreur API Qonto: ${data.error}. ${data.details || ''}`)
        }
        throw new Error(data.error || 'Erreur de synchronisation')
      }
      return data
    },
    onSuccess: (data) => {
      const fetched = data.transactions_fetched ?? 0
      const reconciled = data.auto_reconciled ?? 0
      const skipped = data.transactions_skipped ?? 0
      const total = data.total_from_qonto ?? 0

      toast.success(`Synchronisation Qonto réussie`, {
        description: `${fetched} nouvelles transactions importées, ${reconciled} rapprochées automatiquement${skipped > 0 ? `, ${skipped} déjà existantes` : ''} (${total} total Qonto)`,
      })
      queryClient.invalidateQueries({ queryKey: ['qonto-transactions'] })
      queryClient.invalidateQueries({ queryKey: ['qonto-connection'] })
      queryClient.invalidateQueries({ queryKey: ['tresorerie-revenus'], refetchType: 'all' })
      queryClient.invalidateQueries({ queryKey: ['tresorerie-depenses'], refetchType: 'all' })
      queryClient.invalidateQueries({
        queryKey: ['tresorerie-revenus-paginated'],
        refetchType: 'all',
      })
      queryClient.invalidateQueries({
        queryKey: ['tresorerie-depenses-paginated'],
        refetchType: 'all',
      })
      queryClient.invalidateQueries({ queryKey: ['tresorerie-revenus-analyse'] })
      queryClient.invalidateQueries({ queryKey: ['tresorerie-depenses-analyse'] })
      queryClient.invalidateQueries({ queryKey: ['tresorerie-depenses-mois'] })
      queryClient.invalidateQueries({ queryKey: ['qonto-client-invoices'] })
      queryClient.invalidateQueries({ queryKey: ['tresorerie-budgets'] })
      queryClient.invalidateQueries({ queryKey: ['tresorerie-previsionnel'] })
      queryClient.resetQueries({ queryKey: ['qonto-credits'] })
      queryClient.resetQueries({ queryKey: ['forecast-revenus-unlinked'] })
    },
    onError: (error: Error) => {
      toast.error('Erreur de synchronisation Qonto', {
        description: sanitizeSupabaseError(error),
        duration: 8000,
      })
    },
  })

  // Manual reconciliation mutation
  const reconcileMutation = useMutation({
    mutationFn: async ({
      transactionId,
      revenuId,
    }: {
      transactionId: string
      revenuId: string
    }) => {
      const { error: opError } = await supabase
        .from('tresorerie_operations_bancaires')
        .update({ recette_id: revenuId, reconcilie: true })
        .eq('id', transactionId)

      if (opError) throw opError

      const { data: transaction } = await supabase
        .from('tresorerie_operations_bancaires')
        .select('date_operation')
        .eq('id', transactionId)
        .maybeSingle()

      const { error: revError } = await supabase
        .from('tresorerie_revenus')
        .update({
          statut: 'paye',
          date_paiement_reel: transaction?.date_operation || new Date().toISOString().split('T')[0],
        })
        .eq('id', revenuId)

      if (revError) throw revError

      return { transactionId, revenuId }
    },
    onSuccess: () => {
      toast.success('Rapprochement effectué')
      queryClient.invalidateQueries({ queryKey: ['qonto-transactions'] })
      queryClient.invalidateQueries({ queryKey: ['tresorerie-revenus'] })
    },
    onError: (error) => {
      toast.error(sanitizeSupabaseError(error))
    },
  })

  // Unreconcile mutation
  const unreconcileMutation = useMutation({
    mutationFn: async ({
      transactionId,
      revenuId,
    }: {
      transactionId: string
      revenuId: string
    }) => {
      const { error: opError } = await supabase
        .from('tresorerie_operations_bancaires')
        .update({ recette_id: null, reconcilie: false })
        .eq('id', transactionId)

      if (opError) throw opError

      const { error: revError } = await supabase
        .from('tresorerie_revenus')
        .update({
          statut: 'facture',
          date_paiement_reel: null,
        })
        .eq('id', revenuId)

      if (revError) throw revError
    },
    onSuccess: () => {
      toast.success('Rapprochement annulé')
      queryClient.invalidateQueries({ queryKey: ['qonto-transactions'] })
      queryClient.invalidateQueries({ queryKey: ['tresorerie-revenus'] })
    },
  })

  return {
    transactions: transactionsQuery.data || [],
    connection: connectionQuery.data,
    isLoading: transactionsQuery.isLoading,
    isError: transactionsQuery.isError,
    refetch: transactionsQuery.refetch,
    isConnectionLoading: connectionQuery.isLoading,
    sync: syncMutation.mutate,
    isSyncing: syncMutation.isPending,
    reconcile: reconcileMutation.mutate,
    unreconcile: unreconcileMutation.mutate,
    isReconciling: reconcileMutation.isPending,
  }
}
