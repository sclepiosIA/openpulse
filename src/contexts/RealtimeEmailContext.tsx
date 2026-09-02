import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
  useMemo,
  useCallback,
} from 'react'
import { supabase } from '@/integrations/supabase/client'
import { RealtimeChannel } from '@supabase/supabase-js'
import { toast } from 'sonner'
import { debug } from '@/lib/debug'
import { safeStorage } from '@/lib/safeStorage'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { fromExtended } from '@/lib/supabaseTyped'
import { useDeferredReady } from '@/components/shared/DeferredProvider'
import { useCurrentProfile } from '@/hooks/profile/useProfiles'
import { notifyDesktopShell } from '@/lib/desktopBridge'

interface EmailNotification {
  id: string
  subject: string
  unread_count: number
  last_message_date: string
  _addedAt?: number // Timestamp for TTL cleanup
}

export interface UnreadByAccount {
  [accountId: string]: {
    count: number
    email: string
  }
}

interface RealtimeEmailContextValue {
  unreadCount: number
  unreadByAccount: UnreadByAccount
  newEmails: EmailNotification[]
  clearNewEmail: (emailId: string) => void
  clearAllNewEmails: () => void
  getTopUnreadAccountId: () => string | null
  invalidateThreads: () => void
}

const RealtimeEmailContext = createContext<RealtimeEmailContextValue | null>(null)

/**
 * Singleton provider for email realtime notifications.
 * This centralizes all email WebSocket subscriptions to avoid duplicate channels.
 */
