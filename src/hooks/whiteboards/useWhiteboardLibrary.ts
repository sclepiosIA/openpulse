import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/hooks/shared/useAuth'
import type { TeamKey } from './useSimpleWhiteboards'

export interface LibraryItem {
  id: string
  user_id: string
  name: string
  category: string
  source: string
  scope: 'personal' | 'team' | 'company'
  team_role: string | null
  elements: unknown[]
  files: Record<string, unknown>
  preview_data: string | null
  created_at: string
}

const MAX_ITEMS = 200

export function useWhiteboardLibrary() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['whiteboard-library', user?.id],
    enabled: !!user?.id,
    staleTime: 60_000,
    queryFn: async (): Promise<LibraryItem[]> => {
      const { data, error } = await supabase
        .from('whiteboard_library_items' as any)
        .select('*')
        .order('created_at', { ascending: false })
        .limit(MAX_ITEMS)
      if (error) throw error
      return (data ?? []) as unknown as LibraryItem[]
    },
  })
}

export function useSaveLibraryItem() {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (params: {
      name: string
      elements: unknown[]
      files?: Record<string, unknown>
      previewData?: string | null
      scope: 'personal' | 'team' | 'company'
      team?: TeamKey | null
    }) => {
      if (!user?.id) throw new Error('Non authentifié')
      if (!params.elements.length) throw new Error('Sélection vide')
      const { error } = await supabase.from('whiteboard_library_items' as any).insert({
        user_id: user.id,
        name: params.name.trim() || 'Bloc sans nom',
        category: 'perso',
        source: 'user',
        scope: params.scope,
        team_role: params.scope === 'team' ? (params.team ?? null) : null,
        elements: params.elements,
        files: params.files ?? {},
        preview_data: params.previewData ?? null,
      })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['whiteboard-library'] }),
  })
}

export function useDeleteLibraryItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('whiteboard_library_items' as any)
        .delete()
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['whiteboard-library'] }),
  })
}
