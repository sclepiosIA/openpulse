import { useQuery } from '@tanstack/react-query';
import { socialClient } from '@/lib/supabaseSocial';
import type { SocialConnection } from '@/types/social';

export function useSocialConnections(brandId?: string) {
  return useQuery({
    queryKey: ['social', 'connections', brandId ?? 'all'],
    queryFn: async (): Promise<SocialConnection[]> => {
      let q = socialClient.from('social_connections').select('*');
      if (brandId) q = q.eq('brand_id', brandId);
      const { data, error } = await q.order('platform');
      if (error) throw error;
      return (data || []) as SocialConnection[];
    },
    staleTime: 60 * 1000,
  });
}
