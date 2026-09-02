import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { safeRealtimeChannel } from '@/lib/realtimeMonitor';
import type { ActivityFeedFilters, ActivityFeedItem, ActivityFeedPage } from '@/types/activity';
import { debug } from '@/lib/debug';

interface UseGlobalActivityFeedOptions {
  filters?: ActivityFeedFilters;
  pageSize?: number;
  realtime?: boolean;
}

const REALTIME_TABLES = [
  'interactions',
  'taches',
  'calendar_events',
  'email_threads',
  'devis',
  'factures',
  'signature_requests',
  'workflow_runs',
];

export function useGlobalActivityFeed({
  filters = {},
  pageSize = 30,
  realtime = false,
}: UseGlobalActivityFeedOptions = {}) {
  const queryClient = useQueryClient();
  const queryKey = ['global-activity-feed', filters, pageSize];
  const [pendingNew, setPendingNew] = useState(0);

  const query = useInfiniteQuery<ActivityFeedPage>({
    queryKey,
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }) => {
      const { data, error } = await supabase.rpc('get_global_activity_feed', {
        p_limit: pageSize,
        p_cursor: (pageParam ?? undefined) as string | undefined,
        p_filters: JSON.parse(JSON.stringify(filters)),
      });
      if (error) {
        // Gracefully degrade on structural errors (missing table/RPC) — return empty page, no retry storm
        const pgError = error as { code?: string; message?: string };
        const code = pgError.code;
        const msg = pgError.message || '';
        if (code === '42P01' || code === '42883' || /does not exist/i.test(msg)) {
          if (import.meta.env.DEV) {
            // single quiet log instead of repeated error spam
             
            console.warn('[activity-feed] source unavailable, degrading silently:', code || msg);
          }
          return { items: [], nextCursor: null };
        }
        debug.error('get_global_activity_feed error', error);
        throw error;
      }
      const items = (data || []) as ActivityFeedItem[];
      const nextCursor = items.length === pageSize ? items[items.length - 1].occurred_at : null;
      return { items, nextCursor };
    },
    getNextPageParam: (last) => last.nextCursor,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    retry: (failureCount, error: unknown) => {
      const e = error as { code?: string; message?: string } | null;
      const code = e?.code;
      const msg = e?.message || '';
      if (code === '42P01' || code === '42883' || /does not exist/i.test(msg)) return false;
      return failureCount < 1;
    },
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!realtime) return;
    const bump = () => setPendingNew((n) => n + 1);
    const handle = safeRealtimeChannel('global-activity-feed-v2', (channel) => {
      REALTIME_TABLES.forEach((t) => {
        (channel as unknown as { on: (event: string, opts: unknown, cb: () => void) => void }).on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: t },
          bump,
        );
      });
      return channel;
    });
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      handle.dispose();
    };
  }, [realtime]);

  const refresh = () => {
    setPendingNew(0);
    queryClient.invalidateQueries({ queryKey: ['global-activity-feed'] });
    queryClient.invalidateQueries({ queryKey: ['activity-feed-stats'] });
  };

  const items = query.data?.pages.flatMap((p) => p.items) ?? [];
  return { ...query, items, pendingNew, refresh };
}
