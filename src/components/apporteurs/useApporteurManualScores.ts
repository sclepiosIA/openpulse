import { useEffect } from 'react'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { useAuthSafe } from '@/components/AuthProvider'

export interface ManualScore {
  value: number
  comment: string
  updatedAt: string // ISO
}

export interface ManualScores {
  organisation: ManualScore
  relation: ManualScore
}

export const DEFAULT_MANUAL_SCORES: ManualScores = {
  organisation: { value: 70, comment: 'À renseigner', updatedAt: new Date().toISOString() },
  relation: { value: 70, comment: 'À renseigner', updatedAt: new Date().toISOString() },
}

const QUERY_KEY = (apporteurId: string) => ['apporteur-manual-scores', apporteurId]

function clampScore(score: number): number {
  return Math.max(0, Math.min(100, score))
}

function rowToScores(row: unknown): ManualScores {
  const r = row as {
    organisation_score?: number | null
    organisation_comment?: string | null
    relation_score?: number | null
    relation_comment?: string | null
    updated_at?: string | null
  }
  const updatedAt = r.updated_at ?? new Date().toISOString()
  return {
    organisation: {
      value: clampScore(r.organisation_score ?? DEFAULT_MANUAL_SCORES.organisation.value),
      comment: r.organisation_comment ?? DEFAULT_MANUAL_SCORES.organisation.comment,
      updatedAt,
    },
    relation: {
      value: clampScore(r.relation_score ?? DEFAULT_MANUAL_SCORES.relation.value),
      comment: r.relation_comment ?? DEFAULT_MANUAL_SCORES.relation.comment,
      updatedAt,
    },
  }
}

/**
 * Lit et met à jour les scores manuels Organisation/Relation d'un apporteur.
 * Les données sont persistées dans Supabase et partagées entre tous les utilisateurs authentifiés.
 */
export function useApporteurManualScores(apporteurId: string | undefined) {
  const queryClient = useQueryClient()
  const { user } = useAuthSafe()
  const enabled = Boolean(apporteurId)

  const query = useQuery({
    queryKey: QUERY_KEY(apporteurId ?? ''),
    enabled,
    queryFn: async (): Promise<ManualScores> => {
      const { data, error } = await supabase
        .from('apporteur_manual_scores' as never)
        .select(
          'organisation_score, organisation_comment, relation_score, relation_comment, updated_at'
        )
        .eq('apporteur_id', apporteurId!)
        .maybeSingle()
      if (error) throw error
      return rowToScores(data)
    },
  })

  // Realtime : rafraîchit le score dès qu'un autre utilisateur le modifie
  useEffect(() => {
    if (!apporteurId) return
    const channel = supabase
      .channel(`apporteur-manual-scores-${apporteurId}-${Math.random().toString(36).slice(2)}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'apporteur_manual_scores',
          filter: `apporteur_id=eq.${apporteurId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: QUERY_KEY(apporteurId) })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [apporteurId, queryClient])

  const updateScore = useMutation({
    mutationFn: async (payload: {
      key: 'organisation' | 'relation'
      value: number
      comment: string
    }) => {
      if (!apporteurId) throw new Error('apporteurId manquant')
      const current =
        queryClient.getQueryData<ManualScores>(QUERY_KEY(apporteurId)) ?? DEFAULT_MANUAL_SCORES
      const next: ManualScores = {
        organisation:
          payload.key === 'organisation'
            ? {
                value: clampScore(payload.value),
                comment: payload.comment,
                updatedAt: new Date().toISOString(),
              }
            : current.organisation,
        relation:
          payload.key === 'relation'
            ? {
                value: clampScore(payload.value),
                comment: payload.comment,
                updatedAt: new Date().toISOString(),
              }
            : current.relation,
      }

      const { error } = await supabase.from('apporteur_manual_scores' as never).upsert(
        {
          apporteur_id: apporteurId,
          organisation_score: next.organisation.value,
          organisation_comment: next.organisation.comment,
          relation_score: next.relation.value,
          relation_comment: next.relation.comment,
          created_by: user?.id ?? null,
        } as never,
        { onConflict: 'apporteur_id' }
      )
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY(apporteurId ?? '') })
    },
  })

  return {
    scores: query.data ?? DEFAULT_MANUAL_SCORES,
    isLoading: query.isLoading,
    updateScore,
  }
}
