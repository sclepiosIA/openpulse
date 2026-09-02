import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/hooks/shared/useAuth'
import { fromExtended } from '@/lib/supabaseTyped'
import { toast } from 'sonner'
import { useCallback, useRef } from 'react'
import { debug } from '@/lib/debug'
import type { DashboardNoteRow } from '@/types/supabase-extensions'

export type DashboardNote = DashboardNoteRow

const notesKeys = {
  all: ['dashboard-notes'] as const,
  list: () => [...notesKeys.all, 'list'] as const,
}

// Hook: Liste des notes de l'utilisateur
export function useDashboardNotes() {
  const { user } = useAuth()

  return useQuery({
    queryKey: notesKeys.list(),
    queryFn: async (): Promise<DashboardNote[]> => {
      if (!user?.id) return []

      const { data, error } = await fromExtended('dashboard_notes')
        .select(
          'id, user_id, tab_name, content, tab_order, created_at, updated_at, drawings, color'
        )
        .eq('user_id', user.id)
        .order('tab_order', { ascending: true })

      if (error) {
        debug.error('Error fetching notes:', error)
        return []
      }

      return (data || []) as unknown as DashboardNote[]
    },
    enabled: !!user?.id,
    staleTime: 30 * 1000, // 30 seconds
  })
}

// Hook: Créer une nouvelle note
export function useCreateNote() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (tabName: string = 'Nouvelle note') => {
      if (!user?.id) throw new Error('User not authenticated')

      // Get max order
      const { data: existing } = await fromExtended('dashboard_notes')
        .select('tab_order')
        .eq('user_id', user.id)
        .order('tab_order', { ascending: false })
        .limit(1)

      const existingData = existing as unknown as { tab_order: number }[] | null
      const nextOrder = (existingData?.[0]?.tab_order ?? -1) + 1

      const { data, error } = await fromExtended('dashboard_notes')
        .insert({
          user_id: user.id,
          tab_name: tabName,
          content: '',
          tab_order: nextOrder,
        })
        .select()
        // safe: guaranteed-row
        .single() // safe: guaranteed-row

      if (error) throw error
      return data as unknown as DashboardNote
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notesKeys.all })
    },
    onError: (error: Error) => {
      debug.error('Error creating note:', error)
      toast.error('Erreur lors de la création de la note')
    },
  })
}

// Hook: Mettre à jour une note (debounced)
export function useUpdateNote() {
  const queryClient = useQueryClient()
  const debounceRef = useRef<NodeJS.Timeout | null>(null)

  const mutate = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<DashboardNote> & { id: string }) => {
      const { data, error } = await fromExtended('dashboard_notes')
        .update(updates)
        .eq('id', id)
        .select()
        // safe: guaranteed-row
        .single() // safe: guaranteed-row

      if (error) throw error
      return data as unknown as DashboardNote
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notesKeys.all })
    },
    onError: (error: Error) => {
      debug.error('Error updating note:', error)
    },
  })

  // Debounced update for content changes
  const debouncedUpdate = useCallback(
    (params: Partial<DashboardNote> & { id: string }) => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
      debounceRef.current = setTimeout(() => {
        mutate.mutate(params)
      }, 500)
    },
    [mutate]
  )

  return {
    ...mutate,
    debouncedUpdate,
  }
}

// Hook: Supprimer une note
export function useDeleteNote() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await fromExtended('dashboard_notes').delete().eq('id', id)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notesKeys.all })
      toast.success('Note supprimée')
    },
    onError: (error: Error) => {
      debug.error('Error deleting note:', error)
      toast.error('Erreur lors de la suppression')
    },
  })
}

// Hook: Réorganiser les notes
export function useReorderNotes() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (orderedIds: string[]) => {
      if (!user?.id) throw new Error('User not authenticated')

      // Update each note's order
      const updates = orderedIds.map((id, index) =>
        fromExtended('dashboard_notes').update({ tab_order: index }).eq('id', id)
      )

      await Promise.all(updates)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notesKeys.all })
    },
    onError: (error: Error) => {
      debug.error('Error reordering notes:', error)
      toast.error('Erreur lors de la réorganisation')
    },
  })
}
