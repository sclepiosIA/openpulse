import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { toast } from 'sonner'
import { sanitizeSupabaseError } from '@/lib/supabaseErrorSanitizer'
import { debug } from '@/lib/debug'
import { useAuth } from '@/components/AuthProvider'

export interface AuthorizedIP {
  id: string
  ip_address: string
  description: string
  created_at: string
  updated_at: string
  created_by: string
}

const QUERY_KEY = ['authorized-ips'] as const

// Hook pour récupérer les IP autorisées (admin seulement)
export function useAuthorizedIPs() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('authorized_ips')
        .select('id, ip_address, description, created_at, updated_at, created_by')
        .order('created_at', { ascending: false })
        .limit(500)

      if (error) {
        debug.error('Error fetching authorized IPs:', error)
        throw error
      }

      return data as AuthorizedIP[]
    },
  })
}

// Hook pour ajouter une IP autorisée
export function useAddAuthorizedIP() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: { ip_address: string; description?: string }) => {
      // Récupérer l'ID du profil de l'utilisateur actuel
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user?.id || '')
        .maybeSingle()

      const { data: result, error } = await supabase
        .from('authorized_ips')
        .insert({
          ip_address: data.ip_address,
          description: data.description || '',
          created_by: profile?.id,
        })
        .select()
        // safe: guaranteed-row
        .single()

      if (error) throw error
      return result
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY })
      toast.success('IP autorisée ajoutée avec succès')
    },
    onError: (error: Error) => {
      debug.error('Error adding authorized IP:', error)
      toast.error(sanitizeSupabaseError(error))
    },
  })
}

// Hook pour supprimer une IP autorisée
export function useDeleteAuthorizedIP() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('authorized_ips').delete().eq('id', id)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY })
      toast.success('IP autorisée supprimée avec succès')
    },
    onError: (error: Error) => {
      debug.error('Error deleting authorized IP:', error)
      toast.error(sanitizeSupabaseError(error))
    },
  })
}
