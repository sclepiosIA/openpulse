import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

import { subMonths, format, differenceInMonths } from "date-fns";

interface SalaireRow {
  profile_id: string;
  mois: string;
  salaire_brut: number;
  cotisations_salariales?: number | null;
  cotisations_patronales?: number | null;
  primes?: number | null;
  heures_supplementaires?: number | null;
  profiles?: { nom?: string | null; prenom?: string | null } | null;
}

interface ProfileRow {
  id: string;
  date_embauche?: string | null;
  type_contrat?: string | null;
  actif?: boolean | null;
  nom?: string | null;
  prenom?: string | null;
}

export interface RHAnalyticsData {
  evolutionMensuelle: {
    mois: string;
    masseSalariale: number;
    effectif: number;
    coutMoyen: number;
  }[];
  repartitionContrats: {
    type: string;
    count: number;
    pourcentage: number;
  }[];
  ancienneteMoyenne: number;
  turnover12Mois: {
    entrees: number;
    sorties: number;
    tauxTurnover: number;
  };
  chargesDetail: {
    totalSalaireBrut: number;
    totalCotisationsSalariales: number;
    totalCotisationsPatronales: number;
    totalPrimes: number;
    totalHeuresSupplementaires: number;
  };
  top3Couts: {
    profile_id: string;
    nom: string;
    prenom: string;
    coutTotal: number;
  }[];
}

export function useRHAnalytics(months: number = 12) {
  return useQuery({
    queryKey: ['rh-analytics', months],
    staleTime: 60000, // 1 minute
    queryFn: async () => {
      // 1. Récupérer tous les salaires des N derniers mois
      const endDate = new Date();
      const startDate = subMonths(endDate, months);
      const startDateStr = format(startDate, 'yyyy-MM-dd');

      const { data: salaires, error: salairesError } = await supabase
        .from('rh_salaires_mensuels')
        .select(`
          *,
          profiles:profile_id (
            id,
            prenom,
            nom,
            email,
            date_embauche,
            type_contrat,
            actif
          )
        `)
        .gte('mois', startDateStr)
        .order('mois', { ascending: true });

      if (salairesError) throw salairesError;

      // 2. Récupérer tous les profils pour les analyses
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, date_embauche, type_contrat, actif, nom, prenom')
        .limit(500);

      if (profilesError) throw profilesError;

      // 3. Calculer l'évolution mensuelle
      const evolutionMap: Record<string, { masse: number; effectif: Set<string> }> = {};
      
      ((salaires || []) as SalaireRow[]).forEach((salaire) => {
        const moisKey = salaire.mois.slice(0, 7); // YYYY-MM
        if (!evolutionMap[moisKey]) {
          evolutionMap[moisKey] = { masse: 0, effectif: new Set() };
        }
        evolutionMap[moisKey].masse += salaire.salaire_brut + (salaire.cotisations_patronales || 0);
        evolutionMap[moisKey].effectif.add(salaire.profile_id);
      });

      const evolutionMensuelle = Object.entries(evolutionMap)
        .map(([mois, data]) => ({
          mois,
          masseSalariale: data.masse,
          effectif: data.effectif.size,
          coutMoyen: data.effectif.size > 0 ? data.masse / data.effectif.size : 0,
        }))
        .sort((a, b) => a.mois.localeCompare(b.mois))
        .slice(-months);

      // 4. Répartition par type de contrat
      const contratsMap: Record<string, number> = {};
      ((profiles || []) as ProfileRow[]).forEach((p) => {
        const type = p.type_contrat || 'non_specifie';
        contratsMap[type] = (contratsMap[type] || 0) + 1;
      });

      const totalProfiles = profiles?.length || 0;
      const repartitionContrats = Object.entries(contratsMap).map(([type, count]) => ({
        type: type === 'cdi' ? 'CDI' : type === 'cdd' ? 'CDD' : type === 'stage' ? 'Stage' : type === 'alternance' ? 'Alternance' : 'Non spécifié',
        count,
        pourcentage: totalProfiles > 0 ? (count / totalProfiles) * 100 : 0,
      }));

      // 5. Ancienneté moyenne
      const now = new Date();
      const anciennetes = ((profiles || []) as ProfileRow[])
        .filter((p) => p.date_embauche && p.actif)
        .map((p) => differenceInMonths(now, new Date(p.date_embauche!)));
      
      const ancienneteMoyenne = anciennetes.length > 0 
        ? anciennetes.reduce((sum, a) => sum + a, 0) / anciennetes.length 
        : 0;

      // 6. Turnover sur 12 mois
      const oneYearAgo = subMonths(now, 12);
      const entrees = ((profiles || []) as ProfileRow[]).filter((p) =>
        p.date_embauche && new Date(p.date_embauche) >= oneYearAgo
      ).length;
      
      const sorties = ((profiles || []) as ProfileRow[]).filter((p) => !p.actif).length;
      
      const effectifMoyen = totalProfiles > 0 ? totalProfiles : 1;
      const tauxTurnover = ((entrees + sorties) / effectifMoyen) * 100;

      // 7. Détail des charges (mois le plus récent)
      const moisRecent = evolutionMensuelle[evolutionMensuelle.length - 1]?.mois;
      const salairesRecent = ((salaires || []) as SalaireRow[]).filter((s) => s.mois.startsWith(moisRecent));
      
      const chargesDetail = {
        totalSalaireBrut: salairesRecent.reduce((sum, s) => sum + s.salaire_brut, 0),
        totalCotisationsSalariales: salairesRecent.reduce((sum, s) => sum + (s.cotisations_salariales || 0), 0),
        totalCotisationsPatronales: salairesRecent.reduce((sum, s) => sum + (s.cotisations_patronales || 0), 0),
        totalPrimes: salairesRecent.reduce((sum, s) => sum + (s.primes || 0), 0),
        totalHeuresSupplementaires: salairesRecent.reduce((sum, s) => sum + (s.heures_supplementaires || 0), 0),
      };

      // 8. Top 3 des coûts
      const coutsParProfile: Record<string, { nom: string; prenom: string; cout: number }> = {};
      salairesRecent.forEach((s) => {
        const profile = s.profiles;
        if (profile) {
          const key = s.profile_id;
          if (!coutsParProfile[key]) {
            coutsParProfile[key] = { 
              nom: profile.nom ?? '', 
              prenom: profile.prenom ?? '', 
              cout: 0 
            };
          }
          coutsParProfile[key].cout += s.salaire_brut + (s.cotisations_patronales || 0);
        }
      });

      const top3Couts = Object.entries(coutsParProfile)
        .map(([profile_id, data]) => ({
          profile_id,
          nom: data.nom,
          prenom: data.prenom,
          coutTotal: data.cout,
        }))
        .sort((a, b) => b.coutTotal - a.coutTotal)
        .slice(0, 3);

      return {
        evolutionMensuelle,
        repartitionContrats,
        ancienneteMoyenne,
        turnover12Mois: {
          entrees,
          sorties,
          tauxTurnover,
        },
        chargesDetail,
        top3Couts,
      } as RHAnalyticsData;
    },
  });
}