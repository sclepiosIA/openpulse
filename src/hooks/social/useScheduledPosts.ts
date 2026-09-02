import { useQuery } from '@tanstack/react-query';
import { socialClient } from '@/lib/supabaseSocial';
import type { SocialPostStatus } from '@/types/social';

export interface ScheduledPost {
  id: string;
  brand_id: string;
  created_by: string;
  title: string | null;
  message: string;
  media_paths: string[];
  target_account_ids: string[];
  scheduled_at: string | null;
  status: SocialPostStatus;
  attempt_count: number;
  error_message: string | null;
  created_at: string;
}

export function useScheduledPosts(brandId?: string) {
  return useQuery({
    queryKey: ['social', 'scheduled', brandId ?? 'all'],
    queryFn: async (): Promise<ScheduledPost[]> => {
      let q = socialClient.from('social_scheduled_posts').select('*');
      if (brandId) q = q.eq('brand_id', brandId);
      const { data, error } = await q.order('scheduled_at', { ascending: true, nullsFirst: false }).limit(100);
      if (error) throw error;
      return (data || []) as ScheduledPost[];
    },
    staleTime: 30_000,
  });
}
