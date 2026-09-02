import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { queryPresets } from '@/lib/queryPresets';
import { debug } from '@/lib/debug';
import { safeRealtimeChannel } from '@/lib/realtimeMonitor';

/**
 * Badge R&D — tâches assignées à l'utilisateur courant non terminées
 * (statut différent de 'termine' / 'done').
 */
export function useRDOpenTasksCount(): number {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const userId = user?.id;

  const { data } = useQuery({
    queryKey: ['rd-open-tasks-count', userId],
    queryFn: async () => {
      if (!userId) return 0;
      const { count, error } = await supabase
        .from('rd_tasks')
        .select('id', { count: 'exact', head: true })
        .eq('responsable_id', userId)
        .not('statut', 'in', '(termine,done,terminee,fini)');
      if (error) {
        debug.error('[useRDOpenTasksCount]', error);
        return 0;
      }
      return count || 0;
    },
    enabled: !!userId,
    ...queryPresets.standard,
    refetchInterval: 180 * 1000,
  });

  useEffect(() => {
    if (!userId) return;
    const handle = safeRealtimeChannel(`rd-tasks-badge-${userId}`, (channel) =>
      channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'rd_tasks', filter: `responsable_id=eq.${userId}` },
        () => queryClient.invalidateQueries({ queryKey: ['rd-open-tasks-count', userId] }),
      ),
    );
    return () => handle.dispose();
  }, [userId, queryClient]);

  return data || 0;
}
