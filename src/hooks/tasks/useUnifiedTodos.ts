import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { useCurrentProfile } from '@/hooks/profile/useProfiles'
import { debug } from '@/lib/debug'
import { format, isToday, isTomorrow, isThisWeek, isPast, addHours } from 'date-fns'
import { fr } from 'date-fns/locale'

export type TodoSource = 'personal' | 'etablissement' | 'pulse'
export type TodoVisibility = 'personal' | 'team' | 'all'

export interface UnifiedTodo {
  id: string
  source: TodoSource
  title: string
  description: string | null
  is_done: boolean
  done_at: string | null
  priority: 'low' | 'medium' | 'high' | 'urgent'
  due_date: string | null
  created_at: string
  etablissement_id: string | null
  etablissement_name: string | null
  project_id: string | null
  project_name: string | null
  project_color: string | null
  conversation_id: string | null
  conversation_name: string | null
  pulse_list_id?: string
  pulse_item_id?: string
  // New fields for assignment and operations
  assigned_to_id: string | null
  assigned_to_name: string | null
  rd_user_story_id: string | null
  rd_user_story_title: string | null
  support_ticket_id: string | null
  support_ticket_title: string | null
  visibility: TodoVisibility
}

export type TodoFilter =
  | 'all'
  | 'today'
  | 'week'
  | 'overdue'
  | 'etablissement'
  | 'personal'
  | 'shared'

export interface UnifiedTodosFilters {
  filter?: TodoFilter
  etablissementId?: string
  projectId?: string
  showDone?: boolean
  search?: string
}

export const unifiedTodoKeys = {
  all: ['unified-todos'] as const,
  list: (filters?: UnifiedTodosFilters) => [...unifiedTodoKeys.all, 'list', filters] as const,
  stats: () => [...unifiedTodoKeys.all, 'stats'] as const,
}

