import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { ActivityFeedFilters, ActivityFeedStats } from '@/types/activity';

export function useActivityFeedStats(filters: ActivityFeedFilters = {}) {
  return useQuery<ActivityFeedStats>({
    queryKey: ['activity-feed-stats', filters],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_activity_feed_stats', {
        p_filters: JSON.parse(JSON.stringify(filters)),
      });
      if (error) throw error;
      return (data || { today: 0, week: 0, month: 0, by_type: {}, by_user: [] }) as ActivityFeedStats;
    },
    staleTime: 60_000,
  });
}
