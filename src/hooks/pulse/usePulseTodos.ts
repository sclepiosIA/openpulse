import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/components/AuthProvider'
import { useToast } from '@/hooks/shared/use-toast'
import { debug } from '@/lib/debug'

export interface TodoItem {
  id: string
  todo_list_id: string
  content: string
  is_done: boolean
  done_at: string | null
  done_by: string | null
  position: number
  created_at: string
}

export interface TodoList {
  id: string
  conversation_id: string
  message_id: string | null
  title: string
  created_by: string
  created_at: string
  updated_at: string
  items?: TodoItem[]
}

// Query keys
export const pulseTodoKeys = {
  all: ['pulse-todos'] as const,
  byConversation: (conversationId: string) =>
    [...pulseTodoKeys.all, 'conversation', conversationId] as const,
  byMessage: (messageId: string) => [...pulseTodoKeys.all, 'message', messageId] as const,
  single: (todoId: string) => [...pulseTodoKeys.all, 'single', todoId] as const,
}

// Fetch todo list with items by ID
export function usePulseTodoList(todoId: string | undefined) {
  return useQuery({
    queryKey: pulseTodoKeys.single(todoId || ''),
    queryFn: async () => {
      if (!todoId) return null

      const { data: todoList, error: listError } = await supabase
        .from('pulse_todo_lists')
        .select('id, conversation_id, message_id, title, created_by, created_at, updated_at')
        .eq('id', todoId)
        .maybeSingle()

      if (listError) throw listError
      if (!todoList) return null

      const { data: items, error: itemsError } = await supabase
        .from('pulse_todo_items')
        .select('id, todo_list_id, content, is_done, done_at, done_by, position, created_at')
        .eq('todo_list_id', todoId)
        .order('position', { ascending: true })

      if (itemsError) throw itemsError

      return { ...todoList, items } as TodoList
    },
    enabled: !!todoId,
    staleTime: 30000,
  })
}

// Create todo list with items
export function useCreatePulseTodoList() {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const { user } = useAuth()

  return useMutation({
    mutationFn: async ({
      conversationId,
      title,
      items,
      messageId,
    }: {
      conversationId: string
      title: string
      items: string[]
      messageId?: string
    }) => {
      if (!user) throw new Error('Non authentifié')

      // Get profile_id from auth.uid() to comply with RLS
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle()

      if (profileError || !profile) throw new Error('Profil introuvable')

      // Create the todo list
      const { data: todoList, error: listError } = await supabase
        .from('pulse_todo_lists')
        .insert({
          conversation_id: conversationId,
          message_id: messageId || null,
          title,
          created_by: profile.id,
        })
        .select()
        // safe: guaranteed-row
        .single()

      if (listError) throw listError

      // Create items
      if (items.length > 0) {
        const itemsToInsert = items.map((content, index) => ({
          todo_list_id: todoList.id,
          content,
          position: index,
        }))

        const { error: itemsError } = await supabase.from('pulse_todo_items').insert(itemsToInsert)

        if (itemsError) throw itemsError
      }

      return todoList as TodoList
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: pulseTodoKeys.byConversation(data.conversation_id),
      })
      toast({
        title: 'Todo créée',
        description: 'La liste de tâches a été créée',
      })
    },
    onError: (error) => {
      debug.error('Error creating todo:', error)
      toast({
        title: 'Erreur',
        description: 'Impossible de créer la todo',
        variant: 'destructive',
      })
    },
  })
}

// Toggle todo item
export function useToggleTodoItem() {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  return useMutation({
    mutationFn: async ({ itemId, isDone }: { itemId: string; isDone: boolean }) => {
      const { data, error } = await supabase
        .from('pulse_todo_items')
        .update({
          is_done: isDone,
          done_at: isDone ? new Date().toISOString() : null,
          done_by: isDone ? user?.id : null,
        })
        .eq('id', itemId)
        .select('todo_list_id')
        // safe: guaranteed-row
        .single()

      if (error) throw error
      return data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: pulseTodoKeys.single(data.todo_list_id) })
    },
  })
}

// Add todo item
export function useAddTodoItem() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ todoListId, content }: { todoListId: string; content: string }) => {
      // Get current max position
      const { data: existingItems } = await supabase
        .from('pulse_todo_items')
        .select('position')
        .eq('todo_list_id', todoListId)
        .order('position', { ascending: false })
        .limit(1)

      const nextPosition =
        existingItems?.[0]?.position !== undefined ? existingItems[0].position + 1 : 0

      const { data, error } = await supabase
        .from('pulse_todo_items')
        .insert({
          todo_list_id: todoListId,
          content,
          position: nextPosition,
        })
        .select()
        // safe: guaranteed-row
        .single()

      if (error) throw error
      return { ...data, todoListId }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: pulseTodoKeys.single(data.todoListId) })
    },
  })
}

// Delete todo item
export function useDeleteTodoItem() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ itemId, todoListId }: { itemId: string; todoListId: string }) => {
      const { error } = await supabase.from('pulse_todo_items').delete().eq('id', itemId)

      if (error) throw error
      return { todoListId }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: pulseTodoKeys.single(data.todoListId) })
    },
  })
}

// Update todo list message_id (link to message after sending)
export function useUpdateTodoListMessage() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ todoListId, messageId }: { todoListId: string; messageId: string }) => {
      const { data, error } = await supabase
        .from('pulse_todo_lists')
        .update({ message_id: messageId })
        .eq('id', todoListId)
        .select()
        // safe: guaranteed-row
        .single()

      if (error) throw error
      return data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: pulseTodoKeys.single(data.id) })
    },
  })
}