export function useUnifiedTodos(filters?: UnifiedTodosFilters) {
  const { data: profile } = useCurrentProfile()

  return useQuery({
    queryKey: unifiedTodoKeys.list(filters),
    queryFn: async () => {
      if (!profile?.id) return []

      const todos: UnifiedTodo[] = []

      // Types pour les jointures Supabase (non strictement typées par le client)
      type NamedRow = { id?: string; nom?: string | null } | null
      type ProjectRow = { id?: string; name?: string | null; color?: string | null } | null
      type ProfileRow = { id?: string; prenom?: string | null; nom?: string | null } | null
      type TitledRow = { id?: string; titre?: string | null } | null
      type ConversationRow = { name?: string | null } | null
      type PulseItem = {
        id: string
        content: string
        is_done: boolean
        done_at: string | null
        position: number
        created_at: string
      }

      // 1. Fetch personal todos
      const { data: personalTodos, error: personalError } = await supabase
        .from('personal_todos')
        .select(
          `
          *,
          etablissement:etablissements(id, nom),
          project:todo_projects(id, name, color),
          assigned:profiles!personal_todos_assigned_to_fkey(id, prenom, nom),
          rd_user_story:rd_user_stories(id, titre),
          support_ticket:support_tickets(id, titre, numero_ticket)
        `
        )
        .order('position', { ascending: true })

      if (personalError) {
        debug.error('Error fetching personal todos:', personalError)
      } else if (personalTodos) {
        for (const todo of personalTodos) {
          todos.push({
            id: todo.id,
            source: 'personal',
            title: todo.title,
            description: todo.description,
            is_done: todo.is_done,
            done_at: todo.done_at,
            priority: todo.priority as UnifiedTodo['priority'],
            due_date: todo.due_date,
            created_at: todo.created_at,
            etablissement_id: todo.etablissement_id,
            etablissement_name: (todo.etablissement as NamedRow)?.nom || null,
            project_id: todo.project_id,
            project_name: (todo.project as ProjectRow)?.name || null,
            project_color: (todo.project as ProjectRow)?.color || null,
            conversation_id: null,
            conversation_name: null,
            assigned_to_id: todo.assigned_to || null,
            assigned_to_name: (todo.assigned as ProfileRow | null)
              ? `${(todo.assigned as ProfileRow | null)?.prenom || ''} ${(todo.assigned as ProfileRow | null)?.nom || ''}`.trim()
              : null,
            rd_user_story_id: todo.rd_user_story_id || null,
            rd_user_story_title: (todo.rd_user_story as TitledRow)?.titre || null,
            support_ticket_id: todo.support_ticket_id || null,
            support_ticket_title: (todo.support_ticket as TitledRow)?.titre || null,
            visibility: (todo.visibility as TodoVisibility) || 'personal',
          })
        }
      }

      // 2. Fetch establishment tasks (taches) assigned to user
      const { data: taches, error: tachesError } = await supabase
        .from('taches')
        .select(
          `
          id,
          titre,
          description,
          statut,
          priorite,
          echeance,
          created_at,
          etablissement:etablissements(id, nom)
        `
        )
        .eq('responsable_id', profile.id)
        .in('statut', ['A faire', 'En cours'])

      if (tachesError) {
        debug.error('Error fetching taches:', tachesError)
      } else if (taches) {
        for (const tache of taches) {
          const priorityMap: Record<string, UnifiedTodo['priority']> = {
            low: 'low',
            medium: 'medium',
            high: 'high',
          }

          todos.push({
            id: tache.id,
            source: 'etablissement',
            title: tache.titre,
            description: tache.description,
            is_done: tache.statut === 'Terminé',
            done_at: null,
            priority: priorityMap[tache.priorite] || 'medium',
            due_date: tache.echeance,
            created_at: tache.created_at,
            etablissement_id: (tache.etablissement as NamedRow)?.id || null,
            etablissement_name: (tache.etablissement as NamedRow)?.nom || null,
            project_id: null,
            project_name: null,
            project_color: null,
            conversation_id: null,
            conversation_name: null,
            assigned_to_id: null,
            assigned_to_name: null,
            rd_user_story_id: null,
            rd_user_story_title: null,
            support_ticket_id: null,
            support_ticket_title: null,
            visibility: 'personal',
          })
        }
      }

      // 3. Fetch Pulse todo lists the user is member of
      const { data: memberData } = await supabase
        .from('pulse_conversation_members')
        .select('conversation_id, pulse_conversations!inner(name)')
        .eq('user_id', profile.id)

      if (memberData && memberData.length > 0) {
        const conversationIds = memberData.map((m) => m.conversation_id)
        const conversationNames = new Map(
          memberData.map((m) => [
            m.conversation_id,
            (m.pulse_conversations as ConversationRow)?.name || 'Conversation',
          ])
        )

        const { data: pulseTodoLists } = await supabase
          .from('pulse_todo_lists')
          .select(
            `
            id,
            title,
            conversation_id,
            pulse_todo_items (
              id,
              content,
              is_done,
              done_at,
              position,
              created_at
            )
          `
          )
          .in('conversation_id', conversationIds)

        if (pulseTodoLists) {
          for (const list of pulseTodoLists) {
            const items = (list.pulse_todo_items || []) as PulseItem[]
            for (const item of items) {
              todos.push({
                id: `pulse-${list.id}-${item.id}`,
                source: 'pulse',
                title: item.content,
                description: null,
                is_done: item.is_done,
                done_at: item.done_at,
                priority: 'medium',
                due_date: null,
                created_at: item.created_at,
                etablissement_id: null,
                etablissement_name: null,
                project_id: null,
                project_name: list.title || 'Todo',
                project_color: '#8B5CF6',
                conversation_id: list.conversation_id,
                conversation_name: conversationNames.get(list.conversation_id) || null,
                pulse_list_id: list.id,
                pulse_item_id: item.id,
                assigned_to_id: null,
                assigned_to_name: null,
                rd_user_story_id: null,
                rd_user_story_title: null,
                support_ticket_id: null,
                support_ticket_title: null,
                visibility: 'personal',
              })
            }
          }
        }
      }

      // Apply filters
      let filtered = todos

      // Keep done tasks visible for 24 hours after completion
      if (!filters?.showDone) {
        const now = new Date()
        const twentyFourHoursAgo = addHours(now, -24)

        filtered = filtered.filter((t) => {
          // Keep if not done
          if (!t.is_done) return true
          // Keep if done within the last 24 hours
          if (t.done_at && new Date(t.done_at) > twentyFourHoursAgo) return true
          return false
        })
      }

      if (filters?.filter) {
        switch (filters.filter) {
          case 'today':
            filtered = filtered.filter((t) => t.due_date && isToday(new Date(t.due_date)))
            break
          case 'week':
            filtered = filtered.filter(
              (t) => t.due_date && isThisWeek(new Date(t.due_date), { weekStartsOn: 1 })
            )
            break
          case 'overdue':
            filtered = filtered.filter(
              (t) => t.due_date && isPast(new Date(t.due_date)) && !isToday(new Date(t.due_date))
            )
            break
          case 'etablissement':
            filtered = filtered.filter((t) => t.source === 'etablissement')
            break
          case 'personal':
            filtered = filtered.filter((t) => t.source === 'personal' && !t.project_id)
            break
          case 'shared':
            filtered = filtered.filter(
              (t) => t.source === 'pulse' || (t.source === 'personal' && t.project_id)
            )
            break
        }
      }

      if (filters?.etablissementId) {
        filtered = filtered.filter((t) => t.etablissement_id === filters.etablissementId)
      }

      if (filters?.projectId) {
        filtered = filtered.filter((t) => t.project_id === filters.projectId)
      }

      if (filters?.search) {
        const search = filters.search.toLowerCase()
        filtered = filtered.filter(
          (t) =>
            t.title.toLowerCase().includes(search) ||
            t.description?.toLowerCase().includes(search) ||
            t.etablissement_name?.toLowerCase().includes(search) ||
            t.project_name?.toLowerCase().includes(search)
        )
      }

      // Sort
      filtered.sort((a, b) => {
        if (a.is_done !== b.is_done) return a.is_done ? 1 : -1

        const aOverdue =
          a.due_date && isPast(new Date(a.due_date)) && !isToday(new Date(a.due_date))
        const bOverdue =
          b.due_date && isPast(new Date(b.due_date)) && !isToday(new Date(b.due_date))
        if (aOverdue !== bOverdue) return aOverdue ? -1 : 1

        const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 }
        if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
          return priorityOrder[a.priority] - priorityOrder[b.priority]
        }

        if (a.due_date && b.due_date) {
          return new Date(a.due_date).getTime() - new Date(b.due_date).getTime()
        }
        if (a.due_date) return -1
        if (b.due_date) return 1

        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      })

      return filtered
    },
    enabled: !!profile?.id,
    staleTime: 30 * 1000,
  })
}

