import { useQuery } from '@tanstack/react-query';
import { socialClient } from '@/lib/supabaseSocial';

export interface SocialCommentRow {
  id: string;
  post_id: string;
  brand_id: string;
  platform: 'facebook' | 'instagram' | 'linkedin' | 'tiktok';
  external_id: string;
  parent_external_id: string | null;
  author_name: string | null;
  author_id: string | null;
  message: string | null;
  created_time: string | null;
  likes_count: number;
  is_hidden: boolean;
  is_handled: boolean;
  handled_at: string | null;
  post?: {
    id: string;
    permalink: string | null;
    message: string | null;
  };
}

export function useSocialComments(brandId?: string, handled: 'pending' | 'all' = 'pending') {
  return useQuery({
    queryKey: ['social', 'comments', brandId ?? 'all', handled],
    queryFn: async (): Promise<SocialCommentRow[]> => {
      let q = socialClient
        .from('social_comments')
        .select('id, post_id, brand_id, platform, external_id, parent_external_id, author_name, author_id, message, created_time, likes_count, is_hidden, is_handled, handled_at, post:social_posts!social_comments_post_id_fkey(id, permalink, message)')
        .order('created_time', { ascending: false, nullsFirst: false })
        .limit(200);
      if (brandId) q = q.eq('brand_id', brandId);
      if (handled === 'pending') q = q.eq('is_handled', false);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as SocialCommentRow[];
    },
    staleTime: 60_000,
  });
}
