import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { subMonths, startOfMonth, endOfMonth, format } from "date-fns";
import { debug } from "@/lib/debug";

export interface NPSStats {
  // Score NPS moyen (0-10)
  npsScore: number;
  // Évolution vs période précédente (%)
  evolution: number;
  // Nombre de répondants total (formation + solution)
  totalRepondants: number;
  // Breakdown par catégorie NPS
  promoteurs: number; // 9-10
  passifs: number; // 7-8
  detracteurs: number; // 0-6
  // NPS calculé (-100 à +100)
  npsCalculated: number;
  // Données par mois pour graphique
  monthlyData: Array<{
    mois: string;
    nps: number;
    repondants: number;
  }>;
}

const EMPTY_STATS: NPSStats = {
  npsScore: 0,
  evolution: 0,
  totalRepondants: 0,
  promoteurs: 0,
  passifs: 0,
  detracteurs: 0,
  npsCalculated: 0,
  monthlyData: [],
};

/**
 * Agrège le NPS depuis deux sources :
 *   - `enquetes_satisfaction_formation.note_globale` (0-10, satisfaction formation)
 *   - `enquetes_satisfaction_solution.nps_score` (0-10, NPS produit)
 *
 * Les erreurs partielles (une source KO) sont loggées via `debug.error`
 * et le hook continue avec les données disponibles. Une exception réseau
 * (promesse rejetée) propage et met la query en erreur.
 */
export function useNPSStats() {
  return useQuery({
    queryKey: ["nps-stats"],
    queryFn: async (): Promise<NPSStats> => {
      const now = new Date();
      const sixMonthsAgo = subMonths(now, 6);
      const sinceIso = sixMonthsAgo.toISOString();

      // 1. Formation NPS (note_globale = score 0-10)
      const { data: formationData, error: formationError } = await supabase
        .from("enquetes_satisfaction_formation")
        .select("note_globale, date_reponse")
        .gte("date_reponse", sinceIso)
        .not("note_globale", "is", null);

      if (formationError) {
        debug.error("Error fetching formation NPS:", formationError);
      }

      // 2. Solution NPS (nps_score = 0-10)
      const { data: solutionData, error: solutionError } = await supabase
        .from("enquetes_satisfaction_solution")
        .select("nps_score, date_reponse")
        .gte("date_reponse", sinceIso)
        .not("nps_score", "is", null);

      if (solutionError) {
        debug.error("Error fetching solution NPS:", solutionError);
      }

      // 3. Fusion des scores (source-agnostique)
      const allScores: Array<{ score: number; date: string }> = [];

      const formationRows = (formationData ?? []) as Array<{
        note_globale: number | null;
        date_reponse: string | null;
      }>;
      formationRows.forEach((item) => {
        if (
          item.note_globale !== null &&
          item.note_globale !== undefined &&
          item.date_reponse
        ) {
          allScores.push({ score: Number(item.note_globale), date: item.date_reponse });
        }
      });

      const solutionRows = (solutionData ?? []) as Array<{
        nps_score: number | null;
        date_reponse: string | null;
      }>;
      solutionRows.forEach((item) => {
        if (
          item.nps_score !== null &&
          item.nps_score !== undefined &&
          item.date_reponse
        ) {
          allScores.push({ score: Number(item.nps_score), date: item.date_reponse });
        }
      });


      if (allScores.length === 0) {
        return EMPTY_STATS;
      }

      // 4. Métriques globales
      const totalRepondants = allScores.length;
      const npsScore =
        allScores.reduce((sum, s) => sum + s.score, 0) / totalRepondants;

      const promoteurs = allScores.filter((s) => s.score >= 9).length;
      const passifs = allScores.filter((s) => s.score >= 7 && s.score < 9).length;
      const detracteurs = allScores.filter((s) => s.score < 7).length;

      const npsCalculated = Math.round(
        (promoteurs / totalRepondants - detracteurs / totalRepondants) * 100,
      );

      // 5. Évolution mois courant vs mois précédent
      const currentMonthStart = startOfMonth(now);
      const previousMonthStart = startOfMonth(subMonths(now, 1));
      const previousMonthEnd = endOfMonth(subMonths(now, 1));

      const currentMonthScores = allScores.filter(
        (s) => new Date(s.date) >= currentMonthStart,
      );
      const previousMonthScores = allScores.filter((s) => {
        const d = new Date(s.date);
        return d >= previousMonthStart && d <= previousMonthEnd;
      });

      const currentAvg =
        currentMonthScores.length > 0
          ? currentMonthScores.reduce((sum, s) => sum + s.score, 0) /
            currentMonthScores.length
          : npsScore;
      const previousAvg =
        previousMonthScores.length > 0
          ? previousMonthScores.reduce((sum, s) => sum + s.score, 0) /
            previousMonthScores.length
          : npsScore;

      const evolution =
        previousAvg > 0 ? ((currentAvg - previousAvg) / previousAvg) * 100 : 0;

      // 6. Série mensuelle (6 derniers mois)
      const monthlyMap = new Map<string, { total: number; count: number }>();
      for (let i = 5; i >= 0; i--) {
        const key = format(subMonths(now, i), "yyyy-MM");
        monthlyMap.set(key, { total: 0, count: 0 });
      }
      allScores.forEach((s) => {
        const key = format(new Date(s.date), "yyyy-MM");
        const bucket = monthlyMap.get(key);
        if (bucket) {
          bucket.total += s.score;
          bucket.count += 1;
        }
      });
      const monthlyData = Array.from(monthlyMap.entries()).map(([mois, data]) => ({
        mois: format(new Date(mois + "-01"), "MMM yyyy"),
        nps: data.count > 0 ? Math.round((data.total / data.count) * 10) / 10 : 0,
        repondants: data.count,
      }));

      return {
        npsScore: Math.round(npsScore * 10) / 10,
        evolution: Math.round(evolution * 10) / 10,
        totalRepondants,
        promoteurs,
        passifs,
        detracteurs,
        npsCalculated,
        monthlyData,
      };
    },
    staleTime: 5 * 60 * 1000,
  });
}
