import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { useCurrentProfile } from '@/hooks/profile/useProfiles'
import { toast } from 'sonner'
import { unifiedTodoKeys } from '@/hooks/tasks/useUnifiedTodos'
import { debug } from '@/lib/debug'

// Helper to get current user's profile ID
async function getCurrentProfileId(): Promise<string> {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session?.user) throw new Error('Not authenticated')

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('id')
    .eq('user_id', session.user.id)
    .maybeSingle()

  if (error || !profile) throw new Error('Profile not found')
  return profile.id
}
export interface PersonalTodo {
  id: string
  user_id: string
  project_id: string | null
  etablissement_id: string | null
  title: string
  description: string | null
  is_done: boolean
  done_at: string | null
  done_by: string | null
  priority: 'low' | 'medium' | 'high' | 'urgent'
  due_date: string | null
  due_time: string | null
  reminder_at: string | null
  position: number
  labels: string[]
  created_at: string
  updated_at: string
  // Joined fields
  etablissement?: {
    id: string
    nom: string
  } | null
  project?: {
    id: string
    name: string
    color: string
  } | null
}

export interface CreateTodoInput {
  title: string
  description?: string
  project_id?: string | null
  etablissement_id?: string | null
  priority?: 'low' | 'medium' | 'high' | 'urgent'
  due_date?: string | null
  due_time?: string | null
  labels?: string[]
  // New fields
  assigned_to?: string | null
  rd_user_story_id?: string | null
  support_ticket_id?: string | null
  visibility?: 'personal' | 'team' | 'all'
}

export interface UpdateTodoInput {
  id: string
  title?: string
  description?: string | null
  project_id?: string | null
  etablissement_id?: string | null
  is_done?: boolean
  priority?: 'low' | 'medium' | 'high' | 'urgent'
  due_date?: string | null
  due_time?: string | null
  labels?: string[]
  position?: number
}

export const personalTodoKeys = {
  all: ['personal-todos'] as const,
  list: (filters?: { projectId?: string; done?: boolean }) =>
    [...personalTodoKeys.all, 'list', filters] as const,
  detail: (id: string) => [...personalTodoKeys.all, 'detail', id] as const,
}

export function usePersonalTodos(filters?: { projectId?: string; done?: boolean }) {
  const { data: profile } = useCurrentProfile()

  return useQuery({
    queryKey: personalTodoKeys.list(filters),
    queryFn: async () => {
      if (!profile?.id) return []

      let query = supabase
        .from('personal_todos')
        .select(
          `
          *,
          etablissement:etablissements(id, nom),
          project:todo_projects(id, name, color)
        `
        )
        .order('position', { ascending: true })
        .order('created_at', { ascending: false })

      if (filters?.projectId) {
        query = query.eq('project_id', filters.projectId)
      }

      if (filters?.done !== undefined) {
        query = query.eq('is_done', filters.done)
      }

      const { data, error } = await query

      if (error) {
        debug.error('Error fetching personal todos:', error)
        throw error
      }

      return (data || []) as PersonalTodo[]
    },
    enabled: !!profile?.id,
    staleTime: 30 * 1000,
  })
}

export function useCreatePersonalTodo() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: CreateTodoInput) => {
      const profileId = await getCurrentProfileId()

      // Get max position
      const { data: maxPos } = await supabase
        .from('personal_todos')
        .select('position')
        .eq('user_id', profileId)
        .order('position', { ascending: false })
        .limit(1)
        .maybeSingle()

      const newPosition = (maxPos?.position ?? -1) + 1

      const { data, error } = await supabase
        .from('personal_todos')
        .insert({
          user_id: profileId,
          title: input.title,
          description: input.description || null,
          project_id: input.project_id || null,
          etablissement_id: input.etablissement_id || null,
          priority: input.priority || 'medium',
          due_date: input.due_date || null,
          due_time: input.due_time || null,
          labels: input.labels || [],
          position: newPosition,
          // New fields
          assigned_to: input.assigned_to || null,
          rd_user_story_id: input.rd_user_story_id || null,
          support_ticket_id: input.support_ticket_id || null,
          visibility: input.visibility || 'personal',
        })
        .select()
        // safe: guaranteed-row
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: personalTodoKeys.all })
      queryClient.invalidateQueries({ queryKey: unifiedTodoKeys.all })
      toast.success('Todo créée')
    },
    onError: (error) => {
      debug.error('Error creating todo:', error)
      toast.error('Erreur lors de la création')
    },
  })
}

export function useUpdatePersonalTodo() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: UpdateTodoInput) => {
      const updateData: Record<string, unknown> = {}

      if (input.title !== undefined) updateData.title = input.title
      if (input.description !== undefined) updateData.description = input.description
      if (input.project_id !== undefined) updateData.project_id = input.project_id
      if (input.etablissement_id !== undefined) updateData.etablissement_id = input.etablissement_id
      if (input.priority !== undefined) updateData.priority = input.priority
      if (input.due_date !== undefined) updateData.due_date = input.due_date
      if (input.due_time !== undefined) updateData.due_time = input.due_time
      if (input.labels !== undefined) updateData.labels = input.labels
      if (input.position !== undefined) updateData.position = input.position

      if (input.is_done !== undefined) {
        updateData.is_done = input.is_done
        if (input.is_done) {
          const profileId = await getCurrentProfileId()
          updateData.done_at = new Date().toISOString()
          updateData.done_by = profileId
        } else {
          updateData.done_at = null
          updateData.done_by = null
        }
      }

      const { data, error } = await supabase
        .from('personal_todos')
        .update(updateData as never)
        .eq('id', input.id)
        .select()
        // safe: guaranteed-row
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: personalTodoKeys.all })
      queryClient.invalidateQueries({ queryKey: unifiedTodoKeys.all })
    },
    onError: (error) => {
      debug.error('Error updating todo:', error)
      toast.error('Erreur lors de la mise à jour')
    },
  })
}

export function useTogglePersonalTodo() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, is_done }: { id: string; is_done: boolean }) => {
      let doneBy: string | null = null
      if (is_done) {
        doneBy = await getCurrentProfileId()
      }

      const { data, error } = await supabase
        .from('personal_todos')
        .update({
          is_done,
          done_at: is_done ? new Date().toISOString() : null,
          done_by: doneBy,
        })
        .eq('id', id)
        .select()
        // safe: guaranteed-row
        .single()

      if (error) throw error
      return data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: personalTodoKeys.all })
      queryClient.invalidateQueries({ queryKey: unifiedTodoKeys.all })
      queryClient.invalidateQueries({ queryKey: ['todos-unread-count'] })
      if (data.is_done) {
        toast.success('Todo terminée')
      }
    },
    onError: (error) => {
      debug.error('Error toggling todo:', error)
      toast.error('Erreur')
    },
  })
}

export function useDeletePersonalTodo() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('personal_todos').delete().eq('id', id)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: personalTodoKeys.all })
      queryClient.invalidateQueries({ queryKey: unifiedTodoKeys.all })
      toast.success('Todo supprimée')
    },
    onError: (error) => {
      debug.error('Error deleting todo:', error)
      toast.error('Erreur lors de la suppression')
    },
  })
}
