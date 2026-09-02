import { useQuery } from '@tanstack/react-query';
import { socialClient } from '@/lib/supabaseSocial';
import type { SocialPlatform } from '@/types/social';

export interface SocialPost {
  id: string;
  account_id: string;
  brand_id: string;
  platform: SocialPlatform;
  external_id: string;
  permalink: string | null;
  message: string | null;
  media_urls: string[];
  media_type: string | null;
  published_at: string | null;
  likes_count: number;
  comments_count: number;
  shares_count: number;
  views_count: number;
}

export function useSocialPosts(opts: { brandId?: string; limit?: number } = {}) {
  const { brandId, limit = 25 } = opts;
  return useQuery({
    queryKey: ['social', 'posts', brandId ?? 'all', limit],
    queryFn: async (): Promise<SocialPost[]> => {
      let q = socialClient.from('social_posts').select('*');
      if (brandId) q = q.eq('brand_id', brandId);
      const { data, error } = await q
        .order('published_at', { ascending: false, nullsFirst: false })
        .limit(limit);
      if (error) throw error;
      return (data || []) as SocialPost[];
    },
    staleTime: 60_000,
  });
}
