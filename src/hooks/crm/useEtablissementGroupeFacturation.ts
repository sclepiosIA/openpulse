import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { debug } from '@/lib/debug';

export interface GroupeFacturationData {
  groupe_id: string;
  groupe_nom: string;
  type_offre: string | null;
  periodicite_paiement: string | null;
  pallier_vise: string | null;
  modele_statique_succes: string | null;
  tarifs_palliers: Record<string, number> | null;
  paiement_initial: number | null;
  email_facturation: string | null;
  adresse_facturation: string | null;
  siret_facturation: string | null;
  conditions_paiement_defaut: string | null;
  mode_paiement_prefere: string | null;
  vecteur_achat: string | null;
  etablissements_en_facturation_groupe: number;
}

interface GroupeRelation {
  groupe_id: string;
  groupes_etablissements: {
    id: string;
    nom: string;
    type_offre: string | null;
    periodicite_paiement: string | null;
    pallier_vise: string | null;
    modele_statique_succes: string | null;
    tarifs_palliers: Record<string, number> | null;
    paiement_initial: number | null;
    email_facturation: string | null;
    adresse_facturation: string | null;
    siret_facturation: string | null;
    conditions_paiement_defaut: string | null;
    mode_paiement_prefere: string | null;
    vecteur_achat: string | null;
  } | null;
}

/**
 * Hook pour récupérer le groupe_id d'un établissement
 * Utilisé pour partager le cache entre établissements du même groupe
 */
export function useEtablissementGroupeId(etablissementId?: string) {
  return useQuery({
    queryKey: ['etablissement-groupe-id', etablissementId],
    queryFn: async (): Promise<string | null> => {
      if (!etablissementId) return null;

      const { data, error } = await supabase
        .from('etablissements_groupes')
        .select('groupe_id')
        .eq('etablissement_id', etablissementId)
        .is('date_sortie', null)
        .maybeSingle();

      if (error) {
        debug.error('[useEtablissementGroupeId] Error:', error);
        return null;
      }

      return data?.groupe_id || null;
    },
    enabled: !!etablissementId,
    staleTime: 5 * 60 * 1000, // 5 minutes - le groupe change rarement
  });
}

/**
 * Hook pour récupérer les données de facturation d'un groupe
 * Utilise le groupe_id comme clé de cache pour partager entre établissements
 */
