import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseBrowser'
import { useAuth } from '@/components/AuthProvider'
import { debug } from '@/lib/debug'

export interface EtablissementUser {
  id: string
  user_id: string
  etablissement_id: string
  nom: string
  prenom: string
  email: string
  telephone?: string
  fonction: string
  service?: string
  specialite?: string
  statut_formation: 'non_forme' | 'en_cours' | 'forme' | 'a_rafraichir'
  date_premiere_formation?: string
  date_derniere_formation?: string
  nombre_sessions_suivies: number
  derniere_utilisation?: string
  nombre_connexions: number
  actif: boolean
  compte_verrouille: boolean
  created_at: string
  updated_at: string
  derniere_connexion?: string
  nombre_posts_forum?: number
  nombre_ressources_vues?: number
}

export function useEtablissementUser() {
  const { user } = useAuth()

  const { data: etablissementUser, isLoading } = useQuery({
    queryKey: ['etablissement-user', user?.id],
    queryFn: async () => {
      if (!user || !user.email) return null

      // 1. Chercher d'abord par user_id (cas normal)
      const { data: userFound, error: userError } = await supabase
        .from('etablissement_users')
        .select(
          'id, user_id, etablissement_id, email, nom, prenom, fonction, service, specialite, telephone, actif, statut_formation, compte_verrouille, nombre_connexions, nombre_sessions_suivies, derniere_utilisation, date_premiere_formation, date_derniere_formation, created_by, created_at, updated_at'
        )
        .eq('user_id', user.id)
        .eq('actif', true)
        .maybeSingle()

      if (userError && userError.code !== 'PGRST116') throw userError
      if (userFound) return userFound as EtablissementUser

      // 2. Si non trouvé, chercher par email avec user_id NULL (cas émargement QR avant auth)
      const { data: emailFound, error: emailError } = await supabase
        .from('etablissement_users')
        .select(
          'id, user_id, etablissement_id, email, nom, prenom, fonction, service, specialite, telephone, actif, statut_formation, compte_verrouille, nombre_connexions, nombre_sessions_suivies, derniere_utilisation, date_premiere_formation, date_derniere_formation, created_by, created_at, updated_at'
        )
        .eq('email', user.email.toLowerCase())
        .is('user_id', null)
        .eq('actif', true)
        .maybeSingle()

      if (emailError && emailError.code !== 'PGRST116') throw emailError

      // 3. Si trouvé avec user_id NULL, faire la liaison automatique
      if (emailFound) {
        if (import.meta.env.DEV) debug.log('Liaison du profil établissement avec le compte auth...')

        const { data: updated, error: updateError } = await supabase
          .from('etablissement_users')
          .update({
            user_id: user.id,
            compte_verrouille: false,
          })
          .eq('id', emailFound.id)
          .select()
          // safe: guaranteed-row
          .single()

        if (updateError) {
          debug.error('Erreur lors de la liaison du profil:', updateError)
          return emailFound as EtablissementUser
        }

        return updated as EtablissementUser
      }

      return null
    },
    enabled: !!user,
  })

  return {
    etablissementUser,
    isLoading,
    isEtablissementUser: !!etablissementUser,
  }
}

export function useEtablissementUserById(userId: string) {
  return useQuery({
    queryKey: ['etablissement-user', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('etablissement_users')
        .select('*, etablissements(nom, ville)')
        .eq('id', userId)
        .maybeSingle()

      if (error) throw error
      if (!data) throw new Error('Utilisateur établissement introuvable')
      return data
    },
    enabled: !!userId,
  })
}
