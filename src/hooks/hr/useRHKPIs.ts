import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queryPresets } from "@/lib/queryPresets";

export interface RHKPIs {
  masse_salariale_mensuelle: number; // Coût total employeur (brut + cotisations patronales)
  masse_salariale_annuelle: number;
  masse_salariale_nette_mensuelle: number;
  masse_salariale_nette_annuelle: number;
  masse_salariale_brute_mensuelle: number;
  masse_salariale_brute_annuelle: number;
  effectif_total: number;
  effectif_actif: number;
  taux_absenteisme: number;
  cout_moyen_salaire: number;
}

export function useRHKPIs(mois?: string) {
  return useQuery({
    queryKey: ['rh-kpis', mois],
    ...queryPresets.frequent, // 30 seconds - frequently updated data
    refetchOnMount: 'always',
    queryFn: async () => {
      // 1. Récupérer TOUS les salaires pour déterminer le mois le plus récent
      const { data: allSalaires, error: allSalairesError } = await supabase
        .from('rh_salaires_mensuels')
        .select('id, profile_id, mois, salaire_brut, salaire_net, cotisations_patronales')
        .order('mois', { ascending: false });

      if (allSalairesError) throw allSalairesError;

      // 2. Récupérer tous les profils (pour calculer les effectifs même sans salaires)
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, actif');

      if (profilesError) throw profilesError;

      // 3. Déterminer le mois à utiliser et filtrer les salaires
      let targetMonth: string | undefined;
      let salaires: typeof allSalaires = [];
      
      if (allSalaires && allSalaires.length > 0) {
        const latestMonth = allSalaires[0]?.mois;
        targetMonth = mois 
          ? (mois.length === 7 ? mois + '-01' : mois)
          : latestMonth;
        salaires = allSalaires.filter(s => s.mois === targetMonth);
      } else {
        // Pas de salaires, utiliser le mois actuel pour les calculs de date
        const now = new Date();
        targetMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
      }

      // Récupérer les absences du mois
      const startOfMonth = targetMonth;
      const yearMonth = startOfMonth.slice(0, 7);
      const [year, month] = yearMonth.split('-').map(Number);
      const lastDayOfMonth = new Date(year, month, 0).getDate();
      const endOfMonth = `${yearMonth}-${String(lastDayOfMonth).padStart(2, '0')}`;

      const { data: absences, error: absencesError } = await supabase
        .from('rh_absences')
        .select('id, date_debut, date_fin')
        .gte('date_debut', startOfMonth)
        .lte('date_fin', endOfMonth);

      if (absencesError) throw absencesError;

      // Calculs masse salariale (si des salaires existent)
      
      // Net mensuel
      const masseSalarialeNetteMensuelle = salaires?.reduce((sum, s) => sum + s.salaire_net, 0) || 0;
      
      // Brut mensuel
      const masseSalarialeBruteMensuelle = salaires?.reduce((sum, s) => sum + s.salaire_brut, 0) || 0;
      
      // Coût total employeur mensuel (brut + cotisations patronales)
      const masseSalarialeMensuelle = salaires?.reduce((sum, s) => sum + s.salaire_brut + (s.cotisations_patronales || 0), 0) || 0;
      
      // Pour l'annuel, identifier les 12 derniers mois distincts et calculer la somme
      const moisDistincts = [...new Set(allSalaires?.map(s => s.mois) || [])].sort().reverse();
      const last12DistinctMonths = moisDistincts.slice(0, 12);
      const salairesLast12Months = allSalaires?.filter(s => last12DistinctMonths.includes(s.mois)) || [];
      
      const masseSalarialeNetteAnnuelle = salairesLast12Months.reduce((sum, s) => sum + s.salaire_net, 0);
      const masseSalarialeBruteAnnuelle = salairesLast12Months.reduce((sum, s) => sum + s.salaire_brut, 0);
      const masseSalarialeAnnuelle = salairesLast12Months.reduce((sum, s) => sum + s.salaire_brut + (s.cotisations_patronales || 0), 0);
      
      // Effectifs basés sur les profils (indépendamment des salaires)
      const effectifTotal = profiles?.length || 0;
      const effectifActif = profiles?.filter(p => p.actif)?.length || 0;

      // Calcul du taux d'absentéisme (jours d'absence / jours ouvrables)
      const joursOuvrables = 22; // Environ 22 jours ouvrables par mois
      const joursAbsence = absences?.reduce((sum, a) => {
        if (!a.date_debut || !a.date_fin) return sum;
        const debut = new Date(a.date_debut);
        const fin = new Date(a.date_fin);
        const diff = Math.ceil((fin.getTime() - debut.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        return sum + diff;
      }, 0) || 0;
      const tauxAbsenteisme = effectifActif > 0 ? (joursAbsence / (effectifActif * joursOuvrables)) * 100 : 0;

      const coutMoyenSalaire = effectifActif > 0 ? masseSalarialeMensuelle / effectifActif : 0;

      return {
        masse_salariale_mensuelle: masseSalarialeMensuelle,
        masse_salariale_annuelle: masseSalarialeAnnuelle,
        masse_salariale_nette_mensuelle: masseSalarialeNetteMensuelle,
        masse_salariale_nette_annuelle: masseSalarialeNetteAnnuelle,
        masse_salariale_brute_mensuelle: masseSalarialeBruteMensuelle,
        masse_salariale_brute_annuelle: masseSalarialeBruteAnnuelle,
        effectif_total: effectifTotal,
        effectif_actif: effectifActif,
        taux_absenteisme: tauxAbsenteisme,
        cout_moyen_salaire: coutMoyenSalaire,
      } as RHKPIs;
    }
  });
}
