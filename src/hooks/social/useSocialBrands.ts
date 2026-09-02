import { useQuery } from '@tanstack/react-query';
import { socialClient } from '@/lib/supabaseSocial';
import type { SocialBrand } from '@/types/social';

export function useSocialBrands() {
  return useQuery({
    queryKey: ['social', 'brands'],
    queryFn: async (): Promise<SocialBrand[]> => {
      const { data, error } = await socialClient
        .from('social_brands')
        .select('*')
        .order('name');
      if (error) throw error;
      return (data || []) as SocialBrand[];
    },
    staleTime: 5 * 60 * 1000,
  });
}
