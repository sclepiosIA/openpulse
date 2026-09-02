/**
 * @tech-debt DUPLICATION : ~60% de la logique de ce composant est dupliquée dans EmailListPanel.tsx (desktop).
 * Les deux gèrent fetchThreads, filtres, recherche body, pagination, realtime, actions bulk.
 * TODO: Extraire la logique commune dans un hook useEmailList partagé.
 */
import { useEffect, useState, useLayoutEffect, useRef, useCallback } from "react";
import { debug } from "@/lib/debug";
import { safeStorage } from "@/lib/safeStorage";
import { useQueryClient } from "@tanstack/react-query";
import { EMAIL_THREAD_SELECT, applyThreadFilters } from "./inbox/threadQuery";

import { Button } from "@/components/ui/button";

import { Mail, Plus, ArrowUp, Filter } from "lucide-react";
import { toast } from "sonner";
import { invokeEdge } from "@/services/edgeFunctions";
import { useInView } from 'react-intersection-observer';

import { EmailInboxToolbarConsolidated } from "./EmailInboxToolbarConsolidated";
import { MobileEmailFilters } from "./MobileEmailFilters";
import { MobileEmailQuickFilters } from "./MobileEmailQuickFilters";

import { InfiniteScrollLoader } from "./InfiniteScrollLoader";
import { EmailSyncProgressBar } from "./EmailSyncProgressBar";
import { EmailListSkeleton } from "./EmailListSkeleton";
import { EmailListEmptyState } from "./EmailListEmptyState";
import { BulkActionsBar } from "./BulkActionsBar";
import { EmailInboxListView } from "./EmailInboxListView";
import { useEmailFilters } from "@/hooks/email/useEmailFilters";
import { useDebouncedValue } from "@/hooks/shared/useDebouncedValue";

import { useEmailRefresh } from "@/hooks/email/useEmailRefresh";
import { useErrorHandler } from "@/hooks/shared/useErrorHandler";

import { useThreadsEnrichedData } from "@/hooks/email/useThreadsEnrichedData";
import { useEmailInboxActionHandlers } from "./inbox/useEmailInboxActionHandlers";
import { useEmailBulkActionHandlers } from "./inbox/useEmailBulkActionHandlers";

import { MobileDrawer } from "@/components/mobile/MobileDrawer";

import { useUserEmailAccountIds } from "@/hooks/shared/useUserEmailAccountIds";
import { useAuth } from "@/components/AuthProvider";
import { supabase } from "@/integrations/supabase/client";

interface EmailInboxProps {
  onThreadSelect: (threadId: string, subject?: string) => void;
  onSyncNow?: () => void;
  onFullSync?: () => void;
  isSyncing?: boolean;
  onComposeNew?: () => void;
  accountId?: string;
  lastSyncAt?: string | null;
  toolbarPrefixSlot?: React.ReactNode;
}

