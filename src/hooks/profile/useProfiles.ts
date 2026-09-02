import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseBrowser'
import { useToast } from '@/hooks/shared/use-toast'
import { useAuth } from '@/components/AuthProvider'
import { debug } from '@/lib/debug'
import { isNetworkAbort } from '@/lib/networkAbort'

export interface Profile {
  id: string
  user_id: string
  prenom: string
  nom: string
  email: string
  actif: boolean
  created_at: string
  updated_at: string
  avatar_url?: string | null
  linkedin_url?: string | null
}

// Simplified profile from get_profiles_public RPC
export interface ProfilePublic {
  id: string
  user_id: string
  prenom: string
  nom: string
  email: string
  avatar_url: string | null
  linkedin_url: string | null
}

export interface CreateProfileData {
  user_id: string
  prenom: string
  nom: string
  email: string
  actif: boolean
}

export function useProfiles() {
  const { toast } = useToast()

  return useQuery({
    queryKey: ['profiles'],
    queryFn: async () => {
      try {
        const { data, error } = await supabase.rpc('get_profiles_public')

        if (error) {
          // Check if it's an auth error or 2FA requirement
          if (
            error.message?.includes('Authentication required') ||
            error.message?.includes('2FA') ||
            error.message?.includes('admin privileges')
          ) {
            debug.warn('User lacks permissions to load all profiles')
            return [] // Return empty array for graceful degradation
          }
          throw error
        }

        return (data || []) as ProfilePublic[]
      } catch (error) {
        // Une navigation annule les requêtes en vol : ce n'est pas une panne,
        // la donnée sera rechargée au montage suivant. Afficher un toast
        // destructif dans ce cas alarme l'utilisateur sans raison.
        if (isNetworkAbort(error)) {
          debug.warn('Chargement des profils interrompu (navigation)')
          return []
        }
        debug.error('Error loading profiles:', error)
        toast({
          title: 'Erreur',
          description: 'Impossible de charger les profils. Vérifiez vos permissions.',
          variant: 'destructive',
        })
        return [] // Graceful degradation instead of throwing
      }
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 1, // Only retry once for auth errors
  })
}

export function useActiveProfiles() {
  const { toast } = useToast()

  return useQuery({
    queryKey: ['active-profiles'],
    queryFn: async () => {
      // get_profiles_public already returns only active profiles
      const { data, error } = await supabase.rpc('get_profiles_public')

      if (error) {
        toast({
          title: 'Erreur',
          description: 'Impossible de charger les profils actifs',
          variant: 'destructive',
        })
        throw error
      }

      // Sort profiles by name
      const sortedProfiles = (data || []).sort((a, b) => (a.nom || '').localeCompare(b.nom || ''))

      return sortedProfiles as ProfilePublic[]
    },
  })
}

export function useCurrentProfile() {
  const { toast } = useToast()
  const { user, loading } = useAuth()
  const authUserId = user?.id

  return useQuery({
    // Include authUserId in queryKey for proper cache isolation between users
    queryKey: ['current-profile', authUserId],
    queryFn: async () => {
      if (!authUserId) {
        return null
      }

      const { data, error } = await supabase
        .from('profiles')
        .select(
          'id, user_id, prenom, nom, email, actif, avatar_url, linkedin_url, created_at, updated_at'
        )
        .eq('user_id', authUserId)
        .maybeSingle()

      if (error) {
        // Erreurs RLS/JWT/absence session : traiter comme profil manquant, ne pas polluer console
        const code = (error as { code?: string })?.code
        if (code === 'PGRST301' || code === 'PGRST116' || code === '42501') {
          debug.warn('Profile fetch skipped:', code)
          return null
        }
        debug.warn('Profile fetch error:', error)
        throw error
      }

      if (!data) {
        return null
      }

      return data as Profile
    },
    // Only run after Supabase auth has fully restored the session.
    // This prevents RLS queries from leaving with an anon JWT during boot.
    enabled: !loading && !!authUserId,
    // Short stale time for profile data freshness
    staleTime: 30 * 1000, // 30 seconds
    retry: false,
  })
}

export function useCreateProfile() {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  return useMutation({
    mutationFn: async (data: CreateProfileData) => {
      const { data: result, error } = await supabase
        .from('profiles')
        .insert([data])
        .select()
        .single()

      if (error) throw error
      return result
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profiles'] })
      queryClient.invalidateQueries({ queryKey: ['active-profiles'] })
      toast({
        title: 'Succès',
        description: 'Utilisateur créé avec succès',
      })
    },
    onError: (error) => {
      debug.error('Error creating profile:', error)
      toast({
        title: 'Erreur',
        description: "Impossible de créer l'utilisateur",
        variant: 'destructive',
      })
    },
  })
}

export function useUpdateProfile() {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string
      data: Partial<Profile> & { role?: string }
    }) => {
      // Extraire le rôle s'il existe - typage explicite
      type ProfileUpdateData = Partial<Profile> & { role?: string }
      const { role, ...profileData } = data as ProfileUpdateData

      // Récupérer le user_id depuis le profile
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('user_id')
        .eq('id', id)
        .maybeSingle()

      if (profileError) throw profileError
      if (!profile) throw new Error('Profil introuvable')

      // Mettre à jour le profil (sans le rôle)
      const { data: result, error } = await supabase
        .from('profiles')
        .update(profileData)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error

      // Si un rôle est fourni, utiliser la fonction sécurisée
      if (role && profile?.user_id) {
        type AppRole = 'admin' | 'chef_projet' | 'commercial' | 'copil' | 'csm' | 'direction' | 'rh'
        const { error: roleError } = await supabase.rpc('update_user_role', {
          target_user_id: profile.user_id,
          new_role: role as AppRole,
        })

        if (roleError) {
          debug.error('Erreur lors de la mise à jour du rôle:', roleError)
          throw new Error(`Impossible de mettre à jour le rôle: ${roleError.message}`)
        }
      }

      return result
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profiles'] })
      queryClient.invalidateQueries({ queryKey: ['active-profiles'] })
      queryClient.invalidateQueries({ queryKey: ['profiles-with-roles'] })
      queryClient.invalidateQueries({ queryKey: ['active-profiles-with-roles'] })
      toast({
        title: 'Succès',
        description: 'Utilisateur mis à jour avec succès',
      })
    },
    onError: (error) => {
      debug.error('Error updating profile:', error)
      toast({
        title: 'Erreur',
        description: "Impossible de mettre à jour l'utilisateur",
        variant: 'destructive',
      })
    },
  })
}

export function useDeleteProfile() {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  return useMutation({
    mutationFn: async (id: string) => {
      // Use offboard-user edge function for proper cleanup
      const { data, error } = await supabase.functions.invoke('offboard-user', {
        body: { target_profile_id: id },
      })

      if (error) throw new Error(error.message || "Erreur lors de l'offboarding")
      if (data?.error) throw new Error(data.error)
      return data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['profiles'] })
      queryClient.invalidateQueries({ queryKey: ['active-profiles'] })
      queryClient.invalidateQueries({ queryKey: ['profiles-with-roles'] })
      queryClient.invalidateQueries({ queryKey: ['marque-team-calendars'] })
      toast({
        title: 'Offboarding terminé',
        description: data?.user
          ? `${data.user} a été désactivé. Les documents RH sont conservés.`
          : 'Utilisateur désactivé avec succès',
      })
    },
    onError: (error) => {
      debug.error('Error offboarding profile:', error)
      toast({
        title: 'Erreur',
        description: error.message || "Impossible de procéder à l'offboarding",
        variant: 'destructive',
      })
    },
  })
}