export function useUnifiedTodoStats() {
  const { data: profile } = useCurrentProfile()

  return useQuery({
    queryKey: unifiedTodoKeys.stats(),
    queryFn: async () => {
      if (!profile?.id) return null

      const [personalResult, tachesResult] = await Promise.all([
        supabase.from('personal_todos').select('id, due_date, is_done').eq('is_done', false),
        supabase
          .from('taches')
          .select('id, echeance, statut')
          .eq('responsable_id', profile.id)
          .in('statut', ['A faire', 'En cours']),
      ])

      const personalTodos = personalResult.data || []
      const taches = tachesResult.data || []

      let todayCount = 0
      let weekCount = 0
      let overdueCount = 0
      const totalCount = personalTodos.length + taches.length

      for (const todo of personalTodos) {
        if (todo.due_date) {
          const date = new Date(todo.due_date)
          if (isToday(date)) todayCount++
          if (isThisWeek(date, { weekStartsOn: 1 })) weekCount++
          if (isPast(date) && !isToday(date)) overdueCount++
        }
      }

      for (const tache of taches) {
        if (tache.echeance) {
          const date = new Date(tache.echeance)
          if (isToday(date)) todayCount++
          if (isThisWeek(date, { weekStartsOn: 1 })) weekCount++
          if (isPast(date) && !isToday(date)) overdueCount++
        }
      }

      return {
        today: todayCount,
        week: weekCount,
        overdue: overdueCount,
        total: totalCount,
      }
    },
    enabled: !!profile?.id,
    staleTime: 60 * 1000,
  })
}

export function formatDueDate(dateStr: string | null): string {
  if (!dateStr) return ''

  const date = new Date(dateStr)

  if (isToday(date)) return "Aujourd'hui"
  if (isTomorrow(date)) return 'Demain'
  if (isPast(date)) return format(date, 'd MMM', { locale: fr })
  if (isThisWeek(date, { weekStartsOn: 1 })) return format(date, 'EEEE', { locale: fr })

  return format(date, 'd MMM', { locale: fr })
}

export function getDueDateColor(dateStr: string | null, isDone: boolean): string {
  if (isDone || !dateStr) return 'text-muted-foreground'

  const date = new Date(dateStr)

  if (isPast(date) && !isToday(date)) return 'text-destructive'
  if (isToday(date)) return 'text-orange-500'
  if (isTomorrow(date)) return 'text-amber-500'

  return 'text-muted-foreground'
}