export function EmailInbox({ 
  onThreadSelect, 
  onSyncNow,
  onFullSync,
  isSyncing = false,
  onComposeNew,
  accountId,
  lastSyncAt,
  toolbarPrefixSlot,
}: EmailInboxProps) {
  const { user } = useAuth();
  const [threads, setThreads] = useState<any[]>([]);
  const threadsRef = useRef<any[]>([]);
  const isFetchingRef = useRef(false);
  const errorCountRef = useRef(0);
  const [loading, setLoading] = useState(true);
  const [autoClassifying, setAutoClassifying] = useState(false);
  const [page, setPage] = useState(1);
  const pageRef = useRef(1);
  const [hasMore, setHasMore] = useState(false);
  
  // Throttle pour éviter les chargements en boucle
  const lastLoadRef = useRef<number>(0);
  const MIN_LOAD_INTERVAL = 500; // 500ms minimum entre chaque chargement
  const MAX_PAGES = 100; // Limite de sécurité
  const [selectedThreads, setSelectedThreads] = useState<Set<string>>(new Set());
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>(() => {
    const saved = localStorage.getItem('email-sort-order');
    return (saved === 'asc' || saved === 'desc') ? saved : 'desc';
  });
  const [scrollToRestore, setScrollToRestore] = useState<number | null>(null);
  const [newThreadIds, setNewThreadIds] = useState<Set<string>>(new Set());
  const [selectedThreadIndex, setSelectedThreadIndex] = useState<number>(-1);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [multiSelectMode, setMultiSelectMode] = useState(false);
  
  // Use global context for filters (useGlobalContext = true)
  const { filters, updateFilter, resetFilters } = useEmailFilters(true);
  
  // Debounce search to avoid triggering fetch on every keystroke
  const debouncedSearch = useDebouncedValue(filters.search, 500);

  // Get user's email account IDs for filtering
  const { accountIds: userAccountIds, hasAccounts } = useUserEmailAccountIds();

  const ITEMS_PER_PAGE = 20;
  
  // Virtualization ref
  const parentRef = useRef<HTMLDivElement>(null);
  
  // Batch enriched data loading
  const { data: enrichedData } = useThreadsEnrichedData(threads);

  // Actions hook (handlers + optimistic helpers) — extrait dans useEmailInboxActionHandlers (session 91)
  const { actionHandlers, optimisticUpdateThread, optimisticRemoveThread } =
    useEmailInboxActionHandlers({ setThreads, setSelectedThreads });
  void optimisticUpdateThread;
  void optimisticRemoveThread;

  // Error handling
  const { handleError } = useErrorHandler();

  // Detect mobile/desktop changes
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Navigation clavier
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignorer si on est dans un input/textarea
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      switch(e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedThreadIndex(prev => Math.min(prev + 1, threads.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedThreadIndex(prev => Math.max(prev - 1, 0));
          break;
        case 'Enter':
          if (selectedThreadIndex >= 0 && threads[selectedThreadIndex]) {
            onThreadSelect(threads[selectedThreadIndex].id, threads[selectedThreadIndex].subject);
          }
          break;
        case 'c':
          if (!e.ctrlKey && !e.metaKey && onComposeNew) {
            e.preventDefault();
            onComposeNew();
          }
          break;
        case 'e':
        case 'a':
          if (selectedThreadIndex >= 0 && threads[selectedThreadIndex]) {
            e.preventDefault();
            handleArchiveThread(threads[selectedThreadIndex].id);
          }
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [selectedThreadIndex, threads, onThreadSelect, onComposeNew]);

  // Persist sortOrder preference
  useEffect(() => {
    localStorage.setItem('email-sort-order', sortOrder);
  }, [sortOrder]);

  // Utility function to get the scroll container
  const getScrollContainer = (): HTMLElement => {
    // 1. Chercher le conteneur marqué explicitement
    const markedContainer = document.querySelector('[data-email-scroll-container]') as HTMLElement;
    if (markedContainer) return markedContainer;
    
    // 2. Fallback sur le scroll de la page
    return document.documentElement;
  };

  // Keep threadsRef in sync with threads state (avoids dependency loop)
  useEffect(() => {
    threadsRef.current = threads;
  }, [threads]);

  // Keep pageRef in sync
  useEffect(() => { pageRef.current = page; }, [page]);

  // Declare fetchThreads with useCallback early so it can be used in hooks
  // mode: 'reset' = full reload, 'incremental' = only new threads, 'page' = next page
  const fetchThreads = useCallback(async (resetOrMode: boolean | 'incremental' = false) => {
    const mode = resetOrMode === 'incremental' ? 'incremental' : (resetOrMode === true ? 'reset' : 'page');
    const reset = mode === 'reset';
    // Concurrency guard: prevent multiple simultaneous fetches
    if (isFetchingRef.current) {
      debug.log('⏭️ Skipping fetch (already in progress)');
      return;
    }
    isFetchingRef.current = true;

    // Save scroll position before fetch (if not reset)
    const scrollContainer = getScrollContainer();
    const scrollPosition = reset ? 0 : scrollContainer?.scrollTop || 0;

    // Store scroll position to restore with useLayoutEffect
    if (!reset && scrollPosition > 0) {
      setScrollToRestore(scrollPosition);
    }

    if (mode !== 'incremental') setLoading(true);
    const currentPage = mode === 'reset' || mode === 'incremental' ? 1 : pageRef.current;
    const from = mode === 'incremental' ? 0 : (currentPage - 1) * ITEMS_PER_PAGE;
    const to = mode === 'incremental' ? ITEMS_PER_PAGE - 1 : from + ITEMS_PER_PAGE - 1;

    try {
      let query = supabase
        .from("email_threads")
        .select(EMAIL_THREAD_SELECT)
        .eq('is_archived', false)
        .eq('is_spam', false);

      // Trash mailbox: show deleted threads. Other mailboxes: hide deleted.
      if (filters.mailbox === 'trash') {
        query = query.eq('is_deleted', true);
      } else {
        query = query.eq('is_deleted', false);
      }

      // When viewing entity-scoped emails (établissement/groupe/partenaire),
      // show threads from ALL user accounts for a 360° view.
      // Otherwise, restrict to the current user's accounts.
      const isEntityScoped = filters.etablissementId || filters.groupeId || filters.partenaireId;
      if (isEntityScoped) {
        // No account filter — cross-user view for this entity
      } else if (accountId && accountId !== 'all') {
        query = query.eq('user_email_account_id', accountId);
      } else if (userAccountIds.length > 0) {
        query = query.in('user_email_account_id', userAccountIds);
      } else {
        // Accounts not loaded yet — don't query without filter
        isFetchingRef.current = false;
        setLoading(false);
        return;
      }

      // For incremental mode, only fetch threads newer than our newest
      if (mode === 'incremental' && threadsRef.current.length > 0) {
        const newestDate = threadsRef.current[0]?.last_message_date;
        if (newestDate) {
          query = query.gt("last_message_date", newestDate);
        }
      }

      // Body search RPC — launched in parallel, awaited later (non-blocking)
      let bodySearchPromise: Promise<string[] | null> | null = null;
      if (debouncedSearch) {
        bodySearchPromise = (async () => {
          try {
            const { data } = await supabase
              .rpc('search_email_threads_body', { search_term: debouncedSearch });
            return data?.map((r: { thread_id: string }) => r.thread_id) || null;
          } catch (err) {
            debug.warn('[EmailInbox] Body search RPC failed:', err);
            return null;
          }
        })();
      }

      // Apply search + filters + entity scoping (centralized)
      query = applyThreadFilters(query, { search: debouncedSearch, filters });

      // Limit to last 15 days unless actively searching or doing incremental
      if (!debouncedSearch && mode !== 'incremental') {
        const fifteenDaysAgo = new Date();
        fifteenDaysAgo.setDate(fifteenDaysAgo.getDate() - 15);
        const cutoff = fifteenDaysAgo.toISOString();
        query = query.or(`last_message_date.gte.${cutoff},updated_at.gte.${cutoff}`);
      }

      query = query
        .order("last_message_date", { ascending: sortOrder === 'asc' })
        .range(from, to);

      const { data } = await query;

      if (mode === 'reset') {
        // Identify new threads when refreshing — use ref to avoid dependency on threads
        const oldIds = new Set(threadsRef.current.map(t => t.id));
        const newIds = new Set((data || []).filter(t => !oldIds.has(t.id)).map(t => t.id));
        setNewThreadIds(newIds);
        setThreads(data || []);
        setPage(1);
      } else if (mode === 'incremental') {
        // Merge new threads into existing list without replacing
        if (data && data.length > 0) {
          setThreads(prev => {
            const map = new Map(prev.map(t => [t.id, t]));
            for (const t of data) map.set(t.id, t);
            const sorted = Array.from(map.values()).sort((a, b) =>
              sortOrder === 'asc'
                ? new Date(a.last_message_date).getTime() - new Date(b.last_message_date).getTime()
                : new Date(b.last_message_date).getTime() - new Date(a.last_message_date).getTime()
            );
            return sorted;
          });
          // Mark new threads for animation
          const oldIds = new Set(threadsRef.current.map(t => t.id));
          const newIds = new Set(data.filter(t => !oldIds.has(t.id)).map(t => t.id));
          if (newIds.size > 0) setNewThreadIds(newIds);
          debug.log(`📬 Incremental refresh: merged ${data.length} new/updated threads`);
        } else {
          debug.log('📭 Incremental refresh: no new threads');
        }
      } else {
        // Deduplicate threads using Map to avoid duplicate keys
        setThreads(prev => {
          const map = new Map(prev.map(t => [t.id, t]));
          for (const t of (data || [])) {
            map.set(t.id, t);
          }
          return Array.from(map.values());
        });
      }

      // hasMore: si on reçoit autant de résultats que la page, il y en a probablement plus
      if (mode !== 'incremental') {
        setHasMore((data?.length || 0) >= ITEMS_PER_PAGE && currentPage < MAX_PAGES);
      }
      // Reset error counter on success
      errorCountRef.current = 0;
      
      // Body search: merge additional results asynchronously (non-blocking)
      if (bodySearchPromise) {
        const existingIds = new Set((data || []).map(t => t.id));
        bodySearchPromise.then(async (bodyThreadIds) => {
          if (!bodyThreadIds || bodyThreadIds.length === 0) return;
          // Filter to only IDs not already in results
          const missingIds = bodyThreadIds.filter(id => !existingIds.has(id));
          if (missingIds.length === 0) return;
          
          // Fetch the missing threads
          const { data: extraThreads } = await supabase
            .from("email_threads")
            .select(EMAIL_THREAD_SELECT)
            .in('id', missingIds.slice(0, 50))
            .eq('is_archived', false)
            .eq('is_spam', false)
            .eq('is_deleted', false)
            .order("last_message_date", { ascending: false });
          
          if (extraThreads && extraThreads.length > 0) {
            setThreads(prev => {
              const map = new Map(prev.map(t => [t.id, t]));
              for (const t of extraThreads) map.set(t.id, t);
              return Array.from(map.values()).sort((a, b) => 
                new Date(b.last_message_date).getTime() - new Date(a.last_message_date).getTime()
              );
            });
          }
        });
      }
    } catch (error) {
      handleError(error, 'Chargement des emails');
      errorCountRef.current++;
      if (errorCountRef.current >= 3) {
        debug.warn('[EmailInbox] Too many consecutive errors, stopping auto-refetch');
      }
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
    }
  }, [debouncedSearch, filters.category, filters.priority, filters.unreadOnly, filters.unprocessedOnly, filters.mailbox, filters.etablissementId, filters.groupeId, filters.partenaireId, sortOrder, handleError, ITEMS_PER_PAGE, accountId, userAccountIds]);

  // Centralized refresh management
  const { triggerRefresh } = useEmailRefresh(fetchThreads);
  
  const lastToastTimeRef = useRef(Date.now());
  
  const handleSyncComplete = useCallback(() => {
    triggerRefresh('sync-complete');
    
    // Throttle toast to max once every 5 minutes
    const now = Date.now();
    if (now - lastToastTimeRef.current > 300000) {
      toast.success('Liste des emails mise à jour');
      lastToastTimeRef.current = now;
    }
  }, [triggerRefresh]);
  
  // Polling fallback — last-resort safety net (5 min) in case realtime misses events
  useEffect(() => {
    const POLL_INTERVAL = 300000; // 5 min (was 3 min) — realtime + visibility refresh handle freshness
    const interval = setInterval(() => {
      if (
        document.visibilityState === 'visible' &&
        errorCountRef.current < 3 &&
        safeStorage.getItem('email-compose-dirty') !== '1'
      ) {
        triggerRefresh('polling-fallback');
      }
    }, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [triggerRefresh]);

  // Realtime email updates are handled by EmailListPanel (child) — no duplicate listener here

  // Get queryClient for invalidating enriched data cache
  const queryClient = useQueryClient();

  // Listen for manual thread updates (e.g., after assigning interlocutor or sending reply)
  // Only invalidate enriched data cache — do NOT re-fetch threads (handled by useRealtimeEmailCompat)
  useEffect(() => {
    const handleThreadUpdated = () => {
      debug.log('🔄 Thread updated event received, invalidating enriched data cache only');
      queryClient.invalidateQueries({ queryKey: ['threads-enriched-data'] });
    };
    
    window.addEventListener('email-thread-updated', handleThreadUpdated);
    return () => window.removeEventListener('email-thread-updated', handleThreadUpdated);
  }, [queryClient]);

  // Infinite scroll with Intersection Observer
  const { ref, inView } = useInView({
    threshold: 0,
    triggerOnce: false,
    rootMargin: '100px', // Trigger loading 100px before the end
  });

  useEffect(() => {
    // Wait for user account IDs to be loaded before fetching
    if (!accountId && userAccountIds.length === 0) return;
    fetchThreads(true);
  }, [debouncedSearch, filters.category, filters.priority, filters.unreadOnly, filters.unprocessedOnly, filters.etablissementId, filters.groupeId, filters.partenaireId, sortOrder, accountId, userAccountIds]);

  // Auto-load more when sentinel becomes visible - increment page only with throttle
  useEffect(() => {
    const now = Date.now();
    if (inView && hasMore && !loading && !isSyncing && !isFetchingRef.current) {
      if (now - lastLoadRef.current > MIN_LOAD_INTERVAL) {
        debug.log('📥 Infinite scroll triggered: incrementing page');
        lastLoadRef.current = now;
        setPage(prev => prev + 1);
      }
    }
  }, [inView, hasMore, loading, isSyncing]);

  // Fetch when page changes (except for page 1 which is handled by filter changes)
  useEffect(() => {
    if (page > 1) {
      debug.log('📥 Loading page:', page);
      fetchThreads(false);
    }
  }, [page]);

  // Restore scroll position after threads update
  useLayoutEffect(() => {
    if (scrollToRestore !== null && !loading) {
      const scrollContainer = getScrollContainer();
      
      // Attendre le prochain frame pour s'assurer que le DOM est à jour
      requestAnimationFrame(() => {
        debug.log('🔄 Restoring scroll to:', scrollToRestore);
        scrollContainer.scrollTop = scrollToRestore;
        setScrollToRestore(null);
      });
    }
  }, [threads, scrollToRestore, loading]);

  const loadMore = () => {
    setPage(prev => prev + 1);
    fetchThreads(false);
  };

  const autoClassifyByDomain = async () => {
    setAutoClassifying(true);
    try {
      const data = await invokeEdge<any>("auto-match-emails", { limit: 100 });
    const error = null;

      if (error) throw error;

      toast.success(
        `Classification terminée : ${data?.matched || 0} emails classés, ${data?.suggestions_created || 0} suggestions créées`
      );

      await fetchThreads('incremental');
    } catch (error: unknown) {
      handleError(error, 'EmailInbox.autoClassifyByDomain');
    } finally {
      setAutoClassifying(false);
    }
  };

  const handleSelectAll = () => {
    if (selectedThreads.size === threads.length) {
      setSelectedThreads(new Set());
    } else {
      setSelectedThreads(new Set(threads.map(t => t.id)));
    }
  };

  const {
    handleArchiveSelected,
    handleArchiveThread,
    handleMarkAsSpamSelected,
    handleMarkAsReadSelected,
    handleMarkAsProcessedSelected,
    handleDeleteSelected,
    handleDeleteThread,
  } = useEmailBulkActionHandlers({
    user,
    queryClient,
    selectedThreads,
    setSelectedThreads,
    setThreads,
    optimisticRemoveThread,
    fetchThreads,
    handleError,
  });

  // Only show full-page skeleton on initial load (when no threads are loaded yet)
  if (loading && threads.length === 0) {
    return <EmailListSkeleton count={10} />;
  }

  const handleToggleReadThread = (threadId: string) => {
    const thread = threads.find(t => t.id === threadId);
    const isUnread = thread?.unread_count > 0;
    actionHandlers.onMarkAsRead(threadId, isUnread);
  };

  const handleEnterMultiSelect = (threadId: string) => {
    setMultiSelectMode(true);
    setSelectedThreads(new Set([threadId]));
    toast.info('Mode sélection activé - Tapez pour sélectionner d\'autres emails');
  };

  const handleRefreshPull = async () => {
    await fetchThreads('incremental');
    if (onSyncNow) {
      onSyncNow();
    }
  };

  const activeFiltersCount = 
    (filters.search ? 1 : 0) +
    (filters.category ? 1 : 0) +
    (filters.priority ? 1 : 0) +
    (filters.unreadOnly ? 1 : 0) +
    (filters.etablissementId ? 1 : 0);

  return (
    <div className="w-full max-w-full overflow-x-clip" data-email-scroll-container>
      {/* Live region for screen readers - Accessibility */}
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {loading && "Chargement des emails en cours"}
        {isSyncing && "Synchronisation des nouveaux emails en cours"}
        {!loading && !isSyncing && `${threads?.length || 0} email${threads.length > 1 ? 's' : ''} affiché${threads.length > 1 ? 's' : ''}`}
      </div>

      {/* Sync Progress Bar */}
      <EmailSyncProgressBar onSyncComplete={handleSyncComplete} />
      
      {/* Mobile Quick Filters */}
      {isMobile && (
        <MobileEmailQuickFilters
          unreadOnly={filters.unreadOnly}
          onUnreadOnlyChange={(value) => updateFilter('unreadOnly', value)}
          unprocessedOnly={filters.unprocessedOnly}
          onUnprocessedOnlyChange={(value) => updateFilter('unprocessedOnly', value)}
          category={filters.category}
          onCategoryChange={(value) => updateFilter('category', value)}
          mailbox={filters.mailbox}
          onMailboxChange={(value) => updateFilter('mailbox', value)}
          unreadCount={threads.filter(t => t.unread_count > 0).length}
          unprocessedCount={threads.filter(t => !t.is_processed).length}
          totalCount={threads.length}
          onOpenFilters={() => setFiltersOpen(true)}
          hasActiveFilters={activeFiltersCount > 0}
        />
      )}

      {/* Desktop Toolbar - Consolidated */}
      {!isMobile && (
        <EmailInboxToolbarConsolidated
          searchValue={filters.search}
          onSearchChange={(value) => updateFilter('search', value)}
          unreadOnly={filters.unreadOnly}
          onUnreadOnlyChange={(value) => updateFilter('unreadOnly', value)}
          category={filters.category}
          onCategoryChange={(value) => updateFilter('category', value)}
          sortOrder={sortOrder}
          onSortOrderChange={setSortOrder}
          totalCount={threads.length}
          unreadCount={threads.filter(t => t.unread_count > 0).length}
          onSync={onSyncNow}
          onCompose={onComposeNew}
          onResetFilters={resetFilters}
          isSyncing={isSyncing}
          hasActiveFilters={activeFiltersCount > 0}
          lastSyncAt={lastSyncAt}
          prefixSlot={toolbarPrefixSlot}
        />
      )}

      {/* Bulk Actions Bar - Sticky Bottom */}
      <BulkActionsBar
        selectedCount={selectedThreads.size}
        onMarkAsRead={handleMarkAsReadSelected}
        onMarkAsProcessed={handleMarkAsProcessedSelected}
        onArchive={handleArchiveSelected}
        onMarkAsSpam={handleMarkAsSpamSelected}
        onDelete={handleDeleteSelected}
        onClear={() => setSelectedThreads(new Set())}
      />

      {/* Email List */}
      {threads.length === 0 ? (
        <EmailListEmptyState 
          type={debouncedSearch || Object.values(filters).some(v => v && v !== 'all') ? 'no-results' : 'empty-inbox'}
          onReset={debouncedSearch || Object.values(filters).some(v => v && v !== 'all') ? resetFilters : undefined}
          onSync={onSyncNow}
        />
      ) : (
        <>
          <EmailInboxListView
            isMobile={isMobile}
            threads={threads}
            selectedThreads={selectedThreads}
            setSelectedThreads={setSelectedThreads}
            newThreadIds={newThreadIds}
            enrichedData={enrichedData}
            actionHandlers={actionHandlers}
            multiSelectMode={multiSelectMode}
            parentRef={parentRef}
            onThreadSelect={onThreadSelect}
            handleToggleReadThread={handleToggleReadThread}
            handleArchiveThread={handleArchiveThread}
            handleDeleteThread={handleDeleteThread}
            handleEnterMultiSelect={handleEnterMultiSelect}
            handleSelectAll={handleSelectAll}
            handleRefreshPull={handleRefreshPull}
            optimisticUpdateThread={optimisticUpdateThread}
          />
          
          {/* Infinite scroll sentinel */}
          {hasMore && (
            <div ref={ref} className="flex justify-center py-8">
              <InfiniteScrollLoader isVisible={hasMore} isLoading={loading && inView} />
            </div>
          )}

          {/* End of list message */}
          {!hasMore && threads.length > 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <Mail className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Vous avez atteint la fin de la liste</p>
              <p className="text-xs mt-1">
                {threads.length} email{threads.length > 1 ? 's' : ''} chargé{threads.length > 1 ? 's' : ''}
              </p>
            </div>
          )}

          {/* Back to top / FAB buttons */}
          {isMobile ? (
            /* Mobile FAB for new message */
            onComposeNew && (
              <Button
                onClick={onComposeNew}
                className="fixed bottom-24 right-4 h-14 w-14 rounded-full shadow-xl z-50 bg-primary hover:bg-primary/90"
                size="icon" aria-label="Ajouter">
                <Plus className="h-6 w-6" />
              </Button>
            )
          ) : (
            /* Desktop back to top button */
            threads.length > ITEMS_PER_PAGE && (
              <Button
                variant="outline"
                size="icon"
                className="fixed bottom-6 right-6 rounded-full shadow-lg z-50"
                onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} aria-label="Monter">
                <ArrowUp className="h-4 w-4" />
              </Button>
            )
          )}
        </>
      )}

      {/* Mobile Filters Drawer */}
      {isMobile && (
        <MobileDrawer
          open={filtersOpen}
          onOpenChange={setFiltersOpen}
          title="Filtres"
        >
          <MobileEmailFilters
            filters={filters}
            onChange={updateFilter}
            onReset={resetFilters}
            onClose={() => setFiltersOpen(false)}
          />
        </MobileDrawer>
      )}
    </div>
  );
}