import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/hooks/shared/useAuth'

export interface WhiteboardVersion {
  id: string
  whiteboard_id: string
  scene: {
    elements?: unknown[]
    appState?: Record<string, unknown>
    files?: Record<string, unknown>
  }
  element_count: number
  reason: string
  created_by: string | null
  created_at: string
  author_name?: string | null
}

export const VERSION_REASON_LABELS: Record<string, string> = {
  auto: 'Sauvegarde automatique',
  manual: 'Point de restauration manuel',
  clear: 'Avant vidage du tableau',
  import: 'Avant import',
  restore: 'Avant restauration',
}

const MAX_VERSIONS = 30

export function useWhiteboardVersions(whiteboardId: string | null, enabled = true) {
  return useQuery({
    queryKey: ['whiteboard-versions', whiteboardId],
    enabled: !!whiteboardId && enabled,
    staleTime: 10_000,
    queryFn: async (): Promise<WhiteboardVersion[]> => {
      const { data, error } = await supabase
        .from('whiteboard_versions' as any)
        .select('id, whiteboard_id, element_count, reason, created_by, created_at')
        .eq('whiteboard_id', whiteboardId as string)
        .order('created_at', { ascending: false })
        .limit(MAX_VERSIONS)
      if (error) throw error
      const rows = (data ?? []) as unknown as WhiteboardVersion[]

      const authorIds = Array.from(
        new Set(rows.map((r) => r.created_by).filter(Boolean))
      ) as string[]
      if (authorIds.length === 0) return rows

      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, prenom, nom')
        .in('user_id', authorIds)
      const byId = new Map(
        (profiles ?? []).map((p: any) => [p.user_id, `${p.prenom ?? ''} ${p.nom ?? ''}`.trim()])
      )
      return rows.map((r) => ({
        ...r,
        author_name: r.created_by ? (byId.get(r.created_by) ?? null) : null,
      }))
    },
  })
}

/** Récupère la scène complète d'une version (chargée à la demande, elle peut être lourde). */
export async function fetchVersionScene(versionId: string) {
  const { data, error } = await supabase
    .from('whiteboard_versions' as any)
    .select('scene')
    .eq('id', versionId)
    .maybeSingle()
  if (error) throw error
  return ((data as any)?.scene ?? { elements: [] }) as WhiteboardVersion['scene']
}

export function useCreateVersion() {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (params: {
      whiteboardId: string
      scene: Record<string, unknown>
      reason?: keyof typeof VERSION_REASON_LABELS | string
    }) => {
      if (!user?.id) throw new Error('Non authentifié')
      const elements = (params.scene?.elements as unknown[] | undefined) ?? []
      const { error } = await supabase.from('whiteboard_versions' as any).insert({
        whiteboard_id: params.whiteboardId,
        scene: params.scene,
        element_count: elements.length,
        reason: params.reason ?? 'auto',
        created_by: user.id,
      })
      if (error) throw error
    },
    onSuccess: (_d, vars) =>
      qc.invalidateQueries({ queryKey: ['whiteboard-versions', vars.whiteboardId] }),
  })
}

export function useDeleteVersion() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (params: { id: string; whiteboardId: string }) => {
      const { error } = await supabase
        .from('whiteboard_versions' as any)
        .delete()
        .eq('id', params.id)
      if (error) throw error
    },
    onSuccess: (_d, vars) =>
      qc.invalidateQueries({ queryKey: ['whiteboard-versions', vars.whiteboardId] }),
  })
}
