import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { queryPresets } from '@/lib/queryPresets';
import { debug } from '@/lib/debug';
import { safeRealtimeChannel } from '@/lib/realtimeMonitor';

/**
 * Badge "RDV en attente" — bookings status='pending' à venir,
 * dont l'hôte est l'utilisateur courant. Realtime sur INSERT/UPDATE bookings.
 */
export function usePendingBookingsCount(): number {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const userId = user?.id;

  const { data } = useQuery({
    queryKey: ['pending-bookings-count', userId],
    queryFn: async () => {
      if (!userId) return 0;
      const now = new Date().toISOString();
      const { count, error } = await supabase
        .from('bookings')
        .select('id', { count: 'exact', head: true })
        .eq('host_user_id', userId)
        .eq('status', 'pending')
        .gte('start_time', now);
      if (error) {
        debug.error('[usePendingBookingsCount]', error);
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
    const handle = safeRealtimeChannel(`pending-bookings-badge-${userId}`, (channel) =>
      channel
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'bookings', filter: `host_user_id=eq.${userId}` },
          (payload) => {
            queryClient.invalidateQueries({ queryKey: ['pending-bookings-count', userId] });
            const b = payload.new as { guest_name?: string; status?: string } | null;
            if (b?.status === 'pending') {
              toast.info('Nouveau RDV à confirmer', {
                description: b.guest_name || 'Demande de rendez-vous reçue',
              });
            }
          },
        )
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'bookings', filter: `host_user_id=eq.${userId}` },
          () => queryClient.invalidateQueries({ queryKey: ['pending-bookings-count', userId] }),
        ),
    );
    return () => handle.dispose();
  }, [userId, queryClient]);

  return data || 0;
}