export function RealtimeEmailProvider({ children }: { children: React.ReactNode }) {
  const [unreadCount, setUnreadCount] = useState(0)
  const [unreadByAccount, setUnreadByAccount] = useState<UnreadByAccount>({})
  const [newEmails, setNewEmails] = useState<EmailNotification[]>([])
  const [reconnectTrigger, setReconnectTrigger] = useState(0)
  const channelRef = useRef<RealtimeChannel | null>(null)
  const lastNotificationTime = useRef<number>(0)
  const notifiedIds = useRef<Set<string>>(new Set())
  const isMountedRef = useRef(true)
  const reconnectAttempts = useRef(0)
  const maxReconnectAttempts = 3
  const queryClient = useQueryClient()
  const { data: profile } = useCurrentProfile()

  // Track mounted state
  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  // Fetch user's email account IDs for RLS-compatible realtime filter
  // Filter by profile_id to only subscribe to current user's accounts
  const { data: userAccountIds } = useQuery({
    queryKey: ['user-email-account-ids-for-realtime-singleton', profile?.id],
    queryFn: async () => {
      if (!profile?.id) return []
      const { data } = await fromExtended('user_email_accounts_safe')
        .select('id, profile_id, is_shared')
        .eq('is_active', true)
        .or(`profile_id.eq.${profile.id},is_shared.eq.true`)
      return (data as { id: string }[] | null)?.map((a) => a.id) ?? []
    },
    staleTime: 5 * 60 * 1000,
    enabled: !!profile?.id,
  })

  // Compute filter string for realtime subscription
  const accountFilter = useMemo(() => {
    if (!userAccountIds || userAccountIds.length === 0) return null
    return `user_email_account_id=in.(${userAccountIds.join(',')})`
  }, [userAccountIds])

  // Fetch unread count with breakdown by account - filtered by user's accounts
  const fetchUnreadCount = useCallback(async () => {
    if (!userAccountIds || userAccountIds.length === 0) return

    const fifteenDaysAgo = new Date()
    fifteenDaysAgo.setDate(fifteenDaysAgo.getDate() - 15)
    const cutoff = fifteenDaysAgo.toISOString()

    const threadsQuery = supabase
      .from('email_threads')
      .select('user_email_account_id')
      .gt('unread_count', 0)
      .eq('is_archived', false)
      .eq('is_deleted', false)
      .eq('is_spam', false)
      .or(`last_message_date.gte.${cutoff},updated_at.gte.${cutoff}`)
      .in('user_email_account_id', userAccountIds)
      .limit(500)

    const { data: threads } = await threadsQuery

    const { data: accounts } = await fromExtended('user_email_accounts_safe')
      .select('id, email_address, profile_id, is_shared')
      .eq('is_active', true)
      .or(profile?.id ? `profile_id.eq.${profile.id},is_shared.eq.true` : 'id.is.null')

    if (threads && accounts) {
      const accountMap = new Map(
        (accounts as { id: string; email_address: string }[]).map((a) => [a.id, a.email_address])
      )
      const byAccount: UnreadByAccount = {}
      let total = 0

      for (const thread of threads) {
        const accId = thread.user_email_account_id
        if (!byAccount[accId]) {
          byAccount[accId] = {
            count: 0,
            email: accountMap.get(accId) || 'Compte inconnu',
          }
        }
        byAccount[accId].count++
        total++
      }

      setUnreadCount(total)
      setUnreadByAccount(byAccount)
    }
  }, [userAccountIds, profile?.id])

  // Initial fetch + re-fetch when window regains focus + periodic sync every 5 min
  useEffect(() => {
    fetchUnreadCount()

    // Re-sync on visibility change (tab focus)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchUnreadCount()
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)

    // Debounced handler for custom events — groups rapid-fire dispatches into a single fetch
    let debounceTimer: ReturnType<typeof setTimeout> | null = null
    const handleDebouncedRefresh = () => {
      if (debounceTimer) clearTimeout(debounceTimer)
      debounceTimer = setTimeout(() => {
        fetchUnreadCount()
      }, 2000)
    }
    window.addEventListener('email-unread-refresh', handleDebouncedRefresh)
    // Removed 'email-thread-updated' listener — unread count is already updated optimistically

    // Periodic sync removed — useEmailCounts refetchInterval handles drift

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('email-unread-refresh', handleDebouncedRefresh)
      if (debounceTimer) clearTimeout(debounceTimer)
    }
  }, [fetchUnreadCount])

  // TTL cleanup: automatically remove newEmails older than 10 minutes
  useEffect(() => {
    const TTL_MS = 10 * 60 * 1000 // 10 minutes
    const cleanup = setInterval(() => {
      setNewEmails((prev) => {
        const now = Date.now()
        const filtered = prev.filter((e) => !e._addedAt || now - e._addedAt < TTL_MS)
        return filtered.length !== prev.length ? filtered : prev
      })
    }, 60 * 1000) // Check every minute
    return () => clearInterval(cleanup)
  }, [])

  // Gate on deferred readiness to avoid subscribing before the provider is ready
  const deferredReady = useDeferredReady()

  // Set up realtime subscription with RLS-compatible filter - SINGLETON
  useEffect(() => {
    if (!deferredReady || !accountFilter) {
      return
    }

    debug.log('🔔 [RealtimeEmailContext] Setting up singleton email notifications channel')

    // Scope channel name with a hash of the account filter for user-level isolation
    // + per-mount unique suffix to prevent "after subscribe()" collision under StrictMode/remount
    const mountSuffix = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
    const channelName = `email-notifications-${accountFilter.slice(0, 32)}-${mountSuffix}`
    let channel: RealtimeChannel
    try {
      channel = supabase.channel(channelName)
    } catch (err) {
      debug.error('[RealtimeEmailContext] channel create failed', err)
      return
    }
    channelRef.current = channel

    channel
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'email_threads',
          filter: accountFilter,
        },
        (payload) => {
          const newThread = payload.new as {
            id: string
            created_at: string
            unread_count: number
            is_spam?: boolean
            is_deleted?: boolean
            is_archived?: boolean
            user_email_account_id: string
            subject: string
            last_message_date: string
          }

          const createdAt = new Date(newThread.created_at)
          const isRecent = Date.now() - createdAt.getTime() < 120000
          const isRelevant =
            newThread.unread_count > 0 &&
            !newThread.is_spam &&
            !newThread.is_deleted &&
            !newThread.is_archived

          const alreadyNotified = notifiedIds.current.has(newThread.id)

          if (isRecent && isRelevant && !alreadyNotified) {
            notifiedIds.current.add(newThread.id)
            setTimeout(() => notifiedIds.current.delete(newThread.id), 60000)

            const now = Date.now()
            if (now - lastNotificationTime.current > 5000) {
              lastNotificationTime.current = now

              setUnreadCount((prev) => prev + 1)

              setUnreadByAccount((prev) => {
                const accId = newThread.user_email_account_id
                const existing = prev[accId] || { count: 0, email: 'Compte' }
                return {
                  ...prev,
                  [accId]: { ...existing, count: existing.count + 1 },
                }
              })

              setNewEmails((prev) =>
                [
                  {
                    id: newThread.id,
                    subject: newThread.subject,
                    unread_count: newThread.unread_count,
                    last_message_date: newThread.last_message_date,
                    _addedAt: Date.now(),
                  },
                  ...prev,
                ].slice(0, 5)
              )

              toast.success('📧 Nouvel email reçu', {
                description: newThread.subject || 'Sans objet',
                duration: 4000,
              })
              notifyDesktopShell({
                module: 'mail',
                title: 'Nouvel email reçu',
                body: newThread.subject || 'Sans objet',
              })

              // Dispatch event only — components handle their own refresh
              // (removed redundant invalidateQueries to avoid cascade)
            }
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'email_threads',
          filter: accountFilter,
        },
        (payload) => {
          const oldThread = payload.old as any
          const newThread = payload.new as any

          const unreadChanged = oldThread.unread_count !== newThread.unread_count

          const isOnlyAIUpdate =
            !unreadChanged &&
            (oldThread.ai_summary !== newThread.ai_summary ||
              oldThread.ai_confidence_score !== newThread.ai_confidence_score ||
              oldThread.ai_last_processed_at !== newThread.ai_last_processed_at)

          if (isOnlyAIUpdate) {
            return
          }

          // Detect new message in existing thread (last_message_date changed or unread increased)
          const hasNewMessage = oldThread.last_message_date !== newThread.last_message_date
          const unreadIncreased = newThread.unread_count > (oldThread.unread_count || 0)

          if (hasNewMessage || unreadIncreased) {
            const isComposing = safeStorage.getItem('email-compose-dirty') === '1'
            if (isComposing) {
              debug.log('✋ [RealtimeEmailContext] Skipping refresh — composition in progress')
            } else {
              debug.log(
                '🔄 [RealtimeEmailContext] New message detected in thread, dispatching event'
              )
              notifyDesktopShell({
                module: 'mail',
                title: 'Nouveau message email',
                body: newThread.subject || 'Sans objet',
              })
              // Dispatch event only — components handle their own refresh
              // (removed redundant invalidateQueries to avoid cascade)
              window.dispatchEvent(new CustomEvent('email-realtime-update'))
            }
          }

          if (unreadChanged) {
            const wasUnread = oldThread.unread_count > 0
            const isUnread = newThread.unread_count > 0
            const accId = newThread.user_email_account_id

            if (wasUnread && !isUnread) {
              setUnreadCount((prev) => Math.max(0, prev - 1))
              setUnreadByAccount((prev) => {
                const existing = prev[accId]
                if (!existing) return prev
                const newCount = Math.max(0, existing.count - 1)
                if (newCount === 0) {
                  const { [accId]: _, ...rest } = prev
                  return rest
                }
                return { ...prev, [accId]: { ...existing, count: newCount } }
              })
            } else if (!wasUnread && isUnread) {
              const now = Date.now()
              if (now - lastNotificationTime.current > 5000) {
                lastNotificationTime.current = now
                setUnreadCount((prev) => prev + 1)
                setUnreadByAccount((prev) => {
                  const existing = prev[accId] || { count: 0, email: 'Compte' }
                  return { ...prev, [accId]: { ...existing, count: existing.count + 1 } }
                })
              }
            }

            if (!isUnread) {
              setNewEmails((prev) => prev.filter((e) => e.id !== newThread.id))
            }
          }
        }
      )
      .subscribe((status, err) => {
        if (status === 'CHANNEL_ERROR') {
          if (!isMountedRef.current) {
            return
          }

          reconnectAttempts.current++
          if (reconnectAttempts.current > maxReconnectAttempts) {
            debug.warn('⚠️ [RealtimeEmailContext] Max reconnect attempts reached')
            return
          }

          // Improved backoff: 10s base + jitter
          const baseDelay = 10000
          const jitter = Math.random() * 5000
          const backoffDelay = Math.min(
            baseDelay * Math.pow(2, reconnectAttempts.current - 1) + jitter,
            120000
          )

          debug.log(
            `🔄 [RealtimeEmailContext] Reconnecting in ${Math.round(backoffDelay / 1000)}s (attempt ${reconnectAttempts.current}/${maxReconnectAttempts})`
          )

          setTimeout(() => {
            if (!isMountedRef.current) return
            if (channelRef.current) {
              try {
                supabase.removeChannel(channelRef.current)
              } catch (e) {
                debug.error('[RealtimeEmailContext] removeChannel failed', e)
              }
              channelRef.current = null
            }
            // Force re-creation of the channel by triggering effect re-run
            setReconnectTrigger((prev) => prev + 1)
          }, backoffDelay)
        } else if (status === 'SUBSCRIBED') {
          reconnectAttempts.current = 0
          debug.log('✅ [RealtimeEmailContext] Singleton channel subscribed')
        }
      })

    return () => {
      debug.log('🔕 [RealtimeEmailContext] Cleaning up singleton channel')
      // Note: isMountedRef is managed by the dedicated mount effect (L52-57), not here
      if (channelRef.current) {
        try {
          supabase.removeChannel(channelRef.current)
        } catch (e) {
          debug.error('[RealtimeEmailContext] removeChannel failed', e)
        }
        channelRef.current = null
      }
    }
  }, [accountFilter, queryClient, reconnectTrigger])

  const clearNewEmail = useCallback((emailId: string) => {
    setNewEmails((prev) => prev.filter((e) => e.id !== emailId))
  }, [])

  const clearAllNewEmails = useCallback(() => {
    setNewEmails([])
  }, [])

  const getTopUnreadAccountId = useCallback((): string | null => {
    const entries = Object.entries(unreadByAccount)
    if (entries.length === 0) return null
    return entries.sort((a, b) => b[1].count - a[1].count)[0][0]
  }, [unreadByAccount])

  const invalidateThreads = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['email-threads'] })
  }, [queryClient])

  const value: RealtimeEmailContextValue = {
    unreadCount,
    unreadByAccount,
    newEmails,
    clearNewEmail,
    clearAllNewEmails,
    getTopUnreadAccountId,
    invalidateThreads,
  }

  return <RealtimeEmailContext.Provider value={value}>{children}</RealtimeEmailContext.Provider>
}

