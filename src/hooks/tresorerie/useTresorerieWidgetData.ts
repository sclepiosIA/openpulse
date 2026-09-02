import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Chantier #4 (audit 2026-06-02) — hooks de lecture pour le widget RH→Trésorerie.
 */
export function useCurrentTresorerieSolde() {
  return useQuery({
    queryKey: ['tresorerie-solde-actuel'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tresorerie_solde')
        .select('id, date, solde_debut, solde_fin, total_recettes, total_depenses, created_at')
        .order('date', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useProchainePaie() {
  return useQuery({
    queryKey: ['prochaine-paie'],
    queryFn: async () => {
      const currentMonth = new Date().toISOString().slice(0, 7);
      const categorie = await supabase
        .from('tresorerie_categories')
        .select('id')
        .eq('code', 'DEP_SALAIRES_NETS')
        .maybeSingle();
      if (!categorie.data?.id) return null;

      const { data, error } = await supabase
        .from('tresorerie_depenses')
        .select('id, nom, montant, date_prevue, categorie_code, statut')
        .eq('categorie_id' as never, categorie.data.id)
        .gte('date_prevue', currentMonth)
        .order('date_prevue', { ascending: true })
        .limit(1)
        .maybeSingle();
      if (error) return null;
      return data;
    },
  });
}
