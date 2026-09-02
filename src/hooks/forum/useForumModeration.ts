import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseBrowser'
import { toast } from 'sonner'
import { sanitizeSupabaseError } from '@/lib/supabaseErrorSanitizer'
import { debug } from '@/lib/debug'
import { useAuth } from '@/components/AuthProvider'

// Vérifier si l'utilisateur est modérateur
export function useIsForumModerator() {
  return useQuery({
    queryKey: ['is-forum-moderator'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('is_forum_moderator')
      if (error) {
        debug.error('Error checking moderator status:', error)
        return false
      }
      return data as boolean
    },
  })
}

// Récupérer tous les posts pour modération
export function useForumPostsForModeration() {
  return useQuery({
    queryKey: ['forum-posts-moderation'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('forum_posts')
        .select(
          'id, user_id, titre, contenu, theme, tags, visibilite, epingle, modere, modere_at, modere_par, raison_moderation, archive, nombre_commentaires, nombre_vues, upvotes, resolu, author_nom, author_prenom, author_role, author_service, author_etablissement_nom, etablissement_id, created_at, updated_at'
        )
        .order('created_at', { ascending: false })
        .limit(500)

      if (error) throw error
      return data
    },
  })
}

// Marquer un post comme modéré (masquer)
export function useMaskForumPost() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ postId, reason }: { postId: string; reason?: string }) => {
      if (!user) throw new Error('Non authentifié')

      // Récupérer le profile.id de l'utilisateur pour respecter la FK
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle()

      if (!profile) throw new Error('Profile non trouvé')

      const { data, error } = await supabase
        .from('forum_posts')
        .update({
          modere: true,
          modere_at: new Date().toISOString(),
          modere_par: profile.id,
          raison_moderation: reason,
        })
        .eq('id', postId)
        .select()
        // safe: guaranteed-row
        .single() // safe: guaranteed-row

      if (error) throw error
      return data
    },
    onSuccess: () => {
      toast.success('Post masqué avec succès')
      queryClient.invalidateQueries({ queryKey: ['forum-posts'] })
      queryClient.invalidateQueries({ queryKey: ['forum-posts-moderation'] })
    },
    onError: (error: Error) => {
      toast.error(sanitizeSupabaseError(error))
    },
  })
}

// Supprimer définitivement un post
export function useDeleteForumPost() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (postId: string) => {
      const { error } = await supabase.from('forum_posts').delete().eq('id', postId)

      if (error) throw error
    },
    onSuccess: () => {
      toast.success('Post supprimé définitivement')
      queryClient.invalidateQueries({ queryKey: ['forum-posts'] })
      queryClient.invalidateQueries({ queryKey: ['forum-posts-moderation'] })
    },
    onError: (error: Error) => {
      toast.error(sanitizeSupabaseError(error))
    },
  })
}

// Approuver un post (retirer la modération)
export function useApproveForumPost() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (postId: string) => {
      const { data, error } = await supabase
        .from('forum_posts')
        .update({
          modere: false,
          modere_at: null,
          modere_par: null,
          raison_moderation: null,
        })
        .eq('id', postId)
        .select()
        // safe: guaranteed-row
        .single() // safe: guaranteed-row

      if (error) throw error
      return data
    },
    onSuccess: () => {
      toast.success('Post approuvé avec succès')
      queryClient.invalidateQueries({ queryKey: ['forum-posts'] })
      queryClient.invalidateQueries({ queryKey: ['forum-posts-moderation'] })
    },
    onError: (error: Error) => {
      toast.error(sanitizeSupabaseError(error))
    },
  })
}

// Archiver un post
export function useArchiveForumPost() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (postId: string) => {
      const { data, error } = await supabase
        .from('forum_posts')
        .update({ archive: true })
        .eq('id', postId)
        .select()
        // safe: guaranteed-row
        .single() // safe: guaranteed-row

      if (error) throw error
      return data
    },
    onSuccess: () => {
      toast.success('Post archivé avec succès')
      queryClient.invalidateQueries({ queryKey: ['forum-posts'] })
      queryClient.invalidateQueries({ queryKey: ['forum-posts-moderation'] })
    },
    onError: (error: Error) => {
      toast.error(sanitizeSupabaseError(error))
    },
  })
}
