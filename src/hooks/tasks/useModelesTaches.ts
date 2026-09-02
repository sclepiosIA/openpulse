import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseBrowser'
import { useToast } from '@/hooks/shared/use-toast'
import { debug } from '@/lib/debug'

export interface ModeletTache {
  id: string
  titre: string
  description?: string
  categorie_id: string
  priorite: 'low' | 'medium' | 'high'
  ordre?: number
  delai_jours?: number
  actif: boolean
  created_at: string
  categorie?: { nom: string; couleur: string }
}

export type Modele = ModeletTache

export function useModelesTaches() {
  const { toast } = useToast()

  return useQuery({
    queryKey: ['modeles-taches'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('modeles_taches')
        .select(
          `
          *,
          categorie:categories_taches(nom, couleur)
        `
        )
        .eq('actif', true)
        .order('ordre', { ascending: true })

      if (error) {
        toast({
          title: 'Erreur',
          description: 'Impossible de charger les modèles de tâches',
          variant: 'destructive',
        })
        throw error
      }

      return data as ModeletTache[]
    },
  })
}

export function useAllModelesTaches() {
  const { toast } = useToast()

  return useQuery({
    queryKey: ['all-modeles-taches'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('modeles_taches')
        .select(
          `
          *,
          categorie:categories_taches(nom, couleur)
        `
        )
        .order('ordre', { ascending: true })

      if (error) {
        toast({
          title: 'Erreur',
          description: 'Impossible de charger les modèles de tâches',
          variant: 'destructive',
        })
        throw error
      }

      return data as ModeletTache[]
    },
  })
}

export function useUpdateModeleTache() {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<ModeletTache> }) => {
      const { data: result, error } = await supabase
        .from('modeles_taches')
        .update(data as never)
        .eq('id', id)
        .select()
        // safe: guaranteed-row
        .single() // safe: guaranteed-row

      if (error) throw error
      return result
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['modeles-taches'] })
      queryClient.invalidateQueries({ queryKey: ['all-modeles-taches'] })
      toast({
        title: 'Succès',
        description: 'Modèle de tâche mis à jour avec succès',
      })
    },
    onError: (error) => {
      debug.error('Error updating modele tache:', error)
      toast({
        title: 'Erreur',
        description: 'Impossible de mettre à jour le modèle de tâche',
        variant: 'destructive',
      })
    },
  })
}

export function useCreateModeleTache() {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  return useMutation({
    mutationFn: async (data: Omit<ModeletTache, 'id' | 'created_at' | 'categorie'>) => {
      const { data: result, error } = await supabase
        .from('modeles_taches')
        .insert([data])
        .select()
        // safe: guaranteed-row
        .single() // safe: guaranteed-row

      if (error) throw error
      return result
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['modeles-taches'] })
      queryClient.invalidateQueries({ queryKey: ['all-modeles-taches'] })
      toast({
        title: 'Succès',
        description: 'Modèle de tâche créé avec succès',
      })
    },
    onError: (error) => {
      debug.error('Error creating modele tache:', error)
      toast({
        title: 'Erreur',
        description: 'Impossible de créer le modèle de tâche',
        variant: 'destructive',
      })
    },
  })
}

export function useDeleteModeleTache() {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('modeles_taches').delete().eq('id', id)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['modeles-taches'] })
      queryClient.invalidateQueries({ queryKey: ['all-modeles-taches'] })
      toast({
        title: 'Succès',
        description: 'Modèle de tâche supprimé avec succès',
      })
    },
    onError: (error) => {
      debug.error('Error deleting modele tache:', error)
      toast({
        title: 'Erreur',
        description: 'Impossible de supprimer le modèle de tâche',
        variant: 'destructive',
      })
    },
  })
}
