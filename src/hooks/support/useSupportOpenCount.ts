import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { queryPresets } from '@/lib/queryPresets';
import { debug } from '@/lib/debug';
import { safeRealtimeChannel } from '@/lib/realtimeMonitor';

/**
 * Compteur badge "tickets support ouverts" (nouveau / en_cours / en_attente_*).
 *
 * Résilience :
 *  - La query échoue silencieusement → renvoie 0 (pas de toast).
 *  - La souscription realtime échoue (CHANNEL_ERROR / TIMED_OUT / exception
 *    subscribe/remove) → on bascule en mode dégradé : badge forcé à 0, aucun
 *    toast utilisateur, log discret en console + report en base via
 *    `frontendErrorCapture` (cf. realtimeMonitor).
 *  - Aucune exception Realtime ne peut faire tomber l'UI shell
 *    (cf. audit run-1782663570).
 */
export function useSupportOpenCount(): number {
  const queryClient = useQueryClient();
  const [realtimeDegraded, setRealtimeDegraded] = useState(false);

  const { data } = useQuery({
    queryKey: ['support-open-count'],
    queryFn: async () => {
      try {
        const { count, error } = await supabase
          .from('support_tickets')
          .select('id', { count: 'exact', head: true })
          .in('statut', ['nouveau', 'en_cours', 'en_attente_client', 'en_attente_interne']);

        if (error) {
          debug.error('[useSupportOpenCount] Query error (silent fallback to 0):', error);
          return 0;
        }
        return count || 0;
      } catch (err) {
        debug.error('[useSupportOpenCount] Unexpected error (silent fallback to 0):', err);
        return 0;
      }
    },
    ...queryPresets.standard,
    refetchInterval: 120 * 1000,
  });

  useEffect(() => {
    const handle = safeRealtimeChannel(
      'support-tickets-badge',
      (channel) =>
        channel
          .on(
            'postgres_changes' as never,
            { event: 'INSERT', schema: 'public', table: 'support_tickets' },
            (payload: { new: { sujet?: string; priorite?: string } | null }) => {
              queryClient.invalidateQueries({ queryKey: ['support-open-count'] });
              queryClient.invalidateQueries({ queryKey: ['support-tickets'] });
              const t = payload.new;
              toast.info('Nouveau ticket support', {
                description: t?.sujet || 'Un nouveau ticket vient d\'être créé',
              });
            },
          )
          .on(
            'postgres_changes' as never,
            { event: 'UPDATE', schema: 'public', table: 'support_tickets' },
            () => {
              queryClient.invalidateQueries({ queryKey: ['support-open-count'] });
            },
          ),
      {
        onStatusError: (status) => {
          // Mode dégradé silencieux : badge à 0, aucun toast utilisateur.
          debug.warn('[useSupportOpenCount] Realtime degraded, badge silenced. Status:', status);
          setRealtimeDegraded(true);
        },
      },
    );

    return () => handle.dispose();
  }, [queryClient]);

  if (realtimeDegraded) return 0;
  return data || 0;
}
