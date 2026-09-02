import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { fromExtended } from '@/lib/supabaseTyped'
import { debug } from '@/lib/debug'

// Types stricts pour les logs console et infos navigateur
export type FeedbackType = 'bug' | 'amelioration' | 'question' | 'autre'
export type FeedbackPriority = 'low' | 'medium' | 'high' | 'critical'
export type FeedbackStatus = 'new' | 'reviewed' | 'in_progress' | 'resolved' | 'wont_fix'

export interface ConsoleLogEntry {
  level: 'log' | 'warn' | 'error' | 'info' | 'debug'
  message: string
  timestamp?: string
  stack?: string
}

export interface BrowserInfo {
  userAgent?: string
  platform?: string
  language?: string
  screenWidth?: number
  screenHeight?: number
  viewportWidth?: number
  viewportHeight?: number
  colorDepth?: number
  [key: string]: string | number | boolean | undefined
}

export interface UserFeedback {
  id: string
  user_id: string | null
  type: FeedbackType
  priority: FeedbackPriority
  status: FeedbackStatus
  title: string
  description: string | null
  screenshot_url: string | null
  current_route: string | null
  console_logs: ConsoleLogEntry[] | null
  browser_info: BrowserInfo | null
  created_at: string
  updated_at: string
  resolved_at: string | null
  resolved_by: string | null
  admin_notes: string | null
  archived_at: string | null
  // Joined data
  user_email?: string
  user_name?: string
}

// Type pour les données brutes de la base
interface RawFeedback {
  id: string
  user_id: string | null
  type: string
  priority: string
  status: string
  title: string
  description: string | null
  screenshot_url: string | null
  current_route: string | null
  console_logs: unknown
  browser_info: unknown
  created_at: string
  updated_at: string
  resolved_at: string | null
  resolved_by: string | null
  admin_notes: string | null
  archived_at: string | null
}

interface ProfileData {
  id: string
  email: string
  nom: string | null
  prenom: string | null
}

const CHUNK_SIZE = 50

export function useFeedbackList(filters?: {
  type?: string
  status?: string
  priority?: string
  showArchived?: boolean
}) {
  return useQuery({
    queryKey: ['user_feedbacks', filters],
    queryFn: async () => {
      // Step 1: Fetch feedbacks without join (avoid PostgREST relationship error)
      let query = fromExtended('user_feedbacks')
        .select(
          'id, user_id, type, priority, status, title, description, screenshot_url, current_route, console_logs, browser_info, created_at, updated_at, resolved_at, resolved_by, admin_notes, archived_at'
        )
        .order('created_at', { ascending: false })
        .limit(200)

      // Par défaut, masquer les feedbacks archivés
      if (!filters?.showArchived) {
        query = query.is('archived_at', null)
      }

      if (filters?.type) {
        query = query.eq('type', filters.type)
      }
      if (filters?.status) {
        query = query.eq('status', filters.status)
      }
      if (filters?.priority) {
        query = query.eq('priority', filters.priority)
      }

      const { data: feedbacks, error } = await query

      if (error) throw error
      if (!feedbacks || feedbacks.length === 0) return [] as UserFeedback[]

      // Step 2: Get unique user_ids - cast via unknown pour éviter les erreurs de type Supabase
      const rawFeedbacks = feedbacks as unknown as RawFeedback[]
      const userIds = [
        ...new Set(rawFeedbacks.map((f) => f.user_id).filter((id): id is string => id !== null)),
      ]

      // Step 3: Fetch profiles in chunks to avoid URL length issues
      const profilesMap = new Map<string, ProfileData>()

      if (userIds.length > 0) {
        for (let i = 0; i < userIds.length; i += CHUNK_SIZE) {
          const chunk = userIds.slice(i, i + CHUNK_SIZE)
          try {
            const { data: profiles } = await supabase
              .from('profiles')
              .select('id, email, nom, prenom')
              .in('id', chunk)

            if (profiles) {
              profiles.forEach((p) => {
                profilesMap.set(p.id, { id: p.id, email: p.email, nom: p.nom, prenom: p.prenom })
              })
            }
          } catch {
            // Silently fail if profiles fetch fails (RLS or other)
            debug.warn('[useFeedbackList] Could not fetch profiles for chunk')
          }
        }
      }

      // Step 4: Map feedbacks with profile data
      return rawFeedbacks.map((item) => {
        const profile = item.user_id ? profilesMap.get(item.user_id) : null
        return {
          ...item,
          type: item.type as FeedbackType,
          priority: item.priority as FeedbackPriority,
          status: item.status as FeedbackStatus,
          console_logs: item.console_logs as ConsoleLogEntry[] | null,
          browser_info: item.browser_info as BrowserInfo | null,
          user_email: profile?.email ?? null,
          user_name: profile ? `${profile.prenom || ''} ${profile.nom || ''}`.trim() || null : null,
        }
      }) as UserFeedback[]
    },
  })
}

