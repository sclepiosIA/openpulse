/**
 * @fileoverview Hook pour gérer les surcharges permanentes de salaires prévisionnels.
 *
 * Permet de modifier les projections de salaires à partir d'une date donnée.
 * Ces surcharges sont stockées dans la table salaire_projections_overrides.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { toast } from 'sonner'
import { sanitizeSupabaseError } from '@/lib/supabaseErrorSanitizer'
import { useAuth } from '@/components/AuthProvider'

export interface SalaireProjectionOverride {
  id: string
  profile_id: string
  montant: number
  date_effet: string
  notes: string | null
  created_at: string
  created_by: string | null
}

export interface CreateOverrideData {
  profile_id: string
  montant: number
  date_effet: string
  notes?: string
}

export function useSalaireProjectionsOverrides() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  const { data: overrides, isLoading } = useQuery({
    queryKey: ['salaire-projections-overrides'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('salaire_projections_overrides')
        .select('id, profile_id, montant, date_effet, notes, created_at, created_by')
        .order('date_effet', { ascending: false })

      if (error) throw error
      return data as SalaireProjectionOverride[]
    },
  })

  const createOverride = useMutation({
    mutationFn: async (data: CreateOverrideData) => {
      const { data: result, error } = await supabase
        .from('salaire_projections_overrides')
        .upsert(
          {
            profile_id: data.profile_id,
            montant: data.montant,
            date_effet: data.date_effet,
            notes: data.notes || null,
            created_by: user?.id || null,
          },
          {
            onConflict: 'profile_id,date_effet',
          }
        )
        .select()
        // safe: guaranteed-row
        .single()

      if (error) throw error
      return result
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['salaire-projections-overrides'] })
      toast.success('Projection de salaire modifiée')
    },
    onError: (error: Error) => {
      toast.error(sanitizeSupabaseError(error))
    },
  })

  const deleteOverride = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('salaire_projections_overrides').delete().eq('id', id)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['salaire-projections-overrides'] })
      toast.success('Surcharge supprimée')
    },
    onError: (error: Error) => {
      toast.error(sanitizeSupabaseError(error))
    },
  })

  /**
   * Récupère la surcharge applicable pour un employé à un mois donné.
   * Cherche la dernière surcharge avec date_effet <= mois
   */
  const getApplicableOverride = (
    profileId: string,
    mois: string
  ): SalaireProjectionOverride | null => {
    if (!overrides) return null

    const applicableOverrides = overrides
      .filter((o) => o.profile_id === profileId && o.date_effet <= mois)
      .sort((a, b) => b.date_effet.localeCompare(a.date_effet))

    return applicableOverrides[0] || null
  }

  return {
    overrides: overrides || [],
    isLoading,
    createOverride: createOverride.mutateAsync,
    deleteOverride: deleteOverride.mutateAsync,
    getApplicableOverride,
    isCreating: createOverride.isPending,
    isDeleting: deleteOverride.isPending,
  }
}
