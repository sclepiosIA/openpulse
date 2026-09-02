import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Chantier #4 (audit 2026-06-02) — liste simplifiée des établissements
 * pour dropdowns/filtres (id + nom uniquement).
 */
export function useEtablissementsListSimple() {
  return useQuery({
    queryKey: ['etablissements', 'simple-list'],
    queryFn: async (): Promise<Array<{ id: string; nom: string }>> => {
      const { data } = await supabase
        .from('etablissements')
        .select('id, nom')
        .order('nom');
      return (data ?? []) as Array<{ id: string; nom: string }>;
    },
    staleTime: 5 * 60_000,
  });
}
