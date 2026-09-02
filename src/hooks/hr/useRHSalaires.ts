import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { toast } from 'sonner'
import { sanitizeSupabaseError } from '@/lib/supabaseErrorSanitizer'
import { debug } from '@/lib/debug'
import { logSalaryBatchView, logSalaryAccess } from './useSalaryAudit'

export interface RHSalaire {
  id: string
  profile_id: string
  mois: string
  salaire_brut: number
  salaire_net: number
  net_paye?: number
  cotisations_patronales: number
  cotisations_salariales: number
  primes?: number
  heures_supplementaires?: number
  source_type?: 'manual' | 'auto_bulletin' | 'corrected'
  source_document_id?: string
  created_at?: string
  updated_at?: string
  profiles?: {
    id: string
    prenom: string
    nom: string
    email: string
    fonction?: string
  }
}

export function useRHSalaires(mois?: string | null) {
  const queryClient = useQueryClient()

  const { data: salaires, isLoading } = useQuery({
    queryKey: ['rh-salaires', mois],
    queryFn: async () => {
      let query = supabase
        .from('rh_salaires_mensuels')
        .select(
          `
          *,
          profiles:profile_id (
            id,
            prenom,
            nom,
            email,
            fonction
          )
        `
        )
        .order('mois', { ascending: false })

      // Si mois === null ou undefined → tous les salaires
      if (mois) {
        const normalizedMois = mois.length === 7 ? mois + '-01' : mois
        query = query.eq('mois', normalizedMois)
      }

      const { data, error } = await query
      if (error) throw error

      // Log batch view for GDPR audit trail
      if (data && data.length > 0) {
        logSalaryBatchView(mois || 'all', data.length)
      }

      return data as RHSalaire[]
    },
  })

  const createSalaire = useMutation({
    mutationFn: async (salaire: Omit<RHSalaire, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('rh_salaires_mensuels')
        .insert(salaire as never)
        .select()
        // safe: guaranteed-row
        .single() // safe: guaranteed-row

      if (error) throw error
      return data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['rh-salaires'] })
      queryClient.invalidateQueries({ queryKey: ['rh-kpis'] })
      toast.success('Salaire créé avec succès')
      // Audit log for salary creation
      logSalaryAccess({
        targetProfileId: data.profile_id,
        accessType: 'CREATE',
        salaryMonth: data.mois,
      })
    },
    onError: (error: Error) => {
      toast.error(sanitizeSupabaseError(error))
      debug.error('Erreur création salaire:', error)
    },
  })

  const updateSalaire = useMutation({
    mutationFn: async ({ id, ...salaire }: Partial<RHSalaire> & { id: string }) => {
      const { data, error } = await supabase
        .from('rh_salaires_mensuels')
        .update(salaire as never)
        .eq('id', id)
        .select()
        // safe: guaranteed-row
        .single() // safe: guaranteed-row

      if (error) throw error
      return data
    },
    // Optimistic update
    onMutate: async (newSalaire) => {
      await queryClient.cancelQueries({ queryKey: ['rh-salaires'] })
      const previousSalaires = queryClient.getQueryData(['rh-salaires', mois])

      queryClient.setQueryData(['rh-salaires', mois], (old: RHSalaire[] | undefined) =>
        old?.map((s) => (s.id === newSalaire.id ? { ...s, ...newSalaire } : s))
      )

      return { previousSalaires }
    },
    onSuccess: (data) => {
      toast.success('Salaire mis à jour avec succès')
      // Audit log for salary update
      logSalaryAccess({
        targetProfileId: data.profile_id,
        accessType: 'UPDATE',
        salaryMonth: data.mois,
      })
    },
    onError: (error: Error, _, context) => {
      if (context?.previousSalaires) {
        queryClient.setQueryData(['rh-salaires', mois], context.previousSalaires)
      }
      toast.error(sanitizeSupabaseError(error))
      debug.error('Erreur mise à jour salaire:', error)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['rh-salaires'] })
      queryClient.invalidateQueries({ queryKey: ['rh-kpis'] })
    },
  })

  const deleteSalaire = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('rh_salaires_mensuels').delete().eq('id', id)

      if (error) throw error
    },
    // Optimistic delete
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['rh-salaires'] })
      const previousSalaires = queryClient.getQueryData(['rh-salaires', mois])

      queryClient.setQueryData(['rh-salaires', mois], (old: RHSalaire[] | undefined) =>
        old?.filter((s) => s.id !== id)
      )

      return { previousSalaires }
    },
    onSuccess: (_data, deletedId) => {
      toast.success('Salaire supprimé avec succès')
      // Audit log for salary deletion
      logSalaryAccess({
        accessType: 'DELETE',
        details: { deleted_salary_id: deletedId },
      })
    },
    onError: (error: Error, _, context) => {
      if (context?.previousSalaires) {
        queryClient.setQueryData(['rh-salaires', mois], context.previousSalaires)
      }
      toast.error(sanitizeSupabaseError(error))
      debug.error('Erreur suppression salaire:', error)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['rh-salaires'] })
      queryClient.invalidateQueries({ queryKey: ['rh-kpis'] })
    },
  })

  return {
    salaires,
    isLoading,
    createSalaire: createSalaire.mutateAsync,
    updateSalaire: updateSalaire.mutateAsync,
    deleteSalaire: deleteSalaire.mutateAsync,
  }
}

/**
 * Helper pour grouper les salaires par mois
 */
export function groupSalairesByMonth(salaires: RHSalaire[] | undefined) {
  if (!salaires || salaires.length === 0) return []

  const grouped = salaires.reduce(
    (acc, salaire) => {
      const monthKey = salaire.mois.slice(0, 7) // YYYY-MM
      if (!acc[monthKey]) acc[monthKey] = []
      acc[monthKey].push(salaire)
      return acc
    },
    {} as Record<string, RHSalaire[]>
  )

  return Object.entries(grouped).sort((a, b) => b[0].localeCompare(a[0]))
}
