import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Chantier #4 (audit 2026-06-02) — extraction du fetch préview établissement
 * utilisé par EmailEstablishmentHoverCard.
 */
export function useEmailEstablishmentPreview(etablissementId: string | undefined) {
  return useQuery({
    queryKey: ['etablissement-details', etablissementId],
    queryFn: async () => {
      const { data } = await supabase
        .from('etablissements')
        .select(`
          nom,
          ville,
          statut,
          progression,
          relationship_status,
          engagement_score,
          taches!inner(
            id,
            titre,
            echeance,
            statut,
            priorite
          )
        `)
        .eq('id', etablissementId!)
        .eq('taches.statut', 'A faire')
        .order('echeance', { ascending: true, foreignTable: 'taches' })
        .limit(1, { foreignTable: 'taches' })
        .maybeSingle();
      return data;
    },
    enabled: !!etablissementId,
    staleTime: 60_000,
  });
}
