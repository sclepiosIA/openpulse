import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabaseBrowser'
import { toast } from 'sonner'
import { sanitizeSupabaseError } from '@/lib/supabaseErrorSanitizer'
import { debug } from '@/lib/debug'
import {
  ForumPost,
  ForumPostFilters,
  ForumPostWithAuthor,
  VoteResult,
  MutationContext,
} from '@/types/forum'
import { Database } from '@/integrations/supabase/types'

type ForumPostInsert = Database['public']['Tables']['forum_posts']['Insert']

export function useForumPosts(filters?: ForumPostFilters) {
  return useQuery({
    queryKey: ['forum-posts', filters],
    queryFn: async () => {
      let query = supabase
        .from('forum_posts')
        .select(
          'id, titre, contenu, theme, visibilite, upvotes, nombre_commentaires, nombre_vues, resolu, epingle, archive, modere, author_nom, author_prenom, author_role, author_service, author_etablissement_nom, user_id, etablissement_id, tags, created_at, updated_at'
        )
        .eq('archive', false)
        .eq('modere', false) // Ne pas afficher les posts modérés aux utilisateurs normaux

      if (filters?.theme) {
        query = query.eq('theme', filters.theme)
      }

      if (filters?.visibilite) {
        query = query.eq('visibilite', filters.visibilite)
      }

      // Gestion du tri
      switch (filters?.sortBy) {
        case 'popular':
          query = query.order('upvotes', { ascending: false })
          break
        case 'mostCommented':
          query = query.order('nombre_commentaires', { ascending: false })
          break
        case 'unresolved':
          query = query.eq('resolu', false).order('created_at', { ascending: false })
          break
        case 'recent':
        default:
          query = query
            .order('epingle', { ascending: false })
            .order('created_at', { ascending: false })
          break
      }

      const { data, error } = await query.limit(500)
      if (error) throw error
      return data
    },
  })
}

export function useForumPost(postId: string) {
  return useQuery({
    queryKey: ['forum-post', postId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('forum_posts')
        .select('*, etablissement_users(nom, prenom, fonction)')
        .eq('id', postId)
        .maybeSingle()

      if (error) throw error
      return data
    },
    enabled: !!postId,
  })
}

export function useCreateForumPost() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (post: Partial<ForumPost>) => {
      // Convertir tous les undefined en null pour Supabase
      const cleanPost = Object.fromEntries(
        Object.entries(post).map(([key, value]) => [key, value === undefined ? null : value])
      )

      // S'assurer que toutes les propriétés nécessaires sont présentes
      const postData = {
        ...cleanPost,
        upvotes: cleanPost.upvotes ?? 0,
        nombre_commentaires: cleanPost.nombre_commentaires ?? 0,
        nombre_vues: cleanPost.nombre_vues ?? 0,
        resolu: cleanPost.resolu ?? false,
        epingle: cleanPost.epingle ?? false,
        archive: cleanPost.archive ?? false,
        modere: cleanPost.modere ?? false,
      }

      const { data, error } = await supabase
        .from('forum_posts')
        .insert([postData as ForumPostInsert])
        .select()
        // safe: guaranteed-row
        .single() // safe: guaranteed-row

      if (error) {
        debug.error('Error creating forum post:', error)
        throw error
      }
      return data
    },
    onSuccess: () => {
      toast.success('Post créé avec succès')
      queryClient.invalidateQueries({ queryKey: ['forum-posts'] })
    },
    onError: (error: Error) => {
      debug.error('Error in useCreateForumPost:', error)
      toast.error(sanitizeSupabaseError(error))
    },
  })
}

export function useUpdateForumPost() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ postId, updates }: { postId: string; updates: Partial<ForumPost> }) => {
      const cleanUpdates = Object.fromEntries(
        Object.entries(updates).map(([key, value]) => [key, value === undefined ? null : value])
      )

      const { data, error } = await supabase
        .from('forum_posts')
        .update({
          ...cleanUpdates,
          updated_at: new Date().toISOString(),
        })
        .eq('id', postId)
        .select()
        // safe: guaranteed-row
        .single() // safe: guaranteed-row

      if (error) throw error
      return data
    },
    onSuccess: () => {
      toast.success('Post modifié avec succès')
      queryClient.invalidateQueries({ queryKey: ['forum-posts'] })
      queryClient.invalidateQueries({ queryKey: ['forum-post'] })
    },
    onError: (error: Error) => {
      toast.error(sanitizeSupabaseError(error))
    },
  })
}

