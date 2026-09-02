import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { queryPresets } from '@/lib/queryPresets';
import { debug } from '@/lib/debug';
import { safeRealtimeChannel } from '@/lib/realtimeMonitor';

/**
 * Badge "appels manqués" — appels entrants manqués des 7 derniers jours
 * pour l'utilisateur courant. Realtime sur INSERT calls.
 */
export function useMissedCallsCount(): number {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const userId = user?.id;

  const { data } = useQuery({
    queryKey: ['missed-calls-count', userId],
    queryFn: async () => {
      if (!userId) return 0;
      const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const { count, error } = await supabase
        .from('calls')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('status', 'missed')
        .gte('started_at', since);
      if (error) {
        debug.error('[useMissedCallsCount]', error);
        return 0;
      }
      return count || 0;
    },
    enabled: !!userId,
    ...queryPresets.standard,
    refetchInterval: 120 * 1000,
  });

  useEffect(() => {
    if (!userId) return;
    const handle = safeRealtimeChannel(`missed-calls-badge-${userId}`, (channel) =>
      channel
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'calls', filter: `user_id=eq.${userId}` },
          (payload) => {
            const c = payload.new as { status?: string; from_name?: string; from_number?: string } | null;
            if (c?.status === 'missed') {
              queryClient.invalidateQueries({ queryKey: ['missed-calls-count', userId] });
              toast.info('Appel manqué', {
                description: c.from_name || c.from_number || 'Numéro inconnu',
              });
            }
          },
        )
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'calls', filter: `user_id=eq.${userId}` },
          () => queryClient.invalidateQueries({ queryKey: ['missed-calls-count', userId] }),
        ),
    );
    return () => handle.dispose();
  }, [userId, queryClient]);

  return data || 0;
}
