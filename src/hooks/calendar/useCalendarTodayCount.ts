import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { endOfDay } from 'date-fns';
import { debug } from '@/lib/debug';

/**
 * Hook pour compter les événements du calendrier du jour
 * Retourne le nombre d'événements à venir aujourd'hui (non passés)
 */
export function useCalendarTodayCount(): number {
  const { user } = useAuth();
  
  const { data: count = 0 } = useQuery({
    queryKey: ['calendar-today-count', user?.id],
    queryFn: async () => {
      if (!user?.id) return 0;
      
      const now = new Date();
      const todayEnd = endOfDay(now);
      
      // Compter les événements du jour qui ne sont pas encore passés
      const { count, error } = await supabase
        .from('calendar_events')
        .select('id, calendars!inner(owner_id)', { count: 'exact', head: true })
        .eq('calendars.owner_id', user.id)
        .gte('end_time', now.toISOString()) // Pas encore terminés
        .lte('start_time', todayEnd.toISOString()) // Commencent aujourd'hui
        .eq('status', 'confirmed');
      
      if (error) {
        debug.error('[CalendarTodayCount] Error:', error);
        return 0;
      }
      
      return count || 0;
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: 5 * 60 * 1000, // Rafraîchir toutes les 5 minutes
  });
  
  return count;
}
