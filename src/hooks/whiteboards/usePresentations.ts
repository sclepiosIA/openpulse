import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/hooks/shared/useAuth'

export interface Slide {
  id: string
  title: string
  elements: unknown[]
  files?: Record<string, unknown>
  background?: string
}

export interface Presentation {
  id: string
  owner_id: string
  title: string
  scope: 'personal' | 'team' | 'company'
  team_role: string | null
  scene: { slides?: Slide[] }
  updated_at: string
  created_at: string
}

export function newSlide(index: number): Slide {
  return {
    id: `slide_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    title: `Diapositive ${index + 1}`,
    elements: [],
    files: {},
    background: '#ffffff',
  }
}

/** Toutes les présentations visibles par l'utilisateur (RLS : perso + équipe + entreprise). */
export function usePresentations() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['presentations', user?.id],
    enabled: !!user?.id,
    staleTime: 20_000,
    queryFn: async (): Promise<Presentation[]> => {
      const { data, error } = await supabase
        .from('whiteboards' as any)
        .select('*')
        .eq('kind', 'presentation')
        .order('updated_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as unknown as Presentation[]
    },
  })
}

export function useCreatePresentation() {
  const qc = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: async (params: {
      title: string
      scope: 'personal' | 'company' | 'team'
      teamRole?: string | null
    }) => {
      if (!user?.id) throw new Error('Non authentifié')
      const { data, error } = await supabase
        .from('whiteboards' as any)
        .insert({
          owner_id: user.id,
          title: params.title || 'Nouvelle présentation',
          kind: 'presentation',
          scope: params.scope,
          team_role: params.scope === 'team' ? (params.teamRole ?? null) : null,
          is_shared: params.scope !== 'personal',
          scene: { slides: [newSlide(0)] },
        })
        .select()
        .single()
      if (error) throw error
      return data as unknown as Presentation
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['presentations'] }),
  })
}

export function useUpdatePresentation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: {
      id: string
      patch: Partial<Pick<Presentation, 'title' | 'scene' | 'scope' | 'team_role'>>
    }) => {
      const { error } = await supabase
        .from('whiteboards' as any)
        .update(payload.patch)
        .eq('id', payload.id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['presentations'] }),
  })
}

export function useDeletePresentation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('whiteboards' as any)
        .delete()
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['presentations'] }),
  })
}
