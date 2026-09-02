import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentProfile } from '@/hooks/profile/useProfiles';
import { queryPresets } from '@/lib/queryPresets';
import { debug } from '@/lib/debug';

/**
 * Hook pour récupérer le nombre de todos non complétées
 * pour l'utilisateur courant
 */
export function useTodosUnreadCount(): number {
  const { data: profile } = useCurrentProfile();
  
  const { data } = useQuery({
    queryKey: ['todos-unread-count', profile?.id],
    queryFn: async () => {
      if (!profile?.id) return 0;
      
      const { count, error } = await supabase
        .from('personal_todos')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', profile.id)
        .eq('is_done', false);
      
      if (error) {
        debug.error('[useTodosUnreadCount] Error:', error);
        return 0;
      }
      
      return count || 0;
    },
    enabled: !!profile?.id,
    ...queryPresets.standard, // 2 min staleTime
    refetchInterval: 300 * 1000, // 5 min — lightweight badge counter
  });
  
  return data || 0;
}
