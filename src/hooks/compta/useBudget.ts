import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { toast } from 'sonner'

export interface ComptaBudget {
  id: string
  libelle: string
  exercice_id: string | null
  statut: 'brouillon' | 'valide' | 'archive'
}

export interface ComptaBudgetLigne {
  id: string
  budget_id: string
  compte_id: string
  mois: number
  montant: number
  commentaire: string | null
}

export function useBudgets() {
  return useQuery({
    queryKey: ['compta', 'budgets'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('compta_budgets' as any)
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data || []) as unknown as ComptaBudget[]
    },
  })
}

export function useBudgetLignes(budgetId: string | null) {
  return useQuery({
    queryKey: ['compta', 'budget-lignes', budgetId],
    enabled: !!budgetId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('compta_budget_lignes' as any)
        .select('*')
        .eq('budget_id', budgetId!)
      if (error) throw error
      return (data || []) as unknown as ComptaBudgetLigne[]
    },
  })
}

export function useBudgetVsReel(budgetId: string | null) {
  return useQuery({
    queryKey: ['compta', 'budget-vs-reel', budgetId],
    enabled: !!budgetId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_compta_budget_vs_reel' as any)
        .select('*')
        .eq('budget_id', budgetId!)
      if (error) throw error
      return (data || []) as any[]
    },
  })
}

export function useCreateBudget() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: { libelle: string; exercice_id?: string }) => {
      const { data, error } = await supabase
        .from('compta_budgets' as any)
        .insert(payload as any)
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['compta', 'budgets'] })
      toast.success('Budget créé')
    },
    onError: (e: any) => toast.error(e.message),
  })
}

export function useUpsertBudgetLigne() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: {
      budget_id: string
      compte_id: string
      mois: number
      montant: number
    }) => {
      const { error } = await supabase
        .from('compta_budget_lignes' as any)
        .upsert(payload as any, { onConflict: 'budget_id,compte_id,mois' })
      if (error) throw error
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['compta', 'budget-lignes', vars.budget_id] })
      qc.invalidateQueries({ queryKey: ['compta', 'budget-vs-reel', vars.budget_id] })
    },
    onError: (e: any) => toast.error(e.message),
  })
}

export function useDeleteBudget() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('compta_budgets' as any)
        .delete()
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['compta', 'budgets'] })
      toast.success('Budget supprimé')
    },
  })
}
