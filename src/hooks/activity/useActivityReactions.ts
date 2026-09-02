import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { safeRealtimeChannel } from '@/lib/realtimeMonitor';
import { useAuth } from '@/hooks/shared/useAuth';

export interface AggregatedReaction {
  emoji: string;
  count: number;
  reactedByMe: boolean;
}

export function useActivityReactions(activityKeys: string[]) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const sortedKeys = [...activityKeys].sort();

  const query = useQuery({
    queryKey: ['activity-reactions', sortedKeys],
    enabled: sortedKeys.length > 0,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('activity_feed_reactions')
        .select('activity_key,user_id,emoji')
        .in('activity_key', sortedKeys);
      if (error) throw error;
      const map: Record<string, AggregatedReaction[]> = {};
      ((data ?? []) as Array<{ activity_key: string; user_id: string; emoji: string }>).forEach((r) => {
        const list = map[r.activity_key] ||= [];
        const existing = list.find((x) => x.emoji === r.emoji);
        if (existing) {
          existing.count += 1;
          if (r.user_id === user?.id) existing.reactedByMe = true;
        } else {
          list.push({ emoji: r.emoji, count: 1, reactedByMe: r.user_id === user?.id });
        }
      });
      return map;
    },
  });

  // Realtime invalidation
  useEffect(() => {
    if (sortedKeys.length === 0) return;
    const handle = safeRealtimeChannel('activity-reactions-rt', (ch) =>
      ch.on('postgres_changes' as never, { event: '*', schema: 'public', table: 'activity_feed_reactions' } as never, (() => {
        qc.invalidateQueries({ queryKey: ['activity-reactions'] });
      }) as never)
    );
    return () => { handle.dispose(); };
  }, [qc, sortedKeys.length]);

  const toggle = useMutation({
    mutationFn: async ({ activityKey, emoji, currently }: { activityKey: string; emoji: string; currently: boolean }) => {
      if (!user) throw new Error('Not authenticated');
      if (currently) {
        const { error } = await supabase
          .from('activity_feed_reactions')
          .delete()
          .eq('activity_key', activityKey)
          .eq('user_id', user.id)
          .eq('emoji', emoji);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('activity_feed_reactions')
          .insert({ activity_key: activityKey, user_id: user.id, emoji });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['activity-reactions'] });
    },
  });

  return {
    reactionsByKey: query.data ?? {},
    isLoading: query.isLoading,
    toggle: (activityKey: string, emoji: string, currently: boolean) =>
      toggle.mutate({ activityKey, emoji, currently }),
  };
}
