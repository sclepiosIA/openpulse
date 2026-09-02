import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseBrowser'
import { useAuth } from '@/components/AuthProvider'
import { useToast } from '@/hooks/shared/use-toast'
import { queryPresets } from '@/lib/queryPresets'
import { debug } from '@/lib/debug'
import { isNetworkAbort } from '@/lib/networkAbort'

export interface ProfileWithRole {
  id: string
  user_id: string
  prenom: string
  nom: string
  email: string
  actif: boolean
  created_at: string
  updated_at: string
  
  // Rôle système (permissions)
  role: 'direction' | 'copil' | 'admin' | 'commercial' | 'chef_projet' | 'csm' | 'rh'
  
  // Coordonnées
  telephone?: string | null
  
  // Fonction métier (poste)
  fonction?: string | null
  
  // Champs RH
  date_embauche?: string | null
  type_contrat?: 'cdi' | 'cdd' | 'remuneration_dirigeant' | 'interim' | 'freelance'
  salaire_brut?: number | null
  
  // Avatar et LinkedIn
  avatar_url?: string | null
  linkedin_url?: string | null
}

export function useProfilesWithRoles() {
  const { toast } = useToast()

  return useQuery({
    queryKey: ['profiles-with-roles'],
    queryFn: async () => {
      try {
        // Utiliser la fonction RPC sécurisée
        const { data, error } = await supabase
          .rpc('get_profiles_with_roles')

        if (error) throw error

        return (data || []) as ProfileWithRole[]
      } catch (error) {
        // Requête interrompue par une navigation : pas une panne (cf. isNetworkAbort).
        if (isNetworkAbort(error)) {
          debug.warn('Chargement des profils avec rôles interrompu (navigation)')
          return []
        }
        debug.error('Error loading profiles with roles:', error)
        toast({
          title: "Erreur",
          description: "Impossible de charger les profils avec leurs rôles",
          variant: "destructive"
        })
        return []
      }
    },
    ...queryPresets.reference, // 30 min staleTime for reference data
    retry: 1,
  })
}

export function useActiveProfilesWithRoles() {
  const { toast } = useToast()

  return useQuery({
    queryKey: ['active-profiles-with-roles'],
    queryFn: async () => {
      try {
        // Utiliser la fonction RPC sécurisée
        const { data, error } = await supabase
          .rpc('get_active_profiles_with_roles')

        if (error) throw error

        return (data || []) as ProfileWithRole[]
      } catch (error) {
        debug.error('Error loading active profiles with roles:', error)
        toast({
          title: "Erreur",
          description: "Impossible de charger les profils actifs",
          variant: "destructive"
        })
        return []
      }
    },
    ...queryPresets.reference, // 30 min staleTime for reference data
    retry: 1,
  })
}

export function useCurrentProfileWithRole() {
  const { toast } = useToast()
  const { user } = useAuth()

  return useQuery({
    queryKey: ['current-profile-with-role'],
    queryFn: async () => {
      if (!user) return null

      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('id, user_id, nom, prenom, email, telephone, fonction, actif, avatar_url, linkedin_url, created_at, updated_at, date_embauche, type_contrat')
        .eq('user_id', user.id)
        .maybeSingle()

      if (profileError) {
        const code = (profileError as { code?: string })?.code
        if (code === 'PGRST301' || code === 'PGRST116' || code === '42501') {
          debug.warn('Profile fetch skipped:', code)
          return null
        }
        debug.warn('Profile fetch error:', profileError)
        throw profileError
      }

      if (!profileData) return null

      // Fetch user role
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .single()

      return {
        ...profileData,
        role: (roleData?.role || 'commercial') as ProfileWithRole['role']
      } as ProfileWithRole
    },
    ...queryPresets.reference, // 30 min staleTime for reference data
    retry: false,
  })
}
