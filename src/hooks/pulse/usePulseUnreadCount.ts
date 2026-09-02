import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentProfile } from '@/hooks/profile/useProfiles';
import { useCallback, useRef } from 'react';
import { queryPresets } from '@/lib/queryPresets';
import { debug } from '@/lib/debug';

export const pulseUnreadKeys = {
  total: ['pulse-unread-total'] as const,
  byConversation: (convId: string) => ['pulse-unread', convId] as const,
};

interface UnreadCount {
  total: number;
  byConversation: Record<string, number>;
}

async function fetchUnreadCounts(profileId: string): Promise<UnreadCount> {
  try {
    const { data, error } = await supabase
      .rpc('count_pulse_unread', { p_user_id: profileId });

    if (error) {
      if (error.code !== 'PGRST116') {
        debug.warn('[Pulse] Unread count fetch failed:', error.message);
      }
      return { total: 0, byConversation: {} };
    }

    const byConversation: Record<string, number> = {};
    let total = 0;

    (data || []).forEach((row: { conversation_id: string; unread_count: number }) => {
      byConversation[row.conversation_id] = row.unread_count;
      total += row.unread_count;
    });

    return { total, byConversation };
  } catch (err) {
    debug.warn('[Pulse] Network error fetching unread:', err);
    return { total: 0, byConversation: {} };
  }
}

export function usePulseUnreadCount() {
  const { data: currentProfile, isLoading: isLoadingProfile } = useCurrentProfile();
  const profileId = currentProfile?.id;
  const queryClient = useQueryClient();
  
  const isMountedRef = useRef(true);

  const invalidate = useCallback(() => {
    if (isMountedRef.current && profileId) {
      queryClient.invalidateQueries({ queryKey: pulseUnreadKeys.total });
    }
  }, [queryClient, profileId]);

  const query = useQuery({
    queryKey: pulseUnreadKeys.total,
    queryFn: () => fetchUnreadCounts(profileId!),
    enabled: !!profileId && !isLoadingProfile,
    ...queryPresets.frequent,
    refetchInterval: 180 * 1000, // 3 min — realtime handles freshness
    retry: false,
    placeholderData: (previousData) => previousData,
    refetchOnWindowFocus: false,
  });

  return {
    ...query,
    invalidate,
  };
}

// Hook simplifié pour juste le total
export function usePulseTotalUnread(): number {
  const { data } = usePulseUnreadCount();
  return data?.total || 0;
}
