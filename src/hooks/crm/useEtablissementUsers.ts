import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseBrowser'
import { toast } from 'sonner'
import { sanitizeSupabaseError } from '@/lib/supabaseErrorSanitizer'
import { debug } from '@/lib/debug'
import { queryPresets } from '@/lib/queryPresets'

interface CreateEtablissementUserData {
  etablissement_id: string
  nom: string
  prenom: string
  email: string
  telephone?: string
  fonction: string
  service?: string
  specialite?: string
  password: string
}

export function useEtablissementUsers(etablissementId?: string) {
  return useQuery({
    queryKey: ['etablissement-users', etablissementId],
    queryFn: async () => {
      if (!etablissementId) {
        debug.log('useEtablissementUsers: etablissementId is undefined')
        return []
      }

      debug.log('useEtablissementUsers: fetching users for', etablissementId)

      const { data, error } = await supabase
        .from('etablissement_users')
        .select('*, etablissement_user_roles(role)')
        .eq('etablissement_id', etablissementId)
        .eq('actif', true)
        .order('nom', { ascending: true })

      if (error) {
        debug.error('useEtablissementUsers error:', error)
        throw error
      }

      debug.log('useEtablissementUsers: found', data?.length || 0, 'users')
      return data || []
    },
    enabled: !!etablissementId,
    ...queryPresets.reference, // 30 min staleTime for reference data
  })
}

export function useCreateEtablissementUser() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (newUser: CreateEtablissementUserData) => {
      // 1. Créer l'utilisateur auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: newUser.email,
        password: newUser.password,
        options: {
          data: {
            type: 'etablissement_user',
          },
        },
      })

      if (authError) throw authError
      if (!authData.user) throw new Error("Erreur lors de la création de l'utilisateur")

      // 2. Créer l'enregistrement etablissement_user
      const { data: userData, error: userError } = await supabase
        .from('etablissement_users')
        .insert({
          user_id: authData.user.id,
          etablissement_id: newUser.etablissement_id,
          nom: newUser.nom,
          prenom: newUser.prenom,
          email: newUser.email,
          telephone: newUser.telephone,
          fonction: newUser.fonction,
          service: newUser.service,
          specialite: newUser.specialite,
        })
        .select()
        // safe: guaranteed-row
        .single()

      if (userError) throw userError
      return userData
    },
    onSuccess: () => {
      toast.success('Utilisateur créé avec succès')
      queryClient.invalidateQueries({ queryKey: ['etablissement-users'] })
      queryClient.invalidateQueries({ queryKey: ['etablissement-analytics'] })
    },
    onError: (error: Error) => {
      toast.error(sanitizeSupabaseError(error))
    },
  })
}

export function useUpdateEtablissementUser() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      id,
      updates,
    }: {
      id: string
      updates: Partial<CreateEtablissementUserData>
    }) => {
      const { data, error } = await supabase
        .from('etablissement_users')
        .update(updates as never)
        .eq('id', id)
        .select()
        // safe: guaranteed-row
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      toast.success('Utilisateur mis à jour')
      queryClient.invalidateQueries({ queryKey: ['etablissement-users'] })
      queryClient.invalidateQueries({ queryKey: ['etablissement-analytics'] })
    },
    onError: (error: Error) => {
      toast.error(sanitizeSupabaseError(error))
    },
  })
}

export function useDeleteEtablissementUser() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase.from('etablissement_users').delete().eq('id', userId)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['etablissement-users'] })
      toast.success('Utilisateur supprimé avec succès')
    },
    onError: (error: Error) => {
      toast.error(sanitizeSupabaseError(error))
    },
  })
}
