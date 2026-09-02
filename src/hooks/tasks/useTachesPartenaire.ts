import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { debug } from '@/lib/debug'
import { supabase } from '@/lib/supabaseBrowser'
import { useToast } from '@/hooks/shared/use-toast'
import { useAuth } from '@/components/AuthProvider'

export interface TachePartenaire {
  id: string
  titre: string
  description?: string
  statut: 'A faire' | 'En cours' | 'Bloqué' | 'Terminé'
  priorite: 'low' | 'medium' | 'high'
  partenaire_id: string
  categorie_id: string
  responsable_id?: string
  completed_by?: string
  date_realisation?: string
  echeance?: string
  commentaires?: string
  ordre?: number
  archive: boolean
  created_at: string
  updated_at: string
  categories_taches?: { id: string; nom: string; couleur: string }
  responsable_profile?: { id: string; prenom: string; nom: string; email: string }
  partenaires?: { id: string; nom: string; type_partenaire: string }
}

export function useTachesPartenaire(partenaireId: string, includeArchived = false) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { loading, user } = useAuth()
  
  const queryKey = ['taches', 'partenaire', partenaireId, includeArchived ? 'with-archived' : 'no-archived']

  const query = useQuery({
    queryKey,
    queryFn: async () => {
      let queryBuilder = supabase
        .from('taches')
        .select(`
          *,
          categories_taches(id, nom, couleur),
          partenaires(id, nom, type_partenaire),
          responsable_profile:profiles!taches_responsable_id_fkey(id, prenom, nom, email)
        `)
        .eq('partenaire_id', partenaireId)

      if (!includeArchived) {
        queryBuilder = queryBuilder.eq('archive', false)
      }

      const { data, error } = await queryBuilder.order('created_at', { ascending: false })

      if (error) {
        toast({
          title: "Erreur",
          description: "Impossible de charger les tâches du partenaire",
          variant: "destructive"
        })
        throw error
      }

      return data as TachePartenaire[]
    },
    enabled: !!partenaireId && !loading && !!user,
  })

  // Abonnement temps réel
  useEffect(() => {
    if (!partenaireId) return

    const channel = supabase
      .channel(`taches-partenaire-${partenaireId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'taches',
        filter: `partenaire_id=eq.${partenaireId}`
      }, () => {
        queryClient.invalidateQueries({ queryKey })
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [partenaireId, queryKey, queryClient])

  return query
}

export function useUpdateTachePartenaire() {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<TachePartenaire> }) => {
      const { data: result, error } = await supabase
        .from('taches')
        .update(data as never)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return result
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['taches'] })
      toast({
        title: "Succès",
        description: "Tâche mise à jour avec succès"
      })
    },
    onError: (error) => {
      debug.error('Error updating tache:', error)
      toast({
        title: "Erreur",
        description: "Impossible de mettre à jour la tâche",
        variant: "destructive"
      })
    },
  })
}

export function useArchiveTachePartenaire() {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  return useMutation({
    mutationFn: async ({ id, archive }: { id: string; archive: boolean }) => {
      const { data: result, error } = await supabase
        .from('taches')
        .update({ archive })
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return result
    },
    onSuccess: (data, { archive }) => {
      queryClient.invalidateQueries({ queryKey: ['taches'] })
      toast({
        title: "Succès",
        description: archive ? "Tâche archivée" : "Tâche désarchivée"
      })
    },
    onError: (error) => {
      debug.error('Error archiving tache:', error)
      toast({
        title: "Erreur",
        description: "Impossible de modifier l'archivage de la tâche",
        variant: "destructive"
      })
    },
  })
}

export function useCreateTachePartenaire() {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  return useMutation({
    mutationFn: async (data: {
      titre: string
      description?: string
      partenaire_id: string
      categorie_id: string
      priorite: 'low' | 'medium' | 'high'
      echeance?: string
      responsable_id?: string
    }) => {
      const { data: result, error } = await supabase
        .from('taches')
        .insert({
          ...data,
          statut: 'A faire',
          niveau_tache: 'partenaire',
          archive: false,
          ordre: 999
        })
        .select()
        .single()

      if (error) throw error
      return result
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['taches'] })
      toast({ title: "Succès", description: "Tâche créée avec succès" })
    },
    onError: (error) => {
      debug.error('Error creating tache:', error)
      toast({
        title: "Erreur",
        description: "Impossible de créer la tâche",
        variant: "destructive"
      })
    },
  })
}