/**
 * Hook to access the centralized email realtime notifications.
 * This replaces direct usage of useRealtimeEmailNotifications in components.
 */
export function useRealtimeEmail(): RealtimeEmailContextValue {
  const context = useContext(RealtimeEmailContext)
  if (!context) {
    throw new Error('useRealtimeEmail must be used within a RealtimeEmailProvider')
  }
  return context
}

/**
 * Compatibility wrapper that mimics the old useRealtimeEmailNotifications API.
 * Components can gradually migrate to useRealtimeEmail.
 */
export function useRealtimeEmailCompat(onNewEmail?: () => void) {
  const context = useContext(RealtimeEmailContext)

  // Call onNewEmail when newEmails changes (for backward compatibility)
  // This effect always runs (hooks must be unconditional)
  useEffect(() => {
    if (context && context.newEmails.length > 0 && onNewEmail) {
      onNewEmail()
    }
  }, [context?.newEmails, onNewEmail, context])

  // If context is available, use it; otherwise return empty state (for components outside provider)
  if (context) {
    return context
  }

  // Fallback for components outside the provider
  return {
    unreadCount: 0,
    unreadByAccount: {},
    newEmails: [] as EmailNotification[],
    clearNewEmail: () => {},
    clearAllNewEmails: () => {},
    getTopUnreadAccountId: () => null,
    invalidateThreads: () => {},
  }
}
