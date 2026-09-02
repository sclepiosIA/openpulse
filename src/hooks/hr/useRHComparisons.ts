import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { subMonths, format, startOfMonth, endOfMonth } from "date-fns";
import { fr } from "date-fns/locale";

export interface RHComparison {
  periode: string;
  masseSalariale: number;
  effectif: number;
  coutMoyen: number;
}

export interface RHComparisonResult {
  current: RHComparison;
  previous: RHComparison;
  delta: {
    masseSalariale: { value: number; percentage: number };
    effectif: { value: number; percentage: number };
    coutMoyen: { value: number; percentage: number };
  };
}

export function useRHComparisons(type: 'month' | 'quarter' | 'year' = 'month') {
  return useQuery({
    queryKey: ['rh-comparisons', type],
    staleTime: 60000, // 1 minute
    queryFn: async () => {
      const now = new Date();
      let currentStart: Date;
      let currentEnd: Date;
      let previousStart: Date;
      let previousEnd: Date;

      if (type === 'month') {
        currentStart = startOfMonth(now);
        currentEnd = endOfMonth(now);
        previousStart = startOfMonth(subMonths(now, 1));
        previousEnd = endOfMonth(subMonths(now, 1));
      } else if (type === 'quarter') {
        const currentQuarter = Math.floor(now.getMonth() / 3);
        currentStart = new Date(now.getFullYear(), currentQuarter * 3, 1);
        currentEnd = endOfMonth(new Date(now.getFullYear(), currentQuarter * 3 + 2, 1));
        previousStart = subMonths(currentStart, 3);
        previousEnd = subMonths(currentEnd, 3);
      } else {
        // year
        currentStart = new Date(now.getFullYear(), 0, 1);
        currentEnd = new Date(now.getFullYear(), 11, 31);
        previousStart = new Date(now.getFullYear() - 1, 0, 1);
        previousEnd = new Date(now.getFullYear() - 1, 11, 31);
      }

      // Récupérer les données de la période actuelle
      const { data: currentData, error: currentError } = await supabase
        .from('rh_salaires_mensuels')
        .select(`
          *,
          profiles:profile_id (id, prenom, nom)
        `)
        .gte('mois', format(currentStart, 'yyyy-MM-dd'))
        .lte('mois', format(currentEnd, 'yyyy-MM-dd'));

      if (currentError) throw currentError;

      // Récupérer les données de la période précédente
      const { data: previousData, error: previousError } = await supabase
        .from('rh_salaires_mensuels')
        .select(`
          *,
          profiles:profile_id (id, prenom, nom)
        `)
        .gte('mois', format(previousStart, 'yyyy-MM-dd'))
        .lte('mois', format(previousEnd, 'yyyy-MM-dd'));

      if (previousError) throw previousError;

      // Calculer les KPIs pour la période actuelle
      const currentMasse = (currentData || []).reduce(
        (sum, s) => sum + s.salaire_brut + (s.cotisations_patronales || 0),
        0
      );
      const currentEffectifs = new Set((currentData || []).map(s => s.profile_id)).size;
      const currentCoutMoyen = currentEffectifs > 0 ? currentMasse / currentEffectifs : 0;

      // Calculer les KPIs pour la période précédente
      const previousMasse = (previousData || []).reduce(
        (sum, s) => sum + s.salaire_brut + (s.cotisations_patronales || 0),
        0
      );
      const previousEffectifs = new Set((previousData || []).map(s => s.profile_id)).size;
      const previousCoutMoyen = previousEffectifs > 0 ? previousMasse / previousEffectifs : 0;

      // Calculer les deltas
      const masseDelta = currentMasse - previousMasse;
      const massePercentage = previousMasse > 0 ? (masseDelta / previousMasse) * 100 : 0;

      const effectifDelta = currentEffectifs - previousEffectifs;
      const effectifPercentage = previousEffectifs > 0 ? (effectifDelta / previousEffectifs) * 100 : 0;

      const coutMoyenDelta = currentCoutMoyen - previousCoutMoyen;
      const coutMoyenPercentage = previousCoutMoyen > 0 ? (coutMoyenDelta / previousCoutMoyen) * 100 : 0;

      const result: RHComparisonResult = {
        current: {
          periode: format(currentStart, 'MMM yyyy', { locale: fr }),
          masseSalariale: currentMasse,
          effectif: currentEffectifs,
          coutMoyen: currentCoutMoyen,
        },
        previous: {
          periode: format(previousStart, 'MMM yyyy', { locale: fr }),
          masseSalariale: previousMasse,
          effectif: previousEffectifs,
          coutMoyen: previousCoutMoyen,
        },
        delta: {
          masseSalariale: { value: masseDelta, percentage: massePercentage },
          effectif: { value: effectifDelta, percentage: effectifPercentage },
          coutMoyen: { value: coutMoyenDelta, percentage: coutMoyenPercentage },
        },
      };

      return result;
    },
  });
}