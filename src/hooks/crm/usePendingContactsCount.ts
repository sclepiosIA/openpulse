import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function usePendingContactsCount(partenaireId?: string) {
  return useQuery({
    queryKey: ['pending-contacts-count', partenaireId],
    queryFn: async () => {
      let query = supabase
        .from('pending_contacts')
        .select('partenaire_id', { count: 'exact', head: true })
        .eq('status', 'pending');

      if (partenaireId) {
        query = query.eq('partenaire_id', partenaireId);
      }

      const { count, error } = await query;

      if (error) throw error;
      return count || 0;
    },
    enabled: true,
  });
}

export function useAllPendingContactsCounts() {
  return useQuery({
    queryKey: ['all-pending-contacts-counts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pending_contacts')
        .select('partenaire_id')
        .eq('status', 'pending');

      if (error) throw error;

      // Group by partenaire_id and count
      const counts = (data || []).reduce((acc, item) => {
        if (item.partenaire_id) {
          acc[item.partenaire_id] = (acc[item.partenaire_id] || 0) + 1;
        }
        return acc;
      }, {} as Record<string, number>);

      return counts;
    },
  });
}
