import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ClientEtablissementOption {
  id: string;
  nom: string;
  statut: string;
}

/**
 * Liste les établissements assignables à une user story R&D :
 * tous les statuts en phase déploiement ou production
 * (Contractuel, Contractualisation, Conformité, Déploiement, Formation, Go-Live, Production).
 * Exclut les prospects et les statuts hors-pipeline.
 */
const ALLOWED_STATUTS = [
  'Contractuel',
  'Contractualisation',
  'Vendu',
  'Conformité',
  'Déploiement',
  'Formation',
  'Go-Live',
  'Production',
] as const;

export function useClientEtablissementsForRD() {
  return useQuery({
    queryKey: ['rd-client-etablissements'],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('etablissements')
        .select('id, nom, statut')
        .in('statut', ALLOWED_STATUTS)
        .order('nom', { ascending: true })
        .limit(500);

      if (error) throw error;
      return (data || []) as ClientEtablissementOption[];
    },
  });
}
