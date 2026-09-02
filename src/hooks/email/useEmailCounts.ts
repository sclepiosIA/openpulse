import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { debug } from '@/lib/debug';
import { useUserEmailAccountIds } from '../shared/useUserEmailAccountIds';

interface EmailCounts {
  unreadCount: number;
  unprocessedCount: number;
}

/**
 * Hook unifié pour récupérer les compteurs d'emails non lus et non traités
 * Remplace useEmailUnreadCount + useEmailUnprocessedCount en une seule requête
 * Aligné avec le filtre inbox (last_message_date OR updated_at >= 15j)
 */
export function useEmailCounts(): EmailCounts {
  const { accountIds, hasAccounts } = useUserEmailAccountIds();
  const queryClient = useQueryClient();

  // Invalider sur événement realtime (debounce 3s)
  useEffect(() => {
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const handler = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['email-counts'] });
      }, 3000);
    };
    window.addEventListener('email-realtime-update', handler);
    return () => {
      window.removeEventListener('email-realtime-update', handler);
      if (debounceTimer) clearTimeout(debounceTimer);
    };
  }, [queryClient]);

  const { data } = useQuery({
    queryKey: ['email-counts', accountIds],
    queryFn: async (): Promise<EmailCounts> => {
      if (!accountIds || accountIds.length === 0) {
        return { unreadCount: 0, unprocessedCount: 0 };
      }

      // Limit counts to last 15 days for performance
      const fifteenDaysAgo = new Date();
      fifteenDaysAgo.setDate(fifteenDaysAgo.getDate() - 15);
      const cutoff = fifteenDaysAgo.toISOString();

      // Execute both counts in parallel — aligned with inbox filter (last_message_date OR updated_at)
      const [unreadResult, unprocessedResult] = await Promise.all([
        supabase
          .from('email_threads')
          .select('id', { count: 'exact', head: true })
          .gt('unread_count', 0)
          .eq('is_archived', false)
          .eq('is_deleted', false)
          .eq('is_spam', false)
          .or(`last_message_date.gte.${cutoff},updated_at.gte.${cutoff}`)
          .in('user_email_account_id', accountIds),
        supabase
          .from('email_threads')
          .select('id', { count: 'exact', head: true })
          .or('is_processed.eq.false,is_processed.is.null')
          .eq('is_archived', false)
          .eq('is_deleted', false)
          .eq('is_spam', false)
          .or(`last_message_date.gte.${cutoff},updated_at.gte.${cutoff}`)
          .in('user_email_account_id', accountIds),
      ]);

      if (unreadResult.error) {
        debug.error('[useEmailCounts] Unread error:', unreadResult.error);
      }
      if (unprocessedResult.error) {
        debug.error('[useEmailCounts] Unprocessed error:', unprocessedResult.error);
      }

      return {
        unreadCount: unreadResult.count || 0,
        unprocessedCount: unprocessedResult.count || 0,
      };
    },
    enabled: hasAccounts,
    staleTime: 120 * 1000, // 2 minutes
    refetchInterval: 300 * 1000, // 5 minutes — realtime events handle freshness
    retry: 2,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 30000),
  });

  return data || { unreadCount: 0, unprocessedCount: 0 };
}