export function useDeleteOwnPost() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  return useMutation({
    mutationFn: async ({
      postId,
      isTeamMember,
      context = 'internal',
    }: {
      postId: string
      isTeamMember: boolean
      context?: 'public' | 'internal'
    }) => {
      const { error } = await supabase.from('forum_posts').delete().eq('id', postId)

      if (error) throw error

      return { isTeamMember, context }
    },
    onSuccess: (result) => {
      toast.success('Post supprimé')
      queryClient.invalidateQueries({ queryKey: ['forum-posts'] })
      queryClient.invalidateQueries({ queryKey: ['forum-post'] })

      // Rediriger selon le contexte
      if (result.context === 'public') {
        navigate('/formation#forum')
      } else if (result.isTeamMember) {
        navigate('/forum-moderation')
      }
    },
    onError: (error: Error) => {
      toast.error(sanitizeSupabaseError(error))
    },
  })
}

export function useToggleResolved() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ postId, resolu }: { postId: string; resolu: boolean }) => {
      const { error } = await supabase.from('forum_posts').update({ resolu }).eq('id', postId)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['forum-posts'] })
      queryClient.invalidateQueries({ queryKey: ['forum-post'] })
    },
    onError: (error: Error) => {
      toast.error(sanitizeSupabaseError(error))
    },
  })
}

export function useVotePost() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ postId }: { postId: string }) => {
      // Vérifier localStorage pour éviter double vote
      const votedPosts = JSON.parse(localStorage.getItem('voted_posts') || '[]')
      if (votedPosts.includes(postId)) {
        throw new Error('Vous avez déjà voté pour ce post')
      }

      // Vérifier d'abord si un vote existe déjà
      const { data: existingVote } = await supabase
        .from('forum_votes')
        .select('id')
        .eq('post_id', postId)
        .is('user_id', null)
        .maybeSingle()

      if (existingVote) {
        // Supprimer le vote
        const { error } = await supabase.from('forum_votes').delete().eq('id', existingVote.id)

        if (error) throw error

        // Retirer du localStorage
        const updatedVotes = votedPosts.filter((id: string) => id !== postId)
        localStorage.setItem('voted_posts', JSON.stringify(updatedVotes))

        return { action: 'removed' as const, postId }
      } else {
        // Ajouter le vote
        const { error } = await supabase
          .from('forum_votes')
          .insert({ post_id: postId, user_id: null })

        if (error) throw error

        // Sauvegarder dans localStorage
        localStorage.setItem('voted_posts', JSON.stringify([...votedPosts, postId]))

        return { action: 'added' as const, postId }
      }
    },
    onMutate: async ({ postId }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['forum-posts'] })
      await queryClient.cancelQueries({ queryKey: ['forum-post', postId] })

      // Snapshot previous value
      const previousPosts = queryClient.getQueryData<ForumPost[]>(['forum-posts'])
      const previousPost = queryClient.getQueryData<ForumPostWithAuthor>(['forum-post', postId])

      // Optimistically update
      queryClient.setQueryData(['forum-posts'], (old: ForumPost[] | undefined) => {
        if (!old) return old
        return old.map((post: ForumPost) => {
          if (post.id === postId) {
            const votedPosts = JSON.parse(localStorage.getItem('voted_posts') || '[]')
            const hasVoted = votedPosts.includes(postId)
            return {
              ...post,
              upvotes: hasVoted ? (post.upvotes || 0) - 1 : (post.upvotes || 0) + 1,
            }
          }
          return post
        })
      })

      return { previousPosts, previousPost }
    },
    onError: (err: Error, variables: { postId: string }, context: MutationContext | undefined) => {
      if (context?.previousPosts) {
        queryClient.setQueryData(['forum-posts'], context.previousPosts)
      }
      if (context?.previousPost) {
        queryClient.setQueryData(['forum-post', variables.postId], context.previousPost)
      }
      if (err.message === 'Vous avez déjà voté pour ce post') {
        toast.error(err.message)
      } else {
        toast.error('Erreur lors du vote')
      }
    },
    onSuccess: (data: VoteResult) => {
      if (data.action === 'added') {
        toast.success('👍 Vote enregistré')
      } else {
        toast.success('Vote retiré')
      }
    },
    onSettled: (_: VoteResult | undefined, __: Error | null, variables: { postId: string }) => {
      queryClient.invalidateQueries({ queryKey: ['forum-posts'] })
      queryClient.invalidateQueries({ queryKey: ['forum-post', variables.postId] })
    },
  })
}
