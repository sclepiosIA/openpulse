import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { toast } from 'sonner'
import { debug } from '@/lib/debug'

export interface RHAbsence {
  id: string
  profile_id: string
  date_debut: string
  date_fin: string
  type_absence: string
  motif?: string
  statut: string
  validateur_id?: string
  validated_at?: string
  rejection_reason?: string
  demandeur_commentaire?: string
  jours_ouvres?: number
  created_at?: string
  updated_at?: string
  profiles?: {
    prenom: string
    nom: string
    email: string
  }
}

export function useRHAbsences(profileId?: string, startDate?: string, endDate?: string) {
  const queryClient = useQueryClient()

  const { data: absences, isLoading } = useQuery({
    queryKey: ['rh-absences', profileId, startDate, endDate],
    queryFn: async () => {
      let query = supabase
        .from('rh_absences')
        .select(
          `
          *,
          profiles!rh_absences_profile_id_fkey (
            prenom,
            nom,
            email
          )
        `
        )
        .order('date_debut', { ascending: false })

      if (profileId) {
        query = query.eq('profile_id', profileId)
      }
      if (startDate) {
        query = query.gte('date_debut', startDate)
      }
      if (endDate) {
        query = query.lte('date_fin', endDate)
      }

      const { data, error } = await query

      if (error) throw error
      return data as RHAbsence[]
    },
  })

  const createAbsence = useMutation({
    mutationFn: async (absence: Omit<RHAbsence, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('rh_absences')
        .insert(absence as never)
        .select()
        // safe: guaranteed-row
        .single() // safe: guaranteed-row

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rh-absences'] })
      toast.success('Absence créée avec succès')
    },
    onError: (error) => {
      toast.error("Erreur lors de la création de l'absence")
      debug.error('Error creating absence:', error)
    },
  })

  const updateAbsence = useMutation({
    mutationFn: async ({ id, ...absence }: Partial<RHAbsence> & { id: string }) => {
      const { data, error } = await supabase
        .from('rh_absences')
        .update(absence as never)
        .eq('id', id)
        .select()
        // safe: guaranteed-row
        .single() // safe: guaranteed-row

      if (error) throw error
      return data
    },
    onMutate: async (newAbsence) => {
      await queryClient.cancelQueries({ queryKey: ['rh-absences'] })
      const previousAbsences = queryClient.getQueryData([
        'rh-absences',
        profileId,
        startDate,
        endDate,
      ])

      queryClient.setQueryData(
        ['rh-absences', profileId, startDate, endDate],
        (old: RHAbsence[] | undefined) =>
          old?.map((a) => (a.id === newAbsence.id ? { ...a, ...newAbsence } : a))
      )

      return { previousAbsences }
    },
    onSuccess: () => {
      toast.success('Absence mise à jour avec succès')
    },
    onError: (error, _, context) => {
      if (context?.previousAbsences) {
        queryClient.setQueryData(
          ['rh-absences', profileId, startDate, endDate],
          context.previousAbsences
        )
      }
      toast.error("Erreur lors de la mise à jour de l'absence")
      debug.error('Error updating absence:', error)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['rh-absences'] })
    },
  })

  const deleteAbsence = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('rh_absences').delete().eq('id', id)

      if (error) throw error
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['rh-absences'] })
      const previousAbsences = queryClient.getQueryData([
        'rh-absences',
        profileId,
        startDate,
        endDate,
      ])

      queryClient.setQueryData(
        ['rh-absences', profileId, startDate, endDate],
        (old: RHAbsence[] | undefined) => old?.filter((a) => a.id !== id)
      )

      return { previousAbsences }
    },
    onSuccess: () => {
      toast.success('Absence supprimée avec succès')
    },
    onError: (error, _, context) => {
      if (context?.previousAbsences) {
        queryClient.setQueryData(
          ['rh-absences', profileId, startDate, endDate],
          context.previousAbsences
        )
      }
      toast.error("Erreur lors de la suppression de l'absence")
      debug.error('Error deleting absence:', error)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['rh-absences'] })
    },
  })

  return {
    absences,
    isLoading,
    createAbsence: createAbsence.mutateAsync,
    updateAbsence: updateAbsence.mutateAsync,
    deleteAbsence: deleteAbsence.mutateAsync,
  }
}
