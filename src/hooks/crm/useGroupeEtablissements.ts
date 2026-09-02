import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { debug } from "@/lib/debug";

interface Tache {
  id: string;
  titre: string;
  statut: string;
  echeance: string | null;
  priorite: string;
  etablissement_id: string | null;
}

interface EtablissementGroupeRelation {
  etablissements: EtablissementWithTaches | null;
}

interface EtablissementWithTaches {
  id: string;
  nom: string;
  ville: string | null;
  statut: string | null;
  progression: number | null;
  engagement_score: number | null;
  taches?: Tache[];
}

/**
 * Hook pour récupérer tous les établissements d'un groupe avec leurs tâches
 */
export function useGroupeEtablissements(groupeId?: string | null) {
  return useQuery({
    queryKey: ['groupe-etablissements', groupeId],
    queryFn: async () => {
      if (!groupeId) return null;

      // Récupérer tous les établissements actifs du groupe
      const { data, error } = await supabase
        .from('etablissements_groupes')
        .select(`
          etablissements (
            id,
            nom,
            ville,
            statut,
            progression,
            engagement_score
          )
        `)
        .eq('groupe_id', groupeId)
        .is('date_sortie', null); // Uniquement les établissements actifs

      if (error) {
        debug.error('[useGroupeEtablissements] Error:', error);
        return null;
      }

      if (!data || data.length === 0) return null;

      // Extraire les IDs des établissements
      const etablissements = data
        .map((eg: EtablissementGroupeRelation) => eg.etablissements)
        .filter(Boolean) as EtablissementWithTaches[];

      const etablissementIds = etablissements.map(e => e.id);

      // Charger les tâches actives pour tous les établissements
      const { data: tachesData } = await supabase
        .from('taches')
        .select('id, titre, statut, echeance, priorite, etablissement_id')
        .in('etablissement_id', etablissementIds)
        .neq('statut', 'Terminé')
        .order('echeance', { ascending: true })
        .limit(200); // Safety limit - max 200 active tasks per group

      // Associer les tâches aux établissements
      const etablissementsWithTaches = etablissements.map(etab => ({
        ...etab,
        taches: (tachesData || []).filter(t => t.etablissement_id === etab.id)
      }));

      return etablissementsWithTaches;
    },
    enabled: !!groupeId,
    // Uses global staleTime from QueryClient (2 min)
  });
}