export function useGroupeFacturationData(groupeId?: string | null) {
  return useQuery({
    queryKey: ['groupe-facturation', groupeId],
    queryFn: async (): Promise<GroupeFacturationData | null> => {
      if (!groupeId) return null;

      // 1. Récupérer les données du groupe
      const { data: groupe, error: groupeError } = await supabase
        .from('groupes_etablissements')
        .select(`
          id,
          nom,
          type_offre,
          periodicite_paiement,
          pallier_vise,
          modele_statique_succes,
          tarifs_palliers,
          paiement_initial,
          email_facturation,
          adresse_facturation,
          siret_facturation,
          conditions_paiement_defaut,
          mode_paiement_prefere,
          vecteur_achat
        `)
        .eq('id', groupeId)
        .maybeSingle();

      if (groupeError) {
        debug.error('[useGroupeFacturationData] Error fetching groupe:', groupeError);
        return null;
      }

      if (!groupe) return null;

      // 2. Récupérer tous les établissements du groupe
      const { data: etabIds } = await supabase
        .from('etablissements_groupes')
        .select('etablissement_id')
        .eq('groupe_id', groupeId)
        .is('date_sortie', null);

      let etablissementsCount = 0;

      if (etabIds && etabIds.length > 0) {
        // 3. Compter combien sont en "facturation groupe"
        const { count } = await supabase
          .from('etablissements')
          .select('id', { count: 'exact', head: true })
          .eq('client_facturation', 'groupe')
          .in('id', etabIds.map(e => e.etablissement_id));
        
        etablissementsCount = count || 0;
      }

      return {
        groupe_id: groupe.id,
        groupe_nom: groupe.nom,
        type_offre: groupe.type_offre,
        periodicite_paiement: groupe.periodicite_paiement,
        pallier_vise: groupe.pallier_vise,
        modele_statique_succes: groupe.modele_statique_succes,
        tarifs_palliers: groupe.tarifs_palliers as Record<string, number> | null,
        paiement_initial: groupe.paiement_initial,
        email_facturation: groupe.email_facturation,
        adresse_facturation: groupe.adresse_facturation,
        siret_facturation: groupe.siret_facturation,
        conditions_paiement_defaut: groupe.conditions_paiement_defaut,
        mode_paiement_prefere: groupe.mode_paiement_prefere,
        vecteur_achat: groupe.vecteur_achat,
        etablissements_en_facturation_groupe: etablissementsCount,
      };
    },
    enabled: !!groupeId,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

/**
 * Hook combiné pour récupérer les données de facturation du groupe d'un établissement
 * Optimisé pour partager le cache entre tous les établissements du même groupe
 */
export function useEtablissementGroupeFacturation(etablissementId?: string, enabled = false) {
  // Étape 1: Récupérer le groupe_id
  const { data: groupeId, isLoading: isLoadingGroupeId } = useEtablissementGroupeId(
    enabled ? etablissementId : undefined
  );

  // Étape 2: Récupérer les données du groupe (utilise groupe_id comme clé de cache)
  const { data: groupeData, isLoading: isLoadingGroupeData, refetch } = useGroupeFacturationData(
    enabled ? groupeId : undefined
  );

  return {
    data: groupeData,
    isLoading: isLoadingGroupeId || isLoadingGroupeData,
    groupeId,
    refetch,
  };
}

/**
 * Hook pour sauvegarder la configuration de facturation du groupe
 * Vérifie que la mise à jour a réellement eu lieu (détection RLS silencieux)
 */
export function useSaveGroupeFacturation() {
  const queryClient = useQueryClient();

  const saveGroupeFacturation = async (
    groupeId: string,
    data: Partial<Omit<GroupeFacturationData, 'groupe_id' | 'groupe_nom' | 'etablissements_en_facturation_groupe'>>
  ) => {
    // Utiliser .select().maybeSingle() pour vérifier que la mise à jour a eu lieu (détection RLS silencieux)
    const { data: updatedData, error } = await supabase
      .from('groupes_etablissements')
      .update({
        type_offre: data.type_offre,
        periodicite_paiement: data.periodicite_paiement,
        pallier_vise: data.pallier_vise,
        modele_statique_succes: data.modele_statique_succes,
        tarifs_palliers: data.tarifs_palliers,
        paiement_initial: data.paiement_initial,
        email_facturation: data.email_facturation,
        adresse_facturation: data.adresse_facturation,
        siret_facturation: data.siret_facturation,
        conditions_paiement_defaut: data.conditions_paiement_defaut,
        mode_paiement_prefere: data.mode_paiement_prefere,
        vecteur_achat: data.vecteur_achat,
      })
      .eq('id', groupeId)
      .select('id')
      .maybeSingle();

    if (error) throw error;

    // Vérifier que la mise à jour a bien eu lieu (détection RLS silencieux)
    if (!updatedData) {
      throw new Error('Échec de la mise à jour : vous n\'avez peut-être pas les permissions nécessaires');
    }

    // Invalider les caches pertinents
    // Cache groupe-facturation avec le groupe_id comme clé
    queryClient.invalidateQueries({ queryKey: ['groupe-facturation', groupeId] });
    // Autres caches
    queryClient.invalidateQueries({ queryKey: ['groupe-etablissements'] });
    queryClient.invalidateQueries({ queryKey: ['etablissement-modele-economique'] });
    queryClient.invalidateQueries({ queryKey: ['facturation-etablissements'] });
  };

  return { saveGroupeFacturation };
}
