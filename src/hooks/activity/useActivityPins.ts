import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/shared/useAuth';
import type { ActivityPin } from '@/types/activity';

export function useActivityPins() {
  const qc = useQueryClient();
  const { user } = useAuth();

  const query = useQuery({
    queryKey: ['activity-pins', user?.id],
    enabled: !!user,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('activity_feed_pins')
        .select('*')
        .order('pinned_at', { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as ActivityPin[];
    },
  });

  const pinnedKeys = new Set((query.data ?? []).map((p) => p.activity_key));

  const toggle = useMutation({
    mutationFn: async ({ activityKey, currentlyPinned }: { activityKey: string; currentlyPinned: boolean }) => {
      if (!user) throw new Error('Not authenticated');
      if (currentlyPinned) {
        const { error } = await supabase
          .from('activity_feed_pins')
          .delete()
          .eq('user_id', user.id)
          .eq('activity_key', activityKey);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('activity_feed_pins')
          .insert({ user_id: user.id, activity_key: activityKey });
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['activity-pins'] }),
  });

  return {
    pins: query.data ?? [],
    pinnedKeys,
    isLoading: query.isLoading,
    togglePin: (activityKey: string, currentlyPinned: boolean) =>
      toggle.mutate({ activityKey, currentlyPinned }),
  };
}
