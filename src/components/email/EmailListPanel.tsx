/**
 * @tech-debt DUPLICATION : ~60% de la logique de ce composant est dupliquée dans EmailInbox.tsx (mobile).
 * Les deux gèrent fetchThreads, filtres, recherche body, pagination, realtime, actions bulk.
 * TODO: Extraire la logique commune dans un hook useEmailList partagé.
 */
import { useEffect, useState, useCallback, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { safeStorage } from '@/lib/safeStorage'

import { RefreshCw, Mail } from 'lucide-react'

import { debug } from '@/lib/debug'
import { EmailListItemCompact } from './EmailListItemCompact'
import { BulkActionsBar } from './BulkActionsBar'
import { EmailListPanelHeader } from './EmailListPanelHeader'
import { useEmailFilters } from '@/hooks/email/useEmailFilters'
import { useDebouncedValue } from '@/hooks/shared/useDebouncedValue'
import { useThreadsEnrichedData } from '@/hooks/email/useThreadsEnrichedData'

import { useErrorHandler } from '@/hooks/shared/useErrorHandler'
import { useEmailListPanelActionHandlers } from './inbox/useEmailListPanelActionHandlers'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import type { EmailThread } from '@/types/email'
import { useAuth } from '@/hooks/shared/useAuth'
import { useUserEmailAccountIds } from '@/hooks/shared/useUserEmailAccountIds'
import { supabase } from '@/integrations/supabase/client'

interface EmailListPanelProps {
  accountId: string
  selectedThreadId: string | null
  onThreadSelect: (threadId: string, subject?: string) => void
  onComposeNew?: () => void
  onSyncNow?: () => void
  isSyncing?: boolean
  lastSyncAt?: string | null
  onThreadHover?: (thread: EmailThread | null) => void
}

export function EmailListPanel({
  accountId,
  selectedThreadId,
  onThreadSelect,
  onComposeNew,
  onSyncNow,
  isSyncing = false,
  lastSyncAt,
  onThreadHover,
}: EmailListPanelProps) {
  const { user: authUser } = useAuth()
  const queryClient = useQueryClient()
  const [threads, setThreads] = useState<EmailThread[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const pageRef = useRef(1)
  const [hasMore, setHasMore] = useState(false)
  const lastLoadRef = useRef<number>(0)
  const isLoadingRef = useRef(false)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const sentinelRef = useRef<HTMLDivElement>(null)
  const errorCountRef = useRef(0)
  const MIN_LOAD_INTERVAL = 500
  const MAX_PAGES = 100
  const ITEMS_PER_PAGE = 50

  // Multi-selection state
  const [selectedThreads, setSelectedThreads] = useState<Set<string>>(new Set())
  const [isSelectionMode, setIsSelectionMode] = useState(false)
  const [isProcessingBulk, setIsProcessingBulk] = useState(false)

  // Pending removal state for "unread only" mode - keeps selected email visible until deselected
  const [pendingRemovalId, setPendingRemovalId] = useState<string | null>(null)

  const { filters, updateFilter } = useEmailFilters(true)
  const debouncedSearch = useDebouncedValue(filters.search, 300)
  const { data: enrichedData } = useThreadsEnrichedData(threads)
  const { handleError } = useErrorHandler()
  const { accountIds: userAccountIds } = useUserEmailAccountIds()

  // Thread actions + optimistic helpers (extrait dans useEmailListPanelActionHandlers — session 94)
  const { actionHandlers, optimisticUpdateThread, optimisticRemoveThread } =
    useEmailListPanelActionHandlers({ setThreads, setSelectedThreads })

  // Keep pageRef in sync
  useEffect(() => {
    pageRef.current = page
  }, [page])

  // Infinite scroll with IntersectionObserver on the scroll container
  useEffect(() => {
    const scrollContainer = scrollContainerRef.current
    const sentinel = sentinelRef.current
    if (!scrollContainer || !sentinel) return

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries
        if (entry.isIntersecting && !isLoadingRef.current) {
          const now = Date.now()
          if (now - lastLoadRef.current > MIN_LOAD_INTERVAL) {
            lastLoadRef.current = now
            setPage((prev) => {
              if (!hasMore) return prev
              return prev + 1
            })
          }
        }
      },
      {
        root: scrollContainer,
        rootMargin: '200px',
        threshold: 0,
      }
    )

    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [hasMore])

  // mode: 'reset' = full reload, 'incremental' = only new threads, 'page' = next page
  const fetchThreads = useCallback(
    async (resetOrMode: boolean | 'incremental' = false) => {
      const mode =
        resetOrMode === 'incremental' ? 'incremental' : resetOrMode === true ? 'reset' : 'page'
      if (isLoadingRef.current) return
      isLoadingRef.current = true
      if (mode !== 'incremental') setLoading(true)
      const currentPage = mode === 'reset' || mode === 'incremental' ? 1 : pageRef.current
      const from = mode === 'incremental' ? 0 : (currentPage - 1) * ITEMS_PER_PAGE
      const to = mode === 'incremental' ? ITEMS_PER_PAGE - 1 : from + ITEMS_PER_PAGE - 1

      try {
        let query = supabase
          .from('email_threads')
          .select(
            `
          id, thread_id, user_email_account_id, subject, participants,
          last_message_date, message_count, unread_count,
          last_message_from_email, last_message_from_name, last_message_is_sent,
          last_inbound_from_email, last_inbound_from_name, last_inbound_date,
          is_archived, is_spam, is_deleted, is_hors_etablissement, is_processed,
          has_sent_messages, category, priority, tags,
          etablissement_id, groupe_id, partenaire_id,
          ai_summary, ai_generated_title, ai_confidence_score, needs_manual_review,
          created_at, updated_at,
          account:user_email_accounts(email_address),
          etablissement:etablissements(id, nom, ville, statut, progression, relationship_status, engagement_score),
          groupe:groupes_etablissements(id, nom, type),
          partenaire:partenaires(id, nom, type_partenaire, ville, statut_relation)
        `
          )
          .eq('is_archived', false)
          .eq('is_spam', false)

        // Trash mailbox: show deleted threads. Other mailboxes: hide deleted.
        if (filters.mailbox === 'trash') {
          query = query.eq('is_deleted', true)
        } else {
          query = query.eq('is_deleted', false)
        }

        // When viewing entity-scoped emails (établissement/groupe/partenaire),
        // show threads from ALL user accounts for a 360° view.
        // Otherwise, restrict to the current user's accounts.
        const isEntityScoped = filters.etablissementId || filters.groupeId || filters.partenaireId
        if (isEntityScoped) {
          // No account filter — cross-user view for this entity
        } else if (accountId && accountId !== 'all') {
          query = query.eq('user_email_account_id', accountId)
        } else if (userAccountIds.length > 0) {
          query = query.in('user_email_account_id', userAccountIds)
        } else {
          // Accounts not loaded yet — don't query without filter
          setLoading(false)
          isLoadingRef.current = false
          return
        }

        // For incremental mode, only fetch threads newer than our newest
        if (mode === 'incremental' && threads.length > 0) {
          const newestDate = threads[0]?.last_message_date
          if (newestDate) {
            query = query.gt('last_message_date', newestDate)
          }
        }

        // Body search promise - launched early, awaited later (non-blocking)
        let bodySearchPromise: Promise<string[] | null> | null = null

        if (debouncedSearch) {
          // Step 1: Direct filter on email_threads columns (fast, no join)
          query = query.or(
            `subject.ilike.%${debouncedSearch}%,ai_summary.ilike.%${debouncedSearch}%,ai_generated_title.ilike.%${debouncedSearch}%`
          )

          // Step 2: Fire body search RPC in parallel (don't await yet)
          bodySearchPromise = (async () => {
            try {
              const { data } = await supabase.rpc('search_email_threads_body', {
                search_term: debouncedSearch,
              })
              return data?.map((r: { thread_id: string }) => r.thread_id) || null
            } catch {
              debug.warn('[EmailListPanel] Body search RPC failed')
              return null
            }
          })()
        }

        if (filters.category) {
          query = query.eq('category', filters.category)
        }
        if (filters.unreadOnly) {
          query = query.gt('unread_count', 0)
        }
        if (filters.unprocessedOnly) {
          query = query.or('is_processed.eq.false,is_processed.is.null')
        }

        // Mailbox filter (inbox/sent/trash)
        if (filters.mailbox === 'sent') {
          query = query.eq('has_sent_messages', true)
        } else if (filters.mailbox === 'inbox') {
          query = query.or('is_outbound.eq.false,is_outbound.is.null')
        } else if (filters.mailbox === 'trash') {
          // Already filtered by is_deleted above
        }
        // 'all' shows everything

        // Limit to last 15 days unless actively searching or doing incremental
        if (!debouncedSearch && mode !== 'incremental') {
          const fifteenDaysAgo = new Date()
          fifteenDaysAgo.setDate(fifteenDaysAgo.getDate() - 15)
          const cutoff = fifteenDaysAgo.toISOString()
          query = query.or(`last_message_date.gte.${cutoff},updated_at.gte.${cutoff}`)
        }

        query = query.order('last_message_date', { ascending: false }).range(from, to)

        const { data } = await query

        if (mode === 'reset') {
          setThreads((data || []) as unknown as EmailThread[])
          setPage(1)
          // Clear selection on refresh
          setSelectedThreads(new Set())
        } else if (mode === 'incremental') {
          // Merge new threads into existing list without replacing
          if (data && data.length > 0) {
            setThreads((prev) => {
              const map = new Map(prev.map((t) => [t.id, t]))
              for (const t of data as unknown as EmailThread[]) {
                map.set(t.id, t)
              }
              return Array.from(map.values()).sort(
                (a, b) =>
                  new Date(b.last_message_date).getTime() - new Date(a.last_message_date).getTime()
              )
            })
            debug.log(`📬 Incremental refresh: merged ${data.length} new/updated threads`)
          } else {
            debug.log('📭 Incremental refresh: no new threads')
          }
        } else {
          setThreads((prev) => {
            const map = new Map(prev.map((t) => [t.id, t]))
            for (const t of (data || []) as unknown as EmailThread[]) {
              map.set(t.id, t)
            }
            return Array.from(map.values())
          })
        }

        // hasMore: si on reçoit autant de résultats que la page, il y en a probablement plus
        if (mode !== 'incremental') {
          setHasMore((data?.length || 0) >= ITEMS_PER_PAGE && currentPage < MAX_PAGES)
        }

        // Body search: merge additional results asynchronously (non-blocking)
        if (bodySearchPromise) {
          const existingIds = new Set((data || []).map((t: any) => t.id))
          bodySearchPromise.then(async (bodyThreadIds) => {
            if (!bodyThreadIds || bodyThreadIds.length === 0) return
            const missingIds = bodyThreadIds.filter((id) => !existingIds.has(id))
            if (missingIds.length === 0) return

            const { data: extraThreads } = await supabase
              .from('email_threads')
              .select(
                `
              id, thread_id, user_email_account_id, subject, participants,
              last_message_date, message_count, unread_count,
              last_message_from_email, last_message_from_name, last_message_is_sent,
              last_inbound_from_email, last_inbound_from_name, last_inbound_date,
              is_archived, is_spam, is_deleted, is_hors_etablissement, is_processed,
              has_sent_messages, category, priority, tags,
              etablissement_id, groupe_id, partenaire_id,
              ai_summary, ai_generated_title, ai_confidence_score, needs_manual_review,
              created_at, updated_at,
              account:user_email_accounts(email_address),
              etablissement:etablissements(id, nom, ville, statut, progression, relationship_status, engagement_score),
              groupe:groupes_etablissements(id, nom, type),
              partenaire:partenaires(id, nom, type_partenaire, ville, statut_relation)
            `
              )
              .in('id', missingIds.slice(0, 50))
              .eq('is_archived', false)
              .eq('is_spam', false)
              .eq('is_deleted', filters.mailbox === 'trash')
              .order('last_message_date', { ascending: false })

            if (extraThreads && extraThreads.length > 0) {
              setThreads((prev) => {
                const map = new Map(prev.map((t) => [t.id, t]))
                for (const t of extraThreads as unknown as EmailThread[]) map.set(t.id, t)
                return Array.from(map.values()).sort(
                  (a, b) =>
                    new Date(b.last_message_date).getTime() -
                    new Date(a.last_message_date).getTime()
                )
              })
            }
          })
        }
      } catch (error) {
        handleError(error, 'EmailListPanel.fetchThreads')
        // Increment error counter for backoff
        errorCountRef.current++
        if (errorCountRef.current >= 3) {
          debug.warn('[EmailListPanel] Too many consecutive errors, stopping auto-refetch')
        }
      } finally {
        setLoading(false)
        isLoadingRef.current = false
      }
    },
    [
      debouncedSearch,
      filters.category,
      filters.unreadOnly,
      filters.unprocessedOnly,
      filters.mailbox,
      accountId,
      userAccountIds,
      handleError,
      threads,
    ]
  )

  // Single realtime listener with 10s debounce + visibility guard
  const realtimeRefreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    const handleRealtimeUpdate = () => {
      if (document.visibilityState !== 'visible') return
      if (errorCountRef.current >= 3) return
      if (safeStorage.getItem('email-compose-dirty') === '1') return
      if (isLoadingRef.current) return
      if (realtimeRefreshTimerRef.current) clearTimeout(realtimeRefreshTimerRef.current)
      const delay = isSyncing ? 15000 : 10000
      realtimeRefreshTimerRef.current = setTimeout(() => {
        fetchThreads('incremental')
      }, delay)
    }
    window.addEventListener('email-realtime-update', handleRealtimeUpdate)
    return () => {
      window.removeEventListener('email-realtime-update', handleRealtimeUpdate)
      if (realtimeRefreshTimerRef.current) clearTimeout(realtimeRefreshTimerRef.current)
    }
  }, [fetchThreads, isSyncing])

  useEffect(() => {
    // Wait for user account IDs to be loaded before fetching
    if (!accountId && userAccountIds.length === 0) return
    fetchThreads(true)
  }, [
    debouncedSearch,
    filters.category,
    filters.unreadOnly,
    filters.unprocessedOnly,
    filters.mailbox,
    accountId,
    userAccountIds,
  ])

  // Removed: inView-based effect, now handled by IntersectionObserver in useEffect above

  useEffect(() => {
    if (page > 1) {
      fetchThreads(false)
    }
  }, [page])

  // Scroll to selected thread when it changes
  useEffect(() => {
    if (selectedThreadId) {
      setTimeout(() => {
        const element = document.getElementById(`thread-${selectedThreadId}`)
        element?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      }, 100)
    }
  }, [selectedThreadId])

  // Auto-mark as read when a thread is selected (optimistic UI + silent DB persist)
  // This is the SINGLE source of truth for auto-mark-as-read — EmailThread.tsx no longer does it
  // In "unread only" mode, keep the email visible until user selects another one
  useEffect(() => {
    if (!selectedThreadId) return

    const thread = threads.find((t) => t.id === selectedThreadId)
    if (!thread || thread.unread_count === 0) return

    // 1. Mark as read visually (optimistic)
    optimisticUpdateThread(selectedThreadId, { unread_count: 0 })

    // 2. Persist to DB silently (no mutation, no event dispatch, no list invalidation)
    const persistMarkAsRead = async () => {
      await Promise.all([
        supabase.from('email_threads').update({ unread_count: 0 }).eq('id', selectedThreadId),
        supabase
          .from('email_messages')
          .update({ is_read: true })
          .eq('thread_id', selectedThreadId)
          .eq('is_read', false),
      ])
      // Only invalidate badge counters — NOT the thread list
      queryClient.invalidateQueries({ queryKey: ['email-counts'] })
      queryClient.invalidateQueries({ queryKey: ['email-unread-count'] })
    }
    persistMarkAsRead()

    // If "unread only" filter is active, mark for pending removal (will be removed when user selects another email)
    if (filters.unreadOnly) {
      setPendingRemovalId(selectedThreadId)
    }
  }, [selectedThreadId, filters.unreadOnly, optimisticUpdateThread])

  // Remove previously selected email from list when user selects a different email (in "unread only" mode)
  useEffect(() => {
    if (pendingRemovalId && pendingRemovalId !== selectedThreadId) {
      optimisticRemoveThread(pendingRemovalId)
      setPendingRemovalId(null)
    }
  }, [selectedThreadId, pendingRemovalId, optimisticRemoveThread])

  // Clear pending removal when switching away from "unread only" mode
  useEffect(() => {
    if (!filters.unreadOnly) {
      setPendingRemovalId(null)
    }
  }, [filters.unreadOnly])

  // Toggle selection mode
  const toggleSelectionMode = () => {
    if (isSelectionMode) {
      setSelectedThreads(new Set())
    }
    setIsSelectionMode(!isSelectionMode)
  }

  // Toggle individual thread selection
  const handleToggleSelect = (threadId: string) => {
    setSelectedThreads((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(threadId)) {
        newSet.delete(threadId)
      } else {
        newSet.add(threadId)
      }
      // Exit selection mode if no threads selected
      if (newSet.size === 0) {
        setIsSelectionMode(false)
      } else if (!isSelectionMode) {
        setIsSelectionMode(true)
      }
      return newSet
    })
  }

  // Select all visible threads
  const handleSelectAll = () => {
    if (selectedThreads.size === threads.length) {
      setSelectedThreads(new Set())
    } else {
      setSelectedThreads(new Set(threads.map((t) => t.id)))
    }
  }

  // Bulk actions
  const handleMarkAsRead = async () => {
    if (selectedThreads.size === 0) return
    setIsProcessingBulk(true)
    const threadIds = Array.from(selectedThreads)
    // Optimistic: update locally
    setThreads((prev) =>
      prev.map((t) => (selectedThreads.has(t.id) ? ({ ...t, unread_count: 0 } as EmailThread) : t))
    )
    setSelectedThreads(new Set())
    setIsSelectionMode(false)
    try {
      const { error } = await supabase
        .from('email_threads')
        .update({ unread_count: 0 })
        .in('id', threadIds)

      if (error) throw error

      await supabase
        .from('email_messages')
        .update({ is_read: true })
        .in('thread_id', threadIds)
        .eq('is_read', false)

      toast.success(`${threadIds.length} email(s) marqué(s) comme lu(s)`)
      queryClient.invalidateQueries({ queryKey: ['email-counts'] })
    } catch (error) {
      handleError(error, 'EmailListPanel.handleMarkAsRead')
      toast.error('Erreur lors du marquage comme lu')
      fetchThreads(true)
    } finally {
      setIsProcessingBulk(false)
    }
  }

  const handleArchive = async () => {
    if (selectedThreads.size === 0) return
    setIsProcessingBulk(true)
    const ids = Array.from(selectedThreads)
    // Optimistic: remove from list immediately
    setThreads((prev) => prev.filter((t) => !selectedThreads.has(t.id)))
    setSelectedThreads(new Set())
    setIsSelectionMode(false)
    try {
      const { error } = await supabase
        .from('email_threads')
        .update({ is_archived: true })
        .in('id', ids)

      if (error) throw error

      toast.success(`${ids.length} email(s) archivé(s)`)
    } catch (error) {
      handleError(error, 'EmailListPanel.handleArchive')
      toast.error("Erreur lors de l'archivage")
      fetchThreads(true)
    } finally {
      setIsProcessingBulk(false)
    }
  }

  const handleMarkAsSpam = async () => {
    if (selectedThreads.size === 0) return
    setIsProcessingBulk(true)
    const ids = Array.from(selectedThreads)
    // Optimistic: remove from list immediately
    setThreads((prev) => prev.filter((t) => !selectedThreads.has(t.id)))
    setSelectedThreads(new Set())
    setIsSelectionMode(false)
    try {
      const { error } = await supabase.from('email_threads').update({ is_spam: true }).in('id', ids)

      if (error) throw error

      toast.success(`${ids.length} email(s) marqué(s) comme spam`)
    } catch (error) {
      handleError(error, 'EmailListPanel.handleMarkAsSpam')
      toast.error('Erreur lors du marquage comme spam')
      fetchThreads(true)
    } finally {
      setIsProcessingBulk(false)
    }
  }

  const handleDelete = async () => {
    if (selectedThreads.size === 0) return
    setIsProcessingBulk(true)
    const ids = Array.from(selectedThreads)
    // Optimistic: remove from list immediately
    setThreads((prev) => prev.filter((t) => !selectedThreads.has(t.id)))
    setSelectedThreads(new Set())
    setIsSelectionMode(false)
    try {
      const { error } = await supabase
        .from('email_threads')
        .update({ is_deleted: true })
        .in('id', ids)

      if (error) throw error

      toast.success(`${ids.length} email(s) supprimé(s)`)
    } catch (error) {
      handleError(error, 'EmailListPanel.handleDelete')
      toast.error('Erreur lors de la suppression')
      fetchThreads(true)
    } finally {
      setIsProcessingBulk(false)
    }
  }

  const handleMarkAsProcessed = async () => {
    if (selectedThreads.size === 0) return
    setIsProcessingBulk(true)
    const threadIds = Array.from(selectedThreads)
    // Optimistic: update locally
    setThreads((prev) =>
      prev.map((t) =>
        selectedThreads.has(t.id)
          ? ({ ...t, is_processed: true, unread_count: 0 } as EmailThread)
          : t
      )
    )
    setSelectedThreads(new Set())
    setIsSelectionMode(false)
    try {
      if (!authUser?.id) throw new Error('User not authenticated')

      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', authUser.id)
        .maybeSingle()

      const { error } = await supabase
        .from('email_threads')
        .update({
          is_processed: true,
          processed_at: new Date().toISOString(),
          processed_by: profile?.id || null,
          unread_count: 0,
        })
        .in('id', threadIds)

      if (error) throw error

      toast.success(`${threadIds.length} email(s) marqué(s) comme traité(s)`)
      queryClient.invalidateQueries({ queryKey: ['email-counts'] })
    } catch (error) {
      handleError(error, 'EmailListPanel.handleMarkAsProcessed')
      toast.error('Erreur lors du marquage comme traité')
      fetchThreads(true)
    } finally {
      setIsProcessingBulk(false)
    }
  }

  const handleClearSelection = () => {
    setSelectedThreads(new Set())
    setIsSelectionMode(false)
  }

  const unreadCount = threads.filter((t) => t.unread_count > 0).length
  const unprocessedCount = threads.filter((t) => !t.is_processed).length

  return (
    <div className="flex flex-col h-full relative bg-marque-papier">
      <EmailListPanelHeader
        filters={filters}
        updateFilter={updateFilter}
        isSelectionMode={isSelectionMode}
        threadsCount={threads.length}
        selectedCount={selectedThreads.size}
        unreadCount={unreadCount}
        onToggleSelectionMode={toggleSelectionMode}
        onSelectAll={handleSelectAll}
        onSyncNow={onSyncNow}
        isSyncing={isSyncing}
        onComposeNew={onComposeNew}
      />

      {/* Thread List - Native scroll container for proper IntersectionObserver */}
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto">
        <div className="divide-y divide-primary/5">
          {loading && threads.length === 0 ? (
            // Skeleton loading
            Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="p-3 space-y-2 bg-card/50">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-8 w-8 rounded-full" />
                  <div className="flex-1 space-y-1">
                    <Skeleton className="h-3 w-24" />
                    <Skeleton className="h-3 w-full" />
                  </div>
                </div>
              </div>
            ))
          ) : threads.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">
              <Mail className="h-12 w-12 mx-auto mb-3 opacity-20" />
              <p>Aucun email</p>
            </div>
          ) : (
            <>
              {threads.map((thread, index) => {
                // Performance: Only animate first 10 items to prevent INP degradation on large lists
                const shouldAnimate = index < 10

                if (shouldAnimate) {
                  return (
                    <motion.div
                      key={thread.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.02, duration: 0.15 }}
                    >
                      <EmailListItemCompact
                        thread={thread}
                        isSelected={thread.id === selectedThreadId}
                        enrichedData={enrichedData?.get(thread.id)}
                        onClick={() => {
                          if (isSelectionMode) {
                            handleToggleSelect(thread.id)
                          } else {
                            onThreadSelect(thread.id, thread.ai_generated_title || thread.subject)
                          }
                        }}
                        onHover={onThreadHover}
                        isInSelectionMode={isSelectionMode}
                        isChecked={selectedThreads.has(thread.id)}
                        onToggleSelect={() => handleToggleSelect(thread.id)}
                        isPendingRemoval={thread.id === pendingRemovalId}
                        isSentMailbox={filters.mailbox === 'sent'}
                        actionHandlers={actionHandlers}
                        contextThreadIds={
                          selectedThreads.has(thread.id) && selectedThreads.size > 1
                            ? Array.from(selectedThreads)
                            : [thread.id]
                        }
                      />
                    </motion.div>
                  )
                }

                // Render without animation for items beyond first 10
                return (
                  <div key={thread.id}>
                    <EmailListItemCompact
                      thread={thread}
                      isSelected={thread.id === selectedThreadId}
                      enrichedData={enrichedData?.get(thread.id)}
                      onClick={() => {
                        if (isSelectionMode) {
                          handleToggleSelect(thread.id)
                        } else {
                          onThreadSelect(thread.id, thread.ai_generated_title || thread.subject)
                        }
                      }}
                      onHover={onThreadHover}
                      isInSelectionMode={isSelectionMode}
                      isChecked={selectedThreads.has(thread.id)}
                      onToggleSelect={() => handleToggleSelect(thread.id)}
                      isPendingRemoval={thread.id === pendingRemovalId}
                      isSentMailbox={filters.mailbox === 'sent'}
                      actionHandlers={actionHandlers}
                      contextThreadIds={
                        selectedThreads.has(thread.id) && selectedThreads.size > 1
                          ? Array.from(selectedThreads)
                          : [thread.id]
                      }
                    />
                  </div>
                )
              })}

              {/* Infinite scroll sentinel */}
              <div ref={sentinelRef} className="p-4 flex justify-center">
                {loading && hasMore && (
                  <RefreshCw className="h-4 w-4 animate-spin text-primary/50" />
                )}
              </div>

              {/* Progress indicator */}
              {threads.length > 0 && (
                <div className="text-center text-xs text-muted-foreground py-2 border-t border-primary/5 bg-card/30">
                  {threads.length} emails chargés
                  {hasMore && ' • Défilez pour plus'}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Bulk Actions Bar */}
      <BulkActionsBar
        selectedCount={selectedThreads.size}
        onMarkAsRead={handleMarkAsRead}
        onMarkAsProcessed={handleMarkAsProcessed}
        onArchive={handleArchive}
        onMarkAsSpam={handleMarkAsSpam}
        onDelete={handleDelete}
        onClear={handleClearSelection}
        isProcessing={isProcessingBulk}
      />
    </div>
  )
}
