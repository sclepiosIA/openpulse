import { useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/hooks/shared/useAuth'

export interface WhiteboardCommentReply {
  id: string
  comment_id: string
  author_id: string
  content: string
  created_at: string
  author_name?: string
}

export interface WhiteboardComment {
  id: string
  whiteboard_id: string
  author_id: string
  content: string
  x: number
  y: number
  element_id: string | null
  mentions: string[]
  resolved_at: string | null
  resolved_by: string | null
  created_at: string
  author_name?: string
  replies: WhiteboardCommentReply[]
}

const MAX_COMMENTS = 300

function nameOf(p: any) {
  return `${p?.prenom ?? ''} ${p?.nom ?? ''}`.trim() || 'Utilisateur'
}

export function useWhiteboardComments(whiteboardId: string | null) {
  const qc = useQueryClient()

  const query = useQuery({
    queryKey: ['whiteboard-comments', whiteboardId],
    enabled: !!whiteboardId,
    staleTime: 15_000,
    queryFn: async (): Promise<WhiteboardComment[]> => {
      const { data, error } = await supabase
        .from('whiteboard_comments' as any)
        .select('*')
        .eq('whiteboard_id', whiteboardId as string)
        .order('created_at', { ascending: false })
        .limit(MAX_COMMENTS)
      if (error) throw error
      const comments = (data ?? []) as unknown as WhiteboardComment[]
      if (comments.length === 0) return []

      const ids = comments.map((c) => c.id)
      const [{ data: replies }, { data: profiles }] = await Promise.all([
        supabase
          .from('whiteboard_comment_replies' as any)
          .select('*')
          .in('comment_id', ids)
          .order('created_at', { ascending: true }),
        supabase
          .from('profiles')
          .select('user_id, prenom, nom')
          .in('user_id', Array.from(new Set(comments.map((c) => c.author_id)))),
      ])

      const nameById = new Map((profiles ?? []).map((p: any) => [p.user_id, nameOf(p)]))
      const repliesByComment = new Map<string, WhiteboardCommentReply[]>()
      ;((replies ?? []) as any[]).forEach((r) => {
        const list = repliesByComment.get(r.comment_id) ?? []
        list.push({ ...r, author_name: nameById.get(r.author_id) })
        repliesByComment.set(r.comment_id, list)
      })

      return comments.map((c) => ({
        ...c,
        author_name: nameById.get(c.author_id) ?? 'Utilisateur',
        replies: repliesByComment.get(c.id) ?? [],
      }))
    },
  })

  useEffect(() => {
    if (!whiteboardId) return
    const channel = supabase
      .channel(`wb-comments:${whiteboardId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'whiteboard_comments',
          filter: `whiteboard_id=eq.${whiteboardId}`,
        },
        () => qc.invalidateQueries({ queryKey: ['whiteboard-comments', whiteboardId] })
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [whiteboardId, qc])

  return query
}

export function useCreateComment() {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (params: {
      whiteboardId: string
      content: string
      x: number
      y: number
      elementId?: string | null
      mentions?: string[]
    }) => {
      if (!user?.id) throw new Error('Non authentifié')
      const { error } = await supabase.from('whiteboard_comments' as any).insert({
        whiteboard_id: params.whiteboardId,
        author_id: user.id,
        content: params.content.trim(),
        x: params.x,
        y: params.y,
        element_id: params.elementId ?? null,
        mentions: params.mentions ?? [],
      })
      if (error) throw error

      // Notifications internes pour les personnes mentionnées.
      const mentions = params.mentions ?? []
      if (mentions.length) {
        await supabase.from('in_app_notifications').insert(
          mentions.map((uid) => ({
            user_id: uid,
            title: 'Mention sur un tableau blanc',
            message: params.content.trim().slice(0, 180),
            type: 'info',
            related_type: 'whiteboard',
            related_id: params.whiteboardId,
          })) as any
        )
      }
    },
    onSuccess: (_d, v) =>
      qc.invalidateQueries({ queryKey: ['whiteboard-comments', v.whiteboardId] }),
  })
}

export function useReplyComment() {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (params: { whiteboardId: string; commentId: string; content: string }) => {
      if (!user?.id) throw new Error('Non authentifié')
      const { error } = await supabase.from('whiteboard_comment_replies' as any).insert({
        comment_id: params.commentId,
        author_id: user.id,
        content: params.content.trim(),
      })
      if (error) throw error
    },
    onSuccess: (_d, v) =>
      qc.invalidateQueries({ queryKey: ['whiteboard-comments', v.whiteboardId] }),
  })
}

export function useResolveComment() {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (params: { whiteboardId: string; commentId: string; resolved: boolean }) => {
      const { error } = await supabase
        .from('whiteboard_comments' as any)
        .update({
          resolved_at: params.resolved ? new Date().toISOString() : null,
          resolved_by: params.resolved ? (user?.id ?? null) : null,
        })
        .eq('id', params.commentId)
      if (error) throw error
    },
    onSuccess: (_d, v) =>
      qc.invalidateQueries({ queryKey: ['whiteboard-comments', v.whiteboardId] }),
  })
}

export function useDeleteComment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (params: { whiteboardId: string; commentId: string }) => {
      const { error } = await supabase
        .from('whiteboard_comments' as any)
        .delete()
        .eq('id', params.commentId)
      if (error) throw error
    },
    onSuccess: (_d, v) =>
      qc.invalidateQueries({ queryKey: ['whiteboard-comments', v.whiteboardId] }),
  })
}
