import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseBrowser';
import { useAuth } from '@/components/AuthProvider';
import { PHASE_GROUPS, type PhaseKey } from '@/config/phases';

/**
 * Lightweight hook qui ne charge que la colonne `statut` de tous les
 * établissements pour calculer les compteurs par phase.
 *
 * Remplace `useAllEtablissements()` quand seul `countByPhase` est nécessaire
 * (ex: header /production, /deploiement) — évite de charger ~25 colonnes +
 * 2 requêtes d'enrichissement logos.
 */
export function usePhaseCounts() {
  const { loading, user } = useAuth();

  return useQuery({
    queryKey: ['phase-counts'],
    enabled: !loading && !!user,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<Record<PhaseKey, number>> => {
      // RPC server-side: GROUP BY statut (évite de charger jusqu'à 5000 lignes)
      const { data, error } = await (supabase as any).rpc('get_phase_counts');

      if (error) throw error;

      const counts: Record<PhaseKey, number> = {
        commercial: 0,
        deploiement: 0,
        production: 0,
      };

      const phaseByStatut = new Map<string, PhaseKey>();
      (Object.keys(PHASE_GROUPS) as PhaseKey[]).forEach((phase) => {
        for (const s of PHASE_GROUPS[phase].statuts) {
          phaseByStatut.set(s, phase);
        }
      });

      for (const row of (data || []) as Array<{ statut: string | null; count: number | string }>) {
        if (!row.statut) continue;
        const phase = phaseByStatut.get(row.statut);
        if (phase) counts[phase] += Number(row.count) || 0;
      }

      return counts;
    },
  });
}
