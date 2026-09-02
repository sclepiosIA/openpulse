import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/hooks/shared/useAuth'
import type { Whiteboard } from './useWhiteboards'
import { TEAM_LABELS, type TeamKey } from './useSimpleWhiteboards'
import { MARQUE } from '@/config/branding'

export type BoardScope = 'personal' | 'team' | 'company'

export interface BoardSummary extends Whiteboard {
  scope: BoardScope
  team_role: string | null
  kind: string
  archived_at: string | null
  is_pinned: boolean
  updated_by: string | null
}

const MAX_BOARDS = 200

function defaultTitle(scope: BoardScope, team: TeamKey | null): string {
  if (scope === 'personal') return 'Mon tableau'
  if (scope === 'company') return `Tableau ${MARQUE.nomCourt}`
  return `Tableau ${team ? TEAM_LABELS[team] : 'équipe'}`
}

export function boardListKey(scope: BoardScope, team: TeamKey | null, userId?: string) {
  return [
    'whiteboard-list',
    scope,
    team ?? null,
    scope === 'personal' ? (userId ?? null) : null,
  ] as const
}

/**
 * Liste des tableaux d'un périmètre (personnel / équipe / entreprise).
 * Crée automatiquement le tableau par défaut si le périmètre est vide,
 * de façon à conserver le comportement historique (un tableau toujours prêt).
 */
export function useWhiteboardList(
  scope: BoardScope,
  team: TeamKey | null,
  includeArchived = false
) {
  const { user } = useAuth()
  const enabled = !!user?.id && (scope !== 'team' || !!team)

  return useQuery({
    queryKey: [...boardListKey(scope, team, user?.id), includeArchived],
    enabled,
    staleTime: 30_000,
    queryFn: async (): Promise<BoardSummary[]> => {
      if (!user?.id) return []
      let query = supabase
        .from('whiteboards' as any)
        .select('*')
        .eq('scope', scope)
        .eq('kind', 'board')
        .order('is_pinned', { ascending: false })
        .order('updated_at', { ascending: false })
        .limit(MAX_BOARDS)

      if (scope === 'personal') query = query.eq('owner_id', user.id)
      if (scope === 'team') query = query.eq('team_role', team ?? '')
      if (!includeArchived) query = query.is('archived_at', null)

      const { data, error } = await query
      if (error) throw error

      const rows = (data ?? []) as unknown as BoardSummary[]
      if (rows.length > 0) return rows

      // Périmètre vide : on crée le tableau par défaut (comportement historique).
      const { data: created, error: insErr } = await supabase
        .from('whiteboards' as any)
        .insert({
          owner_id: user.id,
          title: defaultTitle(scope, team),
          scope,
          kind: 'board',
          team_role: scope === 'team' ? team : null,
          is_shared: scope !== 'personal',
          updated_by: user.id,
        })
        .select()
        .single()
      if (insErr) throw insErr
      return [created as unknown as BoardSummary]
    },
  })
}

function useInvalidateBoards() {
  const qc = useQueryClient()
  return () => {
    qc.invalidateQueries({ queryKey: ['whiteboard-list'] })
    qc.invalidateQueries({ queryKey: ['whiteboard-simple'] })
  }
}

export function useCreateBoard() {
  const { user } = useAuth()
  const invalidate = useInvalidateBoards()
  return useMutation({
    mutationFn: async (params: {
      scope: BoardScope
      team: TeamKey | null
      title: string
      scene?: Record<string, unknown>
    }): Promise<BoardSummary> => {
      if (!user?.id) throw new Error('Non authentifié')
      const { data, error } = await supabase
        .from('whiteboards' as any)
        .insert({
          owner_id: user.id,
          title: params.title.trim() || 'Nouveau tableau',
          scope: params.scope,
          kind: 'board',
          team_role: params.scope === 'team' ? params.team : null,
          is_shared: params.scope !== 'personal',
          scene: params.scene ?? { elements: [], appState: {}, files: {} },
          updated_by: user.id,
        })
        .select()
        .single()
      if (error) throw error
      return data as unknown as BoardSummary
    },
    onSuccess: invalidate,
  })
}

export function useUpdateBoardMeta() {
  const invalidate = useInvalidateBoards()
  return useMutation({
    mutationFn: async (params: {
      id: string
      patch: Partial<Pick<BoardSummary, 'title' | 'is_pinned' | 'archived_at'>>
    }) => {
      const { error } = await supabase
        .from('whiteboards' as any)
        .update(params.patch)
        .eq('id', params.id)
      if (error) throw error
    },
    onSuccess: invalidate,
  })
}

export function useDeleteBoard() {
  const invalidate = useInvalidateBoards()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('whiteboards' as any)
        .delete()
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: invalidate,
  })
}

export function useDuplicateBoard() {
  const { user } = useAuth()
  const invalidate = useInvalidateBoards()
  return useMutation({
    mutationFn: async (board: BoardSummary): Promise<BoardSummary> => {
      if (!user?.id) throw new Error('Non authentifié')
      const { data, error } = await supabase
        .from('whiteboards' as any)
        .insert({
          owner_id: user.id,
          title: `${board.title} (copie)`,
          scope: board.scope,
          kind: 'board',
          team_role: board.team_role,
          is_shared: board.is_shared,
          scene: board.scene ?? { elements: [], appState: {}, files: {} },
          updated_by: user.id,
        })
        .select()
        .single()
      if (error) throw error
      return data as unknown as BoardSummary
    },
    onSuccess: invalidate,
  })
}
