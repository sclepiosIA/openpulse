import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface HealthMetrics {
  satisfaits: number;
  aSurveiller: number;
  aRisque: number;
  totalAvecMetriques: number;
}

export function usePortfolioHealth(productionEtabIds: string[], productionTotal: number) {
  return useQuery({
    queryKey: ["portfolio-health-metrics", productionEtabIds.join(",")],
    queryFn: async (): Promise<HealthMetrics> => {
      if (productionEtabIds.length === 0) {
        return { satisfaits: 0, aSurveiller: 0, aRisque: 0, totalAvecMetriques: 0 };
      }

      const { data: healthData } = await supabase
        .from("customer_health_metrics")
        .select("etablissement_id, health_status, health_score, nps_score")
        .in("etablissement_id", productionEtabIds);

      if (!healthData || healthData.length === 0) {
        const total = productionTotal;
        return {
          satisfaits: Math.round(total * 0.7),
          aSurveiller: Math.round(total * 0.2),
          aRisque: Math.round(total * 0.1),
          totalAvecMetriques: 0,
        };
      }

      let satisfaits = 0;
      let aSurveiller = 0;
      let aRisque = 0;

      healthData.forEach((h) => {
        const status = h.health_status?.toLowerCase();
        const score = h.health_score || 0;
        const nps = h.nps_score || 0;

        if (status === "healthy" || status === "good" || status === "excellent") {
          satisfaits++;
        } else if (status === "warning" || status === "attention" || status === "at_risk") {
          aSurveiller++;
        } else if (status === "critical" || status === "churning" || status === "poor") {
          aRisque++;
        } else {
          if (score >= 70 || nps >= 8) satisfaits++;
          else if (score >= 40 || nps >= 6) aSurveiller++;
          else aRisque++;
        }
      });

      const sansMetriques = productionTotal - healthData.length;
      aSurveiller += Math.floor(sansMetriques * 0.7);
      satisfaits += Math.ceil(sansMetriques * 0.3);

      return { satisfaits, aSurveiller, aRisque, totalAvecMetriques: healthData.length };
    },
    enabled: productionEtabIds.length > 0,
    staleTime: 5 * 60 * 1000,
  });
}
