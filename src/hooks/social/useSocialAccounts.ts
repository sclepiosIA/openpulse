import { useQuery } from '@tanstack/react-query';
import { socialClient } from '@/lib/supabaseSocial';
import type { SocialPlatform } from '@/types/social';

export interface SocialAccount {
  id: string;
  connection_id: string;
  brand_id: string;
  platform: SocialPlatform;
  external_id: string;
  display_name: string;
  username: string | null;
  avatar_url: string | null;
  profile_url: string | null;
  account_type: string | null;
  followers_count: number;
  is_active: boolean;
}

export function useSocialAccounts(brandId?: string) {
  return useQuery({
    queryKey: ['social', 'accounts', brandId ?? 'all'],
    queryFn: async (): Promise<SocialAccount[]> => {
      let q = socialClient.from('social_accounts').select('*').eq('is_active', true);
      if (brandId) q = q.eq('brand_id', brandId);
      const { data, error } = await q.order('display_name');
      if (error) throw error;
      return (data || []) as SocialAccount[];
    },
    staleTime: 60_000,
  });
}
