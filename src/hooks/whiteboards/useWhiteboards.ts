import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/hooks/shared/useAuth'

export interface Whiteboard {
  id: string
  owner_id: string
  title: string
  scene: {
    elements?: unknown[]
    appState?: Record<string, unknown>
    files?: Record<string, unknown>
  }
  is_shared: boolean
  created_at: string
  updated_at: string
}

export type WhiteboardScope = 'mine' | 'shared'

export function useWhiteboards(scope: WhiteboardScope) {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['whiteboards', scope, user?.id],
    enabled: !!user?.id,
    staleTime: 30_000,
    queryFn: async (): Promise<Whiteboard[]> => {
      if (!user?.id) return []
      if (scope === 'mine') {
        const { data, error } = await supabase
          .from('whiteboards' as any)
          .select('*')
          .eq('owner_id', user.id)
          .order('updated_at', { ascending: false })
        if (error) throw error
        return (data ?? []) as unknown as Whiteboard[]
      }
      // shared: is_shared=true OR I'm in whiteboard_shares
      const [pub, shares] = await Promise.all([
        supabase
          .from('whiteboards' as any)
          .select('*')
          .eq('is_shared', true)
          .neq('owner_id', user.id)
          .order('updated_at', { ascending: false }),
        supabase
          .from('whiteboard_shares' as any)
          .select('whiteboard_id')
          .eq('user_id', user.id),
      ])
      if (pub.error) throw pub.error
      if (shares.error) throw shares.error
      const sharedIds = (shares.data ?? []).map((s: any) => s.whiteboard_id)
      let extra: any[] = []
      if (sharedIds.length) {
        const { data, error } = await supabase
          .from('whiteboards' as any)
          .select('*')
          .in('id', sharedIds)
        if (error) throw error
        extra = data ?? []
      }
      const map = new Map<string, Whiteboard>()
      ;[...(pub.data ?? []), ...extra].forEach((w: any) => map.set(w.id, w))
      return Array.from(map.values()).sort(
        (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      )
    },
  })
}

export function useCreateWhiteboard() {
  const qc = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: async (title: string): Promise<Whiteboard> => {
      if (!user?.id) throw new Error('Not authenticated')
      const { data, error } = await supabase
        .from('whiteboards' as any)
        .insert({ owner_id: user.id, title })
        .select()
        .single()
      if (error) throw error
      return data as unknown as Whiteboard
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['whiteboards'] })
    },
  })
}

export function useUpdateWhiteboard() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: {
      id: string
      patch: Partial<Pick<Whiteboard, 'title' | 'scene' | 'is_shared'>>
    }) => {
      const { error } = await supabase
        .from('whiteboards' as any)
        .update(payload.patch)
        .eq('id', payload.id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['whiteboards'] })
    },
  })
}

export function useDeleteWhiteboard() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('whiteboards' as any)
        .delete()
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['whiteboards'] })
    },
  })
}
