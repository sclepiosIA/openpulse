import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { useToast } from '@/hooks/shared/use-toast'

export interface Groupe {
  id: string
  nom: string
  type: 'GHT' | 'Groupe Cliniques' | 'Consortium' | 'Autre'
  description?: string
  adresse_siege?: string
  code_postal_siege?: string
  ville_siege?: string
  region?: string
  telephone?: string
  email?: string
  email_domains?: string[]
  responsable_commercial_id?: string
  responsable_csm_id?: string
  nombre_etablissements: number
  progression_moyenne: number
  total_passages_urgences_annuel?: number
  modules_deployes?: string[]
  notes?: string
  logo_url?: string | null
  created_at: string
  updated_at: string
  created_by?: string
  updated_by?: string
}

export const groupeKeys = {
  all: ['groupes'] as const,
  lists: () => [...groupeKeys.all, 'list'] as const,
  list: (filters?: Record<string, unknown>) => [...groupeKeys.lists(), filters] as const,
  details: () => [...groupeKeys.all, 'detail'] as const,
  detail: (id: string) => [...groupeKeys.details(), id] as const,
  stats: () => [...groupeKeys.all, 'stats'] as const,
}

async function fetchGroupes(filters?: { type?: string; region?: string }): Promise<Groupe[]> {
  let query = supabase
    .from('groupes_etablissements')
    .select(
      'id, nom, type, description, adresse_siege, code_postal_siege, ville_siege, region, telephone, email, email_domains, responsable_commercial_id, responsable_csm_id, nombre_etablissements, progression_moyenne, total_passages_urgences_annuel, modules_deployes, notes, logo_url, created_at, updated_at, created_by, updated_by'
    )
    .order('nom')

  if (filters?.type) {
    query = query.eq('type', filters.type)
  }
  if (filters?.region) {
    query = query.eq('region', filters.region)
  }

  const { data, error } = await query
  if (error) throw error
  return data as Groupe[]
}

async function fetchGroupe(id: string): Promise<Groupe | null> {
  const { data, error } = await supabase
    .from('groupes_etablissements')
    .select(
      'id, nom, type, description, adresse_siege, code_postal_siege, ville_siege, region, telephone, email, email_domains, responsable_commercial_id, responsable_csm_id, nombre_etablissements, progression_moyenne, total_passages_urgences_annuel, modules_deployes, notes, logo_url, created_at, updated_at, created_by, updated_by'
    )
    .eq('id', id)
    .maybeSingle()

  if (error) throw error
  return data as Groupe | null
}

export function useGroupes(filters?: { type?: string; region?: string }) {
  const { toast } = useToast()

  return useQuery({
    queryKey: groupeKeys.list(filters),
    queryFn: () => fetchGroupes(filters),
    staleTime: 5 * 60 * 1000,
    meta: {
      onError: () => {
        toast({
          title: 'Erreur',
          description: 'Impossible de charger les groupes',
          variant: 'destructive',
        })
      },
    },
  })
}

export function useGroupe(id: string) {
  const { toast } = useToast()

  return useQuery({
    queryKey: groupeKeys.detail(id),
    queryFn: () => fetchGroupe(id),
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
    meta: {
      onError: () => {
        toast({
          title: 'Erreur',
          description: 'Impossible de charger le groupe',
          variant: 'destructive',
        })
      },
    },
  })
}

export function useCreateGroupe() {
  const { toast } = useToast()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (
      data: Omit<
        Groupe,
        'id' | 'created_at' | 'updated_at' | 'nombre_etablissements' | 'progression_moyenne'
      >
    ) => {
      const { data: result, error } = await supabase
        .from('groupes_etablissements')
        .insert(data)
        .select()
        // safe: guaranteed-row
        .single()

      if (error) throw error
      return result
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: groupeKeys.all })
      toast({
        title: 'Succès',
        description: 'Groupe créé avec succès',
      })
    },
    onError: () => {
      toast({
        title: 'Erreur',
        description: 'Impossible de créer le groupe',
        variant: 'destructive',
      })
    },
  })
}

export function useUpdateGroupe() {
  const { toast } = useToast()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Groupe> }) => {
      const { data: result, error } = await supabase
        .from('groupes_etablissements')
        .update(data)
        .eq('id', id)
        .select()
        // safe: guaranteed-row
        .single()

      if (error) throw error
      return result
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: groupeKeys.detail(variables.id) })
      queryClient.invalidateQueries({ queryKey: groupeKeys.lists() })
      toast({
        title: 'Succès',
        description: 'Groupe mis à jour avec succès',
      })
    },
    onError: () => {
      toast({
        title: 'Erreur',
        description: 'Impossible de mettre à jour le groupe',
        variant: 'destructive',
      })
    },
  })
}

export function useDeleteGroupe() {
  const { toast } = useToast()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('groupes_etablissements').delete().eq('id', id)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: groupeKeys.all })
      toast({
        title: 'Succès',
        description: 'Groupe supprimé avec succès',
      })
    },
    onError: () => {
      toast({
        title: 'Erreur',
        description: 'Impossible de supprimer le groupe',
        variant: 'destructive',
      })
    },
  })
}
