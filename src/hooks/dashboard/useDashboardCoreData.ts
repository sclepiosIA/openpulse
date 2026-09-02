import { useQueries, keepPreviousData } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseBrowser';
import { useAuth } from '@/components/AuthProvider';
import { queryPresets } from '@/lib/queryPresets';
import type { TacheData } from '@/lib/validations';
import type { EtablissementWithGroupLogo } from '@/hooks/crm/useEtablissements';

/**
 * Colonnes minimales nécessaires pour le dashboard.
 * Réduit le payload de ~80% par rapport à select('*').
 */
const DASHBOARD_ETABLISSEMENTS_SELECT = `
  id, nom, ville, region, type, statut, progression,
  date_signature, date_previsionnelle_signature,
  commercial_id, csm_id, chef_projet_id,
  pallier_vise, pallier_realise, modele_statique_succes,
  nombre_passages_urgences_annuel, type_offre, tarifs_palliers,
  created_at, updated_at,
  last_email_received_at, last_email_sent_at
` as const;

/**
 * Batched hook for core dashboard data.
 * Combines multiple queries into a single React Query call to:
 * - Reduce initial request count
 * - Unify loading states
 * - Prevent request waterfalls
 * - Use placeholderData to avoid flash of loading state on navigation
 */
export function useDashboardCoreData() {
  const { loading: authLoading, user } = useAuth();
  const enabled = !authLoading && !!user;

  const results = useQueries({
    queries: [
      {
        queryKey: ['all-etablissements'],
        queryFn: async (): Promise<EtablissementWithGroupLogo[]> => {
          const { data, error } = await supabase
            .from('etablissements')
            .select(DASHBOARD_ETABLISSEMENTS_SELECT)
            .order('created_at', { ascending: false });
          
          if (error) throw error;
          return (data || []) as unknown as EtablissementWithGroupLogo[];
        },
        enabled,
        placeholderData: keepPreviousData,
        ...queryPresets.standard,
      },
      {
        queryKey: ['taches'],
        queryFn: async (): Promise<TacheData[]> => {
          const { data, error } = await supabase
            .from('taches')
            .select(`
              *,
              categories_taches (id, nom, couleur),
              etablissements (id, nom)
            `)
            .eq('archive', false)
            .order('created_at', { ascending: false })
            .limit(2000);
          
          if (error) throw error;
          return data as TacheData[];
        },
        enabled,
        placeholderData: keepPreviousData,
        ...queryPresets.standard,
      },
      {
        queryKey: ['last-email-by-etablissement-dashboard'],
        queryFn: async () => {
          const { data, error } = await supabase
            .from('email_threads')
            .select('etablissement_id, last_message_date')
            .not('etablissement_id', 'is', null)
            .eq('is_deleted', false)
            .order('last_message_date', { ascending: false });

          if (error) throw error;

          const map = new Map<string, string>();
          data?.forEach((row) => {
            const etabId = row.etablissement_id as string;
            if (etabId && !map.has(etabId)) {
              map.set(etabId, row.last_message_date);
            }
          });
          return map;
        },
        enabled,
        placeholderData: keepPreviousData,
        ...queryPresets.standard,
      },
      {
        queryKey: ['dashboard-overview'],
        queryFn: async () => {
          const { data, error } = await supabase.rpc('get_dashboard_overview');
          if (error) throw error;
          
          const result = Array.isArray(data) ? data[0] : data;
          return {
            total_etablissements: Number(result?.total_etablissements || 0),
            total_prospects: Number(result?.total_prospects || 0),
            total_pipeline: Number(result?.total_pipeline || 0),
            total_contractuel: Number(result?.total_contractuel || 0),
            total_production: Number(result?.total_production || 0),
            total_bloques: Number(result?.total_bloques || 0),
            valeur_bloquee: Number(result?.valeur_bloquee || 0),
            total_taches: Number(result?.total_taches || 0),
            valeur_totale: Number(result?.valeur_totale || 0),
            valeur_pipeline: Number(result?.valeur_pipeline || 0),
          };
        },
        enabled,
        placeholderData: keepPreviousData,
        staleTime: 5 * 60 * 1000,
        gcTime: 10 * 60 * 1000,
      },
    ],
  });

  const [etablissementsQuery, tachesQuery, lastEmailQuery, overviewQuery] = results;

  // Combined loading state - true if ANY query is loading for first time
  const isLoading = results.some(r => r.isLoading);
  
  // All queries have data (may be stale)
  const isReady = results.every(r => r.data !== undefined);

  return {
    etablissements: etablissementsQuery.data,
    taches: tachesQuery.data,
    lastEmailByEtablissement: lastEmailQuery.data as Map<string, string> | undefined,
    overview: overviewQuery.data,
    isLoading,
    isReady,
    // Individual loading states for granular UI
    isLoadingEtablissements: etablissementsQuery.isLoading,
    isLoadingTaches: tachesQuery.isLoading,
    isLoadingLastEmail: lastEmailQuery.isLoading,
    isLoadingOverview: overviewQuery.isLoading,
    // Errors
    errors: results.filter(r => r.error).map(r => r.error),
  };
}