export function useFeedbackStats() {
  return useQuery({
    queryKey: ['user_feedbacks_stats'],
    queryFn: async () => {
      // Table user_feedbacks not in generated Supabase types
      // @see src/types/supabase-extensions.ts for type definitions
      const { data, error } = await fromExtended('user_feedbacks').select('type, status, priority')

      if (error) throw error

      // Type assertion pour les données brutes
      interface StatsFeedback {
        type: string
        status: string
        priority: string
      }
      const feedbacks = (data || []) as unknown as StatsFeedback[]

      return {
        total: feedbacks.length,
        byType: {
          bug: feedbacks.filter((f) => f.type === 'bug').length,
          amelioration: feedbacks.filter((f) => f.type === 'amelioration').length,
          question: feedbacks.filter((f) => f.type === 'question').length,
          autre: feedbacks.filter((f) => f.type === 'autre').length,
        },
        byStatus: {
          new: feedbacks.filter((f) => f.status === 'new').length,
          reviewed: feedbacks.filter((f) => f.status === 'reviewed').length,
          in_progress: feedbacks.filter((f) => f.status === 'in_progress').length,
          resolved: feedbacks.filter((f) => f.status === 'resolved').length,
          wont_fix: feedbacks.filter((f) => f.status === 'wont_fix').length,
        },
        byPriority: {
          critical: feedbacks.filter((f) => f.priority === 'critical').length,
          high: feedbacks.filter((f) => f.priority === 'high').length,
          medium: feedbacks.filter((f) => f.priority === 'medium').length,
          low: feedbacks.filter((f) => f.priority === 'low').length,
        },
      }
    },
  })
}

export function useUpdateFeedback() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      id,
      updates,
    }: {
      id: string
      updates: Partial<
        Pick<UserFeedback, 'status' | 'admin_notes' | 'resolved_at' | 'resolved_by' | 'archived_at'>
      >
    }) => {
      const { data, error } = await fromExtended('user_feedbacks')
        .update(updates)
        .eq('id', id)
        .select()
        // safe: guaranteed-row
        .single() // safe: guaranteed-row

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user_feedbacks'] })
      queryClient.invalidateQueries({ queryKey: ['user_feedbacks_stats'] })
    },
  })
}

export function useArchiveFeedback() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await fromExtended('user_feedbacks')
        .update({ archived_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        // safe: guaranteed-row
        .single() // safe: guaranteed-row

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user_feedbacks'] })
      queryClient.invalidateQueries({ queryKey: ['user_feedbacks_stats'] })
    },
  })
}

export function useBulkArchiveFeedbacks() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await fromExtended('user_feedbacks')
        .update({ archived_at: new Date().toISOString() })
        .in('id', ids)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user_feedbacks'] })
      queryClient.invalidateQueries({ queryKey: ['user_feedbacks_stats'] })
    },
  })
}

export function useDeleteFeedback() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await fromExtended('user_feedbacks').delete().eq('id', id)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user_feedbacks'] })
      queryClient.invalidateQueries({ queryKey: ['user_feedbacks_stats'] })
    },
  })
}
