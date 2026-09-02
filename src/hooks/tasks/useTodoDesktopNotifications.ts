import { useEffect } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { useCurrentProfile } from '@/hooks/profile/useProfiles'
import { notifyDesktopShell } from '@/lib/desktopBridge'

type TodoInsert = {
  title?: string | null
  assigned_to?: string | null
  user_id?: string | null
}

export function shouldNotifyTodo(todo: TodoInsert, profileId: string): boolean {
  return todo.assigned_to === profileId && todo.user_id !== profileId
}

/** Notifications desktop des tâches assignées par un tiers. */
export function useTodoDesktopNotifications(): void {
  const { data: profile } = useCurrentProfile()
  const profileId = profile?.id

  useEffect(() => {
    if (!profileId) return
    const channel = supabase
      .channel(`todo-desktop-notifications-${profileId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'personal_todos',
          filter: `assigned_to=eq.${profileId}`,
        },
        (payload) => {
          const todo = payload.new as TodoInsert
          if (!shouldNotifyTodo(todo, profileId)) return
          notifyDesktopShell({
            module: 'todo',
            title: 'Nouvelle tâche assignée',
            body: todo.title?.trim() || 'Une nouvelle tâche vous a été assignée',
          })
        }
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [profileId])
}
