import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/hooks/shared/useAuth'
import type { Whiteboard } from './useWhiteboards'
import { MARQUE } from '@/config/branding'

/** Équipes disposant d'un tableau dédié. */
export const TEAM_KEYS = [
  'commercial',
  'chef_projet',
  'csm',
  'rh',
  'marketing',
  'direction',
] as const
export type TeamKey = (typeof TEAM_KEYS)[number]

export const TEAM_LABELS: Record<TeamKey, string> = {
  commercial: 'Commercial',
  chef_projet: 'Technique',
  csm: 'CSM',
  rh: 'RH',
  marketing: 'Marketing',
  direction: 'Direction',
}

const PERSONAL_TITLE = 'Mon tableau'
const COMPANY_TITLE = `Tableau ${MARQUE.nomCourt}`

/**
 * Récupère (ou crée à la volée) le tableau unique correspondant au périmètre.
 * personal : privé au propriétaire · team : réservé à l'équipe · company : commun à tous.
 */
async function getOrCreateBoard(params: {
  scope: 'personal' | 'team' | 'company'
  teamRole: string | null
  title: string
  ownerId: string
}): Promise<Whiteboard | null> {
  const { scope, teamRole, title, ownerId } = params
  let query = supabase
    .from('whiteboards' as any)
    .select('*')
    .eq('scope', scope)
    .eq('kind', 'board')
    .order('created_at', { ascending: true })
    .limit(1)

  if (scope === 'personal') query = query.eq('owner_id', ownerId)
  if (scope === 'team') query = query.eq('team_role', teamRole ?? '')

  const { data, error } = await query
  if (error) throw error
  if (data && data.length > 0) return data[0] as unknown as Whiteboard

  const { data: created, error: insErr } = await supabase
    .from('whiteboards' as any)
    .insert({
      owner_id: ownerId,
      title,
      scope,
      kind: 'board',
      team_role: scope === 'team' ? teamRole : null,
      is_shared: scope !== 'personal',
    })
    .select()
    .single()
  if (insErr) throw insErr
  return created as unknown as Whiteboard
}

/** Tableau personnel (unique, auto-créé). */
export function useMyWhiteboard() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['whiteboard-simple', 'personal', user?.id],
    enabled: !!user?.id,
    staleTime: 30_000,
    queryFn: () =>
      getOrCreateBoard({
        scope: 'personal',
        teamRole: null,
        title: PERSONAL_TITLE,
        ownerId: user!.id,
      }),
  })
}

/** Tableau d'équipe (un par équipe, visible des seuls membres). */
export function useTeamWhiteboard(team: TeamKey | null) {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['whiteboard-simple', 'team', team],
    enabled: !!user?.id && !!team,
    staleTime: 30_000,
    queryFn: () =>
      getOrCreateBoard({
        scope: 'team',
        teamRole: team,
        title: `Tableau ${TEAM_LABELS[team as TeamKey]}`,
        ownerId: user!.id,
      }),
  })
}

/** Tableau d'entreprise : commun à tous les utilisateurs de l'instance. */
export function useCompanyWhiteboard() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['whiteboard-simple', 'company'],
    enabled: !!user?.id,
    staleTime: 30_000,
    queryFn: () =>
      getOrCreateBoard({
        scope: 'company',
        teamRole: null,
        title: COMPANY_TITLE,
        ownerId: user!.id,
      }),
  })
}

/** Ancien alias conservé pour compatibilité : le tableau partagé = tableau d'entreprise. */
export const useSharedWhiteboard = useCompanyWhiteboard

export function useResetWhiteboard() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('whiteboards' as any)
        .update({ scene: {} })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['whiteboard-simple'] }),
  })
}
