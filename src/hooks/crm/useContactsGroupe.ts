import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { useToast } from '@/hooks/shared/use-toast'
import { queryPresets } from '@/lib/queryPresets'

export interface ContactGroupe {
  id: string
  groupe_id: string
  niveau_contact: 'groupe'
  nom: string
  prenom?: string
  fonction: string
  email?: string
  telephone?: string
  est_contact_principal: boolean
  type_contact?: string
  created_at: string
  updated_at: string
}

async function fetchContactsGroupe(groupeId: string): Promise<ContactGroupe[]> {
  const { data, error } = await supabase
    .from('contacts')
    .select(
      'id, groupe_id, niveau_contact, nom, prenom, fonction, email, telephone, est_contact_principal, type_contact, created_at, updated_at'
    )
    .eq('groupe_id', groupeId)
    .eq('niveau_contact', 'groupe')
    .order('est_contact_principal', { ascending: false })
    .order('nom')

  if (error) throw error
  return data as ContactGroupe[]
}

export function useContactsGroupe(groupeId?: string) {
  const { toast } = useToast()

  return useQuery({
    queryKey: ['contacts-groupe', groupeId],
    queryFn: () => fetchContactsGroupe(groupeId!),
    enabled: !!groupeId,
    ...queryPresets.standard, // Normalized: 2min staleTime, 30min gcTime
    meta: {
      onError: () => {
        toast({
          title: 'Erreur',
          description: 'Impossible de charger les contacts du groupe',
          variant: 'destructive',
        })
      },
    },
  })
}

export function useCreateContactGroupe() {
  const { toast } = useToast()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (
      data: Omit<ContactGroupe, 'id' | 'created_at' | 'updated_at' | 'niveau_contact'>
    ) => {
      const insertData = {
        ...data,
        niveau_contact: 'groupe' as const,
        etablissement_id: null,
      }

      const { data: result, error } = await supabase
        .from('contacts')
        .insert(insertData)
        .select()
        // safe: guaranteed-row
        .single()

      if (error) throw error
      return result
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['contacts-groupe', variables.groupe_id] })
      toast({
        title: 'Succès',
        description: 'Contact groupe créé avec succès',
      })
    },
    onError: () => {
      toast({
        title: 'Erreur',
        description: 'Impossible de créer le contact groupe',
        variant: 'destructive',
      })
    },
  })
}

export function useUpdateContactGroupe() {
  const { toast } = useToast()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<ContactGroupe> }) => {
      const { data: result, error } = await supabase
        .from('contacts')
        .update(data)
        .eq('id', id)
        .select()
        // safe: guaranteed-row
        .single()

      if (error) throw error
      return result
    },
    onSuccess: (result) => {
      const contact = result as ContactGroupe
      queryClient.invalidateQueries({ queryKey: ['contacts-groupe', contact.groupe_id] })
      toast({
        title: 'Succès',
        description: 'Contact groupe mis à jour avec succès',
      })
    },
    onError: () => {
      toast({
        title: 'Erreur',
        description: 'Impossible de mettre à jour le contact groupe',
        variant: 'destructive',
      })
    },
  })
}

export function useDeleteContactGroupe() {
  const { toast } = useToast()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, groupeId }: { id: string; groupeId: string }) => {
      const { error } = await supabase.from('contacts').delete().eq('id', id)

      if (error) throw error
      return { groupeId }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['contacts-groupe', data.groupeId] })
      toast({
        title: 'Succès',
        description: 'Contact groupe supprimé avec succès',
      })
    },
    onError: () => {
      toast({
        title: 'Erreur',
        description: 'Impossible de supprimer le contact groupe',
        variant: 'destructive',
      })
    },
  })
}
