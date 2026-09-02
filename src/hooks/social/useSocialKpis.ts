import { useMemo } from 'react';
import { useSocialPosts, type SocialPost } from './useSocialPosts';
import { useSocialAccounts } from './useSocialAccounts';

export interface SocialKpis {
  postsCount: number;
  totalEngagement: number;
  totalReach: number;
  totalFollowers: number;
  avgEngagementPerPost: number;
  byPlatform: Record<string, { posts: number; engagement: number }>;
  recent: SocialPost[];
}

export function useSocialKpis(brandId?: string) {
  const postsQ = useSocialPosts({ brandId, limit: 100 });
  const accountsQ = useSocialAccounts(brandId);

  const kpis = useMemo<SocialKpis>(() => {
    const posts = postsQ.data ?? [];
    const accounts = accountsQ.data ?? [];
    let totalEngagement = 0;
    let totalReach = 0;
    const byPlatform: Record<string, { posts: number; engagement: number }> = {};
    for (const p of posts) {
      const eng = (p.likes_count || 0) + (p.comments_count || 0) + (p.shares_count || 0);
      totalEngagement += eng;
      totalReach += p.views_count || 0;
      const k = p.platform;
      byPlatform[k] = byPlatform[k] || { posts: 0, engagement: 0 };
      byPlatform[k].posts += 1;
      byPlatform[k].engagement += eng;
    }
    const totalFollowers = accounts.reduce((s, a) => s + (a.followers_count || 0), 0);
    return {
      postsCount: posts.length,
      totalEngagement,
      totalReach,
      totalFollowers,
      avgEngagementPerPost: posts.length ? Math.round(totalEngagement / posts.length) : 0,
      byPlatform,
      recent: posts.slice(0, 10),
    };
  }, [postsQ.data, accountsQ.data]);

  return {
    kpis,
    isLoading: postsQ.isLoading || accountsQ.isLoading,
    isError: postsQ.isError || accountsQ.isError,
    error: postsQ.error || accountsQ.error,
    refetch: () => {
      postsQ.refetch();
      accountsQ.refetch();
    },
  };
}
